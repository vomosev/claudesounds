'use strict';

const { pool } = require('../config/db');

/**
 * Rejects the request when there is no authenticated session.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return next();
}

/**
 * Loads the signed-in user onto req.user when a session exists.
 * Never throws for anonymous visitors — it simply leaves req.user null.
 */
async function attachUser(req, res, next) {
  req.user = null;

  if (!req.session || !req.session.userId) {
    return next();
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, email, display_name, artist_name, role FROM users WHERE id = ? LIMIT 1',
      [req.session.userId]
    );

    if (!rows || rows.length === 0) {
      // Stale session pointing at a deleted user — clear it.
      if (typeof req.session.destroy === 'function') {
        req.session.destroy(() => next());
        return;
      }
      return next();
    }

    const row = rows[0];
    req.user = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      artistName: row.artist_name,
      role: row.role,
    };

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth, attachUser };