'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  listReleases,
  getRelease,
  createRelease,
  updateRelease,
  deleteRelease,
  deliverRelease,
} = require('../controllers/releases.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', listReleases);
router.post('/', createRelease);
router.get('/:id', getRelease);
router.patch('/:id', updateRelease);
router.delete('/:id', deleteRelease);
router.post('/:id/deliver', deliverRelease);

module.exports = router;