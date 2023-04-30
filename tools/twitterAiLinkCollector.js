//twitterAiLinkCollector.js
const openai = require('../lib/openaiHelper'); // 수정된 부분
const axios = require('axios');
const { MongoClient } = require('mongodb');
const path = require('path');
const dotenv = require('dotenv');

// Set path for environment variables
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

//const twitterApiBaseUrl = 'https://api.twitter.com/1.1';
const twitterApiBaseUrl = 'https://api.twitter.com/2';

// Set up MongoDB client
const uri = process.env.MONGODB_CONNECTION_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Function to extract URL from tweet
function extractUrlFromTweet(tweet) {
    if (tweet.entities.urls.length > 0) {
        return tweet.entities.urls[0].expanded_url;
    }
    return null;
}

async function expandUrl(shortUrl) {
    try {
        const response = await axios.get(shortUrl, {
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 300 && status < 400;
            },
        });
        return response.headers.location;
    } catch (error) {
        console.error(`Error expanding URL: ${error}`);
        return shortUrl;
    }
}

// Function to check if a website is AI-related
async function isAiRelated(url) {
    const systemContent = "You are an AI that can determine if a website is AI-related or not.";
    const userContent = "Is this website AI related? Respond only in 'yes or no'";
    const inputText = url;

    try {
        const response = await openai.createCompletion(inputText, systemContent, userContent); // 수정된 부분
        console.log(response.messageContent);
        const answer = response.messageContent.toLowerCase();
        return answer === 'yes' || answer === '예';
    } catch (error) {
        console.error('Error checking if the website is AI-related:', error);
        return false;
    }
}

// Function to process tweets
async function processTweets(tweets) {
    // Connect to MongoDB
    await client.connect();
    const db = client.db(process.env.MONGODB_DATABASE_NAME);
    const collection = db.collection(process.env.MONGODB_COLLECTION_NAME_FOR_TWITTER_AI_LINKS);

    // Loop through tweets
    for (const tweet of tweets) {
        const url = extractUrlFromTweet(tweet);
        if (url) {
            const expandedUrl = await expandUrl(url);
            if (await isAiRelated(expandedUrl)) {
                console.log(`AI related link found: ${expandedUrl}`);
                // Add the related information to your collection here
                const newDocument = {
                    url: expandedUrl,
                    tweet_id: tweet.id_str,
                    tweet_text: tweet.text,
                    user: {
                        id: tweet.user.id_str,
                        screen_name: tweet.user.screen_name,
                    },
                };
                try {
                    await collection.insertOne(newDocument);
                    console.log(`Successfully added to the collection: ${expandedUrl}`);
                } catch (error) {
                    console.error(`Error inserting document into the collection: ${error}`);
                }
            }
        }
    }

    // Close MongoDB connection
    await client.close();
}

// Function to search for and process tweets
async function searchAndProcessTweets() {
    try {
        const response = await axios.get(`${twitterApiBaseUrl}/tweets/search/recent`, {
            params: {
                query: 'site launching',
                max_results: 100,
                expansions: 'attachments.media_keys',
                'media.fields': 'url',
            },
            headers: {
                'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
            },
        });

        const tweets = response.data.data;
        await processTweets(tweets);
    } catch (error) {
        console.error("[Error] fetching tweets: ", error.response.data);
    }
}

// Call the function to search for and process tweets
searchAndProcessTweets();