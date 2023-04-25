// Import necessary packages
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const axios = require('axios');
const cheerio = require('cheerio');
const { Configuration, OpenAIApi } = require('openai');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

//console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);

// Set up OpenAI API configuration
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

// Create OpenAI API instance
const openai = new OpenAIApi(configuration);

// Function to fetch website content
async function getWebsiteContent(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        // Remove unnecessary elements from the HTML
        $('script, style, noscript, iframe, img, svg, video').remove();
        // Extract meta description and text from the HTML
        const metaDescription = $('meta[name="description"]').attr('content');
        const titleText = $('head title').text();
        console.log('\nURL: ', url);
        console.log('title:', titleText);

        const contents = "".concat(titleText, "/n", metaDescription, "/n", $('body').text().replace(/\s\s+/g, ' ').trim());
        console.log('content:', contents);
        const imageData = "";
        return { contents, imageData };
    } catch (error) {
        console.error(`Error fetching content from ${url}:`, error);
    }
}

// Function to preprocess text
function preprocessText(text) {
    const tokens = tokenizer.tokenize(text);
    return tokens.join(' ');
}

// Function to create text completion using OpenAI API
async function createCompletion(text) {
    try {
        const response = await openai.createCompletion({
            model: "text-davinci-003",
            // Set up prompt for the API request
            prompt: "Please provide a condensed version of the following website content's text, removing copyright information, contact details, and unrelated external website links while making it more concise:\n\n".concat(text),
            temperature: 0.5,
            max_tokens: 1024,
            top_p: 1.0,
            n: 1,
            stop: "None",
            frequency_penalty: 0.5,
            presence_penalty: 0.5,
        });
        if (response.data.choices && response.data.choices.length > 0) {
            // Return summary and usage statistics


            console.log('Summarized content:');
            console.log(response.data.choices[0].text.trim());
            console.log('Prompt tokens:', response.data.usage.prompt_tokens);
            console.log('Completion tokens:', response.data.usage.completion_tokens);
            console.log('Total tokens used:', response.data.usage.total_tokens);
            return {
                summary: response.data.choices[0].text.trim(),
            };
        } else {
            console.error('No choices returned by OpenAI API');
            return {
                summary: '',
            };
        }

        /*
        Example response data from OpenAI API:
        {
            "id": "cmpl-uqkvlQyYK7bGYrRHQ0eXlWi7",
            "object": "text_completion",
            "created": 1589478378,
            "model": "text-davinci-003",
            "choices": [
              {
                "text": "\n\nThis is indeed a test",
                "index": 0,
                "logprobs": null,
                "finish_reason": "length"
              }
            ],
            "usage": {
              "prompt_tokens": 5,
              "completion_tokens": 7,
              "total_tokens": 12
            }
          }
        */
    } catch (error) {
        console.error('Error using OpenAI API:', error.response);
        return {
            summary: '',
        };
    }
}

/* Example usage:
    async function main() {
        const url = 'https://howtowrite.io/'; // Enter website URL here
        const content = await getWebsiteContent(url);
        console.log('Content:');
        console.log(content);
        const result = await createCompletion(content);
        console.log('Summarized content:');
        console.log('URL: ', url);
        console.log(result.summary);
    }

    main();
*/

module.exports = {
    getWebsiteContent,
    createCompletion
};