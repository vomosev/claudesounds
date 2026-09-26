const { pool } = require('../config/db');
const {
  isNonEmptyString,
  isOneOf,
  toInt,
  badRequest,
} = require('../utils/validate');

const REGISTRATION_STATUSES = ['unregistered', 'submitted', 'registered'];
const SPLIT_ROLES = ['composer', 'lyricist', 'arranger', 'publisher'];

/**
 * GET /api/publishing/works
 * Optional query: status, search
 */
async function listWorks(req, res, next) {
  try {
    const userId = req.session.userId;
    const params = [userId];
    let sql = `
      SELECT
        w.id,
        w.user_id,
        w.track_id,
        w.work_title,
        w.iswc,
        w.society,
        w.registration_status,
        w.created_at,
        t.title AS track_title,
        r.title AS release_title,
        COALESCE(SUM(s.share_percent), 0) AS total_share,
        COUNT(s.id) AS writer_count
      FROM publishing_works w
      LEFT JOIN publishing_splits s ON s.work_id = w.id
      LEFT JOIN tracks t ON t.id = w.track_id
      LEFT JOIN releases r ON r.id = t.release_id
      WHERE w.user_id = ?
    `;

    const status = req.query.status;
    if (status && status !== 'all') {
      if (!isOneOf(status, REGISTRATION_STATUSES)) {
        throw badRequest('Invalid registration status filter', {
          status: `Must be one of ${REGISTRATION_STATUSES.join(', ')}`,
        });
      }
      sql += ' AND w.registration_status = ?';
      params.push(status);
    }

    const search = req.query.search;
    if (isNonEmptyString(search, 200)) {
      sql += ' AND (w.work_title LIKE ? OR w.iswc LIKE ? OR w.society LIKE ?)';
      const like = `%${String(search).trim()}%`;
      params.push(like, like, like);
    }

    sql += ' GROUP BY w.id ORDER BY w.created_at DESC, w.id DESC';

    const [rows] = await pool.query(sql, params);

    const works = rows.map((row) => ({
      id: row.id,
      trackId: row.track_id,
      workTitle: row.work_title,
      iswc: row.iswc,
      society: row.society,
      registrationStatus: row.registration_status,
      createdAt: row.created_at,
      trackTitle: row.track_title,
      releaseTitle: row.release_title,
      totalShare: Number(row.total_share) || 0,
      writerCount: Number(row.writer_count) || 0,
    }));

    res.json({ works });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/publishing/works/:id
 */
async function getWork(req, res, next) {
  try {
    const userId = req.session.userId;
    const id = toInt(req.params.id, 0);
    if (!id) throw badRequest('Invalid work id');

    const [workRows] = await pool.query(
      `SELECT
         w.id, w.user_id, w.track_id, w.work_title, w.iswc, w.society,
         w.registration_status, w.created_at,
         t.title AS track_title, r.title AS release_title
       FROM publishing_works w
       LEFT JOIN tracks t ON t.id = w.track_id
       LEFT JOIN releases r ON r.id = t.release_id
       WHERE w.id = ? AND w.user_id = ?
       LIMIT 1`,
      [id, userId]
    );

    if (!workRows.length) {
      return res.status(404).json({ error: 'Work not found' });
    }

    const [splitRows] = await pool.query(
      `SELECT id, work_id, writer_name, role, share_percent
       FROM publishing_splits
       WHERE work_id = ?
       ORDER BY id ASC`,
      [id]
    );

    const row = workRows[0];
    const splits = splitRows.map((s) => ({
      id: s.id,
      writerName: s.writer_name,
      role: s.role,
      sharePercent: Number(s.share_percent),
    }));

    res.json({
      work: {
        id: row.id,
        trackId: row.track_id,
        workTitle: row.work_title,
        iswc: row.iswc,
        society: row.society,
        registrationStatus: row.registration_status,
        createdAt: row.created_at,
        trackTitle: row.track_title,
        releaseTitle: row.release_title,
        totalShare: splits.reduce((acc, s) => acc + s.sharePercent, 0),
        writerCount: splits.length,
        splits,
      },
    });
  } catch (err) {
    next(err);
  }
}

function normaliseSplits(rawSplits) {
  if (!Array.isArray(rawSplits) || rawSplits.length === 0) {
    throw badRequest('At least one writer split is required', {
      splits: 'Add at least one writer split',
    });
  }
  if (rawSplits.length > 20) {
    throw badRequest('Too many splits', { splits: 'Maximum of 20 splits' });
  }

  const splits = rawSplits.map((split, index) => {
    const writerName = split && split.writerName != null ? String(split.writerName).trim() : '';
    if (!isNonEmptyString(writerName, 150)) {
      throw badRequest('Each split needs a writer name', {
        [`splits.${index}.writerName`]: 'Writer name is required',
      });
    }

    const role = split && split.role ? String(split.role) : 'composer';
    if (!isOneOf(role, SPLIT_ROLES)) {
      throw badRequest('Invalid split role', {
        [`splits.${index}.role`]: `Must be one of ${SPLIT_ROLES.join(', ')}`,
      });
    }

    const share = Number(split && split.sharePercent);
    if (!Number.isFinite(share) || share <= 0 || share > 100) {
      throw badRequest('Invalid share percentage', {
        [`splits.${index}.sharePercent`]: 'Share must be between 0 and 100',
      });
    }

    return { writerName, role, sharePercent: Math.round(share * 100) / 100 };
  });

  const total = splits.reduce((acc, s) => acc + s.sharePercent, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw badRequest('Writer splits must total exactly 100%', {
      splits: `Current total is ${total.toFixed(2)}%`,
    });
  }

  return splits;
}

/**
 * POST /api/publishing/works
 */
async function createWork(req, res, next) {
  let connection;
  try {
    const userId = req.session.userId;
    const body = req.body || {};

    const workTitle = body.workTitle != null ? String(body.workTitle).trim() : '';
    if (!isNonEmptyString(workTitle, 200)) {
      throw badRequest('Work title is required', {
        workTitle: 'Work title is required (max 200 characters)',
      });
    }

    const iswc = isNonEmptyString(body.iswc, 20) ? String(body.iswc).trim() : null;
    const society = isNonEmptyString(body.society, 80) ? String(body.society).trim() : null;

    const registrationStatus = body.registrationStatus
      ? String(body.registrationStatus)
      : 'unregistered';
    if (!isOneOf(registrationStatus, REGISTRATION_STATUSES)) {
      throw badRequest('Invalid registration status', {
        registrationStatus: `Must be one of ${REGISTRATION_STATUSES.join(', ')}`,
      });
    }

    let trackId = null;
    if (body.trackId !== undefined && body.trackId !== null && body.trackId !== '') {
      trackId = toInt(body.trackId, 0);
      if (!trackId) {
        throw badRequest('Invalid track id', { trackId: 'Invalid track selection' });
      }
      const [ownRows] = await pool.query(
        `SELECT t.id FROM tracks t
         JOIN releases r ON r.id = t.release_id
         WHERE t.id = ? AND r.user_id = ?
         LIMIT 1`,
        [trackId, userId]
      );
      if (!ownRows.length) {
        throw badRequest('Track not found in your catalogue', {
          trackId: 'Track not found',
        });
      }
    }

    const splits = normaliseSplits(body.splits);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO publishing_works
         (user_id, track_id, work_title, iswc, society, registration_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [userId, trackId, workTitle, iswc, society, registrationStatus]
    );

    const workId = result.insertId;

    for (const split of splits) {
      await connection.execute(
        `INSERT INTO publishing_splits (work_id, writer_name, role, share_percent)
         VALUES (?, ?, ?, ?)`,
        [workId, split.writerName, split.role, split.sharePercent]
      );
    }

    await connection.commit();
    connection.release();
    connection = null;

    res.status(201).json({
      work: {
        id: workId,
        trackId,
        workTitle,
        iswc,
        society,
        registrationStatus,
        splits,
        writerCount: splits.length,
        totalShare: 100,
      },
    });
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

/**
 * PATCH /api/publishing/works/:id
 * Updates registration status (and optionally iswc/society/title).
 */
async function updateWorkRegistration(req, res, next) {
  try {
    const userId = req.session.userId;
    const id = toInt(req.params.id, 0);
    if (!id) throw badRequest('Invalid work id');

    const [existing] = await pool.query(
      'SELECT id FROM publishing_works WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );
    if (!existing.length) {
      return res.status(404).json({ error: 'Work not found' });
    }

    const body = req.body || {};
    const fields = [];
    const params = [];

    if (body.registrationStatus !== undefined) {
      const status = String(body.registrationStatus);
      if (!isOneOf(status, REGISTRATION_STATUSES)) {
        throw badRequest('Invalid registration status', {
          registrationStatus: `Must be one of ${REGISTRATION_STATUSES.join(', ')}`,
        });
      }
      fields.push('registration_status = ?');
      params.push(status);
    }

    if (body.workTitle !== undefined) {
      const workTitle = String(body.workTitle).trim();
      if (!isNonEmptyString(workTitle, 200)) {
        throw badRequest('Work title is required', {
          workTitle: 'Work title is required (max 200 characters)',
        });
      }
      fields.push('work_title = ?');
      params.push(workTitle);
    }

    if (body.iswc !== undefined) {
      const iswc = isNonEmptyString(body.iswc, 20) ? String(body.iswc).trim() : null;
      fields.push('iswc = ?');
      params.push(iswc);
    }

    if (body.society !== undefined) {
      const society = isNonEmptyString(body.society, 80) ? String(body.society).trim() : null;
      fields.push('society = ?');
      params.push(society);
    }

    if (!fields.length) {
      throw badRequest('No updatable fields supplied');
    }

    params.push(id, userId);

    await pool.execute(
      `UPDATE publishing_works SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      params
    );

    const [rows] = await pool.query(
      `SELECT id, track_id, work_title, iswc, society, registration_status, created_at
       FROM publishing_works WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, userId]
    );

    const row = rows[0];
    res.json({
      work: {
        id: row.id,
        trackId: row.track_id,
        workTitle: row.work_title,
        iswc: row.iswc,
        society: row.society,
        registrationStatus: row.registration_status,
        createdAt: row.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/publishing/works/:id
 */
async function deleteWork(req, res, next) {
  try {
    const userId = req.session.userId;
    const id = toInt(req.params.id, 0);
    if (!id) throw badRequest('Invalid work id');

    const [result] = await pool.execute(
      'DELETE FROM publishing_works WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Work not found' });
    }

    res.json({ deleted: true, id });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listWorks,
  getWork,
  createWork,
  updateWorkRegistration,
  deleteWork,
};