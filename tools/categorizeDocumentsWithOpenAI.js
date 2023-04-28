// categorizeDocumentsWithOpenAI.js
const { createCompletion } = require('../lib/openaiHelper.js');
const { MongoClient } = require('mongodb');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const uri = process.env.MONGODB_CONNECTION_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function categorizeDataTask(dataTask, useCaseText, summary) {
    const systemContent = "You are a helpful assistant that categorizes data.";
    const userContent = "Please rank the top 3 categories from the following list for the given data task and respond in the format '1: {category_name_1}, 2: {category_name_2}, 3: {category_name_3}': Speeches, Images, Data Analysis, Videos, NLP, Chatbots, Frameworks, Education, Health, Financial Services, Logistics, Gaming, Human Resources, CRM, Contents Creation, Automation, Cybersecurity, Social Media, Environment, Smart Cities: ";

    const inputText = `${dataTask} ${useCaseText} ${summary}`;

    try {
        const response = await createCompletion(inputText, systemContent, userContent);
        const category = response.messageContent;
        return category;
    } catch (error) {
        console.error('Error categorizing dataTask:', error);
        return '';
    }
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        try {
            await callback(array[index], index, array);
        } catch (error) {
            console.error(`Error processing item at index ${index}:`, error);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 지연
    }
}

(async function main() {
    try {
        console.log('Categorizing data tasks started...');
        await client.connect();
        console.log('client.connect()...');
        const db = client.db(process.env.MONGODB_DATABASE_NAME);
        const collection = db.collection(process.env.MONGODB_COLLECTION_NAME);

        const documents = await collection.find({ category: { $exists: false } }).toArray();
        console.log(`Found ${documents.length} documents to categorize.`);
        await asyncForEach(documents, async (doc, index, array) => {
            const { _id, dataId, dataName, dataTask, useCaseText, summary } = doc;

            const categoryWithPrefix = await categorizeDataTask(dataTask, useCaseText, summary);
            console.log("[categoryWithPrefix]", categoryWithPrefix)
            const category = categoryWithPrefix.split(': ')[1];

            if (category) {
                await collection.updateOne({ _id }, { $set: { category } });
                console.log(`[${index + 1}/${array.length}][OK][${category}]${dataId}\t${dataName}\t${dataTask}\n\t${useCaseText}`);
            } else {
                console.log(`[${index + 1}/${array.length}][Fail]${dataId}\t${dataName}\t${dataTask}\n\t${useCaseText}`);
            }
        });
    } catch (error) {
        console.error('Error categorizing data tasks:', error);
    } finally {
        await client.close();
        console.log('Categorizing data tasks completed.');
    }
})();
