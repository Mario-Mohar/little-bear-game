const { pool } = require('../config/db');

async function getHighscores(req, res) {
    const limit = Math.min(parseInt(req.query.limit) || 100, 100);
    const offset = parseInt(req.query.offset) || 0;
    const platform = req.query.platform; // 'pc', 'mobile', or undefined for all

    try {
        // Build platform filter - treat NULL as 'pc' for old entries
        let platformFilter = '';
        if (platform === 'pc') {
            platformFilter = "WHERE (h.platform = 'pc' OR h.platform IS NULL)";
        } else if (platform === 'mobile') {
            platformFilter = "WHERE h.platform = 'mobile'";
        }
        const params = [limit, offset];

        // Only show the highest score per player (filtered by platform if specified)
        const result = await pool.query(
            `WITH best_scores AS (
                SELECT h.id, h.username, h.score, h.level_reached, h.created_at, h.user_id, h.platform,
                       ROW_NUMBER() OVER (PARTITION BY h.username ORDER BY h.score DESC) as rn
                FROM highscores h
                ${platformFilter}
            )
            SELECT b.id, b.username, b.score, b.level_reached, b.created_at, b.platform, u.selected_skin
            FROM best_scores b
            LEFT JOIN users u ON b.user_id = u.id
            WHERE b.rn = 1
            ORDER BY b.score DESC
            LIMIT $1 OFFSET $2`,
            params
        );

        // Get total count of unique players (filtered by platform if specified)
        let countQuery = 'SELECT COUNT(DISTINCT username) FROM highscores';
        if (platform === 'pc') {
            countQuery = "SELECT COUNT(DISTINCT username) FROM highscores WHERE (platform = 'pc' OR platform IS NULL)";
        } else if (platform === 'mobile') {
            countQuery = "SELECT COUNT(DISTINCT username) FROM highscores WHERE platform = 'mobile'";
        }
        const countResult = await pool.query(countQuery);
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            highscores: result.rows.map((row, index) => ({
                rank: offset + index + 1,
                username: row.username,
                score: row.score,
                levelReached: row.level_reached,
                skin: row.selected_skin || 'default',
                platform: row.platform || 'pc',
                date: row.created_at
            })),
            total: totalCount,
            limit,
            offset,
            platform: platform || 'all'
        });
    } catch (error) {
        console.error('Get highscores error:', error);
        res.status(500).json({ error: 'Highscores konnten nicht geladen werden' });
    }
}

async function getUserHighscores(req, res) {
    const userId = parseInt(req.params.id);

    try {
        const result = await pool.query(
            `SELECT h.id, h.score, h.level_reached, h.created_at
             FROM highscores h
             WHERE h.user_id = $1
             ORDER BY h.score DESC
             LIMIT 10`,
            [userId]
        );

        // Get user's rank
        const rankResult = await pool.query(
            `SELECT COUNT(*) + 1 as rank
             FROM highscores
             WHERE score > (SELECT COALESCE(MAX(score), 0) FROM highscores WHERE user_id = $1)`,
            [userId]
        );

        res.json({
            highscores: result.rows.map(row => ({
                score: row.score,
                levelReached: row.level_reached,
                date: row.created_at
            })),
            bestRank: parseInt(rankResult.rows[0].rank)
        });
    } catch (error) {
        console.error('Get user highscores error:', error);
        res.status(500).json({ error: 'Benutzer-Highscores konnten nicht geladen werden' });
    }
}

async function addHighscore(req, res) {
    const { score, levelReached, platform } = req.body;
    const validPlatform = (platform === 'mobile' || platform === 'pc') ? platform : 'pc';

    try {
        // Get username
        const userResult = await pool.query(
            'SELECT username FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        const username = userResult.rows[0].username;

        // Insert highscore with platform
        const result = await pool.query(
            `INSERT INTO highscores (user_id, username, score, level_reached, platform)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [req.user.id, username, score, levelReached || 1, validPlatform]
        );

        // Get new rank for this platform
        const rankResult = await pool.query(
            `SELECT COUNT(*) + 1 as rank
             FROM highscores
             WHERE score > $1 AND platform = $2`,
            [score, validPlatform]
        );

        // Check if this is user's new best on this platform
        const bestResult = await pool.query(
            `SELECT MAX(score) as best FROM highscores WHERE user_id = $1 AND platform = $2 AND id != $3`,
            [req.user.id, validPlatform, result.rows[0].id]
        );

        const previousBest = bestResult.rows[0].best || 0;
        const isNewBest = score > previousBest;

        res.status(201).json({
            message: 'Highscore gespeichert',
            id: result.rows[0].id,
            rank: parseInt(rankResult.rows[0].rank),
            platform: validPlatform,
            isNewBest,
            previousBest
        });
    } catch (error) {
        console.error('Add highscore error:', error);
        res.status(500).json({ error: 'Highscore konnte nicht gespeichert werden' });
    }
}

async function getMyRank(req, res) {
    const platform = req.query.platform; // 'pc', 'mobile', or undefined for all

    try {
        // Get user's best score (optionally filtered by platform) - treat NULL as 'pc'
        let bestQuery = 'SELECT MAX(score) as best_score FROM highscores WHERE user_id = $1';
        if (platform === 'pc') {
            bestQuery = "SELECT MAX(score) as best_score FROM highscores WHERE user_id = $1 AND (platform = 'pc' OR platform IS NULL)";
        } else if (platform === 'mobile') {
            bestQuery = "SELECT MAX(score) as best_score FROM highscores WHERE user_id = $1 AND platform = 'mobile'";
        }
        const bestResult = await pool.query(bestQuery, [req.user.id]);

        const bestScore = bestResult.rows[0].best_score;

        if (!bestScore) {
            return res.json({ rank: null, bestScore: 0, platform: platform || 'all', message: 'Noch keine Punkte' });
        }

        // Get rank based on unique players' best scores (optionally filtered by platform) - treat NULL as 'pc'
        let rankQuery = `SELECT COUNT(*) + 1 as rank FROM (
            SELECT MAX(score) as best FROM highscores GROUP BY username
           ) AS player_bests WHERE best > $1`;
        if (platform === 'pc') {
            rankQuery = `SELECT COUNT(*) + 1 as rank FROM (
                SELECT MAX(score) as best FROM highscores WHERE (platform = 'pc' OR platform IS NULL) GROUP BY username
               ) AS player_bests WHERE best > $1`;
        } else if (platform === 'mobile') {
            rankQuery = `SELECT COUNT(*) + 1 as rank FROM (
                SELECT MAX(score) as best FROM highscores WHERE platform = 'mobile' GROUP BY username
               ) AS player_bests WHERE best > $1`;
        }
        const rankResult = await pool.query(rankQuery, [bestScore]);

        // Get total players with scores (optionally filtered by platform) - treat NULL as 'pc'
        let totalQuery = 'SELECT COUNT(DISTINCT user_id) as total FROM highscores';
        if (platform === 'pc') {
            totalQuery = "SELECT COUNT(DISTINCT user_id) as total FROM highscores WHERE (platform = 'pc' OR platform IS NULL)";
        } else if (platform === 'mobile') {
            totalQuery = "SELECT COUNT(DISTINCT user_id) as total FROM highscores WHERE platform = 'mobile'";
        }
        const totalResult = await pool.query(totalQuery);

        res.json({
            rank: parseInt(rankResult.rows[0].rank),
            bestScore,
            totalPlayers: parseInt(totalResult.rows[0].total),
            platform: platform || 'all'
        });
    } catch (error) {
        console.error('Get my rank error:', error);
        res.status(500).json({ error: 'Rang konnte nicht geladen werden' });
    }
}

module.exports = { getHighscores, getUserHighscores, addHighscore, getMyRank };
