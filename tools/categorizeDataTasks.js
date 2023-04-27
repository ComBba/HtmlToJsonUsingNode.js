// categorizeDataTasks.js
const { createCompletion } = require('../lib/openaiHelper.js');
const { getNonDuplicateDataTasks } = require('./getNonDuplicateDataTasks.js');
const natural = require('natural');
const tokenizer = new natural.WordTokenizer();

async function categorizeDataTask(dataTasks) {
    const systemContent = "You are a helpful assistant that categorizes data tasks into 20 or fewer categories.";
    const userContent = "Please categorize the following data tasks into one of 20 or fewer categories: ";

    // Tokenize the input text and limit to 3000 tokens
    const tokens = tokenizer.tokenize(dataTasks);
    const limitedTokens = tokens.slice(0, 3000);
    const limitedDataTask = limitedTokens.join(' ');

    try {
        const response = await createCompletion(limitedDataTask, systemContent, userContent);
        const category = response.messageContent;
        return category;
    } catch (error) {
        console.error('Error categorizing dataTask:', error);
        return '';
    }
}

(async function main() {
    try {
        const dataTasks = await getNonDuplicateDataTasks();
        const dataTasksText = dataTasks.map(dataTask => dataTask.text).join(', ');
        const categorizedDataTasks = await categorizeDataTask(dataTasksText);

        console.log('Categorized data tasks:', categorizedDataTasks);
    } catch (error) {
        console.error('Error categorizing data tasks:', error);
    }
})();
