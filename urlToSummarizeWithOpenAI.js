require('dotenv').config({ path: '.env.local' });
const axios = require('axios');
const cheerio = require('cheerio');
const { Configuration, OpenAIApi } = require('openai');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

//console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

async function getWebsiteContent(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);
        $('script, style, noscript, iframe, img, svg, video').remove();
        return $('body').text().replace(/\s\s+/g, ' ').trim();
    } catch (error) {
        console.error(`Error fetching content from ${url}:`, error);
    }
}

function preprocessText(text) {
    const tokens = tokenizer.tokenize(text);
    return tokens.join(' ');
}

async function createCompletion(text) {
    try {
        const response = await openai.createCompletion({
            model: "text-davinci-003",
            prompt: "Please summarize the following text:\n\n".concat(text, "\n\nSummary:"),
            max_tokens: 1000,
            temperature: 0,
            n: 1,
            stop: null,
        });
        //console.log('response:', response);
        //console.log('response.data.choices:', response.data.choices);
        if (response.data.choices && response.data.choices.length > 0) {
            return {
                summary: response.data.choices[0].text.trim(),
                prompt_tokens: response.data.usage.prompt_tokens,
                completion_tokens: response.data.usage.completion_tokens,
                total_tokens: response.data.usage.total_tokens,
            };
        } else {
            console.error('No choices returned by OpenAI API');
            return {
                summary: '',
                total_tokens: 0,
            };
        }

        ```
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
        ```
    } catch (error) {
        console.error('Error using OpenAI API:', error);
        return {
            summary: '',
            total_tokens: 0,
        };
    }
}

async function main() {
    const url = 'https://userpersona.dev/'; // 웹 사이트 주소를 입력하세요
    const content = await getWebsiteContent(url);
    /*
    const preprocessedContent = preprocessText(content);
    console.log('Preprocessed content:');
    console.log(preprocessedContent);
    */
    console.log('Content:');
    console.log(content);
    const result = await createCompletion(content);
    console.log('요약된 내용:');
    console.log(result.summary);
    console.log('프롬프트 토큰 수:', result.prompt_tokens);
    console.log('컴플리션 토큰 수:', result.completion_tokens);
    console.log('사용된 토큰 수:', result.total_tokens);
}

main();
