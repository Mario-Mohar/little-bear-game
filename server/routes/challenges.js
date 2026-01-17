const express = require('express');
const challengesController = require('../controllers/challengesController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Alle Routes erfordern Authentifizierung
router.use(authenticateToken);

// Hole die heutige Challenge
router.get('/today', challengesController.getTodayChallenge);

// Hole die aktive Challenge (für Spielfortschritt)
router.get('/active', challengesController.getActiveChallenge);

// Challenge annehmen
router.post('/accept', challengesController.acceptChallenge);

// Challenge ablehnen
router.post('/decline', challengesController.declineChallenge);

// Fortschritt aktualisieren
router.post('/progress', challengesController.updateProgress);

// Belohnung einfordern
router.post('/claim', challengesController.claimReward);

// Alle Challenge-Definitionen (für Info)
router.get('/definitions', challengesController.getChallengeDefinitions);

module.exports = router;
