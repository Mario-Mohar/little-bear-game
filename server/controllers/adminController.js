const { pool } = require('../config/db');

// Search users
async function searchUsers(req, res) {
    const { query } = req.query;

    try {
        const result = await pool.query(
            `SELECT id, username, email, total_coins, created_at, last_login,
                    purchased_skins, purchased_upgrades, purchased_accessories,
                    selected_skin, selected_hat, selected_glasses, selected_cape
             FROM users
             WHERE LOWER(username) LIKE $1 OR LOWER(email) LIKE $1
             ORDER BY username
             LIMIT 50`,
            [`%${query?.toLowerCase() || ''}%`]
        );

        // Get highscore count for each user
        const usersWithStats = await Promise.all(result.rows.map(async (user) => {
            const highscoreResult = await pool.query(
                'SELECT COUNT(*) as count, MAX(score) as best_score FROM highscores WHERE user_id = $1',
                [user.id]
            );

            const achievementResult = await pool.query(
                'SELECT COUNT(*) as count FROM user_achievements WHERE user_id = $1',
                [user.id]
            );

            return {
                ...user,
                highscore_count: parseInt(highscoreResult.rows[0]?.count || 0),
                best_score: highscoreResult.rows[0]?.best_score || 0,
                achievement_count: parseInt(achievementResult.rows[0]?.count || 0)
            };
        }));

        res.json({ users: usersWithStats });
    } catch (error) {
        console.error('Admin search error:', error);
        res.status(500).json({ error: 'Suche fehlgeschlagen' });
    }
}

// Get user details
async function getUserDetails(req, res) {
    const { userId } = req.params;

    try {
        const userResult = await pool.query(
            `SELECT * FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        const user = userResult.rows[0];

        // Get highscores
        const highscores = await pool.query(
            'SELECT * FROM highscores WHERE user_id = $1 ORDER BY score DESC LIMIT 20',
            [userId]
        );

        // Get achievements
        const achievements = await pool.query(
            'SELECT * FROM user_achievements WHERE user_id = $1',
            [userId]
        );

        res.json({
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                total_coins: user.total_coins,
                purchased_skins: user.purchased_skins || [],
                purchased_upgrades: user.purchased_upgrades || [],
                purchased_accessories: user.purchased_accessories || [],
                selected_skin: user.selected_skin,
                selected_hat: user.selected_hat,
                selected_glasses: user.selected_glasses,
                selected_cape: user.selected_cape,
                created_at: user.created_at,
                last_login: user.last_login
            },
            highscores: highscores.rows,
            achievements: achievements.rows
        });
    } catch (error) {
        console.error('Admin get user error:', error);
        res.status(500).json({ error: 'Benutzer konnte nicht geladen werden' });
    }
}

// Reset user coins
async function resetCoins(req, res) {
    const { userId } = req.params;
    const { newAmount } = req.body;

    try {
        await pool.query(
            'UPDATE users SET total_coins = $1 WHERE id = $2',
            [newAmount || 0, userId]
        );

        res.json({ success: true, message: `Münzen auf ${newAmount || 0} gesetzt` });
    } catch (error) {
        console.error('Admin reset coins error:', error);
        res.status(500).json({ error: 'Münzen konnten nicht zurückgesetzt werden' });
    }
}

// Delete user highscores
async function deleteHighscores(req, res) {
    const { userId } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM highscores WHERE user_id = $1',
            [userId]
        );

        res.json({ success: true, message: `${result.rowCount} Highscores gelöscht` });
    } catch (error) {
        console.error('Admin delete highscores error:', error);
        res.status(500).json({ error: 'Highscores konnten nicht gelöscht werden' });
    }
}

// Reset purchased items (skins, upgrades, accessories)
async function resetPurchases(req, res) {
    const { userId } = req.params;
    const { resetSkins, resetUpgrades, resetAccessories } = req.body;

    try {
        const updates = [];
        const values = [userId];
        let paramIndex = 2;

        if (resetSkins) {
            updates.push(`purchased_skins = '{}'::text[]`);
            updates.push(`selected_skin = 'default'`);
        }
        if (resetUpgrades) {
            updates.push(`purchased_upgrades = '{}'::text[]`);
        }
        if (resetAccessories) {
            updates.push(`purchased_accessories = '{}'::text[]`);
            updates.push(`selected_hat = NULL`);
            updates.push(`selected_glasses = NULL`);
            updates.push(`selected_cape = NULL`);
        }

        if (updates.length > 0) {
            await pool.query(
                `UPDATE users SET ${updates.join(', ')} WHERE id = $1`,
                values
            );
        }

        res.json({ success: true, message: 'Käufe zurückgesetzt' });
    } catch (error) {
        console.error('Admin reset purchases error:', error);
        res.status(500).json({ error: 'Käufe konnten nicht zurückgesetzt werden' });
    }
}

// Reset achievements
async function resetAchievements(req, res) {
    const { userId } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM user_achievements WHERE user_id = $1',
            [userId]
        );

        res.json({ success: true, message: `${result.rowCount} Achievements gelöscht` });
    } catch (error) {
        console.error('Admin reset achievements error:', error);
        res.status(500).json({ error: 'Achievements konnten nicht zurückgesetzt werden' });
    }
}

// Full account reset (everything except username/email/password)
async function fullReset(req, res) {
    const { userId } = req.params;

    try {
        // Reset user data
        await pool.query(
            `UPDATE users SET
                total_coins = 0,
                purchased_skins = '{}'::text[],
                purchased_upgrades = '{}'::text[],
                purchased_accessories = '{}'::text[],
                selected_skin = 'default',
                selected_hat = NULL,
                selected_glasses = NULL,
                selected_cape = NULL
             WHERE id = $1`,
            [userId]
        );

        // Delete highscores
        await pool.query('DELETE FROM highscores WHERE user_id = $1', [userId]);

        // Delete achievements
        await pool.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);

        // Delete friendships
        await pool.query('DELETE FROM friendships WHERE user_id = $1 OR friend_id = $1', [userId]);

        res.json({ success: true, message: 'Account vollständig zurückgesetzt' });
    } catch (error) {
        console.error('Admin full reset error:', error);
        res.status(500).json({ error: 'Reset fehlgeschlagen' });
    }
}

// Delete user completely
async function deleteUser(req, res) {
    const { userId } = req.params;

    try {
        // Delete all related data first
        await pool.query('DELETE FROM highscores WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM user_achievements WHERE user_id = $1', [userId]);
        await pool.query('DELETE FROM friendships WHERE user_id = $1 OR friend_id = $1', [userId]);

        // Delete user
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING username', [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        res.json({ success: true, message: `Benutzer "${result.rows[0].username}" gelöscht` });
    } catch (error) {
        console.error('Admin delete user error:', error);
        res.status(500).json({ error: 'Benutzer konnte nicht gelöscht werden' });
    }
}

// Get statistics
async function getStats(req, res) {
    try {
        const userCount = await pool.query('SELECT COUNT(*) FROM users');
        const highscoreCount = await pool.query('SELECT COUNT(*) FROM highscores');
        const totalCoins = await pool.query('SELECT SUM(total_coins) FROM users');
        const topPlayers = await pool.query(
            `SELECT u.username, MAX(h.score) as best_score
             FROM users u
             JOIN highscores h ON u.id = h.user_id
             GROUP BY u.id, u.username
             ORDER BY best_score DESC
             LIMIT 10`
        );
        const recentUsers = await pool.query(
            `SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT 10`
        );

        res.json({
            userCount: parseInt(userCount.rows[0].count),
            highscoreCount: parseInt(highscoreCount.rows[0].count),
            totalCoins: parseInt(totalCoins.rows[0].sum || 0),
            topPlayers: topPlayers.rows,
            recentUsers: recentUsers.rows
        });
    } catch (error) {
        console.error('Admin stats error:', error);
        res.status(500).json({ error: 'Statistiken konnten nicht geladen werden' });
    }
}

// Set user coins to specific amount
async function setCoins(req, res) {
    const { userId } = req.params;
    const { amount } = req.body;

    try {
        await pool.query(
            'UPDATE users SET total_coins = $1 WHERE id = $2',
            [amount, userId]
        );

        res.json({ success: true, message: `Münzen auf ${amount} gesetzt` });
    } catch (error) {
        console.error('Admin set coins error:', error);
        res.status(500).json({ error: 'Münzen konnten nicht gesetzt werden' });
    }
}

module.exports = {
    searchUsers,
    getUserDetails,
    resetCoins,
    deleteHighscores,
    resetPurchases,
    resetAchievements,
    fullReset,
    deleteUser,
    getStats,
    setCoins
};
