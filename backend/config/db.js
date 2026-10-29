const mongoose = require('mongoose');

// One shared connection. On Vercel the function is reused between requests,
// so we connect once and reuse the same promise.
let connecting = null;

const connectDB = () => {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (!process.env.MONGO_URI) return Promise.reject(new Error('MONGO_URI is not set'));
  if (!connecting) {
    connecting = mongoose
      .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
      .then((conn) => {
        console.log(`MongoDB connected: ${conn.connection.host}`);
        return conn.connection;
      })
      .catch((err) => {
        connecting = null; // allow a retry on the next request
        throw err;
      });
  }
  return connecting;
};

module.exports = connectDB;
