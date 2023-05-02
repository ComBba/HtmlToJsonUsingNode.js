// getFavicon.js
const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { MongoClient } = require('mongodb');
const { URL: Url } = require('url');
const sharp = require('sharp');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const uri = process.env.MONGODB_CONNECTION_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function fetchFaviconAsBase64(url) {
    console.info(`[INFO] Fetching HTML for ${url}`);
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
            },
            responseType: 'arraybuffer',
            strictSSL: false,
            maxRedirects: 10,
        });

        const html = response.data;
        const dom = new JSDOM(html, {
            includeNodeLocations: true,
            storageQuota: 0,
            virtualConsole: new jsdom.VirtualConsole().sendTo(console, { omitJSDOMErrors: true }),
        });

        const doc = dom.window.document;

        // 기본 favicon.ico를 먼저 시도
        const defaultFaviconUrl = new Url('/favicon.ico', url).href;
        console.info(`[INFO][Favicon][Default] Fetching favicon for ${defaultFaviconUrl}`);
        try {
            const defaultFaviconResponse = await axios.get(defaultFaviconUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
                },
                responseType: 'arraybuffer',
                strictSSL: false,
                maxRedirects: 10,
            });

            if (defaultFaviconResponse.status === 200) {
                const buffer = Buffer.from(defaultFaviconResponse.data);
                return buffer.toString('base64');
            }
        } catch (error) {
            if (error.response && (error.response.status === 404 || error.response.status === 403)) {
                console.warn(`[Warn][Favicon][Default] favicon "not" found for ${defaultFaviconUrl}`);
            } else {
                console.error(`[Error][Favicon][Default] Error fetching favicon for ${defaultFaviconUrl}:`, error.message);
            }
        }

        // linkElements를 검색
        const linkElements = Array.from(doc.querySelectorAll('link[rel*="icon"]'));
        console.info(`[INFO][Count: \x1b[36m${linkElements.length}\x1b[0m] Fetching favicon from link elements for ${url}`);
        for (const element of linkElements) {
            console.log(`[INFO][Favicon] Fetching favicon for "${element.href}" `);
            const baseUrl = new URL(url);
            let combinedUrl = baseUrl.href.endsWith('/') ? baseUrl.href : baseUrl.href + '/';
            combinedUrl += element.href.startsWith('/') ? element.href.slice(1) : element.href;
            const faviconUrl = new URL(combinedUrl).href;
            console.log(`[INFO][Favicon] faviconUrl for "${faviconUrl}\nbaseUrl.href: ${baseUrl.href}\nelement.href: ${element.href} `);
            // 데이터 URL 처리
            if (faviconUrl.startsWith('data:image/')) {
                console.info(`[INFO][Favicon] Found data URL for favicon: ${faviconUrl}`);
                const base64Data = faviconUrl.split(',')[1];
                return base64Data;
            }

            if (element.type && element.type.includes("css")) {
                console.warn(`[WARN][Favicon] Skipped CSS file: ${element.href}`);
                continue;
            }

            try {
                const faviconResponse = await axios.get(faviconUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
                    },
                    responseType: 'arraybuffer',
                    strictSSL: false,
                    maxRedirects: 10,
                });
                if (faviconResponse.status === 200 || faviconResponse.status === 304 || faviconResponse.status === 302 || faviconResponse.status === 301) {
                    console.info(`[INFO][Favicon] Found URL for favicon: ${faviconUrl}`);
                    let buffer = Buffer.from(faviconResponse.data);
                    // Check if the content type is SVG or not specified and convert it to PNG
                    if (!element.type || element.type === 'image/svg' || element.type === 'image/svg+xml') {
                        buffer = await sharp(buffer).png().toBuffer();
                    }
                    return buffer.toString('base64');
                }
            } catch (error) {
                if (error.response && (error.response.status === 404 || error.response.status === 403)) {
                    console.warn(`[Warn][Favicon] favicon not found for ${faviconUrl}`);
                } else {
                    console.error(`[Error][Favicon] fetching default favicon for ${faviconUrl}:`, error.message);
                }
            }
        }
    } catch (error) {
        if (error.response && (error.response.status === 404 || error.response.status === 403)) {
            console.warn(`[Warn][HTML] not found for ${url}`);
        } else {
            console.error(`[Error][HTML] Error fetching for  ${url}:`, error.message);
        }
    }
    return '';
}

// Export fetchFaviconAsBase64 함수
module.exports = {
    fetchFaviconAsBase64,
};