const { pool } = require('../config/db');

// Titel-Definitionen (basierend auf Achievements und anderen Bedingungen)
const TITLES = {
    'newcomer': { name: 'Neuling', description: 'Willkommen bei Little Bear!', requirement: 'Automatisch', color: '#95A5A6' },
    'coin_collector': { name: 'Münzsammler', description: '100 Münzen gesammelt', requirement: 'achievement:coin_collector', color: '#F1C40F' },
    'coin_master': { name: 'Münzmeister', description: '2000 Münzen gesammelt', requirement: 'achievement:coin_millionaire', color: '#FFD700' },
    'untouchable': { name: 'Der Unberührbare', description: 'Level ohne Schaden', requirement: 'achievement:untouchable', color: '#3498DB' },
    'ghost': { name: 'Geist', description: '5 Level ohne Schaden', requirement: 'achievement:ghost', color: '#9B59B6' },
    'speedster': { name: 'Blitzschnell', description: 'Level unter 20 Sekunden', requirement: 'achievement:lightning', color: '#E74C3C' },
    'champion': { name: 'Champion', description: 'Alle Level abgeschlossen', requirement: 'achievement:champion', color: '#E67E22' },
    'legend': { name: 'Legende', description: '30.000 Punkte erreicht', requirement: 'achievement:score_legend', color: '#9B59B6' },
    'veteran': { name: 'Veteran', description: '50 Spiele gespielt', requirement: 'achievement:veteran', color: '#1ABC9C' },
    'hunter': { name: 'Jäger', description: '200 Gegner besiegt', requirement: 'achievement:legend_slayer', color: '#E74C3C' },
    'perfectionist': { name: 'Perfektionist', description: 'Alle Münzen in Level', requirement: 'achievement:perfect_collector', color: '#2ECC71' },
    'survivor': { name: 'Überlebenskünstler', description: 'Mit 1 Leben gewonnen', requirement: 'achievement:survivor', color: '#C0392B' },
    'explorer': { name: 'Entdecker', description: 'Geheimes Achievement', requirement: 'achievement:secret_explorer', color: '#8E44AD' },
    'top10': { name: 'Top 10 Spieler', description: 'In den Top 10', requirement: 'rank:10', color: '#F39C12' },
    'top3': { name: 'Podiumsplatz', description: 'In den Top 3', requirement: 'rank:3', color: '#FFD700' },
    'number_one': { name: '#1 Spieler', description: 'Platz 1 der Rangliste', requirement: 'rank:1', color: '#FF6B6B' }
};

// Banner-Definitionen
const BANNERS = {
    'default': { name: 'Standard', colors: ['#1a1a2e', '#16213e'], requirement: null },
    'forest': { name: 'Waldgrün', colors: ['#1a472a', '#2d5a3d'], requirement: null },
    'sunset': { name: 'Sonnenuntergang', colors: ['#c0392b', '#e74c3c', '#f39c12'], requirement: 'coins:100' },
    'ocean': { name: 'Ozean', colors: ['#0c2461', '#1e3799', '#3498db'], requirement: 'coins:100' },
    'purple': { name: 'Königlich', colors: ['#4a148c', '#7b1fa2', '#9c27b0'], requirement: 'coins:200' },
    'gold': { name: 'Golden', colors: ['#5d4e37', '#8b7355', '#ffd700'], requirement: 'achievement:coin_millionaire' },
    'fire': { name: 'Feuer', colors: ['#b71c1c', '#e53935', '#ff5722'], requirement: 'achievement:legend_slayer' },
    'ice': { name: 'Eis', colors: ['#0d47a1', '#1976d2', '#b3e5fc'], requirement: 'achievement:ghost' },
    'rainbow': { name: 'Regenbogen', colors: ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'], requirement: 'achievement:champion' },
    'champion': { name: 'Champion', colors: ['#ffd700', '#ff8c00', '#ff4500'], requirement: 'rank:1' }
};

// Shop items configuration (must match frontend)
const SHOP_ITEMS = {
    skins: {
        'default': { price: 0, name: 'Klassischer Bär' },
        'polar': { price: 50, name: 'Eisbär' },
        'panda': { price: 75, name: 'Pandabär' },
        'golden': { price: 150, name: 'Goldener Bär' },
        'pink': { price: 100, name: 'Rosa Bär' },
        'blue': { price: 100, name: 'Blauer Bär' }
    },
    upgrades: {
        'extra_life_1': { price: 100, name: '+1 Startleben' },
        'extra_life_2': { price: 250, name: '+2 Startleben', requires: 'extra_life_1' },
        'coin_magnet': { price: 200, name: 'Münzmagnet' },
        'double_coins': { price: 300, name: 'Doppelte Münzen' }
    },
    accessories: {
        // Hüte
        'hat_crown': { price: 200, name: 'Krone', type: 'hat', icon: '👑', description: 'Fühle dich wie ein König!' },
        'hat_wizard': { price: 150, name: 'Zauberhut', type: 'hat', icon: '🎩', description: 'Magische Kräfte!' },
        'hat_party': { price: 75, name: 'Partyhut', type: 'hat', icon: '🎉', description: 'Party-Time!' },
        'hat_cap': { price: 50, name: 'Baseball-Cap', type: 'hat', icon: '🧢', description: 'Cool und lässig' },
        'hat_cowboy': { price: 125, name: 'Cowboyhut', type: 'hat', icon: '🤠', description: 'Yeehaw!' },
        'hat_pirate': { price: 175, name: 'Piratenhut', type: 'hat', icon: '🏴‍☠️', description: 'Arrr, Matrose!' },
        'hat_chef': { price: 100, name: 'Kochmütze', type: 'hat', icon: '👨‍🍳', description: 'Meisterkoch' },
        'hat_viking': { price: 200, name: 'Wikingerhelm', type: 'hat', icon: '⚔️', description: 'Für Valhalla!' },
        // Brillen
        'glasses_cool': { price: 80, name: 'Sonnenbrille', type: 'glasses', icon: '😎', description: 'Super cool!' },
        'glasses_nerd': { price: 60, name: 'Nerd-Brille', type: 'glasses', icon: '🤓', description: 'Intelligent aussehen' },
        'glasses_star': { price: 120, name: 'Star-Brille', type: 'glasses', icon: '⭐', description: 'Superstar!' },
        'glasses_heart': { price: 90, name: 'Herz-Brille', type: 'glasses', icon: '💕', description: 'Voller Liebe' },
        'glasses_3d': { price: 70, name: '3D-Brille', type: 'glasses', icon: '🎬', description: 'Kino-Feeling' },
        'glasses_monocle': { price: 150, name: 'Monokel', type: 'glasses', icon: '🧐', description: 'Sehr distinguiert' },
        // Capes
        'cape_hero': { price: 175, name: 'Helden-Cape', type: 'cape', icon: '🦸', description: 'Superhelden-Power!' },
        'cape_royal': { price: 250, name: 'Königsmantel', type: 'cape', icon: '👑', description: 'Majestätisch!' },
        'cape_wizard': { price: 200, name: 'Zauberumhang', type: 'cape', icon: '✨', description: 'Mystische Kräfte' },
        'cape_rainbow': { price: 150, name: 'Regenbogen-Cape', type: 'cape', icon: '🌈', description: 'Farbenfroh!' },
        'cape_fire': { price: 225, name: 'Feuer-Cape', type: 'cape', icon: '🔥', description: 'Heiß, heiß, heiß!' },
        'cape_ice': { price: 225, name: 'Eis-Cape', type: 'cape', icon: '❄️', description: 'Eiskalt!' },
        'cape_invisible': { price: 300, name: 'Unsichtbarkeits-Umhang', type: 'cape', icon: '👻', description: 'Fast unsichtbar...' },
        // Weitere Accessoires
        'acc_wings': { price: 350, name: 'Engelsflügel', type: 'special', icon: '👼', description: 'Himmlisch!' },
        'acc_halo': { price: 200, name: 'Heiligenschein', type: 'special', icon: '😇', description: 'Heilig!' },
        'acc_devil_horns': { price: 175, name: 'Teufelshörner', type: 'special', icon: '😈', description: 'Ein kleiner Teufel' },
        'acc_bow': { price: 75, name: 'Schleife', type: 'special', icon: '🎀', description: 'Süß und niedlich' },
        'acc_scarf': { price: 100, name: 'Schal', type: 'special', icon: '🧣', description: 'Warm und gemütlich' }
    }
};

async function getProfile(req, res) {
    try {
        const result = await pool.query(
            `SELECT id, username, email, email_verified, total_coins,
                    purchased_skins, purchased_upgrades, selected_skin,
                    purchased_accessories, selected_hat, selected_glasses, selected_cape,
                    created_at
             FROM users WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        const user = result.rows[0];

        // Get user's best score
        const scoreResult = await pool.query(
            'SELECT MAX(score) as best_score FROM highscores WHERE user_id = $1',
            [req.user.id]
        );

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            emailVerified: user.email_verified,
            totalCoins: user.total_coins,
            purchasedSkins: user.purchased_skins || [],
            purchasedUpgrades: user.purchased_upgrades || [],
            purchasedAccessories: user.purchased_accessories || [],
            selectedSkin: user.selected_skin,
            selectedHat: user.selected_hat,
            selectedGlasses: user.selected_glasses,
            selectedCape: user.selected_cape,
            bestScore: scoreResult.rows[0]?.best_score || 0,
            createdAt: user.created_at
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Profil konnte nicht geladen werden' });
    }
}

async function updateProfile(req, res) {
    const { selectedSkin } = req.body;

    try {
        // Verify the skin is owned
        const userResult = await pool.query(
            'SELECT purchased_skins FROM users WHERE id = $1',
            [req.user.id]
        );

        const purchasedSkins = userResult.rows[0]?.purchased_skins || [];

        // Allow 'default' skin or check if skin is purchased
        if (selectedSkin !== 'default' && !purchasedSkins.includes(selectedSkin)) {
            return res.status(400).json({ error: 'Skin nicht gekauft' });
        }

        await pool.query(
            'UPDATE users SET selected_skin = $1 WHERE id = $2',
            [selectedSkin, req.user.id]
        );

        res.json({ message: 'Profil aktualisiert', selectedSkin });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Profil konnte nicht aktualisiert werden' });
    }
}

async function addCoins(req, res) {
    const { coins, level, sessionData } = req.body;

    try {
        // Server-side validation of coins earned
        const maxPossibleCoins = calculateMaxCoins(level);
        const validatedCoins = Math.min(coins, maxPossibleCoins);

        // Get user's upgrades to check for double_coins
        const userResult = await pool.query(
            'SELECT purchased_upgrades, total_coins FROM users WHERE id = $1',
            [req.user.id]
        );

        const upgrades = userResult.rows[0]?.purchased_upgrades || [];
        const hasDoubleCo = upgrades.includes('double_coins');
        const finalCoins = hasDoubleCo ? validatedCoins * 2 : validatedCoins;

        // Update coins
        const result = await pool.query(
            'UPDATE users SET total_coins = total_coins + $1 WHERE id = $2 RETURNING total_coins',
            [finalCoins, req.user.id]
        );

        // Log game session if data provided
        if (sessionData) {
            await pool.query(
                `INSERT INTO game_sessions (user_id, coins_earned, max_level, final_score, duration_seconds)
                 VALUES ($1, $2, $3, $4, $5)`,
                [req.user.id, finalCoins, sessionData.maxLevel || level, sessionData.score || 0, sessionData.duration || 0]
            );
        }

        res.json({
            message: 'Münzen hinzugefügt',
            coinsAdded: finalCoins,
            totalCoins: result.rows[0].total_coins
        });
    } catch (error) {
        console.error('Add coins error:', error);
        res.status(500).json({ error: 'Münzen konnten nicht hinzugefügt werden' });
    }
}

function calculateMaxCoins(level) {
    // Base coins per level + collected coins bonus
    // This should match frontend calculation
    const baseCoins = 10 + (level * 5);
    const maxCollectedBonus = 50; // Max coins collectible per level
    const allCoinsBonus = 10;
    return (baseCoins + maxCollectedBonus + allCoinsBonus) * 2; // *2 for double_coins upgrade margin
}

async function purchase(req, res) {
    const { itemType, itemId } = req.body;

    try {
        if (!['skins', 'upgrades', 'accessories'].includes(itemType)) {
            return res.status(400).json({ error: 'Ungültiger Artikeltyp' });
        }

        const item = SHOP_ITEMS[itemType][itemId];
        if (!item) {
            return res.status(400).json({ error: 'Artikel nicht gefunden' });
        }

        const userResult = await pool.query(
            'SELECT total_coins, purchased_skins, purchased_upgrades, purchased_accessories FROM users WHERE id = $1',
            [req.user.id]
        );

        const user = userResult.rows[0];
        let purchasedList;
        if (itemType === 'skins') purchasedList = user.purchased_skins;
        else if (itemType === 'upgrades') purchasedList = user.purchased_upgrades;
        else purchasedList = user.purchased_accessories;

        // Check if already purchased
        if (purchasedList && purchasedList.includes(itemId)) {
            return res.status(400).json({ error: 'Artikel bereits gekauft' });
        }

        // Check requirements for upgrades
        if (itemType === 'upgrades' && item.requires) {
            if (!user.purchased_upgrades || !user.purchased_upgrades.includes(item.requires)) {
                return res.status(400).json({ error: `Benötigt zuerst ${SHOP_ITEMS.upgrades[item.requires].name}` });
            }
        }

        // Check if user has enough coins
        if (user.total_coins < item.price) {
            return res.status(400).json({ error: 'Nicht genug Münzen' });
        }

        // Perform purchase
        let columnName;
        if (itemType === 'skins') columnName = 'purchased_skins';
        else if (itemType === 'upgrades') columnName = 'purchased_upgrades';
        else columnName = 'purchased_accessories';

        await pool.query(
            `UPDATE users
             SET total_coins = total_coins - $1,
                 ${columnName} = array_append(${columnName}, $2)
             WHERE id = $3`,
            [item.price, itemId, req.user.id]
        );

        // Get updated user data
        const updatedUser = await pool.query(
            'SELECT total_coins, purchased_skins, purchased_upgrades, purchased_accessories FROM users WHERE id = $1',
            [req.user.id]
        );

        res.json({
            message: 'Kauf erfolgreich',
            item: { type: itemType, id: itemId, name: item.name },
            totalCoins: updatedUser.rows[0].total_coins,
            purchasedSkins: updatedUser.rows[0].purchased_skins,
            purchasedUpgrades: updatedUser.rows[0].purchased_upgrades,
            purchasedAccessories: updatedUser.rows[0].purchased_accessories
        });
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ error: 'Kauf fehlgeschlagen' });
    }
}

async function getInventory(req, res) {
    try {
        const result = await pool.query(
            `SELECT total_coins, purchased_skins, purchased_upgrades, purchased_accessories,
                    selected_skin, selected_hat, selected_glasses, selected_cape
             FROM users WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        const user = result.rows[0];

        res.json({
            totalCoins: user.total_coins,
            purchasedSkins: user.purchased_skins || [],
            purchasedUpgrades: user.purchased_upgrades || [],
            purchasedAccessories: user.purchased_accessories || [],
            selectedSkin: user.selected_skin,
            selectedHat: user.selected_hat,
            selectedGlasses: user.selected_glasses,
            selectedCape: user.selected_cape,
            shopItems: SHOP_ITEMS
        });
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({ error: 'Inventar konnte nicht geladen werden' });
    }
}

// Accessoire ausrüsten/ablegen
async function equipAccessory(req, res) {
    const { accessoryId, slot } = req.body; // slot: 'hat', 'glasses', 'cape', or 'special'

    try {
        if (!['hat', 'glasses', 'cape', 'special'].includes(slot)) {
            return res.status(400).json({ error: 'Ungültiger Slot' });
        }

        // Wenn accessoryId null ist, wird das Accessoire abgelegt
        if (accessoryId !== null) {
            // Prüfen ob das Accessoire existiert und dem richtigen Typ entspricht
            const accessory = SHOP_ITEMS.accessories[accessoryId];
            if (!accessory) {
                return res.status(400).json({ error: 'Accessoire nicht gefunden' });
            }

            // Prüfen ob der Typ zum Slot passt
            if (accessory.type !== slot) {
                return res.status(400).json({ error: 'Accessoire passt nicht in diesen Slot' });
            }

            // Prüfen ob gekauft
            const userResult = await pool.query(
                'SELECT purchased_accessories FROM users WHERE id = $1',
                [req.user.id]
            );

            const purchased = userResult.rows[0]?.purchased_accessories || [];
            if (!purchased.includes(accessoryId)) {
                return res.status(400).json({ error: 'Accessoire nicht gekauft' });
            }
        }

        // Slot-Spalte bestimmen (special Accessoires gehen in selected_hat als Fallback)
        let columnName;
        if (slot === 'hat' || slot === 'special') columnName = 'selected_hat';
        else if (slot === 'glasses') columnName = 'selected_glasses';
        else columnName = 'selected_cape';

        await pool.query(
            `UPDATE users SET ${columnName} = $1 WHERE id = $2`,
            [accessoryId, req.user.id]
        );

        res.json({
            message: accessoryId ? 'Accessoire ausgerüstet' : 'Accessoire abgelegt',
            slot,
            accessoryId
        });
    } catch (error) {
        console.error('Equip accessory error:', error);
        res.status(500).json({ error: 'Accessoire konnte nicht ausgerüstet werden' });
    }
}

async function syncProfile(req, res) {
    const { totalCoins, purchasedSkins, purchasedUpgrades, selectedSkin } = req.body;

    try {
        // This endpoint is for transferring guest data to a new account
        // Only allow if user has no coins (fresh account)
        const userResult = await pool.query(
            'SELECT total_coins FROM users WHERE id = $1',
            [req.user.id]
        );

        if (userResult.rows[0].total_coins > 0) {
            return res.status(400).json({ error: 'Konto hat bereits Daten' });
        }

        // Validate skins and upgrades
        const validSkins = purchasedSkins.filter(s => SHOP_ITEMS.skins[s]);
        const validUpgrades = purchasedUpgrades.filter(u => SHOP_ITEMS.upgrades[u]);

        await pool.query(
            `UPDATE users
             SET total_coins = $1,
                 purchased_skins = $2,
                 purchased_upgrades = $3,
                 selected_skin = $4
             WHERE id = $5`,
            [totalCoins || 0, validSkins, validUpgrades, selectedSkin || 'default', req.user.id]
        );

        res.json({ message: 'Profil erfolgreich synchronisiert' });
    } catch (error) {
        console.error('Sync profile error:', error);
        res.status(500).json({ error: 'Profil konnte nicht synchronisiert werden' });
    }
}

// Erweitertes eigenes Profil abrufen (mit Titeln, Bannern, Privatsphäre)
async function getExtendedProfile(req, res) {
    try {
        const result = await pool.query(
            `SELECT id, username, email, email_verified, total_coins,
                    purchased_skins, purchased_upgrades, selected_skin, created_at,
                    bio, profile_banner, selected_title, unlocked_titles,
                    privacy_show_coins, privacy_show_stats, privacy_show_achievements, privacy_allow_requests
             FROM users WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        const user = result.rows[0];

        // Berechne verfügbare Titel basierend auf Achievements und Rang
        const availableTitles = await getAvailableTitles(req.user.id);
        const availableBanners = await getAvailableBanners(req.user.id, user.total_coins);

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            emailVerified: user.email_verified,
            totalCoins: user.total_coins,
            purchasedSkins: user.purchased_skins || [],
            purchasedUpgrades: user.purchased_upgrades || [],
            selectedSkin: user.selected_skin,
            createdAt: user.created_at,
            // Neue Profil-Felder
            bio: user.bio || '',
            profileBanner: user.profile_banner || 'default',
            selectedTitle: user.selected_title,
            unlockedTitles: user.unlocked_titles || [],
            availableTitles,
            availableBanners,
            allTitles: TITLES,
            allBanners: BANNERS,
            privacy: {
                showCoins: user.privacy_show_coins,
                showStats: user.privacy_show_stats,
                showAchievements: user.privacy_show_achievements,
                allowRequests: user.privacy_allow_requests
            }
        });
    } catch (error) {
        console.error('Get extended profile error:', error);
        res.status(500).json({ error: 'Profil konnte nicht geladen werden' });
    }
}

// Erweitertes Profil aktualisieren (Bio, Banner, Titel, Privatsphäre)
async function updateExtendedProfile(req, res) {
    const { bio, profileBanner, selectedTitle, privacy } = req.body;

    try {
        const user = await pool.query(
            'SELECT total_coins, unlocked_titles FROM users WHERE id = $1',
            [req.user.id]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        const userData = user.rows[0];
        const updates = [];
        const values = [];
        let paramIndex = 1;

        // Bio validieren und aktualisieren
        if (bio !== undefined) {
            const sanitizedBio = bio.substring(0, 200).trim();
            updates.push(`bio = $${paramIndex++}`);
            values.push(sanitizedBio);
        }

        // Banner validieren und aktualisieren
        if (profileBanner !== undefined) {
            const availableBanners = await getAvailableBanners(req.user.id, userData.total_coins);
            if (!availableBanners.includes(profileBanner)) {
                return res.status(400).json({ error: 'Banner nicht verfügbar' });
            }
            updates.push(`profile_banner = $${paramIndex++}`);
            values.push(profileBanner);
        }

        // Titel validieren und aktualisieren
        if (selectedTitle !== undefined) {
            if (selectedTitle !== null) {
                const availableTitles = await getAvailableTitles(req.user.id);
                if (!availableTitles.includes(selectedTitle)) {
                    return res.status(400).json({ error: 'Titel nicht freigeschaltet' });
                }
            }
            updates.push(`selected_title = $${paramIndex++}`);
            values.push(selectedTitle);
        }

        // Privatsphäre-Einstellungen aktualisieren
        if (privacy !== undefined) {
            if (privacy.showCoins !== undefined) {
                updates.push(`privacy_show_coins = $${paramIndex++}`);
                values.push(Boolean(privacy.showCoins));
            }
            if (privacy.showStats !== undefined) {
                updates.push(`privacy_show_stats = $${paramIndex++}`);
                values.push(Boolean(privacy.showStats));
            }
            if (privacy.showAchievements !== undefined) {
                updates.push(`privacy_show_achievements = $${paramIndex++}`);
                values.push(Boolean(privacy.showAchievements));
            }
            if (privacy.allowRequests !== undefined) {
                updates.push(`privacy_allow_requests = $${paramIndex++}`);
                values.push(Boolean(privacy.allowRequests));
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Keine Änderungen angegeben' });
        }

        values.push(req.user.id);
        await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            values
        );

        res.json({ message: 'Profil aktualisiert' });
    } catch (error) {
        console.error('Update extended profile error:', error);
        res.status(500).json({ error: 'Profil konnte nicht aktualisiert werden' });
    }
}

// Hilfsfunktion: Verfügbare Titel basierend auf Achievements und Rang ermitteln
async function getAvailableTitles(userId) {
    const availableTitles = ['newcomer']; // Jeder hat den Neuling-Titel

    // Achievements abrufen
    const achievementsResult = await pool.query(
        `SELECT achievement_id FROM user_achievements WHERE user_id = $1 AND unlocked = true`,
        [userId]
    );
    const unlockedAchievements = achievementsResult.rows.map(r => r.achievement_id);

    // Rang ermitteln
    const rankResult = await pool.query(
        `SELECT COUNT(*) + 1 as rank
         FROM (SELECT user_id, MAX(score) as best FROM highscores GROUP BY user_id) sub
         WHERE sub.best > (SELECT COALESCE(MAX(score), 0) FROM highscores WHERE user_id = $1)`,
        [userId]
    );
    const userRank = parseInt(rankResult.rows[0]?.rank) || 9999;

    // Titel basierend auf Anforderungen freischalten
    for (const [titleId, title] of Object.entries(TITLES)) {
        if (titleId === 'newcomer') continue;

        const req = title.requirement;
        if (req.startsWith('achievement:')) {
            const achievementId = req.replace('achievement:', '');
            if (unlockedAchievements.includes(achievementId)) {
                availableTitles.push(titleId);
            }
        } else if (req.startsWith('rank:')) {
            const requiredRank = parseInt(req.replace('rank:', ''));
            if (userRank <= requiredRank) {
                availableTitles.push(titleId);
            }
        }
    }

    return availableTitles;
}

// Hilfsfunktion: Verfügbare Banner basierend auf Achievements, Rang und Coins ermitteln
async function getAvailableBanners(userId, totalCoins) {
    const availableBanners = ['default', 'forest']; // Standard-Banner

    // Achievements abrufen
    const achievementsResult = await pool.query(
        `SELECT achievement_id FROM user_achievements WHERE user_id = $1 AND unlocked = true`,
        [userId]
    );
    const unlockedAchievements = achievementsResult.rows.map(r => r.achievement_id);

    // Rang ermitteln
    const rankResult = await pool.query(
        `SELECT COUNT(*) + 1 as rank
         FROM (SELECT user_id, MAX(score) as best FROM highscores GROUP BY user_id) sub
         WHERE sub.best > (SELECT COALESCE(MAX(score), 0) FROM highscores WHERE user_id = $1)`,
        [userId]
    );
    const userRank = parseInt(rankResult.rows[0]?.rank) || 9999;

    // Banner basierend auf Anforderungen freischalten
    for (const [bannerId, banner] of Object.entries(BANNERS)) {
        if (availableBanners.includes(bannerId)) continue;

        const req = banner.requirement;
        if (!req) {
            availableBanners.push(bannerId);
        } else if (req.startsWith('coins:')) {
            const requiredCoins = parseInt(req.replace('coins:', ''));
            if (totalCoins >= requiredCoins) {
                availableBanners.push(bannerId);
            }
        } else if (req.startsWith('achievement:')) {
            const achievementId = req.replace('achievement:', '');
            if (unlockedAchievements.includes(achievementId)) {
                availableBanners.push(bannerId);
            }
        } else if (req.startsWith('rank:')) {
            const requiredRank = parseInt(req.replace('rank:', ''));
            if (userRank <= requiredRank) {
                availableBanners.push(bannerId);
            }
        }
    }

    return availableBanners;
}

// Aktivitäts-Feed abrufen (letzte Spiele, Achievements, etc.)
async function getActivityFeed(req, res) {
    const { userId } = req.params;

    try {
        // Prüfen ob Benutzer existiert
        const userResult = await pool.query('SELECT id, username FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        const activities = [];

        // Letzte Highscores
        const highscores = await pool.query(
            `SELECT score, level_reached, platform, created_at
             FROM highscores WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 10`,
            [userId]
        );
        highscores.rows.forEach(row => {
            activities.push({
                type: 'highscore',
                score: row.score,
                level: row.level_reached,
                platform: row.platform,
                timestamp: row.created_at
            });
        });

        // Letzte freigeschaltete Achievements
        const achievements = await pool.query(
            `SELECT achievement_id, unlocked_at
             FROM user_achievements WHERE user_id = $1 AND unlocked = true
             ORDER BY unlocked_at DESC LIMIT 10`,
            [userId]
        );
        achievements.rows.forEach(row => {
            activities.push({
                type: 'achievement',
                achievementId: row.achievement_id,
                timestamp: row.unlocked_at
            });
        });

        // Letzte Spielsitzungen
        const sessions = await pool.query(
            `SELECT coins_earned, max_level, final_score, duration_seconds, created_at
             FROM game_sessions WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 10`,
            [userId]
        );
        sessions.rows.forEach(row => {
            activities.push({
                type: 'session',
                coins: row.coins_earned,
                level: row.max_level,
                score: row.final_score,
                duration: row.duration_seconds,
                timestamp: row.created_at
            });
        });

        // Nach Zeitstempel sortieren
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            userId: parseInt(userId),
            username: userResult.rows[0].username,
            activities: activities.slice(0, 20) // Max 20 Einträge
        });
    } catch (error) {
        console.error('Get activity feed error:', error);
        res.status(500).json({ error: 'Aktivitäts-Feed konnte nicht geladen werden' });
    }
}

// Spieler-Vergleich
async function compareProfiles(req, res) {
    const { userId1, userId2 } = req.params;

    try {
        // Beide Benutzer laden
        const users = await pool.query(
            `SELECT id, username, total_coins, selected_skin, created_at
             FROM users WHERE id = ANY($1)`,
            [[userId1, userId2]]
        );

        if (users.rows.length !== 2) {
            return res.status(404).json({ error: 'Einer oder beide Benutzer nicht gefunden' });
        }

        const comparison = {};

        for (const user of users.rows) {
            // Highscore-Daten
            const highscoreResult = await pool.query(
                `SELECT MAX(score) as best_score, MAX(level_reached) as max_level, COUNT(*) as total_games
                 FROM highscores WHERE user_id = $1`,
                [user.id]
            );

            // Achievements
            const achievementsResult = await pool.query(
                `SELECT COUNT(*) as unlocked
                 FROM user_achievements WHERE user_id = $1 AND unlocked = true`,
                [user.id]
            );

            // Spielsitzungen
            const sessionsResult = await pool.query(
                `SELECT COUNT(*) as games, COALESCE(SUM(coins_earned), 0) as coins_earned,
                        COALESCE(SUM(duration_seconds), 0) as play_time
                 FROM game_sessions WHERE user_id = $1`,
                [user.id]
            );

            // Rang
            const rankResult = await pool.query(
                `SELECT COUNT(*) + 1 as rank
                 FROM (SELECT user_id, MAX(score) as best FROM highscores GROUP BY user_id) sub
                 WHERE sub.best > (SELECT COALESCE(MAX(score), 0) FROM highscores WHERE user_id = $1)`,
                [user.id]
            );

            const stats = highscoreResult.rows[0];
            const sessions = sessionsResult.rows[0];

            comparison[user.id] = {
                username: user.username,
                skin: user.selected_skin,
                memberSince: user.created_at,
                stats: {
                    bestScore: stats.best_score || 0,
                    maxLevel: stats.max_level || 1,
                    totalGames: parseInt(stats.total_games) || 0,
                    rank: parseInt(rankResult.rows[0]?.rank) || 0,
                    totalCoins: user.total_coins,
                    achievementsUnlocked: parseInt(achievementsResult.rows[0]?.unlocked) || 0,
                    gamesPlayed: parseInt(sessions.games) || 0,
                    coinsEarned: parseInt(sessions.coins_earned) || 0,
                    playTimeMinutes: Math.floor(parseInt(sessions.play_time) / 60) || 0
                }
            };
        }

        res.json({
            player1: comparison[userId1],
            player2: comparison[userId2]
        });
    } catch (error) {
        console.error('Compare profiles error:', error);
        res.status(500).json({ error: 'Vergleich konnte nicht geladen werden' });
    }
}

// Öffentliches Profil eines Benutzers abrufen (für andere Spieler sichtbar)
async function getPublicProfile(req, res) {
    const { userId } = req.params;

    try {
        // Benutzer-Grunddaten inkl. Privatsphäre-Einstellungen
        const userResult = await pool.query(
            `SELECT id, username, selected_skin, created_at, total_coins,
                    bio, profile_banner, selected_title,
                    privacy_show_coins, privacy_show_stats, privacy_show_achievements, privacy_allow_requests
             FROM users WHERE id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Benutzer nicht gefunden' });
        }

        const user = userResult.rows[0];

        // Bester Highscore (PC und Mobile)
        const highscoreResult = await pool.query(
            `SELECT MAX(score) as best_score,
                    MAX(level_reached) as max_level,
                    COUNT(*) as total_games
             FROM highscores WHERE user_id = $1`,
            [userId]
        );

        // Beste Scores getrennt nach Plattform
        const platformScores = await pool.query(
            `SELECT platform, MAX(score) as best_score
             FROM highscores WHERE user_id = $1
             GROUP BY platform`,
            [userId]
        );

        // Achievements zählen
        const achievementsResult = await pool.query(
            `SELECT COUNT(*) as unlocked_count
             FROM user_achievements
             WHERE user_id = $1 AND unlocked = true`,
            [userId]
        );

        // Letzte 5 freigeschaltete Achievements
        const recentAchievements = await pool.query(
            `SELECT achievement_id, unlocked_at
             FROM user_achievements
             WHERE user_id = $1 AND unlocked = true
             ORDER BY unlocked_at DESC
             LIMIT 5`,
            [userId]
        );

        // Game Sessions Statistiken
        const sessionStats = await pool.query(
            `SELECT
                COUNT(*) as games_played,
                COALESCE(SUM(coins_earned), 0) as total_coins_earned,
                COALESCE(MAX(final_score), 0) as highest_session_score,
                COALESCE(MAX(max_level), 1) as highest_level_reached,
                COALESCE(SUM(duration_seconds), 0) as total_play_time
             FROM game_sessions WHERE user_id = $1`,
            [userId]
        );

        // Freundschaftsstatus prüfen (wenn eingeloggt)
        let friendshipStatus = null;
        if (req.user && req.user.id !== parseInt(userId)) {
            const friendshipResult = await pool.query(
                `SELECT status FROM friends
                 WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
                [req.user.id, userId]
            );
            if (friendshipResult.rows.length > 0) {
                friendshipStatus = friendshipResult.rows[0].status;
            }
        }

        // Rang in der Highscore-Liste
        const rankResult = await pool.query(
            `SELECT COUNT(*) + 1 as rank
             FROM (SELECT user_id, MAX(score) as best FROM highscores GROUP BY user_id) sub
             WHERE sub.best > (SELECT COALESCE(MAX(score), 0) FROM highscores WHERE user_id = $1)`,
            [userId]
        );

        // Plattform-Scores formatieren
        const platformScoresObj = {};
        platformScores.rows.forEach(row => {
            platformScoresObj[row.platform || 'pc'] = row.best_score;
        });

        const stats = highscoreResult.rows[0];
        const sessions = sessionStats.rows[0];
        const isOwnProfile = req.user && req.user.id === parseInt(userId);

        // Privatsphäre-Einstellungen berücksichtigen
        const showCoins = isOwnProfile || user.privacy_show_coins;
        const showStats = isOwnProfile || user.privacy_show_stats;
        const showAchievements = isOwnProfile || user.privacy_show_achievements;

        // Titel-Info holen
        const titleInfo = user.selected_title ? TITLES[user.selected_title] : null;

        res.json({
            user: {
                id: user.id,
                username: user.username,
                skin: user.selected_skin,
                memberSince: user.created_at,
                coins: showCoins ? user.total_coins : null,
                bio: user.bio || '',
                banner: user.profile_banner || 'default',
                bannerColors: BANNERS[user.profile_banner || 'default']?.colors || BANNERS.default.colors,
                title: user.selected_title,
                titleInfo: titleInfo
            },
            stats: showStats ? {
                bestScore: stats.best_score || 0,
                maxLevel: stats.max_level || 1,
                totalGames: parseInt(stats.total_games) || 0,
                rank: parseInt(rankResult.rows[0]?.rank) || 0,
                platformScores: platformScoresObj
            } : null,
            achievements: showAchievements ? {
                unlocked: parseInt(achievementsResult.rows[0]?.unlocked_count) || 0,
                total: 24, // Gesamtanzahl der Achievements
                recent: recentAchievements.rows
            } : null,
            sessions: showStats ? {
                gamesPlayed: parseInt(sessions.games_played) || 0,
                totalCoinsEarned: parseInt(sessions.total_coins_earned) || 0,
                highestScore: parseInt(sessions.highest_session_score) || 0,
                highestLevel: parseInt(sessions.highest_level_reached) || 1,
                totalPlayTimeMinutes: Math.floor(parseInt(sessions.total_play_time) / 60) || 0
            } : null,
            friendshipStatus,
            allowFriendRequests: user.privacy_allow_requests,
            isOwnProfile,
            privacy: {
                showCoins: user.privacy_show_coins,
                showStats: user.privacy_show_stats,
                showAchievements: user.privacy_show_achievements
            }
        });
    } catch (error) {
        console.error('Get public profile error:', error);
        res.status(500).json({ error: 'Profil konnte nicht geladen werden' });
    }
}

module.exports = {
    getProfile,
    updateProfile,
    addCoins,
    purchase,
    getInventory,
    syncProfile,
    getPublicProfile,
    getExtendedProfile,
    updateExtendedProfile,
    getActivityFeed,
    compareProfiles,
    equipAccessory,
    TITLES,
    BANNERS,
    SHOP_ITEMS
};
