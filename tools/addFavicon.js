// addFavicon.js
const axios = require('axios');
const { JSDOM } = require('jsdom');
const { MongoClient } = require('mongodb');
const { URL: Url } = require('url');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const uri = process.env.MONGODB_CONNECTION_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function fetchFaviconAsBase64(url) {
    try {
        const response = await axios.get(url);
        const html = response.data;
        const dom = new JSDOM(html);
        const doc = dom.window.document;
        const linkElements = Array.from(doc.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]'));

        if (linkElements.length === 0) {
            linkElements.push({ href: '/favicon.ico' }); // 기본 favicon.ico를 시도
        }

        for (const element of linkElements) {
            try {
                const faviconUrl = new Url(element.href, url).href;
                const faviconResponse = await axios.get(faviconUrl, {
                    responseType: 'arraybuffer',
                });

                if (faviconResponse.status === 200) {
                    const buffer = Buffer.from(faviconResponse.data, 'binary');
                    return buffer.toString('base64');
                }
            } catch (error) {
                console.error(`Error fetching favicon for ${url}:`, error);
            }
        }
    } catch (error) {
        console.error(`Error fetching HTML for ${url}:`, error);
    }
    return '';
}

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
                { projection: { _id: 1, dataUrl: 1 } } // 필요한 필드만 선택
            )
            .toArray();
        console.log(`Found ${documents.length} documents to update favicon.`);

        for (const doc of documents) {
            const { _id, dataUrl } = doc;
            console.log("[dataUrl]", dataUrl)
            const favicon = await fetchFaviconAsBase64(dataUrl);

            if (favicon) {
                await collection.updateOne({ _id }, { $set: { favicon } });
                console.log(`[OK] Updated favicon for ${dataUrl}`);
            } else {
                console.log(`[Fail] Could not fetch favicon for ${dataUrl}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 1000)); // 1초 지연
        }
    } catch (error) {
        console.error('Error adding favicon to documents:', error);
    } finally {
        await client.close();
        console.log('Adding favicon to documents completed.');
    }
})();
