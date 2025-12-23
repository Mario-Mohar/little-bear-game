const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Handle validation errors
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Routes
router.get('/profile', userController.getProfile);

router.put('/profile',
    body('selectedSkin').isString().trim(),
    handleValidation,
    userController.updateProfile
);

router.post('/coins',
    body('coins').isInt({ min: 0, max: 1000 }),
    body('level').isInt({ min: 1, max: 10 }),
    handleValidation,
    userController.addCoins
);

router.post('/purchase',
    body('itemType').isIn(['skins', 'upgrades']),
    body('itemId').isString().trim(),
    handleValidation,
    userController.purchase
);

router.get('/inventory', userController.getInventory);

router.post('/sync',
    body('totalCoins').optional().isInt({ min: 0 }),
    body('purchasedSkins').optional().isArray(),
    body('purchasedUpgrades').optional().isArray(),
    handleValidation,
    userController.syncProfile
);

module.exports = router;
