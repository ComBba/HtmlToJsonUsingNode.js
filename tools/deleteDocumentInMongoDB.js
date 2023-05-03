// deleteDocumentInMongoDB.js
const MongoClient = require('mongodb').MongoClient;

const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

async function deleteDocumentsWithUrlPrefix(urlPrefix) {
  const uri = process.env.MONGODB_CONNECTION_URI;
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  let deletedCount = 0;

  try {
    await client.connect();
    const collection = client.db(process.env.MONGODB_DATABASE_NAME).collection(process.env.MONGODB_COLLECTION_NAME);
    const query = { dataUrl: { $regex: `^${urlPrefix}` } };

    const result = await collection.deleteMany(query);

    deletedCount = result.deletedCount;
    console.log(`${deletedCount} documents deleted with dataUrl starting with "${urlPrefix}"`);
  } catch (err) {
    console.error(`Error deleting documents with dataUrl starting with "${urlPrefix}":`, err);
  } finally {
    await client.close();
    return deletedCount;
  }
}

(async () => {
  const urlPrefixes = [
    'https://chrome.google.com/',
    'https://play.google.com/',
    'https://apps.apple.com/',
    'https://workspace.google.com/'
  ];

  for (const urlPrefix of urlPrefixes) {
    await deleteDocumentsWithUrlPrefix(urlPrefix);
  }
})();
