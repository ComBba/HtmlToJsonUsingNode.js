require('dotenv').config({ path: '.env.local' });
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function createCompletion(text) {
    const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: "Say this is a test",
        max_tokens: 7,
        temperature: 0,
    });
    if (response.choices && response.choices.length > 0) {
        return {
            summary: response.choices[0].text.trim(),
            prompt_tokens: response.usage.prompt_tokens,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
        };
    } else {
        console.error('No choices returned by OpenAI API');
        return {
            summary: '',
            total_tokens: 0,
        };
    }
}


async function main() {
    const result = await createCompletion("Say this is a test");
    console.log(result.summary);
    console.log('프롬프트 토큰 수:', result.prompt_tokens);
    console.log('컴플리션 토큰 수:', result.completion_tokens);
    console.log('사용된 토큰 수:', result.total_tokens);
}

main();
