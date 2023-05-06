// openaiHelper.js
const path = require('path');
const dotenv = require('dotenv');
const { Configuration, OpenAIApi } = require('openai');

const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

// Set up OpenAI API configuration
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

// Create OpenAI API instance
const openai = new OpenAIApi(configuration);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to create text completion using OpenAI API
async function createCompletion(text, systemContent, userContent, temperature = 0.2) {
    try {
        const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: systemContent,
                },
                {
                    role: "user",
                    content: userContent.concat(text),
                },
            ],
            temperature: temperature,
            max_tokens: 3000,
            //top_p: 1.0,
            //n: 1,
            //stop: "None",
            //frequency_penalty: 0.5,
            //presence_penalty: 0.5,
        });
        if (response && response.data && response.data.choices && response.data.choices.length > 0) {
            console.log("response.data.choices[0].logprobs.top_logprobs[0]:", response.data.choices[0].logprobs.top_logprobs[0]);
            return {
                messageContent: response.data.choices[0].message.content.trim(),
            };
        } else {
            console.error('No choices returned by OpenAI API');
            return {
                messageContent: '',
            };
        }
    } catch (error) {
        console.error('Error using OpenAI API:', error.response == undefined ? error : error.response);
        if (error.response?.status == 429) {
            await sleep(30 * 1000); // 30초 대기
        } else {
            await sleep(30 * 1000); // 30초 대기
        }
        return {
            messageContent: '',
        };
    }
}

module.exports = {
    createCompletion,
};
