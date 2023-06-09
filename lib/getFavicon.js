// lib/getFavicon.js
const fetch = require('node-fetch');
const { URL: Url } = require('url');
const sharp = require('sharp');
const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });
const BrowserHEADER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'

async function fetchImageDataWithPuppeteer(url, selector, page) {
    try {
        // Wait for the app icon image element to load
        if (selector && selector != undefined && selector.length > 1) {
            await page.waitForSelector(selector);
        }

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
        }
        return null;
    } catch (error) {
        console.error(`[Error] Failed to fetch image data with Puppeteer:`, error.message);
        return null;
    }
}

async function fetchFaviconAsBase64(url, page) {
    console.info(`[INFO] Fetching HTML for ${url}`);
    let defaultFaviconUrl;
    try {
        const selectors = {
            "https://chrome.google.com/": "img.e-f-s",
            "https://play.google.com/": "#yDmH0d > c-wiz.SSPGKf.Czez9d > div > div > div.tU8Y5c > div:nth-child(1) > div > div > c-wiz > div.Mqg6jb.Mhrnjf > img.T75of.nm4vBd.arM4bb",
            "https://workspace.google.com/": "#yDmH0d > c-wiz > div > c-wiz > div.mGJQPd > div.YKOwYb > div > div > img",
            "https://apps.apple.com/": '#ember3 > source:nth-child(2)',
        };

        for (const base of Object.keys(selectors)) {
            if (url.startsWith(base)) {
                const selector = selectors[base];
                const src = await fetchImageDataWithPuppeteer(url, selector, page);
                defaultFaviconUrl = new Url(src, url).href;
                break;
            }
        }
        // If no match, use default
        if (!defaultFaviconUrl || defaultFaviconUrl == undefined) {
            const baseUrl = new URL(url);
            let combinedUrl = baseUrl.href.endsWith('/') ? baseUrl.href : baseUrl.href + '/';
            combinedUrl += 'favicon.ico';
            defaultFaviconUrl = new URL(combinedUrl).href;
        }
        console.info(`[INFO][Favicon][Default] Fetching favicon for ${defaultFaviconUrl}`);

        try {
            const defaultFaviconResponse = await fetch(defaultFaviconUrl, {
                headers: {
                    'User-Agent': BrowserHEADER,
                },
                follow: 5,         // maximum redirect count. 0 to not follow redirect
                timeout: 5000,         // req/res timeout in ms, it resets on redirect. 0 to disable (OS limit applies). Signal is recommended instead.
                compress: true,     // support gzip/deflate content encoding. false to disable
            });

            //console.log('[defaultFaviconResponse]', defaultFaviconResponse)

            if (defaultFaviconResponse.ok) {
                const contentType = defaultFaviconResponse.headers.get('content-type');
                if (contentType && contentType.includes('text/html')) {
                    throw new Error('Favicon is a HTML document');
                }

                const buffer = Buffer.from(await defaultFaviconResponse.arrayBuffer());
                //console.log("[buffer]", buffer);
                if (buffer.length > 0) {
                    return buffer.toString('base64');
                }
            }
        } catch (error) {
            if (error.message === 'Favicon is a HTML document') {
                console.warn(`[Warn][Favicon][Default] Favicon is a HTML document for ${defaultFaviconUrl}`);
            } else if (error.response && (error.response.status === 404 || error.response.status === 403)) {
                console.warn(`[Warn][Favicon][Default] favicon "not" found for ${defaultFaviconUrl}`);
            } else {
                console.error(`[Error][Favicon][Default] Error fetching favicon for ${defaultFaviconUrl}:`, error.message);
            }
            console.log(`[Continue] fetching favicon from link elements for ${url}`);
        }

        try {
            // linkElements를 검색하고 href와 type 속성을 추출
            const linkElements = await page.$$eval('link[rel*="icon"]', elements => elements.map(element => ({ href: element.href, type: element.type })));

            console.info(`[INFO][Count: \x1b[36m${linkElements.length}\x1b[0m] Fetching favicon from link elements for ${url}`);
            for (const element of linkElements) {
                console.log(`[INFO][Favicon] Fetching favicon for "${element.href}" `);
                //console.log(element);
                if (element.type && typeof element.type === 'string' && element.type.includes("css")) {
                    console.warn(`[WARN][Favicon] Skipped CSS file: ${element.href}`);
                    continue;
                }
                if (element.href && typeof element.href === 'string' && element.href.startsWith('data:image/')) { // Data URL 처리 추가
                    console.info(`[INFO][Favicon] Found data URL for favicon: ${element.href}`);
                    const base64Data = element.href.split(',')[1];
                    return base64Data;
                }

                let faviconUrl = element.href;
                if (!faviconUrl.startsWith('http')) {
                    const baseUrl = new URL(url);
                    let combinedUrl = baseUrl.href.endsWith('/') ? baseUrl.href : baseUrl.href + '/';
                    combinedUrl += element.href.startsWith('/') ? element.href.slice(1) : element.href;
                    faviconUrl = new URL(combinedUrl).href;
                    console.log(`[INFO][Favicon] faviconUrl for "${faviconUrl}\nbaseUrl.href: ${baseUrl.href}\nelement.href: ${element.href} `);
                }

                try {
                    const faviconResponse = await fetch(faviconUrl, {
                        headers: {
                            'User-Agent': BrowserHEADER,
                        },
                        follow: 5,         // maximum redirect count. 0 to not follow redirect
                        timeout: 5000,         // req/res timeout in ms, it resets on redirect. 0 to disable (OS limit applies). Signal is recommended instead.
                        compress: true,     // support gzip/deflate content encoding. false to disable
                    });

                    if (faviconResponse.ok) {
                        let buffer = Buffer.from(await faviconResponse.arrayBuffer());

                        if (element.type && element.type.includes('image/svg')) {
                            try {
                                buffer = await sharp(buffer).png().toBuffer();
                            } catch (error) {
                                console.error(`[Error] Failed to convert SVG to PNG, return original data:`, error);
                            }
                        }
                        return buffer.toString('base64');
                    }
                } catch (error) {
                    if (error.response && error.response.status) {
                        switch (error.response.status) {
                            case 400: // Bad Request
                                console.error(`[Error][Favicon] Bad Request for ${faviconUrl}`);
                                break;
                            case 403: // Forbidden
                                console.warn(`[Warn][Favicon] favicon not found for ${faviconUrl}`);
                                break;
                            case 404: // Not Found
                                console.warn(`[Warn][Favicon] favicon not found for ${faviconUrl}`);
                                break;
                            case 500: // Internal Server Error
                                console.error(`[Error][Favicon] Internal Server Error for ${faviconUrl}`);
                                break;
                            case 502: // Bad Gateway
                                console.error(`[Error][Favicon] Bad Gateway for ${faviconUrl}`);
                                break;
                            default:
                                console.error(`[Error][Favicon] Unknown Error for ${faviconUrl}`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`[Error] Failed to fetch favicon:`, error.message);
            return '';
        }
    } catch (error) {
        if (error.response && (error.response.status === 404 || error.response.status === 403)) {
            console.warn(`[Warn][HTML] not found for ${url}`);
        } else {
            console.error(`[Error][HTML] Error fetching for  ${url}:`, error.message);
        }
        return '';
    }
    return '';
}

// Export fetchFaviconAsBase64 함수
module.exports = {
    fetchFaviconAsBase64,
};