const cheerio = require('cheerio');
const fs = require('fs');

function extractData($) {
  const result = [];

  $('div#data_hist > div > div > h2 > span').each(function () {
    const category = $(this).text().trim();

    $('div.tasks > li').each(function () {
      const dataId = $(this).attr('data-id');
      const dataName = $(this).attr('data-name');
      const dataTask = $(this).attr('data-task');
      const dataUrl = $(this).attr('data-url');
      const dataTaskSlug = $(this).attr('data-task_slug');

      const aiLinkHref = $(this).find('a.ai_link.new_tab.c_event').attr('href');
      const useCaseText = $(this).find('a.use_case').text().trim();
      const aiLaunchDateText = $(this).find('a.ai_launch_date').text().trim();
      const imgSrc = $(this).find('img').attr('src');

      result.push({
        category,
        dataId,
        dataName,
        dataTask,
        dataUrl,
        dataTaskSlug,
        aiLinkHref,
        useCaseText,
        aiLaunchDateText,
        imgSrc,
      });
    });
  });

  return result;
}

function convertHtmlFileToJson(inputFile, outputFile) {
  fs.readFile(inputFile, 'utf8', (err, html) => {
    if (err) {
      console.error(`Error reading file ${inputFile}:`, err);
      return;
    }

    const $ = cheerio.load(html);
    const data = extractData($);

    fs.writeFile(outputFile, JSON.stringify(data, null, 2), (err) => {
      if (err) {
        console.error(`Error writing file ${outputFile}:`, err);
        return;
      }
      console.log(`Successfully converted ${inputFile} to ${outputFile}`);
    });
  });
}

convertHtmlFileToJson('input.html', 'output.json');
