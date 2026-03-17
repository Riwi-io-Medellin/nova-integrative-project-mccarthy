// config/mongo.js
const mongoose = require('mongoose');

const connectMongo = async () => {
  if (!process.env.MONGO_URI) return;
  try {
    await mongoose.connect(process.env.MONGO_URI, { dbName: 'nova' });
  } catch {}
};

module.exports = connectMongo;
