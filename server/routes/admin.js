const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Verify admin password
router.post('/verify', adminController.verifyAdmin);

// Get statistics
router.get('/stats', adminController.getStats);

// Search users
router.get('/users/search', adminController.searchUsers);

// Get user details
router.get('/users/:userId', adminController.getUserDetails);

// Set user coins
router.post('/users/:userId/coins', adminController.setCoins);

// Reset user coins to 0
router.post('/users/:userId/reset-coins', adminController.resetCoins);

// Delete user highscores
router.delete('/users/:userId/highscores', adminController.deleteHighscores);

// Reset purchases (skins, upgrades, accessories)
router.post('/users/:userId/reset-purchases', adminController.resetPurchases);

// Reset achievements
router.delete('/users/:userId/achievements', adminController.resetAchievements);

// Full account reset
router.post('/users/:userId/full-reset', adminController.fullReset);

// Delete user completely
router.delete('/users/:userId', adminController.deleteUser);

module.exports = router;
