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

function isValidScore(score) {
  if (score == null || score == undefined || score == NaN || score.length == 0)
    return false;
  return score > 10 && score <= 100;
}

function isCompletion(text) {
  const regex = /^1:(Speeches|Images|Data Analysis|Videos|NLP|Chatbots|Frameworks|Education|Health|Financial Services|Logistics|Gaming|Human Resources|CRM|Contents Creation|Automation|Cybersecurity|Social Media|Environment|Smart Cities):[0-9]{1,3}(, (\d:(Speeches|Images|Data Analysis|Videos|NLP|Chatbots|Frameworks|Education|Health|Financial Services|Logistics|Gaming|Human Resources|CRM|Contents Creation|Automation|Cybersecurity|Social Media|Environment|Smart Cities):[0-9]{1,3})){4}$/;

  return regex.test(text);
}

async function categorizeDataTask(dataTask, useCaseText, summary) {
  const systemContent = "You are a helpful assistant that categorizes data.";
  let excludedCategories = [];
  let isValid = false;
  let attemptCount = 0;
  let response;
  let categoryScores;
  let temperature = 0.4;
  while (!isValid) {
    if (temperature > 0.9 || temperature < 0.1) {
      temperature = 0.1;
      excludedCategories = [];
    }
    attemptCount += 1;
    //const userContent = `Please select the top 3 from the list below in order of highest relevance to the provided data Task, useCaseText, summary, and respond in the format of '1: {category_name_1: suitability score}, 2: {category_name_2: suitability score}, 3: {category_name_3: suitability score}'. Assign a suitability score from 0 to 100 for each category, with 100 being the most suitable and 0 being the least suitable.\n
    const userContent = `Absolutely select the top 5 from the list below in order of highest relevance to the provided data Task, useCaseText, summary, and Assign a suitability score from 0 to 100 for each category, with 100 being the most suitable and 0 being the least suitable. respond in the format of '1:{category_name_1:suitability score}, 2:{category_name_2:suitability score}, 3:{category_name_3:suitability score}, 4:{category_name_4:suitability score}, 5:{category_name_5:suitability score}'.\n
      A list of valid categories: 'Speeches', 'Images', 'Data Analysis', 'Videos', 'NLP', 'Chatbots', 'Frameworks', 'Education', 'Health', 'Financial Services', 'Logistics', 'Gaming', 'Human Resources', 'CRM', 'Contents Creation', 'Automation', 'Cybersecurity', 'Social Media', 'Environment', 'Smart Cities'\n"Excluded categories" are not valid categories and should never be included in a response.\n`;
    const inputText = `Task:${dataTask}\nuseCaseText:${useCaseText}\nsummary:${summary}\nCategories to be excluded:${excludedCategories.join(', ')}`;

    response = await createCompletion(inputText, systemContent, userContent, temperature);
    if (response && response.messageContent && response.messageContent.length > 10) {
      console.log('[messageContent]', response.messageContent);
      if (!isCompletion(response.messageContent)) {
        temperature += 0.1;
        sleep(1000);
        continue;
      }
      //1:Contents Creation:95, 2: Chatbots:90, 3: NLP:85
      //1:{category_name_1:suitability score}, 2:{category_name_2:suitability score}, 3:{category_name_3:suitability score}
      categoryScores = response.messageContent.split(', ').map(c => {
        //console.log('[c]', c);
        const [number, category, score] = c.split(':');
        //console.log('[number]', number, '[category]', category, '[score]', score);
        return { category: removeDots(category), score: parseFloat(score) };
      });
      console.log('[categoryScores]', categoryScores);
      isValid = categoryScores.every(item => isValidCategory(item.category));
      const isValidNumber = categoryScores.slice(0, 3).every(item => isValidScore(item.score));

      if (!isValid) {
        excludedCategories = excludedCategories.concat(
          categoryScores
            .filter(c => !isValidCategory(c.category) && c.category.length >= 2) // 길이가 2 이상인 경우에만 필터링합니다.
            .map(c => c.category) // 각 요소에서 'category' 프로퍼티만 추출합니다.
        );
        console.log('[Attempt][Invalid] count:', attemptCount, '\ntemperature:', temperature, '\ncategoryScores:', categoryScores, '\nExcluded categories:', excludedCategories);
        temperature += 0.1;
        sleep(1000);
      } else if (!isValidNumber) {
        isValid = false;
        console.log('[Attempt][InvalidNumber] count:', attemptCount, '\ntemperature:', temperature, '\ncategoryScores:', categoryScores, '\nExcluded categories:', excludedCategories);
        temperature -= 0.1;
        sleep(1000);
      } else if (categoryScores.length != 5) {
        isValid = false;
        console.log('[Attempt][InvalidCategoryScoresCount] categoryScores.length:', categoryScores.length, '\n count:', attemptCount, '\ntemperature:', temperature, '\ncategoryScores:', categoryScores, '\nExcluded categories:', excludedCategories);
        sleep(1000);
      } else {
        console.log('[Attempt][Success] count:', attemptCount);
      }
    } else {
      console.log('[OpenAI][ERROR] return response.messageContent is empty');
    }
  }
  return categoryScores;
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
      const categoryScores = await categorizeDataTask(dataTask, useCaseText, summary);
      const category = categoryScores.map(item => item.category).join('.');
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
        Category1st: categoryScores[0].category,
        Category1stScore: categoryScores[0].score,
        Category2nd: categoryScores[1].category,
        Category2ndScore: categoryScores[1].score,
        Category3rd: categoryScores[2].category,
        Category3rdScore: categoryScores[2].score,
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
