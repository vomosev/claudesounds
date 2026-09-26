'use strict';

const { pool } = require('../config/db');

/**
 * GET /api/royalties
 * List royalty statements belonging to the session user.
 */
async function listStatements(req, res, next) {
  try {
    const userId = req.session.userId;

    const [rows] = await pool.execute(
      `SELECT id,
              user_id,
              period_label,
              gross_amount,
              fees_amount,
              net_amount,
              status,
              paid_at
         FROM royalty_statements
        WHERE user_id = ?
        ORDER BY period_label DESC, id DESC`,
      [userId]
    );

    const statements = rows.map((row) => ({
      id: row.id,
      period_label: row.period_label,
      gross_amount: Number(row.gross_amount || 0),
      fees_amount: Number(row.fees_amount || 0),
      net_amount: Number(row.net_amount || 0),
      status: row.status,
      paid_at: row.paid_at,
    }));

    const totals = statements.reduce(
      (acc, s) => {
        acc.gross += s.gross_amount;
        acc.fees += s.fees_amount;
        acc.net += s.net_amount;
        if (s.status === 'pending') acc.pending += s.net_amount;
        else acc.paid += s.net_amount;
        return acc;
      },
      { gross: 0, fees: 0, net: 0, pending: 0, paid: 0 }
    );

    res.json({
      statements,
      totals: {
        gross_amount: Number(totals.gross.toFixed(2)),
        fees_amount: Number(totals.fees.toFixed(2)),
        net_amount: Number(totals.net.toFixed(2)),
        pending_amount: Number(totals.pending.toFixed(2)),
        paid_amount: Number(totals.paid.toFixed(2)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/royalties/breakdown
 * Revenue and streams grouped by store for the session user's releases.
 */
async function getBreakdown(req, res, next) {
  try {
    const userId = req.session.userId;

    const [rows] = await pool.execute(
      `SELECT s.store_name AS store_name,
              COALESCE(SUM(s.stream_count), 0) AS streams,
              COALESCE(SUM(s.revenue), 0) AS revenue
         FROM streams s
         INNER JOIN releases r ON r.id = s.release_id
        WHERE r.user_id = ?
        GROUP BY s.store_name
        ORDER BY revenue DESC`,
      [userId]
    );

    const breakdown = rows.map((row) => ({
      store_name: row.store_name,
      streams: Number(row.streams || 0),
      revenue: Number(Number(row.revenue || 0).toFixed(2)),
    }));

    const totalRevenue = breakdown.reduce((sum, r) => sum + r.revenue, 0);
    const totalStreams = breakdown.reduce((sum, r) => sum + r.streams, 0);

    const withShare = breakdown.map((row) => ({
      ...row,
      share_percent:
        totalRevenue > 0 ? Number(((row.revenue / totalRevenue) * 100).toFixed(2)) : 0,
    }));

    res.json({
      breakdown: withShare,
      total_revenue: Number(totalRevenue.toFixed(2)),
      total_streams: totalStreams,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/royalties/:id/request-payout
 * Marks a pending statement as paid. 404 when not owned by the user.
 */
async function requestPayout(req, res, next) {
  try {
    const userId = req.session.userId;
    const statementId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(statementId) || statementId <= 0) {
      return res.status(400).json({ error: 'Invalid statement id' });
    }

    const [existing] = await pool.execute(
      `SELECT id, status, net_amount, period_label
         FROM royalty_statements
        WHERE id = ? AND user_id = ?
        LIMIT 1`,
      [statementId, userId]
    );

    if (!existing.length) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    const statement = existing[0];

    if (statement.status === 'paid') {
      return res.status(409).json({ error: 'This statement has already been paid out' });
    }

    await pool.execute(
      `UPDATE royalty_statements
          SET status = 'paid', paid_at = NOW()
        WHERE id = ? AND user_id = ?`,
      [statementId, userId]
    );

    const [updated] = await pool.execute(
      `SELECT id,
              period_label,
              gross_amount,
              fees_amount,
              net_amount,
              status,
              paid_at
         FROM royalty_statements
        WHERE id = ? AND user_id = ?
        LIMIT 1`,
      [statementId, userId]
    );

    if (!updated.length) {
      return res.status(404).json({ error: 'Statement not found' });
    }

    const row = updated[0];

    res.json({
      statement: {
        id: row.id,
        period_label: row.period_label,
        gross_amount: Number(row.gross_amount || 0),
        fees_amount: Number(row.fees_amount || 0),
        net_amount: Number(row.net_amount || 0),
        status: row.status,
        paid_at: row.paid_at,
      },
      message: 'Payout requested — funds are on the way.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listStatements,
  getBreakdown,
  requestPayout,
};