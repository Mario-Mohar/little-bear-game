const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Resend } = require('resend');
const { pool } = require('../config/db');
const { generateToken } = require('../middleware/auth');

const SALT_ROUNDS = 12;

// Resend E-Mail Client
let resend = null;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
}

// E-Mail Absender (muss bei Resend verifiziert sein)
const EMAIL_FROM = process.env.EMAIL_FROM || 'Little Bear <onboarding@resend.dev>';

async function sendEmail(to, subject, html) {
    if (!resend) {
        console.log('Resend nicht konfiguriert (RESEND_API_KEY fehlt), E-Mail wird übersprungen');
        return false;
    }

    console.log('Sende E-Mail an:', to);
    console.log('Von:', EMAIL_FROM);
    console.log('API Key vorhanden:', process.env.RESEND_API_KEY ? 'Ja (' + process.env.RESEND_API_KEY.substring(0, 10) + '...)' : 'Nein');

    try {
        const { data, error } = await resend.emails.send({
            from: EMAIL_FROM,
            to: to,
            subject: subject,
            html: html
        });

        if (error) {
            console.error('Resend API Fehler:', JSON.stringify(error, null, 2));
            return false;
        }

        console.log('E-Mail erfolgreich gesendet! ID:', data.id);
        return true;
    } catch (error) {
        console.error('E-Mail senden fehlgeschlagen:', error.message);
        console.error('Vollständiger Fehler:', error);
        return false;
    }
}

async function register(req, res) {
    const { username, email, password } = req.body;

    try {
        // E-Mail ist optional - normalisiere nur wenn vorhanden
        const normalizedEmail = email ? email.toLowerCase().trim() : null;

        // Check if username already exists (unique constraint)
        const existingUsername = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existingUsername.rows.length > 0) {
            return res.status(400).json({ error: 'Benutzername ist bereits vergeben' });
        }

        // Check if email already exists (nur wenn E-Mail angegeben)
        if (normalizedEmail) {
            const existingEmail = await pool.query(
                'SELECT id FROM users WHERE email = $1',
                [normalizedEmail]
            );

            if (existingEmail.rows.length > 0) {
                return res.status(400).json({ error: 'E-Mail-Adresse ist bereits registriert' });
            }
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Generate verification token (nur wenn E-Mail vorhanden)
        const verificationToken = normalizedEmail ? crypto.randomBytes(32).toString('hex') : null;

        // Create user (E-Mail ist optional)
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, verification_token, email_verified)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, username, email, email_verified, total_coins, purchased_skins, purchased_upgrades, selected_skin,
                       purchased_accessories, selected_hat, selected_glasses, selected_cape`,
            [username, normalizedEmail, passwordHash, verificationToken, !normalizedEmail] // Ohne E-Mail = auto-verified
        );

        const user = result.rows[0];

        // Send verification email nur wenn E-Mail angegeben und Resend konfiguriert
        let emailSent = false;
        if (normalizedEmail) {
            const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/auth/verify/${verificationToken}`;
            emailSent = await sendEmail(
                normalizedEmail,
                'Little Bear - Bestätige deine E-Mail',
                `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #8B4513;">Willkommen bei Little Bear!</h1>
                        <p>Hallo ${username},</p>
                        <p>Bitte klicke auf den Button unten, um deine E-Mail zu bestätigen:</p>
                        <a href="${verifyUrl}" style="display: inline-block; background: #8B4513; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">E-Mail bestätigen</a>
                        <p style="color: #666; font-size: 12px;">Oder kopiere diesen Link: ${verifyUrl}</p>
                        <p style="color: #666; font-size: 12px;">Dieser Link läuft in 24 Stunden ab.</p>
                    </div>
                `
            );

            // Auto-verify if no email service or email failed
            if (!emailSent) {
                await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [user.id]);
                user.email_verified = true;
            }
        }

        // Generate token
        const token = generateToken(user);

        res.status(201).json({
            message: 'Registrierung erfolgreich',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                emailVerified: user.email_verified,
                totalCoins: user.total_coins,
                purchasedSkins: user.purchased_skins,
                purchasedUpgrades: user.purchased_upgrades,
                selectedSkin: user.selected_skin,
                purchasedAccessories: user.purchased_accessories || [],
                selectedHat: user.selected_hat,
                selectedGlasses: user.selected_glasses,
                selectedCape: user.selected_cape
            },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
    }
}

async function login(req, res) {
    const { identifier, password } = req.body; // identifier kann Username oder E-Mail sein

    try {
        // Prüfe ob identifier eine E-Mail oder ein Username ist
        const isEmail = identifier && identifier.includes('@');
        const normalizedIdentifier = identifier ? identifier.toLowerCase().trim() : '';

        // Suche nach Username ODER E-Mail
        const result = await pool.query(
            `SELECT id, username, email, password_hash, email_verified, total_coins,
                    purchased_skins, purchased_upgrades, selected_skin,
                    purchased_accessories, selected_hat, selected_glasses, selected_cape
             FROM users WHERE ${isEmail ? 'email' : 'LOWER(username)'} = $1`,
            [normalizedIdentifier]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Ungültiger Benutzername/E-Mail oder Passwort' });
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Ungültiger Benutzername/E-Mail oder Passwort' });
        }

        // Update last login
        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        // Generate token
        const token = generateToken(user);

        res.json({
            message: 'Anmeldung erfolgreich',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                emailVerified: user.email_verified,
                totalCoins: user.total_coins,
                purchasedSkins: user.purchased_skins,
                purchasedUpgrades: user.purchased_upgrades,
                selectedSkin: user.selected_skin,
                purchasedAccessories: user.purchased_accessories || [],
                selectedHat: user.selected_hat,
                selectedGlasses: user.selected_glasses,
                selectedCape: user.selected_cape
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Anmeldung fehlgeschlagen' });
    }
}

async function verifyEmail(req, res) {
    const { token } = req.params;

    try {
        const result = await pool.query(
            'UPDATE users SET email_verified = true, verification_token = NULL WHERE verification_token = $1 RETURNING id',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).send(`
                <html>
                    <body style="font-family: Arial; text-align: center; padding: 50px;">
                        <h1>Ungültiger oder abgelaufener Bestätigungslink</h1>
                        <a href="/">Zum Spiel</a>
                    </body>
                </html>
            `);
        }

        res.send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>E-Mail erfolgreich bestätigt!</h1>
                    <p>Du kannst dich jetzt bei Little Bear anmelden.</p>
                    <a href="/">Zum Spiel</a>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).send('Bestätigung fehlgeschlagen');
    }
}

async function forgotPassword(req, res) {
    const { email } = req.body;

    try {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        const result = await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3 RETURNING id, username',
            [resetToken, expires, email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            // Don't reveal if email exists
            return res.json({ message: 'Falls ein Konto existiert, wurde eine E-Mail gesendet' });
        }

        const username = result.rows[0].username;
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/?reset=${resetToken}`;

        await sendEmail(
            email,
            'Little Bear - Passwort zurücksetzen',
            `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #8B4513;">Passwort zurücksetzen</h1>
                    <p>Hallo ${username},</p>
                    <p>Klicke auf den Button unten, um dein Passwort zurückzusetzen:</p>
                    <a href="${resetUrl}" style="display: inline-block; background: #8B4513; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Passwort zurücksetzen</a>
                    <p style="color: #666; font-size: 12px;">Oder kopiere diesen Link: ${resetUrl}</p>
                    <p style="color: #666; font-size: 12px;">Dieser Link läuft in 1 Stunde ab.</p>
                    <p style="color: #666; font-size: 12px;">Falls du dies nicht angefordert hast, ignoriere bitte diese E-Mail.</p>
                </div>
            `
        );

        res.json({ message: 'Falls ein Konto existiert, wurde eine E-Mail gesendet' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Anfrage konnte nicht verarbeitet werden' });
    }
}

async function resetPassword(req, res) {
    const { token, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > CURRENT_TIMESTAMP',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Ungültiger oder abgelaufener Reset-Token' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        await pool.query(
            'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
            [passwordHash, result.rows[0].id]
        );

        res.json({ message: 'Passwort erfolgreich zurückgesetzt' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Passwort konnte nicht zurückgesetzt werden' });
    }
}

module.exports = { register, login, verifyEmail, forgotPassword, resetPassword };
