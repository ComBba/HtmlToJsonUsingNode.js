// tools/addFavicon.js
const { MongoClient } = require('mongodb');
const { fetchFaviconAsBase64 } = require('../lib/getFavicon.js');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const uri = process.env.MONGODB_CONNECTION_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

(async function main() {
    try {
        console.log('Adding favicon to documents started...');
        await client.connect();
        console.log('client.connect()...');
        const db = client.db(process.env.MONGODB_DATABASE_NAME);
        const collection = db.collection(process.env.MONGODB_COLLECTION_NAME);

        const documents = await collection
            .find(
                { $or: [{ favicon: { $exists: false } }, { favicon: '' }] },
                //{dataUrl: 'https://whybot-khaki.vercel.app/'},
                //{},
                { projection: { _id: 1, dataUrl: 1 } } // 필요한 필드만 선택
            )//.limit(10)
            .toArray();
        console.info(`Found \x1b[36m${documents.length}\x1b[0m documents to update favicon.`);

        for (const doc of documents) {
            const { _id, dataUrl } = doc;
            const maxRetries = 3;
            let retryCount = 0;
            let success = false;

            while (retryCount < maxRetries && !success) {
                try {
                    console.log(`[NOTICE][DOCU] Processing ${dataUrl}`);
                    const favicon = await fetchFaviconAsBase64(dataUrl);
                    if (favicon) {
                        await collection.updateOne({ _id }, { $set: { favicon } });
                        console.log(`[\x1b[32mOK\x1b[0m][DOCU] Updated favicon for ${dataUrl}`);
                        success = true;
                    } else {
                        console.log(`[\x1b[31mFail\x1b[0m][DOCU] Could not fetch favicon for ${dataUrl}`);
                        retryCount++;
                    }
                } catch (error) {
                    console.error(`[Warn][DOCU]Error adding favicon to document ${dataUrl}:`, error);
                    retryCount++;
                    if (retryCount < maxRetries) {
                        await new Promise((resolve) => setTimeout(resolve, 5000)); // 5초 지연 후 재시도
                    }
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 지연
        }
    } catch (error) {
        console.error('[Warn][DOCU]Error adding favicon to documents:', error);
    } finally {
        await client.close();
    }

    console.log('Adding favicon to documents completed.');
})();
