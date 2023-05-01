//siteLaunchingStream.js
const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

// Set path for environment variables
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

const apiKey = process.env.TWITTER_API_KEY;
const apiSecretKey = process.env.TWITTER_API_SECRET_KEY;
console.log('API Key:', apiKey, 'API Secret Key:', apiSecretKey);

async function getBearerToken() {
  try {
    const response = await axios.post('https://api.twitter.com/oauth2/token', 'grant_type=client_credentials', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'Authorization': `Basic ${Buffer.from(`${apiKey}:${apiSecretKey}`).toString('base64')}`,
      },
    });
    console.log('Bearer Token:', response.data.access_token);
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Twitter access token:', error.response.data);
    return null;
  }
}

async function streamSiteLaunchingTweets(bearerToken) {
  try {
    const rulesResponse = await axios.get('https://api.twitter.com/2/tweets/search/stream/rules', {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
      },
    });
    console.log('Existing Rules:', rulesResponse.data);

    const existingRule = rulesResponse.data.data?.find(rule => rule.value === 'site launching');

    if (!existingRule) {
      const addedRuleResponse = await axios.post('https://api.twitter.com/2/tweets/search/stream/rules', {
        add: [{ value: 'site launching', tag: 'Site Launching' }],
      }, {
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
        },
      });
      console.log('Added Rule:', addedRuleResponse.data);
    }

    const stream = await axios.get('https://api.twitter.com/2/tweets/search/stream', {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
      },
      responseType: 'stream',
    });

    stream.data.on('data', data => {
      try {
        const parsedData = JSON.parse(data);
        console.log(`User: ${parsedData.includes.users[0].username} - Tweet: ${parsedData.data.text}`);
      } catch (error) {
        // Ignore non-JSON data (such as keep-alive messages)
      }
    });

    stream.data.on('error', error => {
      console.error('Error streaming tweets:', error);
    });
  } catch (error) {
    console.error('Error setting up streaming:', error.response.data);
  }
}

(async () => {
  const bearerToken = await getBearerToken();
  if (bearerToken) {
    streamSiteLaunchingTweets(bearerToken);
  } else {
    console.error('Unable to get Twitter access token');
  }
})();
