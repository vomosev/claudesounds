'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} = require('../controllers/campaigns.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', listCampaigns);
router.post('/', createCampaign);
router.patch('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

module.exports = router;