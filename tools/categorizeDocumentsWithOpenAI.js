// categorizeDocumentsWithOpenAI.js
const { createCompletion } = require('../lib/openaiHelper.js');
const { MongoClient } = require('mongodb');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const uri = process.env.MONGODB_CONNECTION_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

function removeDots(text) {
    return text.replace(/\./g, '');
}

function isValidFormatForCategory(response) {
    const regex = /^\d:\s[\w\s]+,\s\d:\s[\w\s]+,\s\d:\s[\w\s]+(\.|$)/;
    return regex.test(response);
}

async function generateValidCompletion(inputText, systemContent, userContent, temperature = 0.2) {
    if (temperature > 1.5) {
        temperature = 0.0;
    }
    const response = await createCompletion(inputText, systemContent, userContent, temperature + 0.1);
    console.log("[generateValidCompletion] temperature : ", temperature);
    if (isValidFormatForCategory(response.messageContent)) {
        return response;
    } else {
        console.log("[CategoryValidation][XXXXX] :", response.messageContent, "\n", "[inputText]", inputText);
        await sleep(2000); // 2초 딜레이를 추가합니다.
        return await generateValidCompletion(inputText, systemContent, userContent, temperature + 0.1);
    }
}

async function categorizeDataTask(dataTask, useCaseText, summary) {
    const systemContent = "You are a helpful assistant that categorizes data.";
    const userContent = "Strictly and without exception, for a given data task, you must select and rank the top 3 categories exclusively from the following list. Provide your response in the format '1: {category_name_1}, 2: {category_name_2}, 3: {category_name_3}': Speeches, Images, Data Analysis, Videos, NLP, Chatbots, Frameworks, Education, Health, Financial Services, Logistics, Gaming, Human Resources, CRM, Contents Creation, Automation, Cybersecurity, Social Media, Environment, Smart Cities:\n"
    const inputText = `Task:${dataTask}\nuseCaseText:${useCaseText}\nsummary:${summary}`;

    try {
        const response = await generateValidCompletion(inputText, systemContent, userContent);
        const category = removeDots(response.messageContent);
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

        //const documents = await collection.find({ category: { $exists: false } }).toArray();
        //const documents = await collection.find({}).toArray();
        const documents = await collection.find({}, {
            projection: {
                _id: 1, dataId: 1, dataName: 1, dataTask: 1, useCaseText: 1, summary: 1
            }
        }).toArray();
        console.log(`Found ${documents.length} documents to categorize.`);
        await asyncForEach(documents, async (doc, index, array) => {
            const { _id, dataId, dataName, dataTask, useCaseText, summary } = doc;

            const categoryWithPrefix = await categorizeDataTask(dataTask, useCaseText, summary);
            const Category1st = categoryWithPrefix.split(', ')[0].split(': ')[1];
            const Category2nd = categoryWithPrefix.split(', ')[1].split(': ')[1];
            const Category3rd = categoryWithPrefix.split(', ')[2].split(': ')[1];
            const category = "".concat(Category1st, ".", Category2nd, ".", Category3rd);
            console.log("[category]", category, "[categoryWithPrefix]", categoryWithPrefix)
            if (category) {
                await collection.updateOne({ _id }, { $set: { category, Category1st, Category2nd, Category3rd } });
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
