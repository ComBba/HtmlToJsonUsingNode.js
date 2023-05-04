//twitterAiLinkCollector.js
const axios = require('axios');
const openai = require('../lib/openaiHelper');
const { MongoClient } = require('mongodb');
const path = require('path');
const dotenv = require('dotenv');
const qs = require('qs');
const btoa = require('btoa');

// Set path for environment variables
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

// Get BEARER_TOKEN from environment variable
const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

// Set up MongoDB client
const uri = process.env.MONGODB_CONNECTION_URI;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function getTwitterAccessToken() {
    const credentials = btoa(
        `${process.env.TWITTER_CONSUMER_KEY}:${process.env.TWITTER_CONSUMER_SECRET}`
    );

    try {
        const response = await axios.post(
            'https://api.twitter.com/oauth2/token',
            qs.stringify({ grant_type: 'client_credentials' }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                    Authorization: `Basic ${credentials}`,
                },
            }
        );

        return response.data.access_token;
    } catch (error) {
        console.error('Error getting Twitter access token:', error);
        return null;
    }
}

async function searchTweets(query) {
    try {
        const response = await axios.get(
            `https://api.twitter.com/1.1/search/tweets.json?q=${encodeURIComponent(
                query
            )}&count=100`,
            {
                headers: {
                    Authorization: `Bearer ${BEARER_TOKEN}`,
                },
            }
        );

        return response.data.statuses;
    } catch (error) {
        console.error('Error searching tweets:', error.response.data);
        return [];
    }
}

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

async function searchAndProcessTweets() {
    try {
        const accessToken = await getTwitterAccessToken();
        if (!accessToken) {
            console.error('Unable to get Twitter access token');
            return;
        }

        const tweets = await searchTweets(accessToken, 'site launching');
        await processTweets(tweets);
    } catch (error) {
        console.error('[Error] fetching tweets:', error);
    }
}

// Call the function to search for and process tweets
searchAndProcessTweets();