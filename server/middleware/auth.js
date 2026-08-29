const jwt = require('jsonwebtoken');

// Kein Fallback: ein Geheimnis, das im oeffentlichen Repo steht, ist kein
// Standardwert, sondern ein veroeffentlichtes Passwort -- jeder koennte damit
// Tokens fuer beliebige Konten ausstellen. Fehlt es, starten wir gar nicht,
// genauso wie config/db.js es bei DATABASE_URL haelt.
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('ERROR: JWT_SECRET environment variable is not set!');
    console.error('Please set JWT_SECRET in Railway Variables or .env file');
    process.exit(1);
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            req.user = null;
        } else {
            req.user = user;
        }
        next();
    });
}

function generateToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, email: user.email, isAdmin: user.is_admin === true },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

// Muss hinter authenticateToken haengen, nie allein: ohne req.user gibt es
// nichts zu pruefen.
function requireAdmin(req, res, next) {
    if (!req.user || req.user.isAdmin !== true) {
        return res.status(403).json({ error: 'Admin-Rechte erforderlich' });
    }
    next();
}

module.exports = { authenticateToken, optionalAuth, requireAdmin, generateToken, JWT_SECRET };
