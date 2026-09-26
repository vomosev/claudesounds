const { pool } = require('../config/db');

const CHANNELS = ['playlist', 'social', 'ads', 'pr', 'email'];
const STATUSES = ['planned', 'active', 'paused', 'completed'];

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function notFound(message) {
  const err = new Error(message || 'Campaign not found');
  err.status = 404;
  return err;
}

function toNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function normaliseDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const str = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return undefined;
  return str;
}

function shapeCampaign(row) {
  const budget = Number(row.budget || 0);
  const spend = Number(row.spend || 0);
  return {
    id: row.id,
    user_id: row.user_id,
    release_id: row.release_id,
    release_title: row.release_title || null,
    name: row.name,
    channel: row.channel,
    budget,
    spend,
    budget_remaining: Math.round((budget - spend) * 100) / 100,
    spend_percent: budget > 0 ? Math.min(100, Math.round((spend / budget) * 1000) / 10) : 0,
    status: row.status,
    start_date: row.start_date,
    end_date: row.end_date,
    created_at: row.created_at,
  };
}

async function assertReleaseOwnership(releaseId, userId) {
  const [rows] = await pool.execute(
    'SELECT id FROM releases WHERE id = ? AND user_id = ? LIMIT 1',
    [releaseId, userId]
  );
  if (!rows.length) {
    throw badRequest('Linked release not found');
  }
}

async function listCampaigns(req, res, next) {
  try {
    const userId = req.session.userId;
    const params = [userId];
    let sql =
      'SELECT c.*, r.title AS release_title FROM campaigns c ' +
      'LEFT JOIN releases r ON r.id = c.release_id ' +
      'WHERE c.user_id = ?';

    const status = req.query.status;
    if (status && status !== 'all') {
      if (!STATUSES.includes(status)) {
        throw badRequest('Invalid status filter');
      }
      sql += ' AND c.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY c.created_at DESC, c.id DESC';

    const [rows] = await pool.execute(sql, params);
    res.json({ campaigns: rows.map(shapeCampaign) });
  } catch (err) {
    next(err);
  }
}

async function createCampaign(req, res, next) {
  try {
    const userId = req.session.userId;
    const body = req.body || {};

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw badRequest('Campaign name is required');
    if (name.length > 180) throw badRequest('Campaign name is too long');

    const channel = typeof body.channel === 'string' ? body.channel.trim() : '';
    if (!CHANNELS.includes(channel)) {
      throw badRequest('Channel must be one of: ' + CHANNELS.join(', '));
    }

    const status = body.status ? String(body.status).trim() : 'planned';
    if (!STATUSES.includes(status)) {
      throw badRequest('Status must be one of: ' + STATUSES.join(', '));
    }

    const budget = toNumber(body.budget, 0);
    if (Number.isNaN(budget) || budget < 0) throw badRequest('Budget must be a positive number');

    const spend = toNumber(body.spend, 0);
    if (Number.isNaN(spend) || spend < 0) throw badRequest('Spend must be a positive number');

    const startDate = normaliseDate(body.start_date);
    if (startDate === undefined) throw badRequest('Start date must be in YYYY-MM-DD format');
    const endDate = normaliseDate(body.end_date);
    if (endDate === undefined) throw badRequest('End date must be in YYYY-MM-DD format');
    if (startDate && endDate && endDate < startDate) {
      throw badRequest('End date must be on or after the start date');
    }

    let releaseId = null;
    if (body.release_id !== undefined && body.release_id !== null && body.release_id !== '') {
      const parsed = Number(body.release_id);
      if (!Number.isInteger(parsed) || parsed <= 0) throw badRequest('Invalid release id');
      await assertReleaseOwnership(parsed, userId);
      releaseId = parsed;
    }

    const [result] = await pool.execute(
      'INSERT INTO campaigns (user_id, release_id, name, channel, budget, spend, status, start_date, end_date, created_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [userId, releaseId, name, channel, budget, spend, status, startDate, endDate]
    );

    const [rows] = await pool.execute(
      'SELECT c.*, r.title AS release_title FROM campaigns c ' +
        'LEFT JOIN releases r ON r.id = c.release_id ' +
        'WHERE c.id = ? AND c.user_id = ? LIMIT 1',
      [result.insertId, userId]
    );

    if (!rows.length) throw notFound();
    res.status(201).json({ campaign: shapeCampaign(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function updateCampaign(req, res, next) {
  try {
    const userId = req.session.userId;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid campaign id');

    const [existingRows] = await pool.execute(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    if (!existingRows.length) throw notFound();

    const body = req.body || {};
    const fields = [];
    const params = [];

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) throw badRequest('Campaign name cannot be empty');
      if (name.length > 180) throw badRequest('Campaign name is too long');
      fields.push('name = ?');
      params.push(name);
    }

    if (body.channel !== undefined) {
      const channel = String(body.channel).trim();
      if (!CHANNELS.includes(channel)) {
        throw badRequest('Channel must be one of: ' + CHANNELS.join(', '));
      }
      fields.push('channel = ?');
      params.push(channel);
    }

    if (body.status !== undefined) {
      const status = String(body.status).trim();
      if (!STATUSES.includes(status)) {
        throw badRequest('Status must be one of: ' + STATUSES.join(', '));
      }
      fields.push('status = ?');
      params.push(status);
    }

    if (body.budget !== undefined) {
      const budget = toNumber(body.budget, NaN);
      if (Number.isNaN(budget) || budget < 0) throw badRequest('Budget must be a positive number');
      fields.push('budget = ?');
      params.push(budget);
    }

    if (body.spend !== undefined) {
      const spend = toNumber(body.spend, NaN);
      if (Number.isNaN(spend) || spend < 0) throw badRequest('Spend must be a positive number');
      fields.push('spend = ?');
      params.push(spend);
    }

    if (body.start_date !== undefined) {
      const startDate = normaliseDate(body.start_date);
      if (startDate === undefined) throw badRequest('Start date must be in YYYY-MM-DD format');
      fields.push('start_date = ?');
      params.push(startDate);
    }

    if (body.end_date !== undefined) {
      const endDate = normaliseDate(body.end_date);
      if (endDate === undefined) throw badRequest('End date must be in YYYY-MM-DD format');
      fields.push('end_date = ?');
      params.push(endDate);
    }

    if (body.release_id !== undefined) {
      if (body.release_id === null || body.release_id === '') {
        fields.push('release_id = ?');
        params.push(null);
      } else {
        const parsed = Number(body.release_id);
        if (!Number.isInteger(parsed) || parsed <= 0) throw badRequest('Invalid release id');
        await assertReleaseOwnership(parsed, userId);
        fields.push('release_id = ?');
        params.push(parsed);
      }
    }

    if (!fields.length) {
      throw badRequest('No updatable fields provided');
    }

    params.push(id, userId);
    await pool.execute(
      'UPDATE campaigns SET ' + fields.join(', ') + ' WHERE id = ? AND user_id = ?',
      params
    );

    const [rows] = await pool.execute(
      'SELECT c.*, r.title AS release_title FROM campaigns c ' +
        'LEFT JOIN releases r ON r.id = c.release_id ' +
        'WHERE c.id = ? AND c.user_id = ? LIMIT 1',
      [id, userId]
    );
    if (!rows.length) throw notFound();

    res.json({ campaign: shapeCampaign(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function deleteCampaign(req, res, next) {
  try {
    const userId = req.session.userId;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid campaign id');

    const [result] = await pool.execute(
      'DELETE FROM campaigns WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!result.affectedRows) throw notFound();

    res.json({ success: true, id });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
};