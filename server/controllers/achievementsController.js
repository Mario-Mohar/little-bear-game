const { pool } = require('../config/db');

// Definition aller 24 Achievements
const ACHIEVEMENTS = [
    // Anfänger Achievements
    {
        id: 'first_steps',
        title: 'Erste Schritte',
        description: 'Schließe dein erstes Level ab',
        icon: '🐾',
        category: 'anfaenger',
        type: 'complete_levels',
        target: 1,
        reward: 10,
        secret: false
    },
    {
        id: 'coin_collector',
        title: 'Münzsammler',
        description: 'Sammle insgesamt 100 Münzen',
        icon: '🪙',
        category: 'sammeln',
        type: 'total_coins',
        target: 100,
        reward: 15,
        secret: false
    },
    {
        id: 'coin_hoarder',
        title: 'Münzhorterin',
        description: 'Sammle insgesamt 500 Münzen',
        icon: '💰',
        category: 'sammeln',
        type: 'total_coins',
        target: 500,
        reward: 30,
        secret: false
    },
    {
        id: 'coin_millionaire',
        title: 'Münzmillionär',
        description: 'Sammle insgesamt 2000 Münzen',
        icon: '🏦',
        category: 'sammeln',
        type: 'total_coins',
        target: 2000,
        reward: 75,
        secret: false
    },
    {
        id: 'untouchable',
        title: 'Unberührbar',
        description: 'Schließe ein Level ohne Schaden ab',
        icon: '🛡️',
        category: 'geschick',
        type: 'level_no_damage',
        target: 1,
        reward: 25,
        secret: false
    },
    {
        id: 'ghost',
        title: 'Geist',
        description: 'Schließe 5 Level ohne Schaden ab',
        icon: '👻',
        category: 'geschick',
        type: 'level_no_damage',
        target: 5,
        reward: 50,
        secret: false
    },
    {
        id: 'invincible',
        title: 'Unbesiegbar',
        description: 'Schließe 10 Level ohne Schaden ab',
        icon: '⭐',
        category: 'geschick',
        type: 'level_no_damage',
        target: 10,
        reward: 100,
        secret: false
    },
    {
        id: 'stomper',
        title: 'Hüpfer',
        description: 'Besiege 10 Gegner durch Sprung',
        icon: '🦘',
        category: 'kampf',
        type: 'enemies_stomped',
        target: 10,
        reward: 20,
        secret: false
    },
    {
        id: 'exterminator',
        title: 'Vernichter',
        description: 'Besiege 50 Gegner durch Sprung',
        icon: '💥',
        category: 'kampf',
        type: 'enemies_stomped',
        target: 50,
        reward: 40,
        secret: false
    },
    {
        id: 'legend_slayer',
        title: 'Legendärer Jäger',
        description: 'Besiege 200 Gegner durch Sprung',
        icon: '🏆',
        category: 'kampf',
        type: 'enemies_stomped',
        target: 200,
        reward: 100,
        secret: false
    },
    {
        id: 'speedrunner',
        title: 'Speedrunner',
        description: 'Schließe ein Level in unter 30 Sekunden ab',
        icon: '⚡',
        category: 'geschick',
        type: 'speed_level',
        target: 30,
        reward: 35,
        secret: false
    },
    {
        id: 'lightning',
        title: 'Blitzschnell',
        description: 'Schließe ein Level in unter 20 Sekunden ab',
        icon: '🌩️',
        category: 'geschick',
        type: 'speed_level',
        target: 20,
        reward: 60,
        secret: false
    },
    {
        id: 'world_traveler',
        title: 'Weltreisender',
        description: 'Erreiche Level 5',
        icon: '🌍',
        category: 'fortschritt',
        type: 'reach_level',
        target: 5,
        reward: 25,
        secret: false
    },
    {
        id: 'adventurer',
        title: 'Abenteurer',
        description: 'Erreiche Level 10',
        icon: '🗺️',
        category: 'fortschritt',
        type: 'reach_level',
        target: 10,
        reward: 50,
        secret: false
    },
    {
        id: 'champion',
        title: 'Champion',
        description: 'Schließe alle Level ab und gewinne das Spiel',
        icon: '👑',
        category: 'fortschritt',
        type: 'complete_game',
        target: 1,
        reward: 150,
        secret: false
    },
    {
        id: 'high_scorer',
        title: 'Punktejäger',
        description: 'Erreiche 5.000 Punkte in einem Spiel',
        icon: '📊',
        category: 'punkte',
        type: 'score_single_game',
        target: 5000,
        reward: 30,
        secret: false
    },
    {
        id: 'score_master',
        title: 'Punktemeister',
        description: 'Erreiche 15.000 Punkte in einem Spiel',
        icon: '📈',
        category: 'punkte',
        type: 'score_single_game',
        target: 15000,
        reward: 75,
        secret: false
    },
    {
        id: 'score_legend',
        title: 'Punktelegende',
        description: 'Erreiche 30.000 Punkte in einem Spiel',
        icon: '🌟',
        category: 'punkte',
        type: 'score_single_game',
        target: 30000,
        reward: 150,
        secret: false
    },
    {
        id: 'double_jump_master',
        title: 'Doppelsprung-Meister',
        description: 'Führe 100 Doppelsprünge aus',
        icon: '🔄',
        category: 'geschick',
        type: 'double_jumps',
        target: 100,
        reward: 25,
        secret: false
    },
    {
        id: 'survivor',
        title: 'Überlebender',
        description: 'Beende ein Spiel mit nur noch 1 Leben',
        icon: '💔',
        category: 'geschick',
        type: 'survive_one_life',
        target: 1,
        reward: 40,
        secret: false
    },
    {
        id: 'perfect_collector',
        title: 'Perfekter Sammler',
        description: 'Sammle alle Münzen in einem Level',
        icon: '💯',
        category: 'sammeln',
        type: 'all_coins_level',
        target: 1,
        reward: 30,
        secret: false
    },
    {
        id: 'dedicated_player',
        title: 'Treuer Spieler',
        description: 'Spiele 10 komplette Spiele',
        icon: '🎮',
        category: 'fortschritt',
        type: 'games_played',
        target: 10,
        reward: 35,
        secret: false
    },
    {
        id: 'veteran',
        title: 'Veteran',
        description: 'Spiele 50 komplette Spiele',
        icon: '🎖️',
        category: 'fortschritt',
        type: 'games_played',
        target: 50,
        reward: 100,
        secret: false
    },
    // Geheime Achievements
    {
        id: 'secret_explorer',
        title: 'Geheimforscher',
        description: 'Finde einen versteckten Bereich',
        icon: '🔮',
        category: 'geheim',
        type: 'find_secret',
        target: 1,
        reward: 50,
        secret: true
    }
];

// Kategorien für die Gruppierung
const CATEGORIES = {
    anfaenger: { name: 'Anfänger', icon: '🌱', color: '#2ECC71' },
    sammeln: { name: 'Sammeln', icon: '🪙', color: '#FFD700' },
    geschick: { name: 'Geschick', icon: '🎯', color: '#3498DB' },
    kampf: { name: 'Kampf', icon: '⚔️', color: '#E74C3C' },
    fortschritt: { name: 'Fortschritt', icon: '📈', color: '#9B59B6' },
    punkte: { name: 'Punkte', icon: '🏅', color: '#F39C12' },
    geheim: { name: 'Geheim', icon: '🔒', color: '#7F8C8D' }
};

// Alle Achievements abrufen (für einen Benutzer)
const getAchievements = async (req, res) => {
    try {
        const userId = req.user.id;

        // Hole alle Achievement-Fortschritte des Benutzers
        const result = await pool.query(
            `SELECT achievement_id, progress, unlocked, unlocked_at
             FROM user_achievements
             WHERE user_id = $1`,
            [userId]
        );

        // Map für schnellen Zugriff
        const userProgress = {};
        result.rows.forEach(row => {
            userProgress[row.achievement_id] = {
                progress: row.progress,
                unlocked: row.unlocked,
                unlockedAt: row.unlocked_at
            };
        });

        // Kombiniere mit Achievement-Definitionen
        const achievements = ACHIEVEMENTS.map(achievement => {
            const progress = userProgress[achievement.id] || { progress: 0, unlocked: false, unlockedAt: null };
            return {
                ...achievement,
                progress: progress.progress,
                unlocked: progress.unlocked,
                unlockedAt: progress.unlockedAt,
                // Verstecke Details von geheimen Achievements, die noch nicht freigeschaltet sind
                title: achievement.secret && !progress.unlocked ? '???' : achievement.title,
                description: achievement.secret && !progress.unlocked ? 'Dieses Achievement ist geheim!' : achievement.description
            };
        });

        // Statistiken berechnen
        const totalAchievements = ACHIEVEMENTS.length;
        const unlockedCount = achievements.filter(a => a.unlocked).length;
        const totalRewardsPossible = ACHIEVEMENTS.reduce((sum, a) => sum + a.reward, 0);
        const earnedRewards = achievements.filter(a => a.unlocked).reduce((sum, a) => sum + a.reward, 0);

        res.json({
            achievements,
            categories: CATEGORIES,
            stats: {
                total: totalAchievements,
                unlocked: unlockedCount,
                percentage: Math.round((unlockedCount / totalAchievements) * 100),
                totalRewards: totalRewardsPossible,
                earnedRewards
            }
        });
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Erfolge' });
    }
};

// Achievement-Fortschritt aktualisieren
const updateProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        const { achievementId, progress } = req.body;

        if (!achievementId || progress === undefined) {
            return res.status(400).json({ error: 'Achievement-ID und Fortschritt erforderlich' });
        }

        // Finde das Achievement
        const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
        if (!achievement) {
            return res.status(404).json({ error: 'Achievement nicht gefunden' });
        }

        // Prüfe ob bereits freigeschaltet
        const existing = await pool.query(
            `SELECT unlocked, progress FROM user_achievements WHERE user_id = $1 AND achievement_id = $2`,
            [userId, achievementId]
        );

        if (existing.rows.length > 0 && existing.rows[0].unlocked) {
            return res.json({ achievement, alreadyUnlocked: true });
        }

        // Berechne neuen Fortschritt (akkumulativ für manche, maximum für andere)
        let newProgress = progress;
        if (existing.rows.length > 0) {
            const currentProgress = existing.rows[0].progress;
            // Für kumulative Types addieren wir
            if (['total_coins', 'enemies_stomped', 'double_jumps', 'games_played', 'complete_levels', 'level_no_damage'].includes(achievement.type)) {
                newProgress = currentProgress + progress;
            } else {
                // Für andere nehmen wir das Maximum
                newProgress = Math.max(currentProgress, progress);
            }
        }

        // Prüfe ob Achievement freigeschaltet wird
        const shouldUnlock = newProgress >= achievement.target;

        // Upsert Achievement-Fortschritt
        await pool.query(
            `INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked, unlocked_at)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, achievement_id)
             DO UPDATE SET progress = $3, unlocked = $4, unlocked_at = CASE WHEN $4 AND NOT user_achievements.unlocked THEN $5 ELSE user_achievements.unlocked_at END`,
            [userId, achievementId, newProgress, shouldUnlock, shouldUnlock ? new Date() : null]
        );

        // Wenn freigeschaltet, Belohnung gutschreiben
        if (shouldUnlock && (!existing.rows.length || !existing.rows[0].unlocked)) {
            await pool.query(
                `UPDATE users SET total_coins = total_coins + $1 WHERE id = $2`,
                [achievement.reward, userId]
            );

            return res.json({
                achievement,
                progress: newProgress,
                unlocked: true,
                newlyUnlocked: true,
                reward: achievement.reward
            });
        }

        res.json({
            achievement,
            progress: newProgress,
            unlocked: shouldUnlock,
            newlyUnlocked: false
        });
    } catch (error) {
        console.error('Error updating achievement progress:', error);
        res.status(500).json({ error: 'Fehler beim Aktualisieren des Fortschritts' });
    }
};

// Mehrere Achievements auf einmal aktualisieren (für Spielende)
const updateMultiple = async (req, res) => {
    try {
        const userId = req.user.id;
        const { updates } = req.body;

        if (!updates || !Array.isArray(updates)) {
            return res.status(400).json({ error: 'Updates-Array erforderlich' });
        }

        const results = [];
        const newlyUnlocked = [];

        for (const update of updates) {
            const { achievementId, progress } = update;

            const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
            if (!achievement) continue;

            // Prüfe bestehenden Fortschritt
            const existing = await pool.query(
                `SELECT unlocked, progress FROM user_achievements WHERE user_id = $1 AND achievement_id = $2`,
                [userId, achievementId]
            );

            if (existing.rows.length > 0 && existing.rows[0].unlocked) {
                continue; // Bereits freigeschaltet
            }

            // Berechne neuen Fortschritt
            let newProgress = progress;
            if (existing.rows.length > 0) {
                const currentProgress = existing.rows[0].progress;
                if (['total_coins', 'enemies_stomped', 'double_jumps', 'games_played', 'complete_levels', 'level_no_damage'].includes(achievement.type)) {
                    newProgress = currentProgress + progress;
                } else {
                    newProgress = Math.max(currentProgress, progress);
                }
            }

            const shouldUnlock = newProgress >= achievement.target;

            // Upsert
            await pool.query(
                `INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked, unlocked_at)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (user_id, achievement_id)
                 DO UPDATE SET progress = $3, unlocked = $4, unlocked_at = CASE WHEN $4 AND NOT user_achievements.unlocked THEN $5 ELSE user_achievements.unlocked_at END`,
                [userId, achievementId, newProgress, shouldUnlock, shouldUnlock ? new Date() : null]
            );

            if (shouldUnlock && (!existing.rows.length || !existing.rows[0].unlocked)) {
                await pool.query(
                    `UPDATE users SET total_coins = total_coins + $1 WHERE id = $2`,
                    [achievement.reward, userId]
                );
                newlyUnlocked.push({
                    ...achievement,
                    progress: newProgress
                });
            }

            results.push({
                achievementId,
                progress: newProgress,
                unlocked: shouldUnlock
            });
        }

        res.json({
            results,
            newlyUnlocked,
            totalReward: newlyUnlocked.reduce((sum, a) => sum + a.reward, 0)
        });
    } catch (error) {
        console.error('Error updating multiple achievements:', error);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der Erfolge' });
    }
};

// Achievement-Definitionen abrufen (ohne Auth für Anzeige)
const getDefinitions = async (req, res) => {
    try {
        const achievements = ACHIEVEMENTS.map(a => ({
            ...a,
            // Verstecke geheime Achievement-Details
            title: a.secret ? '???' : a.title,
            description: a.secret ? 'Dieses Achievement ist geheim!' : a.description
        }));

        res.json({
            achievements,
            categories: CATEGORIES,
            total: ACHIEVEMENTS.length
        });
    } catch (error) {
        console.error('Error fetching achievement definitions:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Achievement-Definitionen' });
    }
};

module.exports = {
    getAchievements,
    updateProgress,
    updateMultiple,
    getDefinitions,
    ACHIEVEMENTS,
    CATEGORIES
};
