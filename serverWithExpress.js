//serverWithExpress.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { MongoClient, ObjectId } = require('mongodb');
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
    console.log('Number of data with MongoDB query:', totalItems);
    const data = await collection.find(searchQuery ? query : {}, { projection: { dataId: 1, dataName: 1, dataTask: 1, dataUrl: 1, summary: 1, useCaseText: 1, favicon: 1, Category1st: 1, Category1stScore: 1, Category2nd: 1, Category2ndScore: 1, Category3rd: 1, Category3rdScore: 1 } }) // 수정: 카테고리와 점수 필드 추가
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage)
      .sort({ _id: -1 })
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

// Utility function to get unique categories and their count
async function getCategoriesAndCounts(collection) {
  const pipeline = [
    {
      $project: {
        categories: ["$Category1st", "$Category2nd", "$Category3rd"],
      },
    },
    { $unwind: "$categories" },
    { $group: { _id: "$categories", count: { $sum: 1 } } },
    { $project: { category: "$_id", count: 1, _id: 0 } },
    { $sort: { count: -1 } }, // 수정된 부분: 도큐멘트 수가 많은 순서대로 정렬
    //{ $sort: { category: 1 } },
  ];

  const categories = await collection.aggregate(pipeline).toArray();
  return categories;
}

app.get("/categories", async (req, res) => {
  console.log("GET /categories request received");

  try {
    const client = await getClient();
    const collection = client.db(dbName).collection(collectionName);

    console.log("Fetching categories from MongoDB");
    const categories = await getCategoriesAndCounts(collection);
    console.log("Categories fetched successfully");

    res.json({ categories });
  } catch (err) {
    res.status(500).send("Error fetching categories from MongoDB");
    console.error("Error fetching categories from MongoDB:", err);
  }
});

app.delete('/delete/:objId', async (req, res) => {
  const { objId } = req.params;

  try {
    const client = await getClient();
    const collection = client.db(dbName).collection(collectionName);
    const item = await collection.findOne({ _id: new ObjectId(objId) }, { projection: { _id: 1, dataId: 1, dataName: 1, dataUrl: 1 } });
    console.log('[deleteOne][item]', item);
    const result = await collection.deleteOne({ _id: new ObjectId(objId) });
    console.log('[deleteOne][result]', result);
    if (result.deletedCount === 1) {
      res.status(200).send(`Successfully deleted item with id ${objId}`);
    } else {
      res.status(404).send(`No item found with id ${objId}`);
    }
  } catch (err) {
    res.status(500).send(`Error deleting item with id ${objId}`);
    console.error(`Error deleting item with id ${objId}:`, err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});