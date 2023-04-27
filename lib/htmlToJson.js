const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');

function extractData($) {
  const result = [];

  $('div.tasks > li').each(function () {
    const element = $(this);
    const data = {
      dataId: element.attr('data-id'),
      dataName: element.attr('data-name'),
      dataTask: element.attr('data-task'),
      dataUrl: element.attr('data-url'),
      dataTaskSlug: element.attr('data-task_slug'),
      aiLinkHref: element.find('a.ai_link.new_tab.c_event').attr('href'),
      useCaseText: element.find('a.use_case').text().trim(),
      aiLaunchDateText: element.find('a.ai_launch_date').text().trim(),
      aiLaunchDateTimestamp: convertToTimestamp(el.find('a.ai_launch_date').text().trim()), // TimeStamp로 추가
      imgSrc: element.find('img').attr('src'),
    };

    result.push(data);
  });

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
    const data = extractData($);

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
