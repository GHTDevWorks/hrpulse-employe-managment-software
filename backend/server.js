require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');
const routes = require('./routes');
const closeExpiredSessions = require('./utils/autoSignOut');
const { notFound, errorHandler } = require('./middleware/error');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('JWT_SECRET must be set to a long random string (16+ characters). See .env.example.');
  process.exit(1);
}

const app = express();
const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim());

app.set('trust proxy', 1);
app.use(helmet());
// Allowed: origins in CLIENT_URL, plus any http://localhost:<port> so Vite can pick a free port.
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => res.json({ name: 'HRPulse API', version: '2.0.0', status: 'ok' }));
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5005;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`HRPulse API running on port ${PORT}`));
  // Close forgotten sessions every 10 minutes even if nobody opens the app.
  setInterval(() => closeExpiredSessions().catch((e) => console.error('Auto sign-out failed:', e.message)), 10 * 60 * 1000);
});
