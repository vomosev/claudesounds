const { pool } = require('../config/db');

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function percentDelta(current, previous) {
  const c = toNumber(current);
  const p = toNumber(previous);
  if (p === 0) {
    return c === 0 ? 0 : 100;
  }
  return Math.round(((c - p) / p) * 1000) / 10;
}

/**
 * GET /api/analytics/summary
 * Dashboard KPI totals plus month-over-month deltas.
 */
async function getSummary(req, res, next) {
  const userId = req.session && req.session.userId;
  try {
    const [totalsRows] = await pool.execute(
      `SELECT
         COALESCE(SUM(s.stream_count), 0) AS total_streams,
         COALESCE(SUM(s.revenue), 0) AS total_revenue
       FROM streams s
       INNER JOIN releases r ON r.id = s.release_id
       WHERE r.user_id = ?`,
      [userId]
    );

    const [currentRows] = await pool.execute(
      `SELECT
         COALESCE(SUM(s.stream_count), 0) AS streams,
         COALESCE(SUM(s.revenue), 0) AS revenue
       FROM streams s
       INNER JOIN releases r ON r.id = s.release_id
       WHERE r.user_id = ?
         AND s.stream_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      [userId]
    );

    const [previousRows] = await pool.execute(
      `SELECT
         COALESCE(SUM(s.stream_count), 0) AS streams,
         COALESCE(SUM(s.revenue), 0) AS revenue
       FROM streams s
       INNER JOIN releases r ON r.id = s.release_id
       WHERE r.user_id = ?
         AND s.stream_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
         AND s.stream_date < DATE_SUB(CURDATE(), INTERVAL 30 DAY)`,
      [userId]
    );

    const [releaseRows] = await pool.execute(
      `SELECT
         COUNT(*) AS total_releases,
         SUM(CASE WHEN status = 'live' THEN 1 ELSE 0 END) AS live_releases,
         SUM(CASE WHEN status IN ('draft', 'in_review') THEN 1 ELSE 0 END) AS pending_releases
       FROM releases
       WHERE user_id = ?`,
      [userId]
    );

    const [campaignRows] = await pool.execute(
      `SELECT
         COUNT(*) AS total_campaigns,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_campaigns,
         COALESCE(SUM(budget), 0) AS total_budget,
         COALESCE(SUM(spend), 0) AS total_spend
       FROM campaigns
       WHERE user_id = ?`,
      [userId]
    );

    const [worksRows] = await pool.execute(
      `SELECT
         COUNT(*) AS total_works,
         SUM(CASE WHEN registration_status = 'registered' THEN 1 ELSE 0 END) AS registered_works
       FROM works
       WHERE user_id = ?`,
      [userId]
    );

    const [royaltyRows] = await pool.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'pending' THEN net_amount ELSE 0 END), 0) AS pending_payout,
         COALESCE(SUM(net_amount), 0) AS lifetime_net
       FROM royalty_statements
       WHERE user_id = ?`,
      [userId]
    );

    const totals = totalsRows[0] || {};
    const current = currentRows[0] || {};
    const previous = previousRows[0] || {};
    const releases = releaseRows[0] || {};
    const campaigns = campaignRows[0] || {};
    const works = worksRows[0] || {};
    const royalties = royaltyRows[0] || {};

    res.json({
      total_streams: toNumber(totals.total_streams),
      total_revenue: Math.round(toNumber(totals.total_revenue) * 100) / 100,
      streams_last_30: toNumber(current.streams),
      revenue_last_30: Math.round(toNumber(current.revenue) * 100) / 100,
      streams_delta_percent: percentDelta(current.streams, previous.streams),
      revenue_delta_percent: percentDelta(current.revenue, previous.revenue),
      total_releases: toNumber(releases.total_releases),
      live_releases: toNumber(releases.live_releases),
      pending_releases: toNumber(releases.pending_releases),
      total_campaigns: toNumber(campaigns.total_campaigns),
      active_campaigns: toNumber(campaigns.active_campaigns),
      campaign_budget: Math.round(toNumber(campaigns.total_budget) * 100) / 100,
      campaign_spend: Math.round(toNumber(campaigns.total_spend) * 100) / 100,
      total_works: toNumber(works.total_works),
      registered_works: toNumber(works.registered_works),
      pending_payout: Math.round(toNumber(royalties.pending_payout) * 100) / 100,
      lifetime_net: Math.round(toNumber(royalties.lifetime_net) * 100) / 100
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/streams?days=30&releaseId=123
 * Daily series, zero-filled so the chart never has gaps.
 */
async function getStreamSeries(req, res, next) {
  const userId = req.session && req.session.userId;
  try {
    let days = parseInt(req.query.days, 10);
    if (!Number.isFinite(days) || days <= 0) days = 30;
    if (days > 365) days = 365;

    let releaseId = null;
    if (req.query.releaseId !== undefined && req.query.releaseId !== '' && req.query.releaseId !== 'all') {
      const parsed = parseInt(req.query.releaseId, 10);
      if (!Number.isFinite(parsed)) {
        const err = new Error('releaseId must be a number');
        err.status = 400;
        throw err;
      }
      releaseId = parsed;
    }

    const params = [userId, String(days)];
    let sql =
      `SELECT s.stream_date AS stream_date,
              COALESCE(SUM(s.stream_count), 0) AS streams,
              COALESCE(SUM(s.revenue), 0) AS revenue
       FROM streams s
       INNER JOIN releases r ON r.id = s.release_id
       WHERE r.user_id = ?
         AND s.stream_date >= DATE_SUB(CURDATE(), INTERVAL CAST(? AS UNSIGNED) DAY)`;

    if (releaseId !== null) {
      sql += ' AND s.release_id = ?';
      params.push(releaseId);
    }

    sql += ' GROUP BY s.stream_date ORDER BY s.stream_date ASC';

    const [rows] = await pool.execute(sql, params);

    const byDate = new Map();
    rows.forEach((row) => {
      const key =
        row.stream_date instanceof Date
          ? formatDate(row.stream_date)
          : String(row.stream_date).slice(0, 10);
      byDate.set(key, {
        streams: toNumber(row.streams),
        revenue: Math.round(toNumber(row.revenue) * 100) / 100
      });
    });

    const series = [];
    const today = new Date();
    const end = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(end.getTime());
      d.setUTCDate(d.getUTCDate() - i);
      const key = formatDate(d);
      const found = byDate.get(key);
      series.push({
        date: key,
        streams: found ? found.streams : 0,
        revenue: found ? found.revenue : 0
      });
    }

    const totalStreams = series.reduce((sum, p) => sum + p.streams, 0);
    const totalRevenue = series.reduce((sum, p) => sum + p.revenue, 0);

    res.json({
      days,
      release_id: releaseId,
      series,
      total_streams: totalStreams,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      average_daily_streams: series.length ? Math.round(totalStreams / series.length) : 0
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/top-releases
 * Top 5 releases by streams with a per-store breakdown.
 */
async function getTopReleases(req, res, next) {
  const userId = req.session && req.session.userId;
  try {
    let limit = parseInt(req.query.limit, 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 5;
    if (limit > 25) limit = 25;

    let days = parseInt(req.query.days, 10);
    if (!Number.isFinite(days) || days <= 0) days = 90;
    if (days > 365) days = 365;

    const [rows] = await pool.execute(
      `SELECT r.id,
              r.title,
              r.artist_name,
              r.release_type,
              r.status,
              r.artwork_color,
              COALESCE(SUM(s.stream_count), 0) AS streams,
              COALESCE(SUM(s.revenue), 0) AS revenue
       FROM releases r
       LEFT JOIN streams s
         ON s.release_id = r.id
        AND s.stream_date >= DATE_SUB(CURDATE(), INTERVAL CAST(? AS UNSIGNED) DAY)
       WHERE r.user_id = ?
       GROUP BY r.id, r.title, r.artist_name, r.release_type, r.status, r.artwork_color
       ORDER BY streams DESC, r.created_at DESC
       LIMIT ${limit}`,
      [String(days), userId]
    );

    const releases = rows.map((row) => ({
      id: row.id,
      title: row.title,
      artist_name: row.artist_name,
      release_type: row.release_type,
      status: row.status,
      artwork_color: row.artwork_color,
      streams: toNumber(row.streams),
      revenue: Math.round(toNumber(row.revenue) * 100) / 100,
      stores: []
    }));

    if (releases.length) {
      const ids = releases.map((r) => r.id);
      const placeholders = ids.map(() => '?').join(', ');
      const [storeRows] = await pool.execute(
        `SELECT s.release_id,
                s.store_name,
                COALESCE(SUM(s.stream_count), 0) AS streams,
                COALESCE(SUM(s.revenue), 0) AS revenue
         FROM streams s
         INNER JOIN releases r ON r.id = s.release_id
         WHERE r.user_id = ?
           AND s.release_id IN (${placeholders})
           AND s.stream_date >= DATE_SUB(CURDATE(), INTERVAL CAST(? AS UNSIGNED) DAY)
         GROUP BY s.release_id, s.store_name
         ORDER BY streams DESC`,
        [userId, ...ids, String(days)]
      );

      const map = new Map(releases.map((r) => [r.id, r]));
      storeRows.forEach((row) => {
        const target = map.get(row.release_id);
        if (target) {
          target.stores.push({
            store_name: row.store_name,
            streams: toNumber(row.streams),
            revenue: Math.round(toNumber(row.revenue) * 100) / 100
          });
        }
      });
    }

    res.json({ days, releases });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSummary,
  getStreamSeries,
  getTopReleases
};