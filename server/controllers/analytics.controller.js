const { pool } = require('../config/db');
const { toInt } = require('../utils/validate');

function pct(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (p === 0) return c === 0 ? 0 : 100;
  return Math.round(((c - p) / p) * 1000) / 10;
}

function toDateKey(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

async function getOverview(req, res, next) {
  try {
    const userId = req.session.userId;

    const [[current]] = await pool.query(
      `SELECT
         COALESCE(SUM(s.streams), 0) AS streams,
         COALESCE(SUM(s.listeners), 0) AS listeners,
         COALESCE(SUM(s.revenue_cents), 0) AS revenue_cents
       FROM stream_stats s
       INNER JOIN releases r ON r.id = s.release_id
       WHERE r.user_id = ? AND s.stat_date >= (CURDATE() - INTERVAL 30 DAY)`,
      [userId]
    );

    const [[previous]] = await pool.query(
      `SELECT
         COALESCE(SUM(s.streams), 0) AS streams,
         COALESCE(SUM(s.listeners), 0) AS listeners,
         COALESCE(SUM(s.revenue_cents), 0) AS revenue_cents
       FROM stream_stats s
       INNER JOIN releases r ON r.id = s.release_id
       WHERE r.user_id = ?
         AND s.stat_date >= (CURDATE() - INTERVAL 60 DAY)
         AND s.stat_date < (CURDATE() - INTERVAL 30 DAY)`,
      [userId]
    );

    const [[releaseCounts]] = await pool.query(
      `SELECT
         COUNT(*) AS total_releases,
         COALESCE(SUM(status = 'live'), 0) AS live_releases,
         COALESCE(SUM(status IN ('draft', 'in_review', 'approved')), 0) AS pending_releases
       FROM releases
       WHERE user_id = ?`,
      [userId]
    );

    const [[deliveryCounts]] = await pool.query(
      `SELECT
         COALESCE(SUM(d.status = 'live'), 0) AS live_deliveries,
         COALESCE(SUM(d.status = 'pending'), 0) AS pending_deliveries
       FROM store_deliveries d
       INNER JOIN releases r ON r.id = d.release_id
       WHERE r.user_id = ?`,
      [userId]
    );

    const [[campaignCounts]] = await pool.query(
      `SELECT
         COALESCE(SUM(status = 'running'), 0) AS running_campaigns,
         COALESCE(SUM(budget_cents), 0) AS budget_cents,
         COALESCE(SUM(spend_cents), 0) AS spend_cents
       FROM campaigns
       WHERE user_id = ?`,
      [userId]
    );

    const [[royalties]] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'pending' THEN net_cents ELSE 0 END), 0) AS unpaid_cents,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN net_cents ELSE 0 END), 0) AS paid_cents,
         COALESCE(SUM(net_cents), 0) AS total_net_cents
       FROM royalty_statements
       WHERE user_id = ?`,
      [userId]
    );

    res.json({
      overview: {
        streams30d: Number(current.streams) || 0,
        listeners30d: Number(current.listeners) || 0,
        revenueCents30d: Number(current.revenue_cents) || 0,
        previous: {
          streams: Number(previous.streams) || 0,
          listeners: Number(previous.listeners) || 0,
          revenueCents: Number(previous.revenue_cents) || 0
        },
        change: {
          streams: pct(current.streams, previous.streams),
          listeners: pct(current.listeners, previous.listeners),
          revenue: pct(current.revenue_cents, previous.revenue_cents)
        },
        totalReleases: Number(releaseCounts.total_releases) || 0,
        liveReleases: Number(releaseCounts.live_releases) || 0,
        pendingReleases: Number(releaseCounts.pending_releases) || 0,
        liveDeliveries: Number(deliveryCounts.live_deliveries) || 0,
        pendingDeliveries: Number(deliveryCounts.pending_deliveries) || 0,
        runningCampaigns: Number(campaignCounts.running_campaigns) || 0,
        campaignBudgetCents: Number(campaignCounts.budget_cents) || 0,
        campaignSpendCents: Number(campaignCounts.spend_cents) || 0,
        unpaidRoyaltiesCents: Number(royalties.unpaid_cents) || 0,
        paidRoyaltiesCents: Number(royalties.paid_cents) || 0,
        totalRoyaltiesCents: Number(royalties.total_net_cents) || 0
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getTimeseries(req, res, next) {
  try {
    const userId = req.session.userId;
    let days = toInt(req.query.days, 30);
    if (!Number.isFinite(days) || days < 1) days = 30;
    if (days > 365) days = 365;

    const releaseId = req.query.releaseId ? toInt(req.query.releaseId, 0) : 0;

    const params = [userId];
    let releaseFilter = '';
    if (releaseId > 0) {
      releaseFilter = ' AND r.id = ?';
      params.push(releaseId);
    }
    params.push(days - 1);

    const [rows] = await pool.query(
      `SELECT
         s.stat_date AS stat_date,
         COALESCE(SUM(s.streams), 0) AS streams,
         COALESCE(SUM(s.listeners), 0) AS listeners,
         COALESCE(SUM(s.revenue_cents), 0) AS revenue_cents
       FROM stream_stats s
       INNER JOIN releases r ON r.id = s.release_id
       WHERE r.user_id = ?${releaseFilter}
         AND s.stat_date >= (CURDATE() - INTERVAL ? DAY)
       GROUP BY s.stat_date
       ORDER BY s.stat_date ASC`,
      params
    );

    const byDate = new Map();
    for (const row of rows) {
      const key = toDateKey(row.stat_date);
      if (!key) continue;
      byDate.set(key, {
        streams: Number(row.streams) || 0,
        listeners: Number(row.listeners) || 0,
        revenueCents: Number(row.revenue_cents) || 0
      });
    }

    const series = [];
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today.getTime());
      d.setDate(d.getDate() - i);
      const key = toDateKey(d);
      const found = byDate.get(key);
      series.push({
        date: key,
        streams: found ? found.streams : 0,
        listeners: found ? found.listeners : 0,
        revenueCents: found ? found.revenueCents : 0
      });
    }

    res.json({ days, series });
  } catch (err) {
    next(err);
  }
}

async function getTopReleases(req, res, next) {
  try {
    const userId = req.session.userId;
    let days = toInt(req.query.days, 30);
    if (!Number.isFinite(days) || days < 1) days = 30;
    if (days > 365) days = 365;

    let limit = toInt(req.query.limit, 5);
    if (!Number.isFinite(limit) || limit < 1) limit = 5;
    if (limit > 25) limit = 25;

    const [rows] = await pool.query(
      `SELECT
         r.id AS id,
         r.title AS title,
         r.artist_name AS artist_name,
         r.release_type AS release_type,
         r.status AS status,
         r.artwork_color AS artwork_color,
         COALESCE(SUM(s.streams), 0) AS streams,
         COALESCE(SUM(s.listeners), 0) AS listeners,
         COALESCE(SUM(s.revenue_cents), 0) AS revenue_cents
       FROM releases r
       LEFT JOIN stream_stats s
         ON s.release_id = r.id
        AND s.stat_date >= (CURDATE() - INTERVAL ? DAY)
       WHERE r.user_id = ?
       GROUP BY r.id, r.title, r.artist_name, r.release_type, r.status, r.artwork_color
       ORDER BY streams DESC, r.created_at DESC
       LIMIT ?`,
      [days - 1, userId, limit]
    );

    const ids = rows.map((r) => r.id);
    let platformRows = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(', ');
      const [pRows] = await pool.query(
        `SELECT
           s.release_id AS release_id,
           s.platform AS platform,
           COALESCE(SUM(s.streams), 0) AS streams
         FROM stream_stats s
         WHERE s.release_id IN (${placeholders})
           AND s.stat_date >= (CURDATE() - INTERVAL ? DAY)
         GROUP BY s.release_id, s.platform
         ORDER BY streams DESC`,
        [...ids, days - 1]
      );
      platformRows = pRows;
    }

    const breakdown = new Map();
    for (const row of platformRows) {
      const list = breakdown.get(row.release_id) || [];
      list.push({ platform: row.platform, streams: Number(row.streams) || 0 });
      breakdown.set(row.release_id, list);
    }

    const releases = rows.map((row) => ({
      id: row.id,
      title: row.title,
      artistName: row.artist_name,
      releaseType: row.release_type,
      status: row.status,
      artworkColor: row.artwork_color,
      streams: Number(row.streams) || 0,
      listeners: Number(row.listeners) || 0,
      revenueCents: Number(row.revenue_cents) || 0,
      platforms: breakdown.get(row.id) || []
    }));

    res.json({ days, releases });
  } catch (err) {
    next(err);
  }
}

async function listRoyalties(req, res, next) {
  try {
    const userId = req.session.userId;

    const [rows] = await pool.query(
      `SELECT id, period_label, gross_cents, fee_cents, net_cents, status, issued_at
       FROM royalty_statements
       WHERE user_id = ?
       ORDER BY issued_at DESC, id DESC`,
      [userId]
    );

    const statements = rows.map((row) => ({
      id: row.id,
      periodLabel: row.period_label,
      grossCents: Number(row.gross_cents) || 0,
      feeCents: Number(row.fee_cents) || 0,
      netCents: Number(row.net_cents) || 0,
      status: row.status,
      issuedAt: row.issued_at
    }));

    const totals = statements.reduce(
      (acc, s) => {
        acc.grossCents += s.grossCents;
        acc.feeCents += s.feeCents;
        acc.netCents += s.netCents;
        if (s.status === 'pending') acc.pendingCents += s.netCents;
        else acc.paidCents += s.netCents;
        return acc;
      },
      { grossCents: 0, feeCents: 0, netCents: 0, pendingCents: 0, paidCents: 0 }
    );

    res.json({ statements, totals });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverview,
  getTimeseries,
  getTopReleases,
  listRoyalties
};