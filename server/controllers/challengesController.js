const { pool } = require('../config/db');

// ============================================
// DAILY CHALLENGES DEFINITION
// ============================================
// Jede Challenge hat:
// - id: Eindeutige ID
// - title: Anzeigename
// - description: Beschreibung der Aufgabe
// - type: Art der Challenge (für Tracking im Spiel)
// - target: Zielwert der muss erreicht werden
// - reward: Münzen als Belohnung
// - difficulty: 1=leicht, 2=mittel, 3=schwer

const CHALLENGES = [
    {
        id: 1,
        title: "Münzsammler",
        description: "Sammle 30 Münzen in einem einzelnen Spiel",
        type: "collect_coins_single_game",
        target: 30,
        reward: 25,
        difficulty: 1
    },
    {
        id: 2,
        title: "Unverwundbar",
        description: "Schließe ein Level ab, ohne Schaden zu nehmen",
        type: "complete_level_no_damage",
        target: 1,
        reward: 40,
        difficulty: 2
    },
    {
        id: 3,
        title: "Kopfspringer",
        description: "Besiege 5 Gegner durch Sprünge auf ihren Kopf",
        type: "defeat_enemies_jump",
        target: 5,
        reward: 30,
        difficulty: 1
    },
    {
        id: 4,
        title: "Perfektionist",
        description: "Sammle ALLE Münzen in einem Level",
        type: "collect_all_coins_level",
        target: 1,
        reward: 35,
        difficulty: 2
    },
    {
        id: 5,
        title: "Speedrunner",
        description: "Schließe Level 1 in unter 60 Sekunden ab",
        type: "complete_level_time",
        target: 60,
        targetLevel: 1,
        reward: 45,
        difficulty: 2
    },
    {
        id: 6,
        title: "Boss-Bezwinger",
        description: "Besiege einen Boss ohne Schaden zu nehmen",
        type: "defeat_boss_no_damage",
        target: 1,
        reward: 60,
        difficulty: 3
    },
    {
        id: 7,
        title: "Akrobat",
        description: "Führe 15 Doppelsprünge in einem Spiel aus",
        type: "double_jumps",
        target: 15,
        reward: 20,
        difficulty: 1
    },
    {
        id: 8,
        title: "Marathon-Läufer",
        description: "Schließe 3 Level in einem Durchgang ab",
        type: "complete_levels_streak",
        target: 3,
        reward: 50,
        difficulty: 2
    },
    {
        id: 9,
        title: "Großer Sammler",
        description: "Sammle insgesamt 50 Münzen (auch über mehrere Spiele)",
        type: "collect_coins_total",
        target: 50,
        reward: 35,
        difficulty: 1
    },
    {
        id: 10,
        title: "Punktejäger",
        description: "Erreiche 5000 Punkte in einem Spiel",
        type: "reach_score",
        target: 5000,
        reward: 40,
        difficulty: 2
    },
    {
        id: 11,
        title: "Überlebenskünstler",
        description: "Beende ein Spiel mit allen Startleben",
        type: "finish_with_all_lives",
        target: 1,
        reward: 55,
        difficulty: 3
    },
    {
        id: 12,
        title: "Gegner-Jäger",
        description: "Besiege insgesamt 10 Gegner",
        type: "defeat_enemies_total",
        target: 10,
        reward: 30,
        difficulty: 1
    }
];

// Hole die Challenge-Definition anhand der ID
function getChallengeById(id) {
    return CHALLENGES.find(c => c.id === id);
}

// Wähle eine zufällige Challenge (nicht die letzte)
function selectRandomChallenge(lastChallengeId = null) {
    let availableChallenges = CHALLENGES;

    // Filtere die letzte Challenge heraus, um Wiederholungen zu vermeiden
    if (lastChallengeId !== null) {
        availableChallenges = CHALLENGES.filter(c => c.id !== lastChallengeId);
    }

    const randomIndex = Math.floor(Math.random() * availableChallenges.length);
    return availableChallenges[randomIndex];
}

// Hole das heutige Datum als String (YYYY-MM-DD) in der Zeitzone des Servers
function getTodayDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

// ============================================
// API ENDPOINTS
// ============================================

// Hole die aktuelle/heutige Challenge für den Benutzer
async function getTodayChallenge(req, res) {
    try {
        const today = getTodayDate();

        // Prüfe ob bereits eine Challenge für heute existiert
        const existingChallenge = await pool.query(
            `SELECT * FROM daily_challenges WHERE user_id = $1 AND challenge_date = $2`,
            [req.user.id, today]
        );

        if (existingChallenge.rows.length > 0) {
            const userChallenge = existingChallenge.rows[0];
            const challengeDef = getChallengeById(userChallenge.challenge_id);

            return res.json({
                hasChallenge: true,
                challenge: {
                    ...challengeDef,
                    status: userChallenge.status,
                    progress: userChallenge.progress,
                    acceptedAt: userChallenge.accepted_at,
                    completedAt: userChallenge.completed_at,
                    rewardClaimed: userChallenge.reward_claimed
                }
            });
        }

        // Keine Challenge für heute - hole die letzte Challenge um Wiederholung zu vermeiden
        const lastChallenge = await pool.query(
            `SELECT challenge_id FROM daily_challenges
             WHERE user_id = $1
             ORDER BY challenge_date DESC
             LIMIT 1`,
            [req.user.id]
        );

        const lastChallengeId = lastChallenge.rows.length > 0
            ? lastChallenge.rows[0].challenge_id
            : null;

        // Wähle eine neue zufällige Challenge
        const newChallenge = selectRandomChallenge(lastChallengeId);

        // Erstelle den Eintrag (noch nicht angenommen)
        await pool.query(
            `INSERT INTO daily_challenges (user_id, challenge_id, challenge_date, status)
             VALUES ($1, $2, $3, 'pending')`,
            [req.user.id, newChallenge.id, today]
        );

        res.json({
            hasChallenge: true,
            challenge: {
                ...newChallenge,
                status: 'pending',
                progress: 0,
                acceptedAt: null,
                completedAt: null,
                rewardClaimed: false
            }
        });
    } catch (error) {
        console.error('Get today challenge error:', error);
        res.status(500).json({ error: 'Challenge konnte nicht geladen werden' });
    }
}

// Challenge annehmen
async function acceptChallenge(req, res) {
    try {
        const today = getTodayDate();

        const result = await pool.query(
            `UPDATE daily_challenges
             SET status = 'active', accepted_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND challenge_date = $2 AND status = 'pending'
             RETURNING *`,
            [req.user.id, today]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Keine ausstehende Challenge für heute' });
        }

        const userChallenge = result.rows[0];
        const challengeDef = getChallengeById(userChallenge.challenge_id);

        res.json({
            message: 'Challenge angenommen!',
            challenge: {
                ...challengeDef,
                status: 'active',
                progress: 0
            }
        });
    } catch (error) {
        console.error('Accept challenge error:', error);
        res.status(500).json({ error: 'Challenge konnte nicht angenommen werden' });
    }
}

// Challenge ablehnen
async function declineChallenge(req, res) {
    try {
        const today = getTodayDate();

        const result = await pool.query(
            `UPDATE daily_challenges
             SET status = 'declined'
             WHERE user_id = $1 AND challenge_date = $2 AND status = 'pending'
             RETURNING *`,
            [req.user.id, today]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Keine ausstehende Challenge für heute' });
        }

        res.json({
            message: 'Challenge abgelehnt. Morgen gibt es eine neue!',
            nextChallengeAt: getNextMidnight()
        });
    } catch (error) {
        console.error('Decline challenge error:', error);
        res.status(500).json({ error: 'Challenge konnte nicht abgelehnt werden' });
    }
}

// Challenge-Fortschritt aktualisieren
async function updateProgress(req, res) {
    const { progress, completed } = req.body;

    try {
        const today = getTodayDate();

        // Hole die aktive Challenge
        const challengeResult = await pool.query(
            `SELECT * FROM daily_challenges
             WHERE user_id = $1 AND challenge_date = $2 AND status = 'active'`,
            [req.user.id, today]
        );

        if (challengeResult.rows.length === 0) {
            return res.status(400).json({ error: 'Keine aktive Challenge' });
        }

        const userChallenge = challengeResult.rows[0];
        const challengeDef = getChallengeById(userChallenge.challenge_id);

        // Berechne neuen Fortschritt (nur erhöhen, nicht verringern)
        const newProgress = Math.max(userChallenge.progress, progress);

        if (completed || newProgress >= challengeDef.target) {
            // Challenge abgeschlossen!
            await pool.query(
                `UPDATE daily_challenges
                 SET status = 'completed', progress = $1, completed_at = CURRENT_TIMESTAMP
                 WHERE id = $2`,
                [challengeDef.target, userChallenge.id]
            );

            return res.json({
                message: 'Challenge abgeschlossen!',
                completed: true,
                progress: challengeDef.target,
                reward: challengeDef.reward
            });
        } else {
            // Fortschritt aktualisieren
            await pool.query(
                `UPDATE daily_challenges SET progress = $1 WHERE id = $2`,
                [newProgress, userChallenge.id]
            );

            return res.json({
                completed: false,
                progress: newProgress,
                target: challengeDef.target
            });
        }
    } catch (error) {
        console.error('Update progress error:', error);
        res.status(500).json({ error: 'Fortschritt konnte nicht aktualisiert werden' });
    }
}

// Belohnung einfordern
async function claimReward(req, res) {
    try {
        const today = getTodayDate();

        // Hole die abgeschlossene Challenge
        const challengeResult = await pool.query(
            `SELECT * FROM daily_challenges
             WHERE user_id = $1 AND challenge_date = $2 AND status = 'completed' AND reward_claimed = FALSE`,
            [req.user.id, today]
        );

        if (challengeResult.rows.length === 0) {
            return res.status(400).json({ error: 'Keine abgeschlossene Challenge zum Einfordern' });
        }

        const userChallenge = challengeResult.rows[0];
        const challengeDef = getChallengeById(userChallenge.challenge_id);

        // Belohnung gutschreiben und als eingefordert markieren
        await pool.query(
            `UPDATE users SET total_coins = total_coins + $1 WHERE id = $2`,
            [challengeDef.reward, req.user.id]
        );

        await pool.query(
            `UPDATE daily_challenges SET reward_claimed = TRUE WHERE id = $1`,
            [userChallenge.id]
        );

        // Hole aktuellen Münzstand
        const userResult = await pool.query(
            `SELECT total_coins FROM users WHERE id = $1`,
            [req.user.id]
        );

        res.json({
            message: `+${challengeDef.reward} Münzen erhalten!`,
            reward: challengeDef.reward,
            totalCoins: userResult.rows[0].total_coins
        });
    } catch (error) {
        console.error('Claim reward error:', error);
        res.status(500).json({ error: 'Belohnung konnte nicht eingefordert werden' });
    }
}

// Hole die aktive Challenge (für Spielfortschritt-Tracking)
async function getActiveChallenge(req, res) {
    try {
        const today = getTodayDate();

        const result = await pool.query(
            `SELECT * FROM daily_challenges
             WHERE user_id = $1 AND challenge_date = $2 AND status = 'active'`,
            [req.user.id, today]
        );

        if (result.rows.length === 0) {
            return res.json({ hasActiveChallenge: false });
        }

        const userChallenge = result.rows[0];
        const challengeDef = getChallengeById(userChallenge.challenge_id);

        res.json({
            hasActiveChallenge: true,
            challenge: {
                ...challengeDef,
                progress: userChallenge.progress
            }
        });
    } catch (error) {
        console.error('Get active challenge error:', error);
        res.status(500).json({ error: 'Aktive Challenge konnte nicht geladen werden' });
    }
}

// Hilfsfunktion: Nächste Mitternacht berechnen
function getNextMidnight() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
}

// Alle Challenge-Definitionen für Frontend
async function getChallengeDefinitions(req, res) {
    res.json({ challenges: CHALLENGES });
}

module.exports = {
    getTodayChallenge,
    acceptChallenge,
    declineChallenge,
    updateProgress,
    claimReward,
    getActiveChallenge,
    getChallengeDefinitions,
    CHALLENGES
};
