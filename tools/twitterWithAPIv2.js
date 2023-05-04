//twitterWithAPIv2.js
const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

// Set path for environment variables
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

// Get BEARER_TOKEN from environment variable
const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

async function searchTweetsV2(query) {
  try {
    const response = await axios.get(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(
        query
      )}&max_results=100`,
      {
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
        },
      }
    );

    return response.data.data;
  } catch (error) {
    console.error('Error searching tweets v2:', error.response.data);
    return [];
  }
}

// 수정된 searchAndProcessTweets 함수
async function searchAndProcessTweets() {
  try {
    const tweets = await searchTweetsV2('site launching');
    await processTweets(tweets);
  } catch (error) {
    console.error('[Error] fetching tweets:', error);
  }
}


async function processTweets(tweets) {
  console.log(tweets);
}

searchAndProcessTweets();