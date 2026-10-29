require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const routes = require('./routes');
const closeExpiredSessions = require('./utils/autoSignOut');
const { notFound, errorHandler } = require('./middleware/error');

const onVercel = !!process.env.VERCEL;
const configError = !process.env.MONGO_URI
  ? 'MONGO_URI is not set. Add it to backend/.env (local) or the Vercel project environment variables.'
  : !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16
    ? 'JWT_SECRET must be set to a long random string (16+ characters).'
    : '';

if (configError && !onVercel) {
  console.error(configError);
  process.exit(1);
}

const app = express();
const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet());
// Allowed: origins in CLIENT_URL, plus any http://localhost:<port> so Vite can pick a free port.
// On Vercel the frontend and API share one domain, so CORS is not needed there.
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => res.json({ name: 'HRPulse API', version: '2.0.0', status: 'ok' }));
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date(), configured: !configError }));

// Make sure settings are valid and the database is connected before any API route runs.
app.use('/api', async (req, res, next) => {
  if (configError) return res.status(500).json({ message: `Server not configured: ${configError}` });
  try {
    await connectDB();
    return next();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    return res.status(503).json({ message: 'Cannot connect to the database. Check MONGO_URI and the MongoDB Atlas network access list.' });
  }
});

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

if (!onVercel) {
  const PORT = process.env.PORT || 5005;
  connectDB()
    .then(() => {
      app.listen(PORT, () => console.log(`HRPulse API running on port ${PORT}`));
      // Close forgotten sessions every 10 minutes. (On Vercel this happens on each request instead.)
      setInterval(() => closeExpiredSessions().catch((e) => console.error('Auto sign-out failed:', e.message)), 10 * 60 * 1000);
    })
    .catch((err) => {
      console.error(`MongoDB connection error: ${err.message}`);
      process.exit(1);
    });
}

module.exports = app;
