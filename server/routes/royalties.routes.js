const express = require('express');

const { requireAuth } = require('../middleware/auth');
const {
  listStatements,
  getBreakdown,
  requestPayout,
} = require('../controllers/royaltiesController');

const router = express.Router();

router.use(requireAuth);

// GET /api/royalties -> royalty statements for the session user
router.get('/', listStatements);

// GET /api/royalties/breakdown -> revenue & streams grouped by store
router.get('/breakdown', getBreakdown);

// POST /api/royalties/:id/request-payout -> mark a pending statement as paid
router.post('/:id/request-payout', requestPayout);

module.exports = router;