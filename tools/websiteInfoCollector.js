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
        const removeLastCharactor = uniqueValueArray.pop();
        const uniqueValueArrayWithOutLastCharactor = uniqueValueArray.join('/');
        uniqueValue = `${uniqueValueArrayWithOutLastCharactor}-${index++}/${removeLastCharactor}`;
    }

    await client.close();
    return uniqueValue;
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
        const aiLaunchDateText = new Date().toLocaleDateString();
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
