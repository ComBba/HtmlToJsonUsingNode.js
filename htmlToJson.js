// |Good parts:
// |- The code uses the popular and widely-used library Cheerio for parsing HTML, which makes it easier to extract data from HTML documents.
// |- The code is modularized into two functions, which makes it easier to read and maintain.
// |- The code uses arrow functions, which are more concise and easier to read than traditional function expressions.
// |- The code uses template literals to interpolate variables into strings, which is more concise and easier to read than concatenating strings with the + operator.
// |- The code uses the JSON.stringify method with the null and 2 arguments to format the JSON output with indentation, which makes it easier to read.
// |
// |Bad parts:
// |- The code does not handle errors in a robust way. If there is an error reading or writing the file, the error message is logged to the console but the program continues to run. It would be better to throw an error or exit the program in these cases.
// |- The code uses nested each loops, which can be inefficient for large datasets. It would be better to use a single loop and filter the elements based on their attributes.
// |- The code uses multiple variables to store the same data, which can be confusing and error-prone. It would be better to use a single object to store all the data for each element.
// |
const cheerio = require('cheerio');
const fs = require('fs');

function extractData($) {
  const result = [];

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
