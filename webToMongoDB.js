//webToJson.js
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const { getWebsiteContent, createUrlToSummarizeCompletion } = require('./lib/urlToSummarizeWithOpenAI.js');
const { checkIfExistsInMongoDB, insertIntoMongoDB } = require('./lib/connectMongo.js');
const { createCompletion } = require('./lib/openaiHelper.js');
const { sleep, randomInRange, msToTime, convertToTimestamp, removeDots, shuffle } = require('./tools/utils.js');
const { fetchFaviconAsBase64 } = require('./lib/getFavicon.js');

const { removeStopwords, eng, kor } = require('stopword');
const { get } = require('http');

const VIEWPORT_WIDTH = 915;
const VIEWPORT_HEIGHT = 750;

let browser, page;

async function init() {
  browser = await puppeteer.launch({ headless: "new" });
  page = await browser.newPage();
  // Set User-Agent to Chrome on PC
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36');
  // 페이지 뷰포트 크기 설정
  await page.setViewport({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
}

async function fetchAndSummarize(url) {
  const content = await fetchSiteContent(url);
  if (content.contents?.length > 0) {
    const summaryResult = await createUrlToSummarizeCompletion(content.contents);
    return { summary: summaryResult.summary, screenShot: content.imageData, favicon: content.faviconData };
  } else {
    return { summary: "", screenShot: "" };
  }
}

function isValidCategory(category) {
  const validCategories = [
    'Speeches', 'Images', 'Data Analysis', 'Videos', 'NLP', 'Chatbots', 'Frameworks', 'Education', 'Health', 'Financial Services',
    'Logistics', 'Gaming', 'Human Resources', 'CRM', 'Contents Creation', 'Automation', 'Cybersecurity', 'Social Media',
    'Environment', 'Smart Cities'
  ];
  return validCategories.includes(category);
}

async function categorizeDataTask(dataTask, useCaseText, summary) {
  const systemContent = "You are a helpful assistant that categorizes data.";
  let excludedCategories = [];
  let isValid = false;
  let attemptCount = 0;
  let response;
  let categories;
  let temperature = 0.5;
  while (!isValid) {
    if (temperature > 1.2 || temperature < 0.2) {
      temperature = 0.2;
      excludedCategories = [];
    }
    attemptCount += 1;
    const userContent = `For a given data task, please strictly select and rank the top 3 categories from the list below, and provide your response in the format '1: {category_name_1}, 2: {category_name_2}, 3: {category_name_3}'. The list of valid categories is: Speeches, Images, Data Analysis, Videos, NLP, Chatbots, Frameworks, Education, Health, Financial Services, Logistics, Gaming, Human Resources, CRM, Contents Creation, Automation, Cybersecurity, Social Media, Environment, Smart Cities. Note: "AI" is not a valid category and should not be included in the response.\n`;
    const inputText = `Task:${dataTask}\nuseCaseText:${useCaseText}\nsummary:${summary}\nCategories to be excluded:${excludedCategories.join(', ')}`;

    response = await createCompletion(inputText, systemContent, userContent, temperature);
    categories = response.messageContent.split(', ').map(c => {
      const category = c.split(': ')[1];
      return removeDots(category);
    });
    isValid = categories.every(isValidCategory);

    if (!isValid) {
      excludedCategories = excludedCategories.concat(categories.filter(c => !isValidCategory(c)));
      console.log('[Attempt][Invalid] count:', attemptCount, '\ntemperature:', temperature, '\ncategories:', categories, '\nExcluded categories:', excludedCategories);
      temperature += 0.1;
      sleep(2000);
    } else {
      console.log('[Attempt][Success] count:', attemptCount);
    }
  }// categories 배열을 쉼표로 구분하여 리턴
  return categories.join('.');
}

function get_categorysl(Category1st, Category2nd, Category3rd) {
  return [
    Category1st.toLowerCase(),
    Category2nd.toLowerCase(),
    Category3rd.toLowerCase()
  ];
}
function get_search_keywords(dataName, dataTask, dataTaskSlug, summary, useCaseText, categorysl) {
  return [
    dataName.toLowerCase().trim(),
    dataTask.toLowerCase().trim(),
    dataTaskSlug.toLowerCase().trim(),
    summary.toLowerCase().trim(),
    useCaseText.toLowerCase().trim(),
    categorysl.join(' ').trim()
  ];
}
// 중복단어들을 제거한, 불용어들을 제외한 검색어 리턴, 영문,한글 지원, text index search에 사용예정
function get_search_keywords_filtered(search_keywords_filtered) {
  search_keywords_filtered = removeStopwords(search_keywords_filtered.split(' '), eng).join(' ');
  search_keywords_filtered = removeStopwords(search_keywords_filtered.split(' '), kor).join(' ');
  search_keywords_filtered = search_keywords_filtered.replace(/[.,;:]/g, ''); // Remove special characters
  search_keywords_filtered = search_keywords_filtered.replace(/[\n\r]/g, ' '); // Remove newline and carriage return characters
  search_keywords_filtered = search_keywords_filtered.replace(/<[^>]*>/g, ''); // Remove HTML tags
  search_keywords_filtered = [...new Set(search_keywords_filtered.split(' '))].join(' ');// Remove duplicates using Set
  return search_keywords_filtered;
}

async function extractData($) {
  const result = [];
  const elements = $('div.tasks > li').toArray();
  const shuffledElements = shuffle(elements);
  for (const element of shuffledElements) {
    const el = $(element);
    const dataId = el.attr('data-id');
    const dataName = el.attr('data-name');
    const dataUrl = el.attr('data-url');

    // Check if dataId already exists in MongoDB
    const exists = await checkIfExistsInMongoDB(dataId);
    if (exists) {
      // Skip this element if the dataId already exists in the database
      console.log(`[Skip][Exists] dataId ${dataId} : ${dataName}`);
      continue;
    }

    await sleep(randomInRange(1000, 2000)); // 1~2초 대기

    const summary = await fetchAndSummarize(dataUrl);

    if (summary.summary && summary.summary.length > 0) {
      const dataTask = el.attr('data-task');
      const useCaseText = el.find('a.use_case').text().trim();
      const category = await categorizeDataTask(dataTask, useCaseText, summary.summary);
      const [Category1st, Category2nd, Category3rd] = category.split('.');
      console.log("[category]", category, "\n", "[Category1st]", Category1st, "\n", "[Category2nd]", Category2nd, "\n", "[Category3rd]", Category3rd);
      const categorysl = get_categorysl(Category1st, Category2nd, Category3rd);
      const search_keywords = get_search_keywords(dataName, dataTask, el.attr('data-task_slug'), summary.summary, useCaseText, categorysl);
      const search_keywordsl = search_keywords.join(' ');
      const search_keywords_filtered = get_search_keywords_filtered(search_keywordsl);
      const data = {
        dataId: dataId,
        dataName: dataName,
        dataTask: dataTask,
        dataUrl: dataUrl,
        dataTaskSlug: el.attr('data-task_slug'),
        aiLinkHref: el.find('a.ai_link.new_tab.c_event').attr('href'),
        useCaseText: useCaseText,
        aiLaunchDateText: el.find('a.ai_launch_date').text().trim(),
        aiLaunchDateTimestamp: convertToTimestamp(el.find('a.ai_launch_date').text().trim()), // TimeStamp로 추가
        imgSrc: el.find('img').attr('src').replace(/\?height=207/, ''),
        summary: summary.summary,
        screenShot: summary.screenShot,
        category: category,
        Category1st: Category1st,
        Category2nd: Category2nd,
        Category3rd: Category3rd,
        favicon: summary.favicon,
        categorys: [
          Category1st,
          Category2nd,
          Category3rd
        ],
        categorysl: categorysl,
        search_keywordsl: search_keywordsl,
        search_keywords_filtered: search_keywords_filtered,
      };
      if (result.length < 20) {
        result.push(data);
      }
      insertIntoMongoDB(data);
    }
  }
  return result;
}

async function fetchAndConvertHtmlToJson(url, outputFile) {
  const startTime = new Date();
  console.log(`프로그램 시작 시간: ${startTime.toISOString()} (${startTime.getTime()}ms)`);

  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    const data = await extractData($);

    fs.writeFile(outputFile, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.error(`Error writing file ${outputFile}:`, err);
        process.exit(1);
      }
      const endTime = new Date();
      console.log(`프로그램 종료 시간: ${endTime.toISOString()} (${endTime.getTime()}ms)`);
      const elapsedTime = endTime.getTime() - startTime.getTime();
      console.log(`작동하는 데 소요된 시간: ${msToTime(elapsedTime)}`);
      console.log(`Successfully fetched and converted data from ${url} to ${outputFile}`);
      console.log(`Total converted data objects: ${data.length}`);
      return;
    });
  } catch (err) {
    console.error(`Error fetching data from ${url}:`, err);
    process.exit(1);
  }
}

async function fetchSiteContent(url) {
  try {
    console.log("\n[fetchSiteContent] url:", url);
    const response = await page.goto(url, { waitUntil: 'networkidle2' });
    console.log("5초 대기 중.....")
    await page.waitForTimeout(5000); // 5초 대기

    if (response?.status() === 404 || response?.status() === 500) {
      console.error(`Error: ${response.status()} occurred while fetching the content from ${url}`);
      return '';
    }

    const screenshotBuffer = await page.screenshot({
      clip: {
        x: 0,
        y: 0,
        width: 915,
        height: 750,
      },
    });

    // 압축하고 JPEG 형식으로 변환
    const compressedBuffer = await sharp(screenshotBuffer)
      .jpeg({ quality: 70 }) // JPEG 품질 설정, 0-100 (낮은 값일수록 더 많이 압축됩니다)
      .toBuffer();
    console.log('[compressedBuffer]', screenshotBuffer.length, '=>', compressedBuffer.length);

    const faviconData = await fetchFaviconAsBase64(url);// Use fetchFaviconAsBase64 function here
    if (faviconData) {
      console.log(`[\x1b[32mOK\x1b[0m][DOCU] Updated favicon for ${url}`);
    } else {
      console.log(`[Fail][DOCU] Could not fetch favicon for ${url}`);
    }
    const content = await page.evaluate((url) => {
      const paragraphs = Array.from(document.querySelectorAll('p'));
      const title = document.querySelector('title')?.innerText;
      const description = document.querySelector('meta[name="description"]')?.content;
      const keywords = document.querySelector('meta[name="keywords"]')?.content;

      const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
      const ogDescription = document.querySelector('meta[property="og:description"]')?.content;

      const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.content;
      const twitterDescription = document.querySelector('meta[name="twitter:description"]')?.content;
      let body;
      if (url.includes("apps.apple.com")) {
        //const specificContents = $("body > div.ember-view > main > div.animation-wrapper.is-visible > section:nth-child(4) > div")?.text().replace(/\s\s+/g, ' ').trim();
        body = document.querySelector("body > div.ember-view > main > div.animation-wrapper.is-visible > section:nth-child(4) > div > div > div")?.content;
      } else {
        body = paragraphs.map(p => p.innerText).join('\n');
      }
      const contents = "".concat(title, description, keywords, ogTitle, ogDescription, twitterTitle, twitterDescription, body)
      console.log('title:', title);
      console.log('content:', contents);
      return contents;
    }, url);

    return {
      contents: content,
      imageData: compressedBuffer.toString('base64'),
      faviconData: faviconData,
    };
  } catch (error) {
    console.error('Error fetching site content:', error);
    return '';
  }
}

async function closeBrowser() {
  await page.goto('about:blank');
  await browser.close();
}

(async () => {
  await init();
  await fetchAndConvertHtmlToJson('https://theresanaiforthat.com/', './data/output.json');
  await closeBrowser();
})();
