// tools/addFavicon.js
const { MongoClient } = require('mongodb');
const { fetchFaviconAsBase64 } = require('../lib/getFavicon.js');
const puppeteer = require('puppeteer');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const uri = process.env.MONGODB_CONNECTION_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
const VIEWPORT_WIDTH = 915;
const VIEWPORT_HEIGHT = 750;
const BrowserHEADER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'

let browser;

async function init() {
    try {
        if (browser && typeof browser.version === 'function') {
            const ver = await browser.version(); // this will throw if the browser is not usable
            console.log(`Browser version: ${ver}`);
        } else {
            browser = await puppeteer.launch({ headless: false });
        }
    } catch (err) {
        console.error(`An error occurred while initializing the browser: ${err}`);
        browser = await puppeteer.launch({ headless: false });
    }
}

(async function main() {
    await init();
    const page = await browser.newPage();
    page.on('dialog', async (dialog) => {
        console.log('[Accept Dialog]', `Dialog message: ${dialog.message()}`);
        await dialog.accept();
    });
    await page.setUserAgent(BrowserHEADER); // Set User-Agent to Chrome on PC
    await page.setViewport({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }); // 페이지 뷰포트 크기 설정

    try {
        console.log('Adding favicon to documents started...');
        await client.connect();
        console.log('client.connect()...');
        const db = client.db(process.env.MONGODB_DATABASE_NAME);
        const collection = db.collection(process.env.MONGODB_COLLECTION_NAME);

        const documents = await collection
            .find(
                { $or: [{ favicon: { $exists: false } }, { favicon: '' }] },
                //{dataUrl: 'https://rolebot.streamlit.app/'},
                //{dataUrl: 'https://www.opentable.com/blog/chatgpt/'}, //TODO: Cloudflare 처리된 사이트들
                //{},
                { projection: { _id: 1, dataUrl: 1 } } // 필요한 필드만 선택
            )//.limit(10)
            .toArray();
        console.info(`Found \x1b[36m${documents.length}\x1b[0m documents to update favicon.`);

        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            const { _id, dataUrl } = doc;
            const maxRetries = 3;
            let retryCount = 0;
            let success = false;

            while (retryCount < maxRetries && !success) {
                try {
                    console.log("[NOTICE][DOCU][", i + 1, "/", documents.length, "][", retryCount + 1, "/", maxRetries, "] Document processing to add favicon:", dataUrl);
                    const response = await page.goto(dataUrl, { waitUntil: 'networkidle2' });
                    for (cntTimeout = 10; cntTimeout > 0; cntTimeout--) {
                        if (response && (response.status() === 404 || response.status() === 500)) {
                            console.error(`Error: ${response.status()} occurred while fetching the content from ${url}`);
                            continue;
                        }
                        await page.waitForTimeout(1 * 1000); // 1초 대기
                        console.log(cntTimeout, "초...");
                    }

                    const favicon = await fetchFaviconAsBase64(dataUrl, page);
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
                    await init();
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
        await browser.close();
    }

    console.log('Adding favicon to documents completed.');
})();
