const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');

const router = express.Router();

// Validation middleware
const validateRegister = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('Benutzername muss 3-50 Zeichen lang sein')
        .matches(/^[a-zA-Z0-9_äöüÄÖÜß]+$/)
        .withMessage('Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten'),
    // E-Mail ist optional - nur validieren wenn angegeben
    body('email')
        .optional({ checkFalsy: true })
        .isEmail()
        .normalizeEmail()
        .withMessage('Wenn angegeben, muss die E-Mail-Adresse gültig sein'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Passwort muss mindestens 6 Zeichen lang sein')
];

// Login akzeptiert Username ODER E-Mail als "identifier"
const validateLogin = [
    body('identifier')
        .trim()
        .notEmpty()
        .withMessage('Benutzername oder E-Mail erforderlich'),
    body('password')
        .notEmpty()
        .withMessage('Passwort erforderlich')
];

const validatePassword = [
    body('password')
        .isLength({ min: 6 })
        .withMessage('Passwort muss mindestens 6 Zeichen lang sein')
];

// Handle validation errors
const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Gib den ersten Fehler als { error: "..." } zurück für Konsistenz
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

// Routes
router.post('/register', validateRegister, handleValidation, authController.register);
router.post('/login', validateLogin, handleValidation, authController.login);
router.get('/verify/:token', authController.verifyEmail);
router.post('/forgot-password', body('email').isEmail(), handleValidation, authController.forgotPassword);
router.post('/reset-password', validatePassword, handleValidation, authController.resetPassword);

module.exports = router;
