const { pool } = require('../config/db');

// Shop items configuration (must match frontend)
const SHOP_ITEMS = {
    skins: {
        'brown': { price: 50, name: 'Brauner Bär' },
        'polar': { price: 75, name: 'Eisbär' },
        'panda': { price: 100, name: 'Panda' },
        'red': { price: 100, name: 'Roter Panda' },
        'koala': { price: 125, name: 'Koala' },
        'golden': { price: 150, name: 'Goldener Bär' }
    },
    upgrades: {
        'extra_life_1': { price: 100, name: 'Extra Leben I' },
        'extra_life_2': { price: 250, name: 'Extra Leben II', requires: 'extra_life_1' },
        'coin_magnet': { price: 200, name: 'Münzmagnet' },
        'double_coins': { price: 300, name: 'Doppelte Münzen' }
    }
};

async function getProfile(req, res) {
    try {
        const result = await pool.query(
            `SELECT id, username, email, email_verified, total_coins,
                    purchased_skins, purchased_upgrades, selected_skin, created_at
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
            selectedSkin: user.selected_skin,
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
        if (!['skins', 'upgrades'].includes(itemType)) {
            return res.status(400).json({ error: 'Ungültiger Artikeltyp' });
        }

        const item = SHOP_ITEMS[itemType][itemId];
        if (!item) {
            return res.status(400).json({ error: 'Artikel nicht gefunden' });
        }

        const userResult = await pool.query(
            'SELECT total_coins, purchased_skins, purchased_upgrades FROM users WHERE id = $1',
            [req.user.id]
        );

        const user = userResult.rows[0];
        const purchasedList = itemType === 'skins' ? user.purchased_skins : user.purchased_upgrades;

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
        const columnName = itemType === 'skins' ? 'purchased_skins' : 'purchased_upgrades';
        await pool.query(
            `UPDATE users
             SET total_coins = total_coins - $1,
                 ${columnName} = array_append(${columnName}, $2)
             WHERE id = $3`,
            [item.price, itemId, req.user.id]
        );

        // Get updated user data
        const updatedUser = await pool.query(
            'SELECT total_coins, purchased_skins, purchased_upgrades FROM users WHERE id = $1',
            [req.user.id]
        );

        res.json({
            message: 'Kauf erfolgreich',
            item: { type: itemType, id: itemId, name: item.name },
            totalCoins: updatedUser.rows[0].total_coins,
            purchasedSkins: updatedUser.rows[0].purchased_skins,
            purchasedUpgrades: updatedUser.rows[0].purchased_upgrades
        });
    } catch (error) {
        console.error('Purchase error:', error);
        res.status(500).json({ error: 'Kauf fehlgeschlagen' });
    }
}

async function getInventory(req, res) {
    try {
        const result = await pool.query(
            'SELECT total_coins, purchased_skins, purchased_upgrades, selected_skin FROM users WHERE id = $1',
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
            selectedSkin: user.selected_skin,
            shopItems: SHOP_ITEMS
        });
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({ error: 'Inventar konnte nicht geladen werden' });
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

module.exports = { getProfile, updateProfile, addCoins, purchase, getInventory, syncProfile };
