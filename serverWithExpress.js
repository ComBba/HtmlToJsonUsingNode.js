//serverWithExpress.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const NodeCache = require('node-cache'); // Import the node-cache package

dotenv.config({ path: path.join(__dirname, '.env.local') });

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const uri = process.env.MONGODB_CONNECTION_URI;
const dbName = process.env.MONGODB_DATABASE_NAME;
const collectionName = process.env.MONGODB_COLLECTION_NAME;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Initialize cache with a 24-hour TTL (time to live)
const imageCache = new NodeCache({ stdTTL: 86400 });

async function getClient() {
  if (!client.topology || !client.topology.isConnected()) {
    try {
      console.log('Connecting to MongoDB');
      await client.connect();
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('Error connecting to MongoDB:', err);
      throw err;
    }
  }
  return client;
}

app.get('/data', async (req, res) => {
  console.log('GET /data request received');
  const page = parseInt(req.query.page) || 1;
  const searchQuery = req.query.search || "";
  const itemsPerPage = 9;

  try {
    const client = await getClient();
    const collection = client.db(dbName).collection(collectionName);

    // Use a regex pattern to match the search query
    const pattern = new RegExp(searchQuery, "i");

    const query = {
      $or: [
        { dataId: pattern },
        { dataName: pattern },
        { dataTask: pattern },
        { dataUrl: pattern },
        { summary: pattern },
        { useCaseText: pattern },
        { category: pattern },
      ]
    };

    console.log('Fetching data from MongoDB');
    const totalItems = await collection.countDocuments(searchQuery ? query : {});
    console.log('Number of data with MongoDB query.');
    const data = await collection.find(searchQuery ? query : {}, { projection: { dataId: 1, dataName: 1, dataTask: 1, dataUrl: 1, summary: 1, useCaseText: 1 } })
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage)
      .toArray();
    console.log('Data fetched successfully');

    res.json({ data, totalItems });
  } catch (err) {
    res.status(500).send('Error fetching data from MongoDB');
    console.error('Error fetching data from MongoDB:', err);
  }
});

app.get('/image/:dataId', async (req, res) => {
  const { dataId } = req.params;

  try {
    // Check if the image is in the cache
    const cachedImage = imageCache.get(dataId);
    if (cachedImage) {
      console.log('Serving image from cache:', dataId);
      res.type('image/jpeg');
      res.send(Buffer.from(cachedImage, 'base64'));
      return;
    }

    const client = await getClient();
    const collection = client.db(dbName).collection(collectionName);

    const item = await collection.findOne({ dataId: dataId }, { projection: { screenShot: 1, imgSrc: 1 } });

    if (item && item.screenShot) {
      // Store the image in the cache
      imageCache.set(dataId, item.screenShot);

      res.type('image/jpeg');
      res.send(Buffer.from(item.screenShot, 'base64'));
    } else if (item && item.imgSrc) {
      res.redirect(item.imgSrc);
    } else {
      res.status(404).send('Image not found');
    }
  } catch (err) {
    res.status(500).send('Error fetching image from MongoDB');
    console.error('Error fetching image from MongoDB:', err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});