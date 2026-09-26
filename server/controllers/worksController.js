'use strict';

const { pool } = require('../config/db');

const REGISTRATION_STATUSES = ['pending', 'registered', 'rejected'];

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function notFound(message) {
  const err = new Error(message || 'Work not found');
  err.status = 404;
  return err;
}

function cleanString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function parseSplit(value) {
  if (value === undefined || value === null || value === '') return 100;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    throw badRequest('split_percent must be a number between 0 and 100');
  }
  return Math.round(num * 100) / 100;
}

function serialiseWork(row) {
  if (!row) return row;
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    iswc: row.iswc,
    writers: row.writers,
    publisher: row.publisher,
    split_percent: row.split_percent === null ? null : Number(row.split_percent),
    registration_status: row.registration_status,
    created_at: row.created_at,
  };
}

async function listWorks(req, res, next) {
  try {
    const userId = req.session.userId;
    const status = cleanString(req.query.status);

    const params = [userId];
    let sql =
      'SELECT id, user_id, title, iswc, writers, publisher, split_percent, registration_status, created_at ' +
      'FROM works WHERE user_id = ?';

    if (status && status !== 'all') {
      if (!REGISTRATION_STATUSES.includes(status)) {
        throw badRequest(
          `status must be one of: ${REGISTRATION_STATUSES.join(', ')}`
        );
      }
      sql += ' AND registration_status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC, id DESC';

    const [rows] = await pool.execute(sql, params);
    res.json({ works: rows.map(serialiseWork) });
  } catch (err) {
    next(err);
  }
}

async function createWork(req, res, next) {
  try {
    const userId = req.session.userId;
    const body = req.body || {};

    const title = cleanString(body.title);
    const writers = cleanString(body.writers);
    const iswc = cleanString(body.iswc);
    const publisher = cleanString(body.publisher);
    const registrationStatus = cleanString(body.registration_status) || 'pending';

    if (!title) throw badRequest('Title is required');
    if (title.length > 255) throw badRequest('Title must be 255 characters or fewer');
    if (!writers) throw badRequest('At least one writer is required');
    if (writers.length > 500) {
      throw badRequest('Writers must be 500 characters or fewer');
    }
    if (iswc && iswc.length > 32) {
      throw badRequest('ISWC must be 32 characters or fewer');
    }
    if (publisher && publisher.length > 255) {
      throw badRequest('Publisher must be 255 characters or fewer');
    }
    if (!REGISTRATION_STATUSES.includes(registrationStatus)) {
      throw badRequest(
        `registration_status must be one of: ${REGISTRATION_STATUSES.join(', ')}`
      );
    }

    const splitPercent = parseSplit(body.split_percent);

    const [result] = await pool.execute(
      'INSERT INTO works (user_id, title, iswc, writers, publisher, split_percent, registration_status, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [
        userId,
        title,
        iswc || null,
        writers,
        publisher || null,
        splitPercent,
        registrationStatus,
      ]
    );

    const [rows] = await pool.execute(
      'SELECT id, user_id, title, iswc, writers, publisher, split_percent, registration_status, created_at ' +
        'FROM works WHERE id = ? AND user_id = ?',
      [result.insertId, userId]
    );

    res.status(201).json({ work: serialiseWork(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function updateWork(req, res, next) {
  try {
    const userId = req.session.userId;
    const workId = Number(req.params.id);
    if (!Number.isInteger(workId) || workId <= 0) {
      throw badRequest('Invalid work id');
    }

    const [existingRows] = await pool.execute(
      'SELECT id FROM works WHERE id = ? AND user_id = ?',
      [workId, userId]
    );
    if (existingRows.length === 0) throw notFound();

    const body = req.body || {};
    const fields = [];
    const params = [];

    if (body.title !== undefined) {
      const title = cleanString(body.title);
      if (!title) throw badRequest('Title is required');
      if (title.length > 255) {
        throw badRequest('Title must be 255 characters or fewer');
      }
      fields.push('title = ?');
      params.push(title);
    }

    if (body.writers !== undefined) {
      const writers = cleanString(body.writers);
      if (!writers) throw badRequest('At least one writer is required');
      if (writers.length > 500) {
        throw badRequest('Writers must be 500 characters or fewer');
      }
      fields.push('writers = ?');
      params.push(writers);
    }

    if (body.iswc !== undefined) {
      const iswc = cleanString(body.iswc);
      if (iswc.length > 32) {
        throw badRequest('ISWC must be 32 characters or fewer');
      }
      fields.push('iswc = ?');
      params.push(iswc || null);
    }

    if (body.publisher !== undefined) {
      const publisher = cleanString(body.publisher);
      if (publisher.length > 255) {
        throw badRequest('Publisher must be 255 characters or fewer');
      }
      fields.push('publisher = ?');
      params.push(publisher || null);
    }

    if (body.split_percent !== undefined) {
      fields.push('split_percent = ?');
      params.push(parseSplit(body.split_percent));
    }

    if (body.registration_status !== undefined) {
      const registrationStatus = cleanString(body.registration_status);
      if (!REGISTRATION_STATUSES.includes(registrationStatus)) {
        throw badRequest(
          `registration_status must be one of: ${REGISTRATION_STATUSES.join(', ')}`
        );
      }
      fields.push('registration_status = ?');
      params.push(registrationStatus);
    }

    if (fields.length === 0) {
      throw badRequest('No updatable fields supplied');
    }

    params.push(workId, userId);

    await pool.execute(
      `UPDATE works SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    const [rows] = await pool.execute(
      'SELECT id, user_id, title, iswc, writers, publisher, split_percent, registration_status, created_at ' +
        'FROM works WHERE id = ? AND user_id = ?',
      [workId, userId]
    );

    if (rows.length === 0) throw notFound();

    res.json({ work: serialiseWork(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function deleteWork(req, res, next) {
  try {
    const userId = req.session.userId;
    const workId = Number(req.params.id);
    if (!Number.isInteger(workId) || workId <= 0) {
      throw badRequest('Invalid work id');
    }

    const [result] = await pool.execute(
      'DELETE FROM works WHERE id = ? AND user_id = ?',
      [workId, userId]
    );

    if (!result.affectedRows) throw notFound();

    res.json({ success: true, id: workId });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listWorks,
  createWork,
  updateWork,
  deleteWork,
};