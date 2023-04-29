//serverWithFastify.js
const fastify = require('fastify')({
  logger: true,
  ignoreTrailingSlash: true,
});
const path = require('path');
const dotenv = require('dotenv');
const { MongoClient } = require('mongodb');
const fastifyStatic = require('@fastify/static');
const fastifyCompress = require('@fastify/compress');

dotenv.config({ path: path.join(__dirname, '.env.local') });

fastify.register(fastifyCompress, {
  encodings: ['gzip', 'deflate'],
});
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
});

const uri = process.env.MONGODB_CONNECTION_URI;
const dbName = process.env.MONGODB_DATABASE_NAME;
const collectionName = process.env.MONGODB_COLLECTION_NAME;

fastify.get('/data', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const searchQuery = req.query.search || "";
  const itemsPerPage = 9;

  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
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
        { useCaseText: pattern },
        { category: pattern },
      ]
    };

    const totalItems = await collection.countDocuments(searchQuery ? query : {});
    const data = await collection.find(searchQuery ? query : {}, { projection: { dataId: 1, dataName: 1, dataTask: 1, dataUrl: 1, summary: 1, useCaseText: 1 } })
      .skip((page - 1) * itemsPerPage)
      .limit(itemsPerPage)
      .toArray();

    res.send({ data, totalItems });
  } catch (err) {
    res.status(500).send('Error fetching data from MongoDB');
    console.error('Error fetching data from MongoDB:', err);
  } finally {
    await client.close();
  }
});

fastify.get('/image/:dataId', async (req, res) => {
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
fastify.listen({ port: PORT }, () => {
  console.log(`Server listening on port ${PORT}`);
});