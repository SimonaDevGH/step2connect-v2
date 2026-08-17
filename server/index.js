require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const contentRoutes = require('./routes/content');
const adminRoutes   = require('./routes/admin');

const app  = express();
// In production Express serves both the API and the Vite-built SPA on port 5000.
// In development the API runs on 3001 (Vite dev server proxies /api there).
const PORT = process.env.NODE_ENV === 'production'
  ? (process.env.PORT || 5000)
  : (process.env.API_PORT || 3001);

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://step-2-connect-v-2.replit.app',
  'https://step2connect.it',
  // dev origins
  /^https?:\/\/.*\.replit\.dev$/,
  /^http:\/\/localhost:\d+$/,
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / non-browser
    const ok = ALLOWED_ORIGINS.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    ok ? cb(null, true) : cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ── BODY PARSING ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.use('/api/content',       contentRoutes);
app.use('/api/admin/content', adminRoutes);

// ── HEALTH ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── STATIC (prod) ─────────────────────────────────────────────────────────────
// In production Vite builds into dist/ and Express serves it.
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get(/(.*)/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`[server] API running on port ${PORT}`);
});
