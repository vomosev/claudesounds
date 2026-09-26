'use strict';

const { pool } = require('../config/db');
const {
  isNonEmptyString,
  isOneOf,
  isIsoDate,
  toInt,
  badRequest,
} = require('../utils/validate');

const RELEASE_TYPES = ['single', 'ep', 'album'];
const RELEASE_STATUSES = ['draft', 'in_review', 'approved', 'live', 'takedown'];
const STORES = [
  'Spotify',
  'Apple Music',
  'Amazon Music',
  'YouTube Music',
  'Deezer',
  'Tidal',
];

function normaliseColor(value) {
  if (!isNonEmptyString(value, 16)) return null;
  const trimmed = String(value).trim();
  if (!/^#?[0-9a-zA-Z-]{1,15}$/.test(trimmed)) return null;
  return trimmed;
}

function parseDuration(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  const str = String(value).trim();
  if (/^\d+$/.test(str)) return Math.max(0, parseInt(str, 10));
  const parts = str.split(':');
  if (parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  if (
    parts.length === 3 &&
    parts.every((p) => /^\d+$/.test(p))
  ) {
    return (
      parseInt(parts[0], 10) * 3600 +
      parseInt(parts[1], 10) * 60 +
      parseInt(parts[2], 10)
    );
  }
  return 0;
}

function validateTracks(rawTracks) {
  if (rawTracks === undefined || rawTracks === null) return [];
  if (!Array.isArray(rawTracks)) {
    throw badRequest('tracks must be an array');
  }
  const tracks = [];
  rawTracks.forEach((track, index) => {
    if (!track || typeof track !== 'object') {
      throw badRequest(`Track ${index + 1} is invalid`);
    }
    if (!isNonEmptyString(track.title, 255)) {
      throw badRequest(`Track ${index + 1} requires a title`);
    }
    tracks.push({
      track_number: toInt(track.trackNumber, index + 1) || index + 1,
      title: String(track.title).trim(),
      isrc: isNonEmptyString(track.isrc, 32) ? String(track.isrc).trim() : null,
      duration_seconds: parseDuration(track.duration || track.durationSeconds),
      explicit: track.explicit ? 1 : 0,
      songwriters: isNonEmptyString(track.songwriters, 2000)
        ? String(track.songwriters).trim()
        : null,
    });
  });
  return tracks;
}

async function listReleases(req, res, next) {
  try {
    const userId = req.session.userId;
    const { status, search } = req.query || {};

    const params = [userId];
    let sql = `
      SELECT
        r.id, r.user_id, r.title, r.artist_name, r.release_type,
        r.primary_genre, r.label, r.upc, r.release_date, r.status,
        r.artwork_color, r.created_at, r.updated_at,
        (SELECT COUNT(*) FROM tracks t WHERE t.release_id = r.id) AS track_count,
        (SELECT COUNT(*) FROM store_deliveries d WHERE d.release_id = r.id) AS delivery_count,
        (SELECT COUNT(*) FROM store_deliveries d WHERE d.release_id = r.id AND d.status = 'live') AS live_delivery_count
      FROM releases r
      WHERE r.user_id = ?
    `;

    if (status && String(status) !== 'all') {
      if (!isOneOf(String(status), RELEASE_STATUSES)) {
        throw badRequest('Invalid status filter', { status: 'unknown status' });
      }
      sql += ' AND r.status = ?';
      params.push(String(status));
    }

    if (isNonEmptyString(search, 120)) {
      sql += ' AND (r.title LIKE ? OR r.artist_name LIKE ? OR r.primary_genre LIKE ?)';
      const like = `%${String(search).trim()}%`;
      params.push(like, like, like);
    }

    sql += ' ORDER BY r.release_date DESC, r.id DESC LIMIT 200';

    const [rows] = await pool.query(sql, params);
    res.json({ releases: rows });
  } catch (err) {
    next(err);
  }
}

async function getRelease(req, res, next) {
  try {
    const userId = req.session.userId;
    const id = toInt(req.params.id, 0);
    if (!id) throw badRequest('Invalid release id');

    const [releases] = await pool.query(
      `SELECT id, user_id, title, artist_name, release_type, primary_genre,
              label, upc, release_date, status, artwork_color, created_at, updated_at
         FROM releases
        WHERE id = ? AND user_id = ?
        LIMIT 1`,
      [id, userId]
    );

    if (!releases.length) {
      return res.status(404).json({ error: 'Release not found' });
    }

    const [tracks] = await pool.query(
      `SELECT id, release_id, track_number, title, isrc, duration_seconds, explicit, songwriters
         FROM tracks
        WHERE release_id = ?
        ORDER BY track_number ASC, id ASC`,
      [id]
    );

    const [deliveries] = await pool.query(
      `SELECT id, release_id, store_name, status, delivered_at
         FROM store_deliveries
        WHERE release_id = ?
        ORDER BY store_name ASC`,
      [id]
    );

    const [stats] = await pool.query(
      `SELECT stat_date, platform,
              SUM(streams) AS streams,
              SUM(listeners) AS listeners,
              SUM(revenue_cents) AS revenue_cents
         FROM stream_stats
        WHERE release_id = ? AND stat_date >= (CURDATE() - INTERVAL 30 DAY)
        GROUP BY stat_date, platform
        ORDER BY stat_date ASC`,
      [id]
    );

    res.json({
      release: releases[0],
      tracks,
      deliveries,
      stats: stats.map((s) => ({
        date: s.stat_date,
        platform: s.platform,
        streams: Number(s.streams) || 0,
        listeners: Number(s.listeners) || 0,
        revenueCents: Number(s.revenue_cents) || 0,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function createRelease(req, res, next) {
  let connection;
  try {
    const userId = req.session.userId;
    const body = req.body || {};
    const errors = {};

    if (!isNonEmptyString(body.title, 255)) errors.title = 'Title is required';
    if (!isNonEmptyString(body.artistName, 255)) {
      errors.artistName = 'Artist name is required';
    }
    if (!isOneOf(body.releaseType, RELEASE_TYPES)) {
      errors.releaseType = 'Release type must be single, ep or album';
    }
    if (!isNonEmptyString(body.primaryGenre, 120)) {
      errors.primaryGenre = 'Primary genre is required';
    }
    if (!isIsoDate(body.releaseDate)) {
      errors.releaseDate = 'Release date must be a valid YYYY-MM-DD date';
    }
    if (body.upc !== undefined && body.upc !== null && body.upc !== '') {
      if (!/^[0-9]{8,14}$/.test(String(body.upc).trim())) {
        errors.upc = 'UPC must be 8-14 digits';
      }
    }

    if (Object.keys(errors).length) {
      throw badRequest('Please correct the highlighted fields', errors);
    }

    const tracks = validateTracks(body.tracks);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO releases
        (user_id, title, artist_name, release_type, primary_genre, label, upc, release_date, status, artwork_color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [
        userId,
        String(body.title).trim(),
        String(body.artistName).trim(),
        body.releaseType,
        String(body.primaryGenre).trim(),
        isNonEmptyString(body.label, 255) ? String(body.label).trim() : null,
        body.upc ? String(body.upc).trim() : null,
        String(body.releaseDate).slice(0, 10),
        normaliseColor(body.artworkColor) || '#7c5cff',
      ]
    );

    const releaseId = result.insertId;

    for (const track of tracks) {
      await connection.execute(
        `INSERT INTO tracks
           (release_id, track_number, title, isrc, duration_seconds, explicit, songwriters)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          releaseId,
          track.track_number,
          track.title,
          track.isrc,
          track.duration_seconds,
          track.explicit,
          track.songwriters,
        ]
      );
    }

    await connection.commit();
    connection.release();
    connection = null;

    const [rows] = await pool.query(
      `SELECT id, user_id, title, artist_name, release_type, primary_genre,
              label, upc, release_date, status, artwork_color, created_at, updated_at
         FROM releases WHERE id = ? LIMIT 1`,
      [releaseId]
    );

    res.status(201).json({ release: rows[0] });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr.message);
      }
      connection.release();
    }
    next(err);
  }
}

async function updateRelease(req, res, next) {
  try {
    const userId = req.session.userId;
    const id = toInt(req.params.id, 0);
    if (!id) throw badRequest('Invalid release id');

    const [existing] = await pool.query(
      'SELECT id FROM releases WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    if (!existing.length) {
      return res.status(404).json({ error: 'Release not found' });
    }

    const body = req.body || {};
    const errors = {};
    const fields = [];
    const params = [];

    if (body.title !== undefined) {
      if (!isNonEmptyString(body.title, 255)) errors.title = 'Title is required';
      else {
        fields.push('title = ?');
        params.push(String(body.title).trim());
      }
    }
    if (body.artistName !== undefined) {
      if (!isNonEmptyString(body.artistName, 255)) {
        errors.artistName = 'Artist name is required';
      } else {
        fields.push('artist_name = ?');
        params.push(String(body.artistName).trim());
      }
    }
    if (body.releaseType !== undefined) {
      if (!isOneOf(body.releaseType, RELEASE_TYPES)) {
        errors.releaseType = 'Release type must be single, ep or album';
      } else {
        fields.push('release_type = ?');
        params.push(body.releaseType);
      }
    }
    if (body.primaryGenre !== undefined) {
      if (!isNonEmptyString(body.primaryGenre, 120)) {
        errors.primaryGenre = 'Primary genre is required';
      } else {
        fields.push('primary_genre = ?');
        params.push(String(body.primaryGenre).trim());
      }
    }
    if (body.label !== undefined) {
      fields.push('label = ?');
      params.push(isNonEmptyString(body.label, 255) ? String(body.label).trim() : null);
    }
    if (body.upc !== undefined) {
      if (body.upc && !/^[0-9]{8,14}$/.test(String(body.upc).trim())) {
        errors.upc = 'UPC must be 8-14 digits';
      } else {
        fields.push('upc = ?');
        params.push(body.upc ? String(body.upc).trim() : null);
      }
    }
    if (body.releaseDate !== undefined) {
      if (!isIsoDate(body.releaseDate)) {
        errors.releaseDate = 'Release date must be a valid YYYY-MM-DD date';
      } else {
        fields.push('release_date = ?');
        params.push(String(body.releaseDate).slice(0, 10));
      }
    }
    if (body.status !== undefined) {
      if (!isOneOf(body.status, RELEASE_STATUSES)) {
        errors.status = 'Unknown status';
      } else {
        fields.push('status = ?');
        params.push(body.status);
      }
    }
    if (body.artworkColor !== undefined) {
      const color = normaliseColor(body.artworkColor);
      if (!color) errors.artworkColor = 'Invalid artwork colour';
      else {
        fields.push('artwork_color = ?');
        params.push(color);
      }
    }

    if (Object.keys(errors).length) {
      throw badRequest('Please correct the highlighted fields', errors);
    }
    if (!fields.length) {
      throw badRequest('No updatable fields supplied');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    await pool.execute(
      `UPDATE releases SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    const [rows] = await pool.query(
      `SELECT id, user_id, title, artist_name, release_type, primary_genre,
              label, upc, release_date, status, artwork_color, created_at, updated_at
         FROM releases WHERE id = ? LIMIT 1`,
      [id]
    );

    res.json({ release: rows[0] });
  } catch (err) {
    next(err);
  }
}

async function deleteRelease(req, res, next) {
  try {
    const userId = req.session.userId;
    const id = toInt(req.params.id, 0);
    if (!id) throw badRequest('Invalid release id');

    const [result] = await pool.execute(
      'DELETE FROM releases WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Release not found' });
    }

    res.json({ ok: true, deletedId: id });
  } catch (err) {
    next(err);
  }
}

async function deliverRelease(req, res, next) {
  let connection;
  try {
    const userId = req.session.userId;
    const id = toInt(req.params.id, 0);
    if (!id) throw badRequest('Invalid release id');

    const [releases] = await pool.query(
      'SELECT id, status FROM releases WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    if (!releases.length) {
      return res.status(404).json({ error: 'Release not found' });
    }

    const [trackCount] = await pool.query(
      'SELECT COUNT(*) AS count FROM tracks WHERE release_id = ?',
      [id]
    );
    if (!Number(trackCount[0].count)) {
      throw badRequest('Add at least one track before delivering to stores');
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.execute(
      "UPDATE releases SET status = 'in_review', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    const [existingDeliveries] = await connection.query(
      'SELECT store_name FROM store_deliveries WHERE release_id = ?',
      [id]
    );
    const existingStores = new Set(existingDeliveries.map((d) => d.store_name));

    for (const store of STORES) {
      if (existingStores.has(store)) continue;
      await connection.execute(
        `INSERT INTO store_deliveries (release_id, store_name, status, delivered_at)
         VALUES (?, ?, 'pending', NULL)`,
        [id, store]
      );
    }

    await connection.commit();
    connection.release();
    connection = null;

    const [deliveries] = await pool.query(
      `SELECT id, release_id, store_name, status, delivered_at
         FROM store_deliveries
        WHERE release_id = ?
        ORDER BY store_name ASC`,
      [id]
    );

    res.json({ ok: true, status: 'in_review', deliveries });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr.message);
      }
      connection.release();
    }
    next(err);
  }
}

module.exports = {
  listReleases,
  getRelease,
  createRelease,
  updateRelease,
  deleteRelease,
  deliverRelease,
};