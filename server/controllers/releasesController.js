const { pool } = require('../config/db');

const RELEASE_TYPES = ['single', 'ep', 'album'];
const RELEASE_STATUSES = ['draft', 'in_review', 'approved', 'live', 'takedown'];
const DEFAULT_STORES = [
  'Spotify',
  'Apple Music',
  'Amazon Music',
  'YouTube Music',
  'Deezer',
  'TIDAL',
];
const ARTWORK_COLORS = [
  '#7c5cff',
  '#ff7ab6',
  '#3ad1c6',
  '#ffb74d',
  '#5c9dff',
  '#c084fc',
  '#4ade80',
];

function badRequest(message, details) {
  const err = new Error(message);
  err.status = 400;
  if (details) err.details = details;
  return err;
}

function notFoundError(message) {
  const err = new Error(message || 'Release not found');
  err.status = 404;
  return err;
}

function randomFrom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function generateIsrc(trackNumber) {
  const year = String(new Date().getFullYear()).slice(-2);
  const designation = String(
    Math.floor(Math.random() * 99999) + (Number(trackNumber) || 0)
  )
    .padStart(5, '0')
    .slice(-5);
  return `US-CLS-${year}-${designation}`;
}

function generateUpc() {
  let digits = '';
  for (let i = 0; i < 12; i += 1) {
    digits += Math.floor(Math.random() * 10);
  }
  return digits;
}

function toDateOnly(value) {
  if (!value) return null;
  const str = String(value).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseDurationSeconds(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  const str = String(value).trim();
  if (/^\d+$/.test(str)) return Math.max(0, parseInt(str, 10));
  const parts = str.split(':').map((p) => p.trim());
  if (parts.length === 2 && parts.every((p) => /^\d+$/.test(p))) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    return (
      parseInt(parts[0], 10) * 3600 +
      parseInt(parts[1], 10) * 60 +
      parseInt(parts[2], 10)
    );
  }
  return 0;
}

function normaliseTracks(rawTracks) {
  if (!Array.isArray(rawTracks)) return [];
  return rawTracks
    .filter((t) => t && typeof t === 'object')
    .map((t, index) => ({
      track_number: Number(t.track_number) > 0 ? Number(t.track_number) : index + 1,
      title: typeof t.title === 'string' ? t.title.trim() : '',
      isrc:
        typeof t.isrc === 'string' && t.isrc.trim()
          ? t.isrc.trim().slice(0, 32)
          : null,
      duration_seconds: parseDurationSeconds(t.duration_seconds ?? t.duration),
      explicit: t.explicit ? 1 : 0,
    }))
    .filter((t) => t.title.length > 0);
}

/* GET /api/releases */
async function listReleases(req, res, next) {
  try {
    const userId = req.session.userId;
    const status = typeof req.query.status === 'string' ? req.query.status : '';

    const params = [userId];
    let sql = `
      SELECT r.id, r.title, r.artist_name, r.release_type, r.genre, r.upc,
             r.release_date, r.status, r.artwork_color, r.created_at, r.updated_at,
             (SELECT COUNT(*) FROM tracks t WHERE t.release_id = r.id) AS track_count,
             (SELECT COUNT(*) FROM release_stores rs WHERE rs.release_id = r.id) AS store_count,
             (SELECT COUNT(*) FROM release_stores rs2 WHERE rs2.release_id = r.id AND rs2.delivered = 1) AS delivered_count
      FROM releases r
      WHERE r.user_id = ?
    `;

    if (status && status !== 'all') {
      if (!RELEASE_STATUSES.includes(status)) {
        throw badRequest(
          `Invalid status filter. Allowed: ${RELEASE_STATUSES.join(', ')}`
        );
      }
      sql += ' AND r.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY r.release_date DESC, r.id DESC';

    const [rows] = await pool.execute(sql, params);
    res.json({ releases: rows });
  } catch (err) {
    next(err);
  }
}

/* POST /api/releases */
async function createRelease(req, res, next) {
  let connection;
  try {
    const userId = req.session.userId;
    const body = req.body || {};

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const artistName =
      typeof body.artist_name === 'string' ? body.artist_name.trim() : '';
    const releaseType =
      typeof body.release_type === 'string'
        ? body.release_type.trim().toLowerCase()
        : '';
    const genre = typeof body.genre === 'string' ? body.genre.trim() : '';
    const releaseDate = toDateOnly(body.release_date);
    const status =
      typeof body.status === 'string' && RELEASE_STATUSES.includes(body.status)
        ? body.status
        : 'draft';
    const artworkColor =
      typeof body.artwork_color === 'string' &&
      /^#[0-9a-fA-F]{3,8}$/.test(body.artwork_color.trim())
        ? body.artwork_color.trim()
        : randomFrom(ARTWORK_COLORS);

    const fieldErrors = {};
    if (!title) fieldErrors.title = 'Title is required';
    if (title.length > 200) fieldErrors.title = 'Title is too long';
    if (!artistName) fieldErrors.artist_name = 'Artist name is required';
    if (!RELEASE_TYPES.includes(releaseType)) {
      fieldErrors.release_type = `Release type must be one of: ${RELEASE_TYPES.join(', ')}`;
    }
    if (!releaseDate) fieldErrors.release_date = 'A valid release date is required';

    const tracks = normaliseTracks(body.tracks);
    if (tracks.length === 0) {
      fieldErrors.tracks = 'At least one track with a title is required';
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw badRequest('Validation failed', fieldErrors);
    }

    connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        `INSERT INTO releases
           (user_id, title, artist_name, release_type, genre, upc, release_date, status, artwork_color)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          title,
          artistName,
          releaseType,
          genre || null,
          generateUpc(),
          releaseDate,
          status,
          artworkColor,
        ]
      );

      const releaseId = result.insertId;

      for (let i = 0; i < tracks.length; i += 1) {
        const track = tracks[i];
        await connection.execute(
          `INSERT INTO tracks
             (release_id, track_number, title, isrc, duration_seconds, explicit)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            releaseId,
            i + 1,
            track.title,
            track.isrc || generateIsrc(i + 1),
            track.duration_seconds,
            track.explicit,
          ]
        );
      }

      for (let i = 0; i < DEFAULT_STORES.length; i += 1) {
        await connection.execute(
          `INSERT INTO release_stores (release_id, store_name, delivered, delivered_at)
           VALUES (?, ?, 0, NULL)`,
          [releaseId, DEFAULT_STORES[i]]
        );
      }

      await connection.commit();

      const [rows] = await connection.execute(
        `SELECT id, title, artist_name, release_type, genre, upc, release_date,
                status, artwork_color, created_at, updated_at
         FROM releases WHERE id = ? AND user_id = ?`,
        [releaseId, userId]
      );

      res.status(201).json({ release: rows[0] || null });
    } catch (txErr) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        /* ignore rollback failure */
      }
      throw txErr;
    }
  } catch (err) {
    next(err);
  } finally {
    if (connection) connection.release();
  }
}

/* GET /api/releases/:id */
async function getRelease(req, res, next) {
  try {
    const userId = req.session.userId;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw badRequest('Invalid release id');
    }

    const [releaseRows] = await pool.execute(
      `SELECT id, title, artist_name, release_type, genre, upc, release_date,
              status, artwork_color, created_at, updated_at
       FROM releases WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (releaseRows.length === 0) throw notFoundError();

    const [tracks] = await pool.execute(
      `SELECT id, track_number, title, isrc, duration_seconds, explicit
       FROM tracks WHERE release_id = ? ORDER BY track_number ASC, id ASC`,
      [id]
    );

    const [stores] = await pool.execute(
      `SELECT id, store_name, delivered, delivered_at
       FROM release_stores WHERE release_id = ? ORDER BY store_name ASC`,
      [id]
    );

    res.json({ release: releaseRows[0], tracks, stores });
  } catch (err) {
    next(err);
  }
}

/* PATCH /api/releases/:id */
async function updateRelease(req, res, next) {
  try {
    const userId = req.session.userId;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw badRequest('Invalid release id');
    }

    const [existing] = await pool.execute(
      'SELECT id FROM releases WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    if (existing.length === 0) throw notFoundError();

    const body = req.body || {};
    const updates = [];
    const params = [];
    const fieldErrors = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) fieldErrors.title = 'Title cannot be empty';
      else {
        updates.push('title = ?');
        params.push(title.slice(0, 200));
      }
    }

    if (body.artist_name !== undefined) {
      const artistName = String(body.artist_name).trim();
      if (!artistName) fieldErrors.artist_name = 'Artist name cannot be empty';
      else {
        updates.push('artist_name = ?');
        params.push(artistName.slice(0, 200));
      }
    }

    if (body.release_type !== undefined) {
      const releaseType = String(body.release_type).trim().toLowerCase();
      if (!RELEASE_TYPES.includes(releaseType)) {
        fieldErrors.release_type = `Release type must be one of: ${RELEASE_TYPES.join(', ')}`;
      } else {
        updates.push('release_type = ?');
        params.push(releaseType);
      }
    }

    if (body.genre !== undefined) {
      const genre = String(body.genre).trim();
      updates.push('genre = ?');
      params.push(genre ? genre.slice(0, 100) : null);
    }

    if (body.release_date !== undefined) {
      const releaseDate = toDateOnly(body.release_date);
      if (!releaseDate) fieldErrors.release_date = 'A valid release date is required';
      else {
        updates.push('release_date = ?');
        params.push(releaseDate);
      }
    }

    if (body.status !== undefined) {
      const status = String(body.status).trim().toLowerCase();
      if (!RELEASE_STATUSES.includes(status)) {
        fieldErrors.status = `Status must be one of: ${RELEASE_STATUSES.join(', ')}`;
      } else {
        updates.push('status = ?');
        params.push(status);
      }
    }

    if (body.artwork_color !== undefined) {
      const color = String(body.artwork_color).trim();
      if (!/^#[0-9a-fA-F]{3,8}$/.test(color)) {
        fieldErrors.artwork_color = 'Artwork colour must be a hex value';
      } else {
        updates.push('artwork_color = ?');
        params.push(color);
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw badRequest('Validation failed', fieldErrors);
    }

    if (updates.length === 0) {
      throw badRequest('No valid fields supplied to update');
    }

    updates.push('updated_at = NOW()');
    params.push(id, userId);

    await pool.execute(
      `UPDATE releases SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    const [rows] = await pool.execute(
      `SELECT id, title, artist_name, release_type, genre, upc, release_date,
              status, artwork_color, created_at, updated_at
       FROM releases WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    res.json({ release: rows[0] || null });
  } catch (err) {
    next(err);
  }
}

/* DELETE /api/releases/:id */
async function deleteRelease(req, res, next) {
  let connection;
  try {
    const userId = req.session.userId;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw badRequest('Invalid release id');
    }

    connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [existing] = await connection.execute(
        'SELECT id FROM releases WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      if (existing.length === 0) throw notFoundError();

      await connection.execute('DELETE FROM streams WHERE release_id = ?', [id]);
      await connection.execute(
        'UPDATE campaigns SET release_id = NULL WHERE release_id = ? AND user_id = ?',
        [id, userId]
      );
      await connection.execute('DELETE FROM release_stores WHERE release_id = ?', [id]);
      await connection.execute('DELETE FROM tracks WHERE release_id = ?', [id]);
      await connection.execute('DELETE FROM releases WHERE id = ? AND user_id = ?', [
        id,
        userId,
      ]);

      await connection.commit();
      res.json({ success: true, id });
    } catch (txErr) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        /* ignore rollback failure */
      }
      throw txErr;
    }
  } catch (err) {
    next(err);
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  listReleases,
  createRelease,
  getRelease,
  updateRelease,
  deleteRelease,
};