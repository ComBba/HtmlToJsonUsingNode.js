//addAiLaunchDateTimestamp.js
const { insertIntoMongoDB } = require('../lib/connectMongo.js');
const MongoClient = require('mongodb').MongoClient;

const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

function convertToTimestamp(dateString) {
    const date = new Date(dateString);
    return date.getTime();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function addAiLaunchDateTimestamp() {
    const uri = process.env.MONGODB_CONNECTION_URI; // Replace with your MongoDB connection URI
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const collection = client.db(process.env.MONGODB_DATABASE_NAME).collection(process.env.MONGODB_COLLECTION_NAME);
        const cursor = collection.find({});

        await cursor.forEach(async (item) => {
            await sleep(randomInRange(2000)); // 1~2초 대기
            const aiLaunchDateText = item.aiLaunchDateText;
            const aiLaunchDateTimestamp = item.aiLaunchDateTimestamp;
            if (aiLaunchDateText && aiLaunchDateText.length > 0 && !aiLaunchDateTimestamp) {
                const aiLaunchDateTimestamp = convertToTimestamp(aiLaunchDateText);
                item.aiLaunchDateTimestamp = aiLaunchDateTimestamp;
                await insertIntoMongoDB(item);
                console.log('[', item.dataId, ']', '[', item.dataName, ']', 'itemAdded aiLaunchDateTimestamp:', aiLaunchDateTimestamp);
            }
        });
    } catch (err) {
        console.error('Error adding aiLaunchDateTimestamp to MongoDB:', err);
        await sleep(randomInRange(2000));
    } finally {
        await sleep(randomInRange(2000));
        await client.close();
    }
}

addAiLaunchDateTimestamp();
