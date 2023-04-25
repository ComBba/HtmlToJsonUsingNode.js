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

app.get('/data', async (req, res) => {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try { 
    await client.connect();
    const collection = client.db(dbName).collection(collectionName);
    const data = await collection.find().toArray();
    res.json(data);
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