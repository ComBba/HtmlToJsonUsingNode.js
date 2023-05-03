//webToJson.js
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const puppeteer = require('puppeteer');
const sharp = require('sharp');

const { getWebsiteContent, createUrlToSummarizeCompletion } = require('./lib/urlToSummarizeWithOpenAI.js');
const { checkIfExistsInMongoDB, insertIntoMongoDB } = require('./lib/connectMongo.js');
const { createCompletion } = require('./lib/openaiHelper.js');
const { sleep, randomInRange, msToTime, convertToTimestamp, removeDots, shuffle } = require('./tools/utils');
const { fetchFaviconAsBase64 } = require('./lib/getFavicon.js');

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

function isValidFormatForCategory(response) {
  const regex = /^\d:\s[\w\s]+,\s\d:\s[\w\s]+,\s\d:\s[\w\s]+(\.|$)/;
  return regex.test(response);
}

async function generateValidCompletion(inputText, systemContent, userContent, temperature = 0.2) {
  if (temperature > 1.5) {
    temperature = 0.0;
  }
  const response = await createCompletion(inputText, systemContent, userContent, temperature + 0.1);
  console.log("[generateValidCompletion] temperature : ", temperature);
  if (isValidFormatForCategory(response.messageContent)) {
    return response;
  } else {
    console.log("[CategoryValidation][XXXXX] :", response.messageContent, "\n", "[inputText]", inputText);
    await sleep(2000); // 2초 딜레이를 추가합니다.
    return await generateValidCompletion(inputText, systemContent, userContent, temperature + 0.1);
  }
}

async function categorizeDataTask(dataTask, useCaseText, summary) {
  const systemContent = "You are a helpful assistant that categorizes data.";
  //const userContent = "Do not assume absolutely, but for a given data task, rank the top 3 categories in the following list only and respond in the format '1: {category_name_1}, 2: {category_name_2}, 3: {category_name_3}':Speeches, Images, Data Analysis, Videos, NLP, Chatbots, Frameworks, Education, Health, Financial Services, Logistics, Gaming, Human Resources, CRM, Contents Creation, Automation, Cybersecurity, Social Media, Environment, Smart Cities\n";
  const userContent = "Strictly and without exception, for a given data task, you must select and rank the top 3 categories exclusively from the following list. Provide your response in the format '1: {category_name_1}, 2: {category_name_2}, 3: {category_name_3}': Speeches, Images, Data Analysis, Videos, NLP, Chatbots, Frameworks, Education, Health, Financial Services, Logistics, Gaming, Human Resources, CRM, Contents Creation, Automation, Cybersecurity, Social Media, Environment, Smart Cities:\n"
  const inputText = `Task:${dataTask}\nuseCaseText:${useCaseText}\nsummary:${summary}`;
  try {
    const response = await generateValidCompletion(inputText, systemContent, userContent);
    const category = removeDots(response.messageContent);
    return category;
  } catch (error) {
    console.error('Error categorizing dataTask:', error);
    return '';
  }
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
      const categoryWithPrefix = await categorizeDataTask(dataTask, useCaseText, summary.summary);
      console.log("[categoryWithPrefix]", categoryWithPrefix);
      const Category1st = categoryWithPrefix.split(', ')[0].split(': ')[1];
      const Category2nd = categoryWithPrefix.split(', ')[1].split(': ')[1];
      const Category3rd = categoryWithPrefix.split(', ')[2].split(': ')[1];
      console.log("[Category1st]", Category1st, "\n", "[Category2nd]", Category2nd, "\n", "[Category3rd]", Category3rd);
      const category = "".concat(Category1st, ".", Category2nd, ".", Category3rd);
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
