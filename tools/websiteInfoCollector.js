// tools/websiteInfoCollector.js
const puppeteer = require('puppeteer');
const slugify = require('slugify');
const { getWebsiteContent } = require('../lib/urlToSummarizeWithOpenAI.js');
const path = require('path');
const dotenv = require('dotenv');
const { Configuration, OpenAIApi } = require('openai');
const MongoClient = require('mongodb').MongoClient;

const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

// Set up OpenAI API configuration
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

// Create OpenAI API instance
const openai = new OpenAIApi(configuration);

async function googleLogin(page) {
    // Navigate to the login page
    await page.goto('https://accounts.google.com/AccountChooser?service=mail&continue=https://mail.google.com/mail/');

    // Enter your email and password
    await page.type('input[type="email"]', 'sejun@ddengle.com');
    console.log("type('input[type=\"email\"]', 'XXXXXXXXXXXXXXXXX');")
    await page.click('#identifierNext');
    console.log("click('#identifierNext');")
    await page.waitForNavigation();
    console.log("waitForNavigation();")
    await page.waitForSelector("#password > div.aCsJod.oJeWuf > div > div.Xb9hP > input");  // Adjust this wait time if needed
    console.log("waitForSelector('#password > div.aCsJod.oJeWuf > div > div.Xb9hP > input');")
    await page.type('input[type="password"]', 'Psop671k!@');
    console.log("type('input[type=\"password\"]', 'XXXXXXXXXXXXXXXXX');")
    await page.click('#passwordNext > div > button');
    console.log("click('#passwordNext > div > button');")
    await page.waitForNavigation();
    console.log("waitForNavigation();")
}

async function checkUniqueValue(field, value) {
    const uri = process.env.MONGODB_CONNECTION_URI; // Replace with your MongoDB connection URI
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE_NAME);
    const collection = db.collection(process.env.MONGODB_COLLECTION_NAME);

    // Get all documents with only the required field
    const docs = await collection.find({}, { projection: { [field]: 1, _id: 0 } }).toArray();

    // Extract the values of the field from the documents
    const values = docs.map(doc => doc[field]);

    let index = 1;
    let uniqueValue = value;
    while (values.includes(uniqueValue)) {
        const uniqueValueArray = uniqueValue.split('/');
        console.log('[uniqueValueArray]', uniqueValueArray);
        const removeLastCharactor = uniqueValueArray.pop();
        console.log('[removeLastCharactor]', removeLastCharactor);
        const uniqueValueArrayWithOutLastCharactor = uniqueValueArray.join('/');
        console.log('[uniqueValueArrayWithOutLastCharactor]', uniqueValueArrayWithOutLastCharactor);
        uniqueValue = `${uniqueValueArrayWithOutLastCharactor}-${index++}/${removeLastCharactor}`;
    }

    await client.close();
    return uniqueValue;
}

async function checkUniqueValue(field, value) {
    const uri = process.env.MONGODB_CONNECTION_URI; // Replace with your MongoDB connection URI
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE_NAME);
    const collection = db.collection(process.env.MONGODB_COLLECTION_NAME);

    // Get all documents with only the required field
    const docs = await collection.find({}, { projection: { [field]: 1, _id: 0 } }).toArray();

    // Extract the values of the field from the documents
    const values = docs.map(doc => doc[field]);

    let index = 1;
    let uniqueValue = value;
    while (values.includes(uniqueValue)) {
        uniqueValue = `${value}-${index++}`;
    }

    await client.close();
    return uniqueValue;
}

async function getAiLaunchDateText(siteName) {
    try {
        const browser = await puppeteer.launch({ headless: false });
        const context = await browser.createIncognitoBrowserContext();
        const page = await context.newPage();
        await page.goto(`https://twitter.com/search?q=${siteName}&src=typed_query&f=live`, { waitUntil: 'networkidle2' });

        await googleLogin(page);  // Add this line
        // Wait for the tweets to load
        await page.waitForSelector('article');

        // Get the dates of the latest 10 tweets
        const tweetDates = await page.evaluate(() => {
            const articles = document.querySelectorAll('article');
            return Array.from(articles).slice(0, 10).map(article => {
                const time = article.querySelector('time');
                return time ? new Date(time.getAttribute('datetime')) : new Date();
            });
        });

        await browser.close();

        if (tweetDates.length > 0) {
            console.log(tweetDates);
            // Assuming the launch date is the date of the earliest tweet about the site
            return new Date(Math.min(...tweetDates)).toLocaleDateString();
        }
    } catch (error) {
        // Log any errors that occur during the tweet search
        console.error(error);
    }

    // If no tweets are found, default to today's date
    return new Date().toLocaleDateString();
}

async function getNewDataId() {
    const uri = process.env.MONGODB_CONNECTION_URI; // Replace with your MongoDB connection URI
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();
        const db = client.db(process.env.MONGODB_DATABASE_NAME);
        const collection = db.collection(process.env.MONGODB_COLLECTION_NAME);

        // Get all documents
        const docs = await collection.find({}, { projection: { _id: 0, dataId: 1 } }).toArray();

        if (docs.length === 0) {
            // If the collection is empty, start with 1
            return "1";
        } else {
            // Convert all dataId's to integers and find the max
            const maxDataId = Math.max(...docs.map(doc => parseInt(doc.dataId, 10)));
            // Add 1 to maxDataId and convert back to string
            return (maxDataId + 1 + 1000000).toString();
        }
    } finally {
        await client.close();
    }
}

// An asynchronous function that extracts specific information from website content using OpenAI API
async function extractDataUsingAI(text) {
    try {
        // Call OpenAI API to create a chat completion
        const response = await openai.createChatCompletion({
            // Use the "gpt-3.5-turbo" model
            model: "gpt-3.5-turbo",
            // Provide messages to the API, including a system message and a user message with the input text
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that extracts specific information from website content.",
                },
                {
                    role: "user",
                    content: `Your assignment is to discern the "site name", a "task" consisting of no more than 5 words, and a "use case text" of under 100 characters from the given text. Your response should be in the format: '{\"siteName\":\"Site Name\",\"task\":\"Task\",\"useCaseText\":\"Use Case Text\"}'. Below, you'll find the text extracted from the website's content, focusing on the main purpose and features of the site. Exclude any copyright information, contact details, and unrelated external website links: ${text}.`
                },
            ],
            // Set the temperature and max tokens for the API response
            temperature: 0.1,
            max_tokens: 2048,
        });

        // Check if the API response contains choices
        if (response.data.choices && response.data.choices.length > 0) {
            let extractedData = {};
            try {
                // Parse the extracted data from the API response
                extractedData = JSON.parse(response.data.choices[0].message.content.trim());
            } catch (error) {
                console.log(error);
                console.dir(response.data.choices[0]);
            }
            // Log the extracted data to the console
            console.log('\n[OpenAI API] Extracted data:');
            console.log('Site Name:', extractedData.siteName);
            console.log('Task:', extractedData.task);
            console.log('Use Case Text:', extractedData.useCaseText);

            // Return the extracted data
            return {
                siteName: extractedData.siteName,
                task: extractedData.task,
                useCaseText: extractedData.useCaseText
            };
        } else {
            // Log an error message to the console if no choices were returned by the API
            console.error('No choices returned by OpenAI API');
            // Return empty strings for the extracted data
            return {
                siteName: '',
                task: '',
                useCaseText: ''
            };
        }
    } catch (error) {
        // Log an error message to the console if there was an error using the OpenAI API
        console.error('Error using OpenAI API:', error.response == undefined ? error : error.response);
        // Return empty strings for the extracted data
        return {
            siteName: '',
            task: '',
            useCaseText: ''
        };
    }
}

// Function to fetch website content
async function getFetchAndExtractWebsiteContent(url) {
    try {
        // Fetch website content using the provided URL
        const websiteContent = await getWebsiteContent(url);

        // Extract data from the website content using AI
        const extractedData = await extractDataUsingAI(websiteContent.contents);

        // Generate a new data ID
        const dataId = await getNewDataId();

        // Get the site name from the extracted data and slugify it for use in a URL
        const siteName = extractedData.siteName;
        const aiLinkHrefSlug = slugify(siteName.toLowerCase());
        // Check if aiLinkHref is unique in MongoDB
        const aiLinkHref = await checkUniqueValue('aiLinkHref', '/ai/'.concat(aiLinkHrefSlug, '/'));
        // Get the task from the extracted data and slugify it for use in a URL
        const Task = extractedData.task;
        const TaskSlug = slugify(Task);

        // Get the use case text from the extracted data
        const useCaseText = extractedData.useCaseText;

        // Get the AI launch date text for the site name and convert it to a timestamp
        const aiLaunchDateText = await getAiLaunchDateText(siteName); //new Date().toLocaleDateString(); 
        const aiLaunchDateTimestamp = new Date(aiLaunchDateText).getTime();

        // Create an object containing all the extracted data
        const data = {
            dataId,
            aiLaunchDateText,
            aiLaunchDateTimestamp,
            aiLinkHref,
            dataName: siteName,
            dataTask: Task,
            dataTaskSlug: TaskSlug,
            dataUrl: url,
            useCaseText,
        };
        return data;
    } catch (error) {
        // Log any errors that occur during the process
        console.error('An error occurred while fetching and extracting website content:', error);
    }
}

(async function main() {
    //const finalData = await getFetchAndExtractWebsiteContent('https://www.chora.cc/'); // call the function with your URL
    const finalData = await getFetchAndExtractWebsiteContent("https://voyaj.ai/"); // call the function with your URL
    // Log the extracted data and return it
    console.log('\n[Website Info Collector] Data:');
    console.dir(finalData);
})();
