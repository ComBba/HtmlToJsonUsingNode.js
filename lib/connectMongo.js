const MongoClient = require('mongodb').MongoClient;

const path = require('path');
const dotenv = require('dotenv');
const envPath = path.join(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

async function checkIfExistsInMongoDB(dataId) {
  const uri = process.env.MONGODB_CONNECTION_URI; // Replace with your MongoDB connection URI
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const collection = client.db(process.env.MONGODB_DATABASE_NAME).collection(process.env.MONGODB_COLLECTION_NAME);
    const count = await collection.countDocuments({ dataId: dataId });
    return count > 0;
  } catch (error) {
    console.error(`Error checking if dataId ${dataId} exists in MongoDB:`, error);
    // Return false to allow the script to continue processing other elements
    return false;
  } finally {
    // 데이터베이스 작업을 완료한 후에는 연결을 닫아야 합니다.
    await client.close();
  }
}

async function insertIntoMongoDB(data) {
  const uri = process.env.MONGODB_CONNECTION_URI; // Replace with your MongoDB connection URI
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();
    const collection = client.db(process.env.MONGODB_DATABASE_NAME).collection(process.env.MONGODB_COLLECTION_NAME);
    const filter = { dataId: data.dataId }; // Filter using the unique dataId
    const update = { $set: data };
    const options = { upsert: true }; // Enable upsert

    const result = await collection.updateOne(filter, update, options);
    if (result.upsertedId) {
      console.log(`Data inserted with ID: ${result.upsertedId._id}`);
    } else {
      console.log(`Data updated with ID: ${data.dataId}`);
    }
  } catch (err) {
    console.error('Error saving data to MongoDB:', err);
  } finally {
    await client.close();
  }
}

module.exports = {
    checkIfExistsInMongoDB,
    insertIntoMongoDB
};