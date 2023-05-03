// getFavicon.js
const axios = require('axios');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const { URL: Url } = require('url');
const puppeteer = require('puppeteer');
const sharp = require('sharp');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

async function fetchImageDataWithPuppeteer(url, selector) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.63 Safari/537.36');
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Wait for the app icon image element to load
        await page.waitForSelector(selector);

        const targetElement = await page.$(selector);
        if (targetElement) {
            let src;
            if (url.startsWith("https://apps.apple.com/")) {
                const srcset = await page.evaluate(el => el.srcset, targetElement);
                const srcsetArray = srcset.split(', ');
                src = srcsetArray[0].split(' ')[0];
                return new Url(src, url).href;
            } else {
                src = await page.evaluate(el => el.src, targetElement);
                return new Url(src, url).href;
            }
        } else {
            return null;
        }
    } catch (error) {
        console.error(`[Error] Failed to fetch image data with Puppeteer:`, error.message);
        return null;
    } finally {
        await browser.close();
    }
}

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
        let defaultFaviconUrl;

        if (url.startsWith("https://chrome.google.com/")) { //확인완료
            const selector = "img.e-f-s";
            const src = await fetchImageDataWithPuppeteer(url, selector);
            defaultFaviconUrl = new Url(src, url).href;
        } else if (url.startsWith("https://play.google.com/")) {
            const selector = "#yDmH0d > c-wiz.SSPGKf.Czez9d > div > div > div.tU8Y5c > div:nth-child(1) > div > div > c-wiz > div.Mqg6jb.Mhrnjf > img.T75of.nm4vBd.arM4bb";
            const src = await fetchImageDataWithPuppeteer(url, selector);
            defaultFaviconUrl = new Url(src, url).href;
        } else if (url.startsWith("https://workspace.google.com/")) {
            const selector = "#yDmH0d > c-wiz > div > c-wiz > div.mGJQPd > div.YKOwYb > div > div > img";
            const src = await fetchImageDataWithPuppeteer(url, selector);
            defaultFaviconUrl = new Url(src, url).href;
        } else if (url.startsWith("https://apps.apple.com/")) { //확인완료
            const selector = '#ember3 > source:nth-child(2)';
            const src = await fetchImageDataWithPuppeteer(url, selector);
            defaultFaviconUrl = new Url(src, url).href;
        } else {
            // 기본 favicon.ico를 먼저 시도
            defaultFaviconUrl = new Url('/favicon.ico', url).href;
        }

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
            let faviconUrl;
            if (element.href.startsWith('http')) {
                faviconUrl = element.href;
            } else {
                const baseUrl = new URL(url);
                let combinedUrl = baseUrl.href.endsWith('/') ? baseUrl.href : baseUrl.href + '/';
                combinedUrl += element.href.startsWith('/') ? element.href.slice(1) : element.href;
                faviconUrl = new URL(combinedUrl).href;
                console.log(`[INFO][Favicon] faviconUrl for "${faviconUrl}\nbaseUrl.href: ${baseUrl.href}\nelement.href: ${element.href} `);
            }
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
                    if (!element.type || element.type.includes('image/svg')) {
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