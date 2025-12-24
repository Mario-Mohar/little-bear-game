const { pool } = require('../config/db');

async function getHighscores(req, res) {
    const limit = Math.min(parseInt(req.query.limit) || 100, 100);
    const offset = parseInt(req.query.offset) || 0;

    try {
        // Only show the highest score per player
        const result = await pool.query(
            `WITH best_scores AS (
                SELECT h.id, h.username, h.score, h.level_reached, h.created_at, h.user_id,
                       ROW_NUMBER() OVER (PARTITION BY h.username ORDER BY h.score DESC) as rn
                FROM highscores h
            )
            SELECT b.id, b.username, b.score, b.level_reached, b.created_at, u.selected_skin
            FROM best_scores b
            LEFT JOIN users u ON b.user_id = u.id
            WHERE b.rn = 1
            ORDER BY b.score DESC
            LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        // Get total count of unique players
        const countResult = await pool.query('SELECT COUNT(DISTINCT username) FROM highscores');
        const totalCount = parseInt(countResult.rows[0].count);

        res.json({
            highscores: result.rows.map((row, index) => ({
                rank: offset + index + 1,
                username: row.username,
                score: row.score,
                levelReached: row.level_reached,
                skin: row.selected_skin || 'default',
                date: row.created_at
            })),
            total: totalCount,
            limit,
            offset
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
    const { score, levelReached } = req.body;

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

        // Insert highscore
        const result = await pool.query(
            `INSERT INTO highscores (user_id, username, score, level_reached)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [req.user.id, username, score, levelReached || 1]
        );

        // Get new rank
        const rankResult = await pool.query(
            `SELECT COUNT(*) + 1 as rank
             FROM highscores
             WHERE score > $1`,
            [score]
        );

        // Check if this is user's new best
        const bestResult = await pool.query(
            `SELECT MAX(score) as best FROM highscores WHERE user_id = $1 AND id != $2`,
            [req.user.id, result.rows[0].id]
        );

        const previousBest = bestResult.rows[0].best || 0;
        const isNewBest = score > previousBest;

        res.status(201).json({
            message: 'Highscore gespeichert',
            id: result.rows[0].id,
            rank: parseInt(rankResult.rows[0].rank),
            isNewBest,
            previousBest
        });
    } catch (error) {
        console.error('Add highscore error:', error);
        res.status(500).json({ error: 'Highscore konnte nicht gespeichert werden' });
    }
}

async function getMyRank(req, res) {
    try {
        // Get user's best score
        const bestResult = await pool.query(
            'SELECT MAX(score) as best_score FROM highscores WHERE user_id = $1',
            [req.user.id]
        );

        const bestScore = bestResult.rows[0].best_score;

        if (!bestScore) {
            return res.json({ rank: null, bestScore: 0, message: 'Noch keine Punkte' });
        }

        // Get rank based on unique players' best scores
        const rankResult = await pool.query(
            `SELECT COUNT(*) + 1 as rank FROM (
                SELECT MAX(score) as best FROM highscores GROUP BY username
            ) AS player_bests WHERE best > $1`,
            [bestScore]
        );

        // Get total players with scores
        const totalResult = await pool.query(
            'SELECT COUNT(DISTINCT user_id) as total FROM highscores'
        );

        res.json({
            rank: parseInt(rankResult.rows[0].rank),
            bestScore,
            totalPlayers: parseInt(totalResult.rows[0].total)
        });
    } catch (error) {
        console.error('Get my rank error:', error);
        res.status(500).json({ error: 'Rang konnte nicht geladen werden' });
    }
}

module.exports = { getHighscores, getUserHighscores, addHighscore, getMyRank };
