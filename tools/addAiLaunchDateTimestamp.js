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

async function addAiLaunchDateTimestamp() {
    const uri = process.env.MONGODB_CONNECTION_URI; // Replace with your MongoDB connection URI
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const collection = client.db(process.env.MONGODB_DATABASE_NAME).collection(process.env.MONGODB_COLLECTION_NAME);
        const cursor = collection.find({});

        let lastInsertTime = 0;
        for await (const item of cursor) {
            const currentTime = Date.now();
            if (currentTime - lastInsertTime < 1000) {
                await new Promise(resolve => setTimeout(resolve, 1000 - (currentTime - lastInsertTime)));
            }

            const aiLaunchDateText = item.aiLaunchDateText;
            const aiLaunchDateTimestamp = item.aiLaunchDateTimestamp;
            if (aiLaunchDateText && aiLaunchDateText.length > 0 && !aiLaunchDateTimestamp) {
                const aiLaunchDateTimestamp = convertToTimestamp(aiLaunchDateText);
                item.aiLaunchDateTimestamp = aiLaunchDateTimestamp;
                const insertResult = await insertIntoMongoDB(item);
                if (insertResult) {
                    lastInsertTime = Date.now();
                }
                console.log('[', item.dataId, ']', '[', item.dataName, ']', 'itemAdded aiLaunchDateTimestamp:', aiLaunchDateTimestamp);
            }
        }
    } catch (err) {
        console.error('Error adding aiLaunchDateTimestamp to MongoDB:', err);
    } finally {
        await client.close();
    }
}

addAiLaunchDateTimestamp();
