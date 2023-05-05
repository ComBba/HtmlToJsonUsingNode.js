// categorizeDocumentsWithOpenAI.js
const { createCompletion } = require('../lib/openaiHelper.js');
const { MongoClient } = require('mongodb');
const { sleep, randomInRange, msToTime, convertToTimestamp, removeDots, shuffle } = require('../tools/utils');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const uri = process.env.MONGODB_CONNECTION_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

function isValidCategory(category) {
    const validCategories = [
        'Speeches', 'Images', 'Data Analysis', 'Videos', 'NLP', 'Chatbots', 'Frameworks', 'Education', 'Health', 'Financial Services',
        'Logistics', 'Gaming', 'Human Resources', 'CRM', 'Contents Creation', 'Automation', 'Cybersecurity', 'Social Media',
        'Environment', 'Smart Cities'
    ];
    return validCategories.includes(category);
}

async function categorizeDataTask(dataTask, useCaseText, summary) {
    const systemContent = "You are a helpful assistant that categorizes data.";
    let excludedCategories = [];
    let isValid = false;
    let attemptCount = 0;
    let response;
    let categories;
    let temperature = 0.5;
    while (!isValid) {
        attemptCount += 1;
        const userContent = `For a given data task, please strictly select and rank the top 3 categories from the list below, and provide your response in the format '1: {category_name_1}, 2: {category_name_2}, 3: {category_name_3}'. The list of valid categories is: Speeches, Images, Data Analysis, Videos, NLP, Chatbots, Frameworks, Education, Health, Financial Services, Logistics, Gaming, Human Resources, CRM, Contents Creation, Automation, Cybersecurity, Social Media, Environment, Smart Cities. Note: "AI" is not a valid category and should not be included in the response.\n`;
        const inputText = `Task:${dataTask}\nuseCaseText:${useCaseText}\nsummary:${summary}\nCategories to be excluded:${excludedCategories.join(', ')}`;

        response = await createCompletion(inputText, systemContent, userContent, temperature);
        categories = response.messageContent.split(', ').map(c => {
            const category = c.split(': ')[1];
            return removeDots(category);
        });
        isValid = categories.every(isValidCategory);

        if (!isValid) {
            excludedCategories = excludedCategories.concat(categories.filter(c => !isValidCategory(c)));
            temperature += 0.1;
            console.log('[Attempt][Invalid] count:', attemptCount, 'categories:', categories, 'Excluded categories:', excludedCategories);
        } else {
            console.log('[Attempt][Success] count:', attemptCount);
        }

        if (++attemptCount > 20) {
            console.log("[Attempt][Failed] count:", attemptCount);
            break;
        }
        sleep(3000);
    }// categories 배열을 쉼표로 구분하여 리턴
    return categories.join('.');
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
        const documents = await collection.find({}, {
            projection: {
                _id: 1, dataId: 1, dataName: 1, dataTask: 1, useCaseText: 1, summary: 1, Category1st: 1, Category2nd: 1, Category3rd: 1
            }
        }).toArray();
        console.log(`Found ${documents.length} documents to categorize.`);
        await asyncForEach(documents, async (doc, index, array) => {
            const { _id, dataId, dataName, dataTask, useCaseText, summary, Category1st, Category2nd, Category3rd } = doc;

            if (isValidCategory(Category1st) && isValidCategory(Category2nd) && isValidCategory(Category3rd)) {
                console.log(`[\x1b[33m${index + 1}\x1b[0m/${array.length}][\x1b[32mSKIPPED\x1b[0m][${dataId}] ${dataName} ${dataTask}\n[useCaseText] ${useCaseText}\n[Categories] ${Category1st}, ${Category2nd}, ${Category3rd}\n\n`);
                //await sleep(1000); // 1초 딜레이를 추가합니다.
            } else {
                const category = await categorizeDataTask(dataTask, useCaseText, summary);
                const [NewCategory1st, NewCategory2nd, NewCategory3rd] = category.split('.');
                if (category) {
                    await collection.updateOne({ _id }, { $set: { category, Category1st: NewCategory1st, Category2nd: NewCategory2nd, Category3rd: NewCategory3rd } });
                    console.log(`[\x1b[33m${index + 1}\x1b[0m/${array.length}][\x1b[32mOK\x1b[0m][${dataId}] ${dataName} ${dataTask}\n[category] ${category}\n[useCaseText] ${useCaseText}\n\n`);
                } else {
                    console.log(`[${index + 1}/${array.length}][Fail][${dataId}] ${dataName} ${dataTask}\n[useCaseText] ${useCaseText}\n[category] ${category}`);
                }
                await sleep(5000); // 10초 딜레이를 추가합니다.
            }
        });
    } catch (error) {
        console.error('Error categorizing data tasks:', error);
    } finally {
        await client.close();
        console.log('Categorizing data tasks completed.');
    }
})();
