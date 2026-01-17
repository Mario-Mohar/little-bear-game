const express = require('express');
const router = express.Router();
const achievementsController = require('../controllers/achievementsController');
const { authenticateToken } = require('../middleware/auth');

// Öffentliche Route: Achievement-Definitionen (ohne Details für geheime)
router.get('/definitions', achievementsController.getDefinitions);

// Geschützte Routen
router.get('/', authenticateToken, achievementsController.getAchievements);
router.post('/progress', authenticateToken, achievementsController.updateProgress);
router.post('/update-multiple', authenticateToken, achievementsController.updateMultiple);

module.exports = router;
