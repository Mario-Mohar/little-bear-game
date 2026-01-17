const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

// Public routes: Öffentliches Profil und Aktivitäts-Feed (optional mit Auth für Freundschaftsstatus)
router.get('/public/:userId', optionalAuth, userController.getPublicProfile);
router.get('/activity/:userId', optionalAuth, userController.getActivityFeed);
router.get('/compare/:userId1/:userId2', optionalAuth, userController.compareProfiles);

// Handle validation errors
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Protected Routes (require authentication)
router.get('/profile', authenticateToken, userController.getProfile);

// Erweitertes Profil (mit Titeln, Bannern, Privatsphäre)
router.get('/profile/extended', authenticateToken, userController.getExtendedProfile);

router.put('/profile',
    authenticateToken,
    body('selectedSkin').isString().trim(),
    handleValidation,
    userController.updateProfile
);

// Erweitertes Profil aktualisieren (Bio, Banner, Titel, Privatsphäre)
router.put('/profile/extended',
    authenticateToken,
    body('bio').optional().isString().isLength({ max: 200 }),
    body('profileBanner').optional().isString(),
    body('selectedTitle').optional(),
    body('privacy').optional().isObject(),
    handleValidation,
    userController.updateExtendedProfile
);

router.post('/coins',
    authenticateToken,
    body('coins').isInt({ min: 0, max: 1000 }),
    body('level').isInt({ min: 1, max: 15 }),
    handleValidation,
    userController.addCoins
);

router.post('/purchase',
    authenticateToken,
    body('itemType').isIn(['skins', 'upgrades', 'accessories']),
    body('itemId').isString().trim(),
    handleValidation,
    userController.purchase
);

router.get('/inventory', authenticateToken, userController.getInventory);

// Accessoire ausrüsten/ablegen
router.post('/equip-accessory',
    authenticateToken,
    body('slot').isIn(['hat', 'glasses', 'cape', 'special']),
    body('accessoryId').optional({ nullable: true }),
    handleValidation,
    userController.equipAccessory
);

router.post('/sync',
    authenticateToken,
    body('totalCoins').optional().isInt({ min: 0 }),
    body('purchasedSkins').optional().isArray(),
    body('purchasedUpgrades').optional().isArray(),
    handleValidation,
    userController.syncProfile
);

module.exports = router;
