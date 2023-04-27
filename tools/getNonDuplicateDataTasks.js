const MongoClient = require('mongodb').MongoClient;
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

async function getNonDuplicateDataTasks() {
    const uri = process.env.MONGODB_CONNECTION_URI;
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const collection = client.db(process.env.MONGODB_DATABASE_NAME).collection(process.env.MONGODB_COLLECTION_NAME);
        const cursor = collection.find({});

        const dataTasks = new Set();

        await cursor.forEach((item) => {
            dataTasks.add(JSON.stringify(item.dataTask));
        });

        const nonDuplicateDataTasks = Array.from(dataTasks).map((dataTask) => JSON.parse(dataTask));
        nonDuplicateDataTasks.forEach((dataTask, index) => {
            console.log(`${index + 1}. ${JSON.stringify(dataTask)}`);
        });
        return nonDuplicateDataTasks;
    } catch (err) {
        console.error('Error retrieving non-duplicate dataTasks from MongoDB:', err);
    } finally {
        await client.close();
    }
}

//getNonDuplicateDataTasks(); //단독실행시 켜기

module.exports = {
    getNonDuplicateDataTasks,
};