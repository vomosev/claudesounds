const express = require('express');

const { requireAuth } = require('../middleware/auth');
const {
  getOverview,
  getTimeseries,
  getTopReleases,
  listRoyalties,
} = require('../controllers/analytics.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/overview', getOverview);
router.get('/timeseries', getTimeseries);
router.get('/top-releases', getTopReleases);
router.get('/royalties', listRoyalties);

module.exports = router;