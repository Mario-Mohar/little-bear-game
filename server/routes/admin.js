const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Jede Route hier braucht ein gueltiges Token UND ein Konto mit is_admin.
// Vorher haette jeder, der den Server erreicht, Konten loeschen koennen: das
// frueher hier stehende /verify prueft ein Passwort und antwortet nur
// { success: true } -- ohne Token, ohne Sitzung. Die Sperre lag damit
// ausschliesslich im Client. Der Admin-Panel meldet sich jetzt ueber
// /api/auth/login an wie jeder andere auch.
router.use(authenticateToken);
router.use(requireAdmin);

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
