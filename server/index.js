'use strict';

require('dotenv').config();

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const { pool, checkDatabaseConnection } = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const releasesRoutes = require('./routes/releases.routes');
const publishingRoutes = require('./routes/publishing.routes');
const campaignsRoutes = require('./routes/campaigns.routes');
const analyticsRoutes = require('./routes/analytics.routes');

const app = express();

const PORT = parseInt(process.env.PORT, 10) || 4107;
const NODE_ENV = process.env.NODE_ENV || 'development';
const SSL_ENABLED = String(process.env.SSL_ENABLED || '').toLowerCase() === 'true';

app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ---------------------------------------------------------------- CORS -- */

const ALLOWED_HOST_SUFFIX = '.arx-app.com';

function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin / curl / server-to-server
  let parsed;
  try {
    parsed = new URL(origin);
  } catch (err) {
    return false;
  }
  const { protocol, hostname } = parsed;

  if (protocol === 'https:' && (hostname.endsWith(ALLOWED_HOST_SUFFIX) || hostname === 'arx-app.com')) {
    return true;
  }

  if (NODE_ENV !== 'production' && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0')) {
    return true;
  }

  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* ------------------------------------------------------------- Parsers -- */

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

/* ------------------------------------------------------------ Sessions -- */

const sessionStore = new MySQLStore(
  {
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 7 * 24 * 60 * 60 * 1000,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  },
  pool
);

sessionStore.on('error', (err) => {
  console.error('[session-store] error:', err && err.message ? err.message : err);
});

const cookieOptions = {
  httpOnly: true,
  secure: SSL_ENABLED,
  sameSite: SSL_ENABLED ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/'
};

if (process.env.SESSION_COOKIE_DOMAIN) {
  cookieOptions.domain = process.env.SESSION_COOKIE_DOMAIN;
}

app.use(
  session({
    name: 'claudesounds.sid',
    secret: process.env.SESSION_SECRET || 'claudesounds-development-secret-change-me',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: cookieOptions
  })
);

/* -------------------------------------------------------------- Health -- */

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'claudesounds-api', env: NODE_ENV, time: new Date().toISOString() });
});

app.get('/health/db', async (req, res) => {
  try {
    await checkDatabaseConnection();
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('[health/db] failed:', err && err.message ? err.message : err);
    res.status(503).json({ status: 'error', database: 'unavailable', error: 'Database connection failed' });
  }
});

/* -------------------------------------------------------------- Routes -- */

app.use('/api/auth', authRoutes);
app.use('/api/releases', releasesRoutes);
app.use('/api/publishing', publishingRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'ClaudeSounds API',
    endpoints: ['/health', '/health/db', '/api/auth', '/api/releases', '/api/publishing', '/api/campaigns', '/api/analytics']
  });
});

/* ------------------------------------------------------- Error handling -- */

app.use(notFound);
app.use(errorHandler);

/* --------------------------------------------------------------- Boot -- */

function readIfExists(filePath) {
  if (!filePath) return null;
  try {
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) return null;
    return fs.readFileSync(resolved);
  } catch (err) {
    console.error('[ssl] unable to read file', filePath, err && err.message ? err.message : err);
    return null;
  }
}

function createServer() {
  if (SSL_ENABLED) {
    const cert = readIfExists(process.env.SSL_CERT_PATH || '/home/arx-app/backends/certs/certificate.crt');
    const key = readIfExists(process.env.SSL_KEY_PATH || '/home/arx-app/backends/certs/private.key');
    const ca = readIfExists(process.env.SSL_CA_PATH);

    if (cert && key) {
      const options = { cert, key };
      if (ca) options.ca = ca;
      console.log('[server] TLS enabled — starting HTTPS server');
      return https.createServer(options, app);
    }

    console.warn('[server] SSL_ENABLED is true but certificate/key could not be read — falling back to HTTP');
  }

  return http.createServer(app);
}

const server = createServer();

server.on('error', (err) => {
  console.error('[server] failed to start:', err && err.message ? err.message : err);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[server] ClaudeSounds API listening on 0.0.0.0:${PORT} (${SSL_ENABLED ? 'https' : 'http'})`);
  try {
    await checkDatabaseConnection();
    console.log('[server] database connection OK');
  } catch (err) {
    console.error('[server] database connection FAILED:', err && err.message ? err.message : err);
  }
});

function shutdown(signal) {
  console.log(`[server] received ${signal}, shutting down...`);
  server.close(() => {
    pool
      .end()
      .catch((err) => console.error('[server] error closing pool:', err && err.message ? err.message : err))
      .finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception:', err && err.message ? err.message : err);
});

module.exports = app;