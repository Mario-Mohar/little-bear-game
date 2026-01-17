const express = require('express');
const { body, param, query } = require('express-validator');
const friendsController = require('../controllers/friendsController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Alle Routes erfordern Authentifizierung
router.use(authenticateToken);

// Validation middleware
const handleValidation = (req, res, next) => {
    const { validationResult } = require('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

// Benutzer suchen (per Username oder E-Mail)
router.get('/search',
    query('query').trim().isLength({ min: 2 }).withMessage('Suchbegriff muss mindestens 2 Zeichen lang sein'),
    handleValidation,
    friendsController.searchUser
);

// Freundschaftsanfrage senden
router.post('/request',
    body('friendId').isInt().withMessage('Gültige Freund-ID erforderlich'),
    handleValidation,
    friendsController.sendRequest
);

// Freundschaftsanfrage annehmen
router.post('/accept/:requestId',
    param('requestId').isInt().withMessage('Gültige Anfrage-ID erforderlich'),
    handleValidation,
    friendsController.acceptRequest
);

// Freundschaftsanfrage ablehnen
router.delete('/decline/:requestId',
    param('requestId').isInt().withMessage('Gültige Anfrage-ID erforderlich'),
    handleValidation,
    friendsController.declineRequest
);

// Gesendete Anfrage zurückziehen
router.delete('/cancel/:requestId',
    param('requestId').isInt().withMessage('Gültige Anfrage-ID erforderlich'),
    handleValidation,
    friendsController.cancelRequest
);

// Freundesliste abrufen
router.get('/', friendsController.getFriends);

// Offene Anfragen abrufen (an mich)
router.get('/pending', friendsController.getPendingRequests);

// Gesendete Anfragen abrufen (von mir)
router.get('/sent', friendsController.getSentRequests);

// Freund entfernen
router.delete('/:friendshipId',
    param('friendshipId').isInt().withMessage('Gültige Freundschafts-ID erforderlich'),
    handleValidation,
    friendsController.removeFriend
);

module.exports = router;
