const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const highscoreController = require('../controllers/highscoreController');

const router = express.Router();

// Handle validation errors
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Public routes (no auth required)
router.get('/', highscoreController.getHighscores);
router.get('/user/:id', highscoreController.getUserHighscores);

// Protected routes (auth required)
router.post('/',
    authenticateToken,
    body('score').isInt({ min: 0, max: 999999999 }),
    body('levelReached').optional().isInt({ min: 1, max: 10 }),
    handleValidation,
    highscoreController.addHighscore
);

router.get('/me', authenticateToken, highscoreController.getMyRank);

module.exports = router;
