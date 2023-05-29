// webToMongoDB.js
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const util = require('util');

const { isValidUrl, get_categorysl, get_search_keywords, get_search_keywords_filtered } = require('./lib/forWebToMongoDB.js');
const { createUrlToSummarizeCompletion } = require('./lib/urlToSummarizeWithOpenAI.js');
const { checkIfExistsInMongoDB, insertIntoMongoDB } = require('./lib/connectMongo.js');
const { categorizeDataTask } = require('./lib/openaiHelper.js');
const { sleep, randomInRange, msToTime, convertToTimestamp, removeDots, shuffle } = require('./tools/utils.js');
const { fetchFaviconAsBase64 } = require('./lib/getFavicon.js');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const stat = util.promisify(fs.stat);

const VIEWPORT_WIDTH = 1200;
const VIEWPORT_HEIGHT = 800;
const BrowserHEADER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'

let browser;

async function init() {
  try {
    if (browser && typeof browser.version === 'function') {
      const ver = await browser.version(); // this will throw if the browser is not usable
      console.log(`Browser version: ${ver}`);
    } else {
      browser = await puppeteer.launch({
        headless: false, // Start the browser in non-headless mode
        args: ['--lang=en-US,en'] // Set the browser language to English
      });
    }
  } catch (err) {
    console.error(`An error occurred while initializing the browser: ${err}`);
    browser = await puppeteer.launch({
      headless: false, // Start the browser in non-headless mode
      args: ['--lang=en-US,en'] // Set the browser language to English
    });
  }
}

async function extractData($) {
  const result = [];
  const shuffledElements = $('div.tasks > li').toArray();
  //const elements = $('div.tasks > li').toArray();
  //const shuffledElements = shuffle(elements);
  try {
    for (let i = 0; i < shuffledElements.length; i++) {
      const element = shuffledElements[i];
      const el = $(element);
      const dataId = el.attr('data-id');
      const dataName = el.attr('data-name');
      let dataUrl = el.attr('data-url');
      let validUrl = isValidUrl(dataUrl);
      //console.log("[validUrl]", validUrl);
      if (!validUrl) {
        // URL이 유효하지 않으면 https를 추가해서 다시 시도
        validUrl = isValidUrl('https://' + dataUrl);
        if (!validUrl) {
          // https로도 실패하면 http를 추가해서 다시 시도
          validUrl = isValidUrl('http://' + dataUrl);
        } else {
          dataUrl = 'https://' + dataUrl;
        }
      }
      if (validUrl) {
        // Check if dataId already exists in MongoDB
        const exists = await checkIfExistsInMongoDB(dataId);
        if (exists) {
          // Skip this element if the dataId already exists in the database
          console.log("[", i + 1, "/", shuffledElements.length, "][Skip][Exists]", "[dataId]", dataId, "[dataName]", dataName, "[dataUrl]", dataUrl);
          continue;
        } else {
          console.log("[", i + 1, "/", shuffledElements.length, "][Start]", "[dataId]", dataId, "[dataName]", dataName, "[dataUrl]", dataUrl);
        }

        await sleep(randomInRange(1000, 2000)); // 1~2초 대기

        const summary = await fetchAndSummarize(dataUrl);

        if (summary.summary && summary.summary.length > 0) {
          const dataTask = el.attr('data-task');
          const useCaseText = el.find('a.use_case').text().trim();
          const categoryScores = await categorizeDataTask(dataTask, useCaseText, summary);
          const category = categoryScores.map(item => item.category).join('.');
          const [Category1st, Category2nd, Category3rd] = category.split('.');
          //console.log("[category]", category, "\n", "[Category1st]", Category1st, "\n", "[Category2nd]", Category2nd, "\n", "[Category3rd]", Category3rd);
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
            Category4th: categoryScores[3].category,
            Category4thScore: categoryScores[3].score,
            Category5th: categoryScores[4].category,
            Category5thScore: categoryScores[4].score,
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
      } else {
        console.error('Invalid URL:', dataUrl);
      }
    }
  } catch (error) {
    console.log('[Error in extractData]', error);
  }
  return result;
}

async function fetchAndConvertHtmlToJson(url, outputFile) {
  const startTime = new Date();
  console.log(`프로그램 시작 시간: ${startTime.toISOString()} (${startTime.getTime()}ms)`);
  try {
    let html;

    // Puppeteer를 이용해서 웹페이지에 접속하고 HTML 데이터를 가져오는 코드
    await init();
    const cachePath = path.join(__dirname, 'data', 'cache_'.concat(encodeURIComponent(url)));
    console.log('[cachePath]', cachePath);
    // Check if the file exists
    if (!fs.existsSync(cachePath)) {
      fs.writeFileSync(cachePath, '', 'utf8');
    }

    try {
      const stats = await stat(cachePath);
      // Check if cache is still valid and file size is greater than or equal to 1MB
      if (stats.size >= 1024 * 1024 && (Date.now() - stats.mtime.getTime()) < 6 * 60 * 60 * 1000) { // 1 hour = 60 minutes * 60 seconds * 1000 milliseconds
        // Calculate the difference between the current time and the file modification time
        const diffInSeconds = (Date.now() - stats.mtime.getTime()) / 1000;

        // Convert the difference to hours, minutes, and seconds
        const diffHours = Math.floor(diffInSeconds / 3600);
        const diffMinutes = Math.floor((diffInSeconds % 3600) / 60);
        const diffSeconds = Math.floor(diffInSeconds % 60);

        // Calculate the file size in KB or MB
        let fileSize = stats.size / 1024; // KB
        let fileSizeUnit = 'KB';
        if (fileSize > 1024) {
          fileSize = fileSize / 1024; // MB
          fileSizeUnit = 'MB';
        }

        console.log(`[Cache is still valid] Time: \x1b[32m${diffHours}:${diffMinutes}:${diffSeconds}\x1b[0m ago\n[Cache is still valid] Size: \x1b[32m${fileSize.toFixed(2)} ${fileSizeUnit}\x1b[0m`);
        html = await readFile(cachePath);
      } else {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
        html = await page.content();
        await page.close();
        await writeFile(cachePath, html);
      }
    } catch (error) {
      // File doesn't exist or is expired
    }
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

async function fetchAndSummarize(url) {
  const content = await fetchSiteContent(url);
  if (content.contents?.length > 0) {
    const summaryResult = await createUrlToSummarizeCompletion(content.contents);
    return { summary: summaryResult.summary, screenShot: content.imageData, favicon: content.faviconData };
  } else {
    return { summary: "", screenShot: "", favicon: "" };
  }
}

async function fetchSiteContent(url) {
  await init();
  const page = await browser.newPage();
  page.on('dialog', async (dialog) => {
    console.log('[Accept Dialog]', `Dialog message: ${dialog.message()}`);
    await dialog.accept();
  });

  try {
    console.log("\n[fetchSiteContent] url:", url);
    await page.setUserAgent(BrowserHEADER); // Set User-Agent to Chrome on PC
    await page.setViewport({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }); // 페이지 뷰포트 크기 설정
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en'
    });

    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    //const headers = response.headers();
    //console.log('Content-Length:', headers['content-length']);
    for (i = 10; i > 0; i--) {
      if (response && response.status() >= 500) {
        console.error(`Error: ${response.status()} occurred while fetching the content from ${url}`);
        return '';
      } else if (response && response.status() >= 400) {
        const html = (await page.content()).toLowerCase();

        if (html.includes('403') ||
          html.includes('404') ||
          html.includes('not found') ||
          html.includes('error') ||
          html.includes('could not') ||
          html.includes('없습니다') ||
          html.includes('unavailable')
        ) {
          console.error(`Error: ${response.status()} occurred while fetching the content from ${url}`);
          return '';
        }
      }
      await page.waitForTimeout(1 * 1000); // 1초 대기
      console.log(i, "초...");
    }

    const screenshotBuffer = await page.screenshot({
      clip: {
        x: 0,
        y: 0,
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
      },
    });

    // 압축하고 JPEG 형식으로 변환
    const compressedBuffer = await sharp(screenshotBuffer)
      .jpeg({ quality: 70 }) // JPEG 품질 설정, 0-100 (낮은 값일수록 더 많이 압축됩니다)
      .toBuffer();
    console.log('[compressedBuffer]', screenshotBuffer.length, '=>', compressedBuffer.length);

    const faviconData = await fetchFaviconAsBase64(url, page);// Use fetchFaviconAsBase64 function here
    //console.log('[faviconData]', faviconData);

    if (faviconData) {
      console.log(`[\x1b[32mOK\x1b[0m][DOCU] Updated favicon for ${url}`);
    } else {
      console.log(`[\x1b[31mFail\x1b[0m][DOCU] Could not fetch favicon for ${url}`);
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
  } finally {
    await page.goto('about:blank');
    await page.close();
  }
}

(async () => {
  await init();
  await fetchAndConvertHtmlToJson('https://theresanaiforthat.com/', './data/output.json');
  await browser.close();
})();
