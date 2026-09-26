'use strict';

const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const {
  isEmail,
  isNonEmptyString,
  isOneOf,
  badRequest,
} = require('../utils/validate');

const SALT_ROUNDS = 10;
const VALID_ROLES = ['artist', 'label', 'admin'];

function shapeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    artistName: row.artist_name,
    role: row.role,
  };
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session || typeof req.session.regenerate !== 'function') {
      resolve();
      return;
    }
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session || typeof req.session.save !== 'function') {
      resolve();
      return;
    }
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

async function signup(req, res, next) {
  try {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    const artistName =
      typeof body.artistName === 'string' && body.artistName.trim()
        ? body.artistName.trim()
        : displayName;
    const role = typeof body.role === 'string' && body.role ? body.role : 'artist';

    const errors = {};
    if (!isEmail(email)) errors.email = 'A valid email address is required';
    if (!isNonEmptyString(password, 200) || password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    if (!isNonEmptyString(displayName, 120)) {
      errors.displayName = 'Display name is required';
    }
    if (!isNonEmptyString(artistName, 120)) {
      errors.artistName = 'Artist or label name is required';
    }
    if (!isOneOf(role, VALID_ROLES)) {
      errors.role = 'Account type must be artist or label';
    }

    if (Object.keys(errors).length > 0) {
      throw badRequest('Please correct the highlighted fields', errors);
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      throw badRequest('An account with that email already exists', {
        email: 'Email is already registered',
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, display_name, artist_name, role) VALUES (?, ?, ?, ?, ?)',
      [email, passwordHash, displayName, artistName, role]
    );

    const [rows] = await pool.query(
      'SELECT id, email, display_name, artist_name, role FROM users WHERE id = ? LIMIT 1',
      [result.insertId]
    );
    const user = shapeUser(rows[0]);

    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);

    res.status(201).json({ user });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      next(
        badRequest('An account with that email already exists', {
          email: 'Email is already registered',
        })
      );
      return;
    }
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    const errors = {};
    if (!isEmail(email)) errors.email = 'A valid email address is required';
    if (!isNonEmptyString(password, 200)) errors.password = 'Password is required';

    if (Object.keys(errors).length > 0) {
      throw badRequest('Please correct the highlighted fields', errors);
    }

    const [rows] = await pool.query(
      'SELECT id, email, password_hash, display_name, artist_name, role FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    const record = rows[0];
    let matches = false;
    try {
      matches = await bcrypt.compare(password, record.password_hash || '');
    } catch (_e) {
      matches = false;
    }

    if (!matches) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      throw err;
    }

    const user = shapeUser(record);

    await regenerateSession(req);
    req.session.userId = user.id;
    await saveSession(req);

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    if (!req.session) {
      res.json({ ok: true });
      return;
    }
    req.session.destroy((err) => {
      if (err) {
        next(err);
        return;
      }
      res.clearCookie('claudesounds.sid', {
        httpOnly: true,
        secure: String(process.env.SSL_ENABLED).toLowerCase() === 'true',
        sameSite: 'none',
        domain: process.env.SESSION_COOKIE_DOMAIN || undefined,
        path: '/',
      });
      res.json({ ok: true });
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    if (!req.session || !req.session.userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const [rows] = await pool.query(
      'SELECT id, email, display_name, artist_name, role FROM users WHERE id = ? LIMIT 1',
      [req.session.userId]
    );

    if (rows.length === 0) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    res.json({ user: shapeUser(rows[0]) });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, logout, me };