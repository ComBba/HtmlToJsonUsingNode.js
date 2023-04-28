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
    const userContent = "Please categorize the following data task into one of the following categories and respond in the format 'Category: {category_name}': Speeches, Images, Data Analysis, Videos, NLP, Chatbots, Frameworks, Education, Health, Financial Services, Logistics, Gaming, Human Resources, CRM, Contents Creation, Automation, Cybersecurity, Social Media, Environment, Smart Cities: ";

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
        await callback(array[index], index, array);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2초 지연
    }
}

(async function main() {
    try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DATABASE_NAME);
        const collection = db.collection(process.env.MONGODB_COLLECTION_NAME);

        const documents = await collection.find({}).toArray();

        await asyncForEach(documents, async (doc) => {
            const { _id, dataId, dataName, dataTask, useCaseText, summary } = doc;

            const categoryWithPrefix = await categorizeDataTask(dataTask, useCaseText, summary);
            const category = categoryWithPrefix.split(': ')[1];

            if (category) {
                await collection.updateOne({ _id }, { $set: { category } });
                console.log(`[OK][${category}]${dataId}\t${dataName}\t${dataTask}\n\t${useCaseText}`);
            } else {
                console.log(`[Fail]${dataId}\t${dataName}\t${dataTask}\n\t${useCaseText}`);
            }
        });
    } catch (error) {
        console.error('Error categorizing data tasks:', error);
    } finally {
        await client.close();
    }
})();
