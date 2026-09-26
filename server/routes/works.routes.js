const express = require('express');

const { requireAuth } = require('../middleware/auth');
const {
  listWorks,
  createWork,
  updateWork,
  deleteWork,
} = require('../controllers/worksController');

const router = express.Router();

router.use(requireAuth);

router.get('/', listWorks);
router.post('/', createWork);
router.patch('/:id', updateWork);
router.delete('/:id', deleteWork);

module.exports = router;