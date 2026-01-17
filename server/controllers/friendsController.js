const { pool } = require('../config/db');

// Freund per Username oder E-Mail suchen
async function searchUser(req, res) {
    const { query } = req.query;

    if (!query || query.length < 2) {
        return res.status(400).json({ error: 'Suchbegriff muss mindestens 2 Zeichen lang sein' });
    }

    try {
        const result = await pool.query(
            `SELECT id, username FROM users
             WHERE (LOWER(username) LIKE $1 OR LOWER(email) = $2)
             AND id != $3
             LIMIT 10`,
            [`%${query.toLowerCase()}%`, query.toLowerCase(), req.user.id]
        );

        res.json({ users: result.rows });
    } catch (error) {
        console.error('Search user error:', error);
        res.status(500).json({ error: 'Suche fehlgeschlagen' });
    }
}

// Freundschaftsanfrage senden
async function sendRequest(req, res) {
    const { friendId } = req.body;

    if (!friendId) {
        return res.status(400).json({ error: 'Freund-ID erforderlich' });
    }

    if (friendId === req.user.id) {
        return res.status(400).json({ error: 'Du kannst dir selbst keine Anfrage senden' });
    }

    try {
        // Prüfe ob Freund existiert
        const friendExists = await pool.query('SELECT id FROM users WHERE id = $1', [friendId]);
        if (friendExists.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        // Prüfe ob bereits eine Beziehung besteht (in beide Richtungen)
        const existingRelation = await pool.query(
            `SELECT id, status FROM friends
             WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
            [req.user.id, friendId]
        );

        if (existingRelation.rows.length > 0) {
            const relation = existingRelation.rows[0];
            if (relation.status === 'accepted') {
                return res.status(400).json({ error: 'Ihr seid bereits Freunde' });
            } else if (relation.status === 'pending') {
                return res.status(400).json({ error: 'Freundschaftsanfrage bereits gesendet' });
            }
        }

        // Anfrage erstellen
        await pool.query(
            `INSERT INTO friends (user_id, friend_id, status) VALUES ($1, $2, 'pending')`,
            [req.user.id, friendId]
        );

        res.status(201).json({ message: 'Freundschaftsanfrage gesendet' });
    } catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ error: 'Anfrage konnte nicht gesendet werden' });
    }
}

// Freundschaftsanfrage annehmen
async function acceptRequest(req, res) {
    const { requestId } = req.params;

    try {
        // Prüfe ob Anfrage existiert und an diesen User gerichtet ist
        const request = await pool.query(
            `SELECT id, user_id FROM friends WHERE id = $1 AND friend_id = $2 AND status = 'pending'`,
            [requestId, req.user.id]
        );

        if (request.rows.length === 0) {
            return res.status(404).json({ error: 'Anfrage nicht gefunden' });
        }

        // Anfrage akzeptieren
        await pool.query(
            `UPDATE friends SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [requestId]
        );

        res.json({ message: 'Freundschaftsanfrage angenommen' });
    } catch (error) {
        console.error('Accept friend request error:', error);
        res.status(500).json({ error: 'Anfrage konnte nicht angenommen werden' });
    }
}

// Freundschaftsanfrage ablehnen
async function declineRequest(req, res) {
    const { requestId } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM friends WHERE id = $1 AND friend_id = $2 AND status = 'pending' RETURNING id`,
            [requestId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Anfrage nicht gefunden' });
        }

        res.json({ message: 'Freundschaftsanfrage abgelehnt' });
    } catch (error) {
        console.error('Decline friend request error:', error);
        res.status(500).json({ error: 'Anfrage konnte nicht abgelehnt werden' });
    }
}

// Freundesliste abrufen
async function getFriends(req, res) {
    try {
        // Hole alle akzeptierten Freundschaften (in beide Richtungen)
        const result = await pool.query(
            `SELECT
                f.id as friendship_id,
                f.created_at,
                f.accepted_at,
                CASE
                    WHEN f.user_id = $1 THEN f.friend_id
                    ELSE f.user_id
                END as friend_user_id,
                u.username,
                u.last_login,
                (SELECT MAX(score) FROM highscores WHERE user_id = u.id) as best_score
             FROM friends f
             JOIN users u ON u.id = CASE
                WHEN f.user_id = $1 THEN f.friend_id
                ELSE f.user_id
             END
             WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
             ORDER BY u.username ASC`,
            [req.user.id]
        );

        res.json({ friends: result.rows });
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Freundesliste konnte nicht geladen werden' });
    }
}

// Offene Anfragen abrufen (an mich gerichtet)
async function getPendingRequests(req, res) {
    try {
        const result = await pool.query(
            `SELECT
                f.id as request_id,
                f.created_at,
                u.id as user_id,
                u.username
             FROM friends f
             JOIN users u ON u.id = f.user_id
             WHERE f.friend_id = $1 AND f.status = 'pending'
             ORDER BY f.created_at DESC`,
            [req.user.id]
        );

        res.json({ requests: result.rows });
    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ error: 'Anfragen konnten nicht geladen werden' });
    }
}

// Gesendete Anfragen abrufen (von mir gesendet)
async function getSentRequests(req, res) {
    try {
        const result = await pool.query(
            `SELECT
                f.id as request_id,
                f.created_at,
                u.id as user_id,
                u.username
             FROM friends f
             JOIN users u ON u.id = f.friend_id
             WHERE f.user_id = $1 AND f.status = 'pending'
             ORDER BY f.created_at DESC`,
            [req.user.id]
        );

        res.json({ requests: result.rows });
    } catch (error) {
        console.error('Get sent requests error:', error);
        res.status(500).json({ error: 'Anfragen konnten nicht geladen werden' });
    }
}

// Freund entfernen
async function removeFriend(req, res) {
    const { friendshipId } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM friends
             WHERE id = $1 AND (user_id = $2 OR friend_id = $2) AND status = 'accepted'
             RETURNING id`,
            [friendshipId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Freundschaft nicht gefunden' });
        }

        res.json({ message: 'Freund entfernt' });
    } catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ error: 'Freund konnte nicht entfernt werden' });
    }
}

// Gesendete Anfrage zurückziehen
async function cancelRequest(req, res) {
    const { requestId } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM friends WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
            [requestId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Anfrage nicht gefunden' });
        }

        res.json({ message: 'Anfrage zurückgezogen' });
    } catch (error) {
        console.error('Cancel request error:', error);
        res.status(500).json({ error: 'Anfrage konnte nicht zurückgezogen werden' });
    }
}

module.exports = {
    searchUser,
    sendRequest,
    acceptRequest,
    declineRequest,
    getFriends,
    getPendingRequests,
    getSentRequests,
    removeFriend,
    cancelRequest
};
