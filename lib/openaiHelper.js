// lib/openaiHelper.js
const path = require('path');
const dotenv = require('dotenv');
const { Configuration, OpenAIApi } = require('openai');
const { sleep, removeDots } = require('../tools/utils.js');

const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

// Set up OpenAI API configuration
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

// Create OpenAI API instance
const openai = new OpenAIApi(configuration);

let cntRetry = 0;
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
            console.log('[OpenAI API] Prompt tokens:', response.data.usage.prompt_tokens);
            console.log('[OpenAI API] Completion tokens:', response.data.usage.completion_tokens);
            console.log('[OpenAI API] Total tokens used:', response.data.usage.total_tokens);
            console.log('[OpenAI API] Estimated cost:', ((response.data.usage.total_tokens / 1000) * 0.002).toFixed(8), 'USD'); // 토큰당 비용인 $0.002를 사용하여 비용 추정
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
            for (cntTimeout = 60; cntTimeout > 0; cntTimeout--) {
                await sleep(1 * 1000); // 30초 대기
                console.log(cntTimeout, "초... 대기중...");
            }

        } else {
            for (cntTimeout = 10; cntTimeout > 0; cntTimeout--) {
                await sleep(1 * 1000); // 30초 대기
                console.log(cntTimeout, "초...  대기중...");
            }
        }
        if (cntRetry > 10) {
            cntRetry = 0;
            return {
                messageContent: '',
            };
        }
        cntRetry += 1;
        return await createCompletion(text, systemContent, userContent, temperature);
    }
}

async function categorizeDataTask(dataTask, useCaseText, summary) {
    const systemContent = "You are a helpful assistant that categorizes data.";
    let excludedCategories = [];
    let isValid = false;
    let attemptCount = 0;
    let response;
    let categoryScores;
    let temperature = 0.4;
    const userContent = `Absolutely select the top 5 from the list below in order of highest relevance to the provided data Task, useCaseText, summary, and Assign a suitability score from 0 to 100 for each category, with 100 being the most suitable and 0 being the least suitable. respond in the format of '1:{category_name_1:suitability score}, 2:{category_name_2:suitability score}, 3:{category_name_3:suitability score}, 4:{category_name_4:suitability score}, 5:{category_name_5:suitability score}'.\n
    A list of valid categories: 'Speeches', 'Images', 'Data Analysis', 'Videos', 'NLP', 'Chatbots', 'Frameworks', 'Education', 'Health', 'Financial Services', 'Logistics', 'Gaming', 'Human Resources', 'CRM', 'Contents Creation', 'Automation', 'Cybersecurity', 'Social Media', 'Environment', 'Smart Cities'\n"Excluded categories" are not valid categories and should never be included in a response.\n`;
    while (!isValid) {
        if (temperature > 0.9 || temperature < 0.1) {
            temperature = 0.1;
            excludedCategories = [];
        }
        attemptCount += 1;
        const inputText = `Task:${dataTask}\nuseCaseText:${useCaseText}\nsummary:${summary}\nCategories to be excluded:${excludedCategories.join(', ')}`;

        console.log('\n[OpenAI API] Categorize Data');
        response = await createCompletion(inputText, systemContent, userContent, temperature);
        if (response && response.messageContent && response.messageContent.length > 10) {
            console.log('[messageContent]', response.messageContent);
            if (!isCompletion(response.messageContent)) {
                temperature += 0.1;
                console.log('[Attempt][\x1b[31mregex Fail\x1b[0m] count:', attemptCount, '\ntemperature:', temperature);
                await sleep(1000);
                continue;
            }
            categoryScores = response.messageContent.split(', ').map(c => {
                const [number, category, score] = c.split(':');
                return { category: removeDots(category), score: parseFloat(score) };
            });
            console.log('[categoryScores]', categoryScores);
            isValid = categoryScores.every(item => isValidCategory(item.category));
            const isValidNumber = categoryScores.slice(0, 3).every(item => isValidScore(item.score));

            if (!isValid) {
                excludedCategories = excludedCategories.concat(
                    categoryScores
                        .filter(c => !isValidCategory(c.category) && c.category.length >= 2) // 길이가 2 이상인 경우에만 필터링합니다.
                        .map(c => c.category) // 각 요소에서 'category' 프로퍼티만 추출합니다.
                );
                console.log('[Attempt][Invalid] count:', attemptCount, '\ntemperature:', temperature, '\ncategoryScores:', categoryScores, '\nExcluded categories:', excludedCategories);
                temperature += 0.1;
                await sleep(1000);
            } else if (!isValidNumber) {
                isValid = false;
                console.log('[Attempt][InvalidNumber] count:', attemptCount, '\ntemperature:', temperature, '\ncategoryScores:', categoryScores, '\nExcluded categories:', excludedCategories);
                temperature -= 0.1;
                await sleep(1000);
            } else if (categoryScores.length != 5) {
                isValid = false;
                console.log('[Attempt][InvalidCategoryScoresCount] categoryScores.length:', categoryScores.length, '\n count:', attemptCount, '\ntemperature:', temperature, '\ncategoryScores:', categoryScores, '\nExcluded categories:', excludedCategories);
                await sleep(1000);
            } else {
                console.log('[Attempt][Success] count:', attemptCount);
            }
        } else {
            console.log('[OpenAI][ERROR] return response.messageContent is empty');
        }
    }
    return categoryScores;
}


function isValidCategory(category) {
    const validCategories = [
        'Speeches', 'Images', 'Data Analysis', 'Videos', 'NLP', 'Chatbots', 'Frameworks', 'Education', 'Health', 'Financial Services',
        'Logistics', 'Gaming', 'Human Resources', 'CRM', 'Contents Creation', 'Automation', 'Cybersecurity', 'Social Media',
        'Environment', 'Smart Cities'
    ];
    return validCategories.includes(category);
}

function isValidScore(score) {
    if (score == null || score == undefined || score == NaN || score.length == 0)
        return false;
    return score > 10 && score <= 100;
}

function isCompletion(text) {
    const regex = /^1: ?([A-Za-z ]+): ?[0-9]{1,3}(, (\d: ?([A-Za-z ]+): ?[0-9]{1,3})){4}$/;
    return regex.test(text);
}

module.exports = {
    createCompletion,
    categorizeDataTask,
};
