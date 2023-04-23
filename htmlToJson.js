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
      imgSrc: element.find('img').attr('src'),
    };

    result.push(data);
  });

  return result;
}

async function fetchAndConvertHtmlToJson(url, outputFile) {
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
      console.log(`Successfully fetched and converted data from ${url} to ${outputFile}`);
      console.log(`Total converted data objects: ${data.length}`);
    });
  } catch (err) {
    console.error(`Error fetching data from ${url}:`, err);
    process.exit(1);
  }
}

fetchAndConvertHtmlToJson('https://theresanaiforthat.com/', 'output.json');
