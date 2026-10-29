// Loads backend/.env (local) and normalises variable names.
// Vercel's MongoDB Atlas integration provides MONGODB_URI; the app uses MONGO_URI.
require('dotenv').config({ quiet: true });

if (!process.env.MONGO_URI && process.env.MONGODB_URI) process.env.MONGO_URI = process.env.MONGODB_URI;

// The Vercel database URI often has no database name (".../?retryWrites=...").
// In that case use "hrpulse" so data doesn't land in the default "test" database.
// A name already in the URI (e.g. mongodb://127.0.0.1:27017/hrpulse) is always respected.
const uriHasDbName = (uri) => /^mongodb(\+srv)?:\/\/[^/]+\/[^?/]+/.test(uri || '');
if (process.env.MONGO_URI && !process.env.MONGO_DB_NAME && !uriHasDbName(process.env.MONGO_URI)) {
  process.env.MONGO_DB_NAME = 'hrpulse';
}
