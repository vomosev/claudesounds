const { pool } = require('../config/db');
const {
  isNonEmptyString,
  isOneOf,
  toInt,
  isIsoDate,
  badRequest,
} = require('../utils/validate');

const CHANNELS = ['playlist_pitch', 'social_ads', 'pr', 'email', 'influencer'];
const STATUSES = ['draft', 'scheduled', 'running', 'completed', 'paused'];

function decorate(row) {
  const impressions = Number(row.impressions) || 0;
  const clicks = Number(row.clicks) || 0;
  const budgetCents = Number(row.budget_cents) || 0;
  const spendCents = Number(row.spend_cents) || 0;
  return {
    id: row.id,
    userId: row.user_id,
    releaseId: row.release_id,
    releaseTitle: row.release_title || null,
    name: row.name,
    channel: row.channel,
    status: row.status,
    budgetCents,
    spendCents,
    startDate: row.start_date,
    endDate: row.end_date,
    clicks,
    impressions,
    ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
    budgetUtilisation:
      budgetCents > 0 ? Math.round((spendCents / budgetCents) * 10000) / 100 : 0,
  };
}

function normaliseDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const str = String(value).slice(0, 10);
  if (!isIsoDate(str)) return undefined;
  return str;
}

async function listCampaigns(req, res, next) {
  try {
    const userId = req.session.userId;
    const params = [userId];
    let sql = `
      SELECT c.*, r.title AS release_title
      FROM campaigns c
      LEFT JOIN releases r ON r.id = c.release_id
      WHERE c.user_id = ?
    `;

    const { status, channel } = req.query || {};
    if (status && status !== 'all') {
      if (!isOneOf(status, STATUSES)) {
        throw badRequest('Invalid status filter', { status: 'Unknown status' });
      }
      sql += ' AND c.status = ?';
      params.push(status);
    }
    if (channel && channel !== 'all') {
      if (!isOneOf(channel, CHANNELS)) {
        throw badRequest('Invalid channel filter', { channel: 'Unknown channel' });
      }
      sql += ' AND c.channel = ?';
      params.push(channel);
    }

    sql += ' ORDER BY COALESCE(c.start_date, c.id) DESC, c.id DESC';

    const [rows] = await pool.query(sql, params);
    res.json({ campaigns: rows.map(decorate) });
  } catch (err) {
    next(err);
  }
}

async function createCampaign(req, res, next) {
  try {
    const userId = req.session.userId;
    const body = req.body || {};
    const errors = {};

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!isNonEmptyString(name, 160)) {
      errors.name = 'Campaign name is required (max 160 characters)';
    }

    const channel = body.channel;
    if (!isOneOf(channel, CHANNELS)) {
      errors.channel = 'Choose a valid channel';
    }

    const status = body.status === undefined || body.status === '' ? 'draft' : body.status;
    if (!isOneOf(status, STATUSES)) {
      errors.status = 'Choose a valid status';
    }

    const budgetDollars = Number(body.budget);
    if (body.budget === undefined || body.budget === null || body.budget === '') {
      errors.budget = 'Budget is required';
    } else if (!Number.isFinite(budgetDollars) || budgetDollars < 0) {
      errors.budget = 'Budget must be a positive number';
    }

    const startDate = normaliseDate(body.startDate);
    if (startDate === undefined) errors.startDate = 'Start date must be YYYY-MM-DD';
    const endDate = normaliseDate(body.endDate);
    if (endDate === undefined) errors.endDate = 'End date must be YYYY-MM-DD';

    if (!errors.startDate && !errors.endDate && startDate && endDate && endDate < startDate) {
      errors.endDate = 'End date must be on or after the start date';
    }

    let releaseId = null;
    if (body.releaseId !== undefined && body.releaseId !== null && body.releaseId !== '') {
      releaseId = toInt(body.releaseId, 0);
      if (!releaseId || releaseId < 1) {
        errors.releaseId = 'Invalid release';
      }
    }

    if (Object.keys(errors).length > 0) {
      throw badRequest('Please correct the highlighted fields', errors);
    }

    if (releaseId) {
      const [owned] = await pool.query(
        'SELECT id FROM releases WHERE id = ? AND user_id = ? LIMIT 1',
        [releaseId, userId]
      );
      if (owned.length === 0) {
        throw badRequest('Release not found', { releaseId: 'Release not found' });
      }
    }

    const budgetCents = Math.round(budgetDollars * 100);
    const spendCents =
      body.spend === undefined || body.spend === null || body.spend === ''
        ? 0
        : Math.max(0, Math.round(Number(body.spend) * 100) || 0);

    const [result] = await pool.query(
      `INSERT INTO campaigns
        (user_id, release_id, name, channel, status, budget_cents, spend_cents, start_date, end_date, clicks, impressions)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        userId,
        releaseId,
        name,
        channel,
        status,
        budgetCents,
        spendCents,
        startDate,
        endDate,
      ]
    );

    const [rows] = await pool.query(
      `SELECT c.*, r.title AS release_title
       FROM campaigns c
       LEFT JOIN releases r ON r.id = c.release_id
       WHERE c.id = ? AND c.user_id = ?`,
      [result.insertId, userId]
    );

    if (rows.length === 0) {
      const err = new Error('Campaign could not be created');
      err.status = 500;
      throw err;
    }

    res.status(201).json({ campaign: decorate(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function updateCampaign(req, res, next) {
  try {
    const userId = req.session.userId;
    const id = toInt(req.params.id, 0);
    if (!id) throw badRequest('Invalid campaign id');

    const [existing] = await pool.query(
      'SELECT * FROM campaigns WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    if (existing.length === 0) {
      const err = new Error('Campaign not found');
      err.status = 404;
      throw err;
    }

    const body = req.body || {};
    const errors = {};
    const fields = [];
    const params = [];

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!isNonEmptyString(name, 160)) {
        errors.name = 'Campaign name is required (max 160 characters)';
      } else {
        fields.push('name = ?');
        params.push(name);
      }
    }

    if (body.channel !== undefined) {
      if (!isOneOf(body.channel, CHANNELS)) {
        errors.channel = 'Choose a valid channel';
      } else {
        fields.push('channel = ?');
        params.push(body.channel);
      }
    }

    if (body.status !== undefined) {
      if (!isOneOf(body.status, STATUSES)) {
        errors.status = 'Choose a valid status';
      } else {
        fields.push('status = ?');
        params.push(body.status);
      }
    }

    if (body.budget !== undefined) {
      const budget = Number(body.budget);
      if (!Number.isFinite(budget) || budget < 0) {
        errors.budget = 'Budget must be a positive number';
      } else {
        fields.push('budget_cents = ?');
        params.push(Math.round(budget * 100));
      }
    }

    if (body.spend !== undefined) {
      const spend = Number(body.spend);
      if (!Number.isFinite(spend) || spend < 0) {
        errors.spend = 'Spend must be a positive number';
      } else {
        fields.push('spend_cents = ?');
        params.push(Math.round(spend * 100));
      }
    }

    if (body.clicks !== undefined) {
      const clicks = toInt(body.clicks, -1);
      if (clicks < 0) errors.clicks = 'Clicks must be a positive whole number';
      else {
        fields.push('clicks = ?');
        params.push(clicks);
      }
    }

    if (body.impressions !== undefined) {
      const impressions = toInt(body.impressions, -1);
      if (impressions < 0) errors.impressions = 'Impressions must be a positive whole number';
      else {
        fields.push('impressions = ?');
        params.push(impressions);
      }
    }

    let nextStart = existing[0].start_date;
    let nextEnd = existing[0].end_date;

    if (body.startDate !== undefined) {
      const startDate = normaliseDate(body.startDate);
      if (startDate === undefined) errors.startDate = 'Start date must be YYYY-MM-DD';
      else {
        fields.push('start_date = ?');
        params.push(startDate);
        nextStart = startDate;
      }
    }

    if (body.endDate !== undefined) {
      const endDate = normaliseDate(body.endDate);
      if (endDate === undefined) errors.endDate = 'End date must be YYYY-MM-DD';
      else {
        fields.push('end_date = ?');
        params.push(endDate);
        nextEnd = endDate;
      }
    }

    const startStr = nextStart ? String(nextStart).slice(0, 10) : null;
    const endStr = nextEnd ? String(nextEnd).slice(0, 10) : null;
    if (!errors.startDate && !errors.endDate && startStr && endStr && endStr < startStr) {
      errors.endDate = 'End date must be on or after the start date';
    }

    if (body.releaseId !== undefined) {
      if (body.releaseId === null || body.releaseId === '') {
        fields.push('release_id = ?');
        params.push(null);
      } else {
        const releaseId = toInt(body.releaseId, 0);
        if (!releaseId) {
          errors.releaseId = 'Invalid release';
        } else {
          const [owned] = await pool.query(
            'SELECT id FROM releases WHERE id = ? AND user_id = ? LIMIT 1',
            [releaseId, userId]
          );
          if (owned.length === 0) errors.releaseId = 'Release not found';
          else {
            fields.push('release_id = ?');
            params.push(releaseId);
          }
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      throw badRequest('Please correct the highlighted fields', errors);
    }

    if (fields.length === 0) {
      throw badRequest('No supported fields supplied');
    }

    params.push(id, userId);
    await pool.query(
      `UPDATE campaigns SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    const [rows] = await pool.query(
      `SELECT c.*, r.title AS release_title
       FROM campaigns c
       LEFT JOIN releases r ON r.id = c.release_id
       WHERE c.id = ? AND c.user_id = ?`,
      [id, userId]
    );

    res.json({ campaign: decorate(rows[0]) });
  } catch (err) {
    next(err);
  }
}

async function deleteCampaign(req, res, next) {
  try {
    const userId = req.session.userId;
    const id = toInt(req.params.id, 0);
    if (!id) throw badRequest('Invalid campaign id');

    const [result] = await pool.query(
      'DELETE FROM campaigns WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      const err = new Error('Campaign not found');
      err.status = 404;
      throw err;
    }

    res.json({ ok: true, id });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  CHANNELS,
  STATUSES,
};