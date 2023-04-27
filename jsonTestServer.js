// app.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');

dotenv.config({ path: path.join(__dirname, '.env.local') });

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const uri = process.env.MONGODB_CONNECTION_URI;
const dbName = process.env.MONGODB_DATABASE_NAME;
const collectionName = process.env.MONGODB_COLLECTION_NAME;

// jsonTestServer.js
app.get('/data', async (req, res) => {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  const page = parseInt(req.query.page) || 1;
  const searchQuery = req.query.search || "";
  const itemsPerPage = 9;

  try {
    await client.connect();
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
        { useCaseText: pattern }
      ]
    };

    const totalItems = await collection.countDocuments(searchQuery ? query : {});
    const data = await collection.find(searchQuery ? query : {})
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage)
      .toArray();

    res.json({ data, totalItems });
  } catch (err) {
    res.status(500).send('Error fetching data from MongoDB');
    console.error('Error fetching data from MongoDB:', err);
  } finally {
    await client.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});