'use strict';

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const VALID_ROLES = ['artist', 'label', 'admin'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function safeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    artist_name: row.artist_name,
    role: row.role,
    created_at: row.created_at,
  };
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

async function signup(req, res, next) {
  try {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';
    const artistName =
      typeof body.artist_name === 'string' && body.artist_name.trim()
        ? body.artist_name.trim()
        : displayName;
    let role = typeof body.role === 'string' ? body.role.trim().toLowerCase() : 'artist';

    if (!EMAIL_RE.test(email)) {
      return next(badRequest('A valid email address is required'));
    }
    if (password.length < 8) {
      return next(badRequest('Password must be at least 8 characters long'));
    }
    if (!displayName) {
      return next(badRequest('Display name is required'));
    }
    if (!VALID_ROLES.includes(role) || role === 'admin') {
      role = 'artist';
    }

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (existing.length > 0) {
      const err = new Error('An account with that email already exists');
      err.status = 409;
      return next(err);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      'INSERT INTO users (email, password_hash, display_name, artist_name, role) VALUES (?, ?, ?, ?, ?)',
      [email, passwordHash, displayName, artistName, role]
    );

    const [rows] = await pool.execute(
      'SELECT id, email, display_name, artist_name, role, created_at FROM users WHERE id = ? LIMIT 1',
      [result.insertId]
    );

    const user = safeUser(rows[0]);

    req.session.regenerate((regenErr) => {
      if (regenErr) return next(regenErr);
      req.session.userId = user.id;
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        return res.status(201).json({ user });
      });
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      const dup = new Error('An account with that email already exists');
      dup.status = 409;
      return next(dup);
    }
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return next(badRequest('Email and password are required'));
    }

    const [rows] = await pool.execute(
      'SELECT id, email, password_hash, display_name, artist_name, role, created_at FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    const row = rows[0];
    if (!row) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      return next(err);
    }

    const ok = await bcrypt.compare(password, row.password_hash || '');
    if (!ok) {
      const err = new Error('Invalid email or password');
      err.status = 401;
      return next(err);
    }

    const user = safeUser(row);

    req.session.regenerate((regenErr) => {
      if (regenErr) return next(regenErr);
      req.session.userId = user.id;
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        return res.json({ user });
      });
    });
  } catch (err) {
    return next(err);
  }
}

function logout(req, res, next) {
  if (!req.session) {
    res.clearCookie('claudesounds.sid');
    return res.json({ ok: true });
  }
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('claudesounds.sid', {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      domain: process.env.SESSION_COOKIE_DOMAIN || undefined,
    });
    return res.json({ ok: true });
  });
}

async function me(req, res, next) {
  try {
    if (req.user) {
      return res.json({ user: safeUser(req.user) });
    }
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const [rows] = await pool.execute(
      'SELECT id, email, display_name, artist_name, role, created_at FROM users WHERE id = ? LIMIT 1',
      [req.session.userId]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.json({ user: safeUser(rows[0]) });
  } catch (err) {
    return next(err);
  }
}

module.exports = { signup, login, logout, me };