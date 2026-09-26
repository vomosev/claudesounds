const express = require('express');

const { requireAuth } = require('../middleware/auth');
const {
  listWorks,
  getWork,
  createWork,
  updateWorkRegistration,
  deleteWork,
} = require('../controllers/publishing.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/works', listWorks);
router.post('/works', createWork);
router.get('/works/:id', getWork);
router.patch('/works/:id', updateWorkRegistration);
router.delete('/works/:id', deleteWork);

module.exports = router;