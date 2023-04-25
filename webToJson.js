const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const puppeteer = require('puppeteer');

const { getWebsiteContent, createCompletion } = require('./lib/urlToSummarizeWithOpenAI.js');
const MongoClient = require('mongodb').MongoClient;

const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

async function saveToMongoDB(data) {
  const uri = process.env.MONGODB_CONNECTION_URI; // Replace with your MongoDB connection URI
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();
    const collection = client.db(process.env.MONGODB_DATABASE_NAME).collection(process.env.MONGODB_COLLECTION_NAME);
    const filter = { dataId: data.dataId }; // Filter using the unique dataId
    const update = { $set: data };
    const options = { upsert: true }; // Enable upsert

    const result = await collection.updateOne(filter, update, options);
    if (result.upsertedId) {
      console.log(`Data inserted with ID: ${result.upsertedId._id}`);
    } else {
      console.log(`Data updated with ID: ${data.dataId}`);
    }
  } catch (err) {
    console.error('Error saving data to MongoDB:', err);
  } finally {
    await client.close();
  }
}

let browser, page;

async function init() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      //`--proxy-server=${torProxy}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  /*
  browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', headless: true });
  */
  page = await browser.newPage();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function fetchAndSummarize(url) {
  let content;
  if (url.includes("apps.apple.com")) {
    content = await getWebsiteContent(url);
  } else {
    content = await fetchSiteContent(url);
  }

  const summaryResult = await createCompletion(content.contents);
  return { summary: summaryResult.summary, screenShot: content.imageData };
}

// limit for test 
// var idxData = 1;
async function extractData($) {
  const result = [];
  const elements = $('div.tasks > li').toArray();

  for (const element of elements) {
    await sleep(randomInRange(1000, 2000)); // 1초 대기
    const el = $(element);
    const summary = await fetchAndSummarize(el.attr('data-url'));
    const data = {
      dataId: el.attr('data-id'),
      dataName: el.attr('data-name'),
      dataTask: el.attr('data-task'),
      dataUrl: el.attr('data-url'),
      dataTaskSlug: el.attr('data-task_slug'),
      aiLinkHref: el.find('a.ai_link.new_tab.c_event').attr('href'),
      useCaseText: el.find('a.use_case').text().trim(),
      aiLaunchDateText: el.find('a.ai_launch_date').text().trim(),
      imgSrc: el.find('img').attr('src').replace(/\?height=207/, ''),
      summary: summary.summary,
      screenShot: summary.screenShot,
    };
    if (result.length < 20) {
      result.push(data);
    }
    saveToMongoDB(data);
    // limit for test 
    //console.log("idxData: ", idxData++);
    //if (idxData > 2) break;
  }

  return result;
}

function msToTime(duration) {
  const milliseconds = parseInt((duration % 1000));
  const seconds = parseInt((duration / 1000) % 60);
  const minutes = parseInt((duration / (1000 * 60)) % 60);
  const hours = parseInt((duration / (1000 * 60 * 60)) % 24);

  return `${hours}시간 ${minutes}분 ${seconds}초 ${milliseconds}ms`;
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
    await page.goto(url, { waitUntil: 'networkidle2' });
    await page.waitForTimeout(5000); // 3초 대기

    const screenshotBuffer = await page.screenshot();

    const content = await page.evaluate(() => {
      const paragraphs = Array.from(document.querySelectorAll('p'));
      const title = document.querySelector('title')?.innerText;
      const description = document.querySelector('meta[name="description"]')?.content;
      const keywords = document.querySelector('meta[name="keywords"]')?.content;

      const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
      const ogDescription = document.querySelector('meta[property="og:description"]')?.content;
      const ogImage = document.querySelector('meta[property="og:image"]')?.content;

      const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.content;
      const twitterDescription = document.querySelector('meta[name="twitter:description"]')?.content;
      const twitterImage = document.querySelector('meta[name="twitter:image"]')?.content;
      const pMap = paragraphs.map(p => p.innerText).join('\n');
      const contents = "".concat(title, description, keywords, ogTitle, ogDescription, ogImage, twitterTitle, twitterDescription, twitterImage, pMap,)

      console.log('title:', title);
      console.log('content:', contents);
      return contents;
    });

    return {
      contents: content,
      imageData: screenshotBuffer.toString('base64'),
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
