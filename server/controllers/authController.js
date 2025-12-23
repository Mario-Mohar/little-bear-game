const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { pool } = require('../config/db');
const { generateToken } = require('../middleware/auth');

const SALT_ROUNDS = 12;

// Email transporter (configure in production)
let transporter = null;
if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

async function register(req, res) {
    const { username, email, password } = req.body;

    try {
        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email.toLowerCase(), username]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Create user
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, verification_token)
             VALUES ($1, $2, $3, $4)
             RETURNING id, username, email, email_verified, total_coins, purchased_skins, purchased_upgrades, selected_skin`,
            [username, email.toLowerCase(), passwordHash, verificationToken]
        );

        const user = result.rows[0];

        // Send verification email if SMTP is configured
        if (transporter) {
            const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/auth/verify/${verificationToken}`;
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: email,
                subject: 'Little Bear - Verify your email',
                html: `
                    <h1>Welcome to Little Bear!</h1>
                    <p>Please click the link below to verify your email:</p>
                    <a href="${verifyUrl}">${verifyUrl}</a>
                    <p>This link expires in 24 hours.</p>
                `
            });
        } else {
            // Auto-verify if no email service configured
            await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [user.id]);
            user.email_verified = true;
        }

        // Generate token
        const token = generateToken(user);

        res.status(201).json({
            message: 'Registration successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                emailVerified: user.email_verified,
                totalCoins: user.total_coins,
                purchasedSkins: user.purchased_skins,
                purchasedUpgrades: user.purchased_upgrades,
                selectedSkin: user.selected_skin
            },
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
}

async function login(req, res) {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            `SELECT id, username, email, password_hash, email_verified, total_coins,
                    purchased_skins, purchased_upgrades, selected_skin
             FROM users WHERE email = $1`,
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login
        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        // Generate token
        const token = generateToken(user);

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                emailVerified: user.email_verified,
                totalCoins: user.total_coins,
                purchasedSkins: user.purchased_skins,
                purchasedUpgrades: user.purchased_upgrades,
                selectedSkin: user.selected_skin
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
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
                        <h1>Invalid or expired verification link</h1>
                        <a href="/">Go to game</a>
                    </body>
                </html>
            `);
        }

        res.send(`
            <html>
                <body style="font-family: Arial; text-align: center; padding: 50px;">
                    <h1>Email verified successfully!</h1>
                    <p>You can now log in to Little Bear.</p>
                    <a href="/">Go to game</a>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).send('Verification failed');
    }
}

async function forgotPassword(req, res) {
    const { email } = req.body;

    try {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        const result = await pool.query(
            'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3 RETURNING id',
            [resetToken, expires, email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            // Don't reveal if email exists
            return res.json({ message: 'If an account exists, a reset email has been sent' });
        }

        if (transporter) {
            const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/?reset=${resetToken}`;
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: email,
                subject: 'Little Bear - Password Reset',
                html: `
                    <h1>Password Reset</h1>
                    <p>Click the link below to reset your password:</p>
                    <a href="${resetUrl}">${resetUrl}</a>
                    <p>This link expires in 1 hour.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                `
            });
        }

        res.json({ message: 'If an account exists, a reset email has been sent' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process request' });
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
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        await pool.query(
            'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
            [passwordHash, result.rows[0].id]
        );

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
}

module.exports = { register, login, verifyEmail, forgotPassword, resetPassword };
