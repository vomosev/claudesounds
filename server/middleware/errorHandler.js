'use strict';

/**
 * 404 handler — mounted after all routers.
 */
function notFound(req, res, next) { // eslint-disable-line no-unused-vars
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

/**
 * Centralised error handler.
 * Maps err.status / err.statusCode (default 500) to the HTTP response and
 * returns a consistent JSON shape. Stack traces are never leaked in production.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const isProduction = process.env.NODE_ENV === 'production';

  let status = Number(err && (err.status || err.statusCode)) || 500;
  if (!Number.isInteger(status) || status < 400 || status > 599) {
    status = 500;
  }

  let message = (err && err.message) || 'Internal server error';

  // Friendly mapping for common MySQL errors.
  if (err && typeof err.code === 'string') {
    if (err.code === 'ER_DUP_ENTRY') {
      status = 409;
      message = 'That record already exists';
    } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
      status = 400;
      message = 'Related record could not be found';
    } else if (
      err.code === 'ECONNREFUSED' ||
      err.code === 'PROTOCOL_CONNECTION_LOST' ||
      err.code === 'ER_ACCESS_DENIED_ERROR'
    ) {
      status = 503;
      message = 'Database unavailable';
    }
  }

  if (status >= 500) {
    console.error('[error]', req.method, req.originalUrl, err && err.stack ? err.stack : err);
    if (isProduction) {
      message = 'Internal server error';
    }
  } else {
    console.warn('[warn]', req.method, req.originalUrl, message);
  }

  if (res.headersSent) {
    return next(err);
  }

  const payload = { error: message };

  if (err && err.details !== undefined) {
    payload.details = err.details;
  }

  if (!isProduction && err && err.stack && status >= 500) {
    payload.stack = err.stack;
  }

  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };