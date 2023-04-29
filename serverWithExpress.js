//serverWithExpress.js
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
  console.log('GET /data request received'); // 로그 추가: 요청 받음
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  const page = parseInt(req.query.page) || 1;
  const searchQuery = req.query.search || "";
  const itemsPerPage = 9;

  try {
    console.log('Connecting to MongoDB'); // 로그 추가: MongoDB 연결 시도
    await client.connect();
    console.log('Connected to MongoDB'); // 로그 추가: MongoDB 연결 성공
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

    console.log('Fetching data from MongoDB'); // 로그 추가: MongoDB에서 데이터 가져오기 시작
    const totalItems = await collection.countDocuments(searchQuery ? query : {});
    console.log('Number of data with MongoDB query.'); // 로그 추가: MongoDB에서 가져올 데이터 카운트
    //const data = await collection.find(searchQuery ? query : {})
    const data = await collection.find(searchQuery ? query : {}, { projection: { dataId: 1, dataName: 1, dataTask: 1, dataUrl: 1, summary: 1, useCaseText: 1 } })
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage)
      .toArray();
    console.log('Data fetched successfully'); // 로그 추가: 데이터 가져오기 성공

    res.json({ data, totalItems });
  } catch (err) {
    res.status(500).send('Error fetching data from MongoDB');
    console.error('Error fetching data from MongoDB:', err);
  } finally {
    console.log('Closing MongoDB connection'); // 로그 추가: MongoDB 연결 종료
    await client.close();
  }
});

app.get('/image/:dataId', async (req, res) => {
  const { dataId } = req.params;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();
    const collection = client.db(dbName).collection(collectionName);

    const item = await collection.findOne({ dataId: dataId }, { projection: { screenShot: 1, imgSrc: 1 } });

    if (item && item.screenShot) {
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
  } finally {
    await client.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});