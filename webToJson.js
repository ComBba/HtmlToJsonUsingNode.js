const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const { getWebsiteContent, createCompletion } = require('./urlToSummarizeWithOpenAI.js');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function fetchAndSummarize(url) {
  const content = await getWebsiteContent(url);
  const summaryResult = await createCompletion(content);

  return summaryResult.summary;
}

var idxData = 1;
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
      imgSrc: el.find('img').attr('src'),
      summary: summary,
    };
    result.push(data);
    console.log("idxData: ", idxData++);
    if (idxData > 10)
      break;
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
    });
  } catch (err) {
    console.error(`Error fetching data from ${url}:`, err);
    process.exit(1);
  }
}

fetchAndConvertHtmlToJson('https://theresanaiforthat.com/', 'output.json');