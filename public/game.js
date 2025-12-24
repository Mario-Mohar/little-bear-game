// ============================================
// API CLIENT - Server Communication
// ============================================

const API = {
    baseUrl: window.location.origin + '/api',
    token: localStorage.getItem('littleBearToken'),
    user: null,
    isGuest: true,
    isOnline: false,

    // Guest coin multiplier (guests get 25% of normal coins)
    GUEST_COIN_MULTIPLIER: 0.25,

    async init() {
        try {
            const response = await fetch(this.baseUrl + '/health');
            this.isOnline = response.ok;
            this.updateOnlineStatus();
        } catch (e) {
            this.isOnline = false;
            this.updateOnlineStatus();
        }

        if (this.token) {
            try {
                const response = await this.request('/users/profile');
                if (response.ok) {
                    this.user = await response.json();
                    this.isGuest = false;
                    return true;
                }
            } catch (e) {
                this.token = null;
                localStorage.removeItem('littleBearToken');
            }
        }
        return false;
    },

    updateOnlineStatus() {
        const statusEl = document.getElementById('online-status');
        if (statusEl) {
            statusEl.textContent = this.isOnline ? 'Verbunden' : 'Nicht verbunden';
            statusEl.className = this.isOnline ? 'online' : 'offline';
        }
    },

    async request(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
        return fetch(this.baseUrl + endpoint, { ...options, headers: { ...headers, ...options.headers } });
    },

    async register(username, email, password) {
        const response = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        const data = await response.json();
        if (response.ok) {
            this.token = data.token;
            this.user = data.user;
            this.isGuest = false;
            localStorage.setItem('littleBearToken', data.token);
        }
        return { ok: response.ok, data };
    },

    async login(email, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
            this.token = data.token;
            this.user = data.user;
            this.isGuest = false;
            localStorage.setItem('littleBearToken', data.token);
        }
        return { ok: response.ok, data };
    },

    logout() {
        this.token = null;
        this.user = null;
        this.isGuest = true;
        localStorage.removeItem('littleBearToken');
    },

    async addCoins(coins, level, sessionData) {
        if (this.isGuest || !this.token) return null;
        try {
            const response = await this.request('/users/coins', {
                method: 'POST',
                body: JSON.stringify({ coins, level, sessionData })
            });
            if (response.ok) {
                const data = await response.json();
                if (this.user) this.user.totalCoins = data.totalCoins;
                return data;
            }
        } catch (e) { console.error('Failed to sync coins:', e); }
        return null;
    },

    async saveHighscore(score, levelReached) {
        if (this.isGuest || !this.token) return null;
        try {
            const response = await this.request('/highscores', {
                method: 'POST',
                body: JSON.stringify({ score, levelReached })
            });
            if (response.ok) return await response.json();
        } catch (e) { console.error('Failed to save highscore:', e); }
        return null;
    },

    async getHighscores(limit = 10) {
        try {
            const response = await this.request('/highscores?limit=' + limit);
            if (response.ok) return await response.json();
        } catch (e) { console.error('Failed to get highscores:', e); }
        return null;
    },

    async getMyRank() {
        if (this.isGuest || !this.token) return null;
        try {
            const response = await this.request('/highscores/me');
            if (response.ok) return await response.json();
        } catch (e) { console.error('Failed to get rank:', e); }
        return null;
    },

    async purchase(itemType, itemId) {
        if (this.isGuest || !this.token) return null;
        try {
            const response = await this.request('/users/purchase', {
                method: 'POST',
                body: JSON.stringify({ itemType, itemId })
            });
            const data = await response.json();
            if (response.ok && this.user) {
                this.user.totalCoins = data.totalCoins;
                this.user.purchasedSkins = data.purchasedSkins;
                this.user.purchasedUpgrades = data.purchasedUpgrades;
            }
            return { ok: response.ok, data };
        } catch (e) { console.error('Failed to purchase:', e); }
        return null;
    },

    async syncGuestData(guestProfile) {
        if (this.isGuest || !this.token) return null;
        try {
            const response = await this.request('/users/sync', {
                method: 'POST',
                body: JSON.stringify({
                    totalCoins: guestProfile.totalCoins,
                    purchasedSkins: guestProfile.ownedSkins,
                    purchasedUpgrades: guestProfile.ownedUpgrades,
                    selectedSkin: guestProfile.selectedSkin
                })
            });
            return response.ok;
        } catch (e) { console.error('Failed to sync guest data:', e); }
        return false;
    }
};

// ============================================
// AUTH UI FUNCTIONS
// ============================================

function showAuthScreen() {
    document.getElementById('start-screen')?.classList.add('hidden');
    document.getElementById('auth-screen')?.classList.remove('hidden');
}

function showStartScreen() {
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.getElementById('start-screen')?.classList.remove('hidden');
    updateUserInfoDisplay();
    updateCoinsDisplay();
    loadGlobalHighscores();
}

function showRegistrationSuccess(message) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content" style="text-align: center; padding: 30px;">
            <h2 style="color: #4CAF50; margin-bottom: 20px;">✓ Erfolgreich!</h2>
            <p style="margin-bottom: 20px;">${message}</p>
            <button id="success-continue-btn" class="shop-button" style="padding: 12px 30px;">Weiter zum Spiel</button>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('success-continue-btn').addEventListener('click', () => {
        overlay.remove();
        showStartScreen();
    });
}

function updateUserInfoDisplay() {
    const userInfo = document.getElementById('user-info');
    const loggedInUser = document.getElementById('logged-in-user');
    const guestNameInput = document.getElementById('guest-name-input');

    if (API.isGuest) {
        if (userInfo) userInfo.style.display = 'none';
        if (guestNameInput) guestNameInput.style.display = 'block';
    } else {
        if (userInfo) userInfo.style.display = 'flex';
        if (loggedInUser) loggedInUser.textContent = API.user?.username || 'User';
        if (guestNameInput) guestNameInput.style.display = 'none';
    }
}

async function loadGlobalHighscores() {
    const data = await API.getHighscores(10);
    if (data && data.highscores) {
        displayHighscores(data.highscores, 'highscore-entries');
        displayHighscores(data.highscores, 'win-highscore-entries');
        displayHighscores(data.highscores, 'gameover-highscore-entries');
    }

    // Show user's rank
    if (!API.isGuest) {
        const rankData = await API.getMyRank();
        if (rankData && rankData.rank) {
            const rankHtml = `Dein Rang: #${rankData.rank} (${rankData.bestScore} Punkte)`;
            ['my-rank', 'win-rank', 'gameover-rank'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = rankHtml;
            });
        }
    }
}

function displayHighscores(highscores, elementId) {
    const container = document.getElementById(elementId);
    if (!container) return;

    container.innerHTML = highscores.map((hs, i) => `
        <li>
            <span class="rank">#${i + 1}</span>
            <span class="player-name">${hs.username || hs.name}</span>
            <span class="player-score">${hs.score}</span>
        </li>
    `).join('');
}

function getGuestWarningHtml(type) {
    if (!API.isGuest) return '';

    if (type === 'levelStart') {
        return `<div class="guest-coins-warning">
            Als Gast bekommst du nur <strong>25%</strong> der Coins!<br>
            <a href="#" onclick="showAuthScreen(); return false;">Registriere dich</a> fur volle Belohnungen!
        </div>`;
    } else if (type === 'levelEnd') {
        return `<div class="level-guest-warning">
            Du hast nur <span class="multiplier">25%</span> der Coins erhalten!<br>
            Registrierte Spieler bekommen <span class="multiplier">4x mehr Coins</span>!
        </div>`;
    }
    return '';
}

// Polyfill for roundRect (browser compatibility)
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radii) {
        if (typeof radii === 'number') {
            radii = [radii, radii, radii, radii];
        } else if (Array.isArray(radii)) {
            if (radii.length === 1) radii = [radii[0], radii[0], radii[0], radii[0]];
            else if (radii.length === 2) radii = [radii[0], radii[1], radii[0], radii[1]];
            else if (radii.length === 3) radii = [radii[0], radii[1], radii[2], radii[1]];
        }
        const [tl, tr, br, bl] = radii;
        this.moveTo(x + tl, y);
        this.lineTo(x + width - tr, y);
        this.quadraticCurveTo(x + width, y, x + width, y + tr);
        this.lineTo(x + width, y + height - br);
        this.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
        this.lineTo(x + bl, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - bl);
        this.lineTo(x, y + tl);
        this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
        return this;
    };
}

// Game Configuration
const CONFIG = {
    WIDTH: 800,
    HEIGHT: 600,
    GRAVITY: 0.6,
    FRICTION: 0.8,
    PLAYER: {
        WIDTH: 40,
        HEIGHT: 50,
        SPEED: 5,
        JUMP_FORCE: 14,
        COLOR: '#8B4513'
    }
};

// Theme configurations for different levels
const THEMES = {
    meadow: {
        sky: ['#87CEEB', '#E0F6FF'],
        hills: '#90EE90',
        clouds: 'rgba(255, 255, 255, 0.8)',
        platformColors: { grass: ['#228B22', '#32CD32', '#8B4513'], stone: ['#696969', '#808080'] }
    },
    desert: {
        sky: ['#FFB347', '#FFE4B5'],
        hills: '#DEB887',
        clouds: 'rgba(255, 255, 255, 0.4)',
        platformColors: { sand: ['#D2B48C', '#F4A460', '#CD853F'], stone: ['#A0522D', '#8B4513'] }
    },
    cave: {
        sky: ['#2F2F2F', '#1a1a1a'],
        hills: '#3D3D3D',
        clouds: null,
        platformColors: { stone: ['#4A4A4A', '#5A5A5A'], crystal: ['#9932CC', '#BA55D3'] }
    },
    sky: {
        sky: ['#4169E1', '#87CEEB'],
        hills: null,
        clouds: 'rgba(255, 255, 255, 0.9)',
        platformColors: { cloud: ['#FFFFFF', '#F0F8FF', '#E6E6FA'], rainbow: ['#FF6B6B', '#4ECDC4'] }
    },
    volcano: {
        sky: ['#8B0000', '#2F0000'],
        hills: '#1a0a0a',
        clouds: 'rgba(50, 50, 50, 0.6)',
        platformColors: { rock: ['#463E3F', '#5C5355'], lava: ['#FF4500', '#FF6347'] }
    }
};

// Level Data
const LEVELS = [
    // Level 1 - Meadow (Easy introduction) - Mushroom enemies + Worm Boss
    {
        theme: 'meadow',
        width: 3200,
        enemyType: 'mushroom',
        platforms: [
            { x: 0, y: 550, w: 500, h: 50, type: 'grass' },
            { x: 600, y: 550, w: 400, h: 50, type: 'grass' },
            { x: 1100, y: 550, w: 600, h: 50, type: 'grass' },
            { x: 1800, y: 550, w: 500, h: 50, type: 'grass' },
            { x: 2400, y: 550, w: 800, h: 50, type: 'grass' },
            { x: 200, y: 450, w: 120, h: 25, type: 'grass' },
            { x: 400, y: 350, w: 120, h: 25, type: 'grass' },
            { x: 850, y: 300, w: 100, h: 25, type: 'grass' },
            { x: 1050, y: 380, w: 130, h: 25, type: 'grass' },
            { x: 1450, y: 350, w: 120, h: 25, type: 'grass' },
            { x: 1650, y: 420, w: 150, h: 25, type: 'grass' },
            { x: 2100, y: 400, w: 130, h: 25, type: 'grass' },
            { x: 2350, y: 300, w: 120, h: 25, type: 'grass' },
            { x: 2750, y: 280, w: 100, h: 25, type: 'grass' }
        ],
        movingPlatforms: [
            { x: 600, y: 400, w: 100, h: 25, type: 'stone', moveX: 150, moveY: 0, speed: 2 },
            { x: 1250, y: 280, w: 100, h: 25, type: 'stone', moveX: 0, moveY: 100, speed: 1.5 },
            { x: 1900, y: 320, w: 100, h: 25, type: 'stone', moveX: 120, moveY: 0, speed: 2 }
        ],
        coins: [
            { x: 230, y: 400 }, { x: 430, y: 300 }, { x: 650, y: 350 },
            { x: 880, y: 250 }, { x: 1080, y: 330 }, { x: 1280, y: 230 },
            { x: 1480, y: 300 }, { x: 1700, y: 370 }, { x: 1930, y: 270 },
            { x: 2130, y: 350 }, { x: 2380, y: 250 }, { x: 2600, y: 330 },
            { x: 150, y: 500 }, { x: 300, y: 500 }, { x: 700, y: 500 },
            { x: 1200, y: 500 }, { x: 1500, y: 500 }, { x: 1900, y: 500 }
        ],
        enemies: [
            { x: 300, y: 510, left: 100, right: 450 },
            { x: 700, y: 510, left: 650, right: 950 },
            { x: 1200, y: 510, left: 1150, right: 1650 },
            { x: 2000, y: 510, left: 1850, right: 2250 }
        ],
        obstacles: [],
        boss: { x: 2700, y: 475, type: 'worm' },
        goalX: 3050
    },
    // Level 2 - Desert - Scorpion enemies + Giant Cactus Boss
    {
        theme: 'desert',
        width: 3700,
        enemyType: 'scorpion',
        platforms: [
            { x: 0, y: 550, w: 300, h: 50, type: 'sand' },
            { x: 400, y: 500, w: 150, h: 25, type: 'sand' },
            { x: 650, y: 450, w: 150, h: 25, type: 'sand' },
            { x: 900, y: 400, w: 100, h: 25, type: 'stone' },
            { x: 1100, y: 350, w: 120, h: 25, type: 'sand' },
            { x: 1300, y: 400, w: 200, h: 50, type: 'sand' },
            { x: 1800, y: 500, w: 150, h: 25, type: 'sand' },
            { x: 2050, y: 550, w: 400, h: 50, type: 'sand' },
            { x: 2750, y: 400, w: 100, h: 25, type: 'sand' },
            { x: 2950, y: 320, w: 150, h: 25, type: 'stone' },
            { x: 3150, y: 400, w: 100, h: 25, type: 'sand' },
            { x: 3300, y: 550, w: 400, h: 50, type: 'sand' }
        ],
        movingPlatforms: [
            { x: 1600, y: 450, w: 100, h: 25, type: 'stone', moveX: 150, moveY: 0, speed: 0.8 },
            { x: 2550, y: 480, w: 120, h: 25, type: 'stone', moveX: 0, moveY: 120, speed: 1.5 }
        ],
        coins: [
            { x: 450, y: 450 }, { x: 700, y: 400 }, { x: 930, y: 350 },
            { x: 1150, y: 300 }, { x: 1380, y: 350 }, { x: 1650, y: 400 },
            { x: 1850, y: 450 }, { x: 2150, y: 500 }, { x: 2280, y: 500 },
            { x: 2600, y: 430 }, { x: 2780, y: 350 }, { x: 3000, y: 270 },
            { x: 3180, y: 350 }
        ],
        enemies: [
            { x: 1350, y: 350, left: 1300, right: 1500 },
            { x: 2150, y: 520, left: 2050, right: 2400 },
            { x: 3350, y: 520, left: 3300, right: 3550 }
        ],
        obstacles: [
            { x: 480, y: 450, type: 'cactus' },
            { x: 700, y: 410, type: 'ruins' },
            { x: 1850, y: 450, type: 'cactus' },
            { x: 2200, y: 510, type: 'ruins' },
            { x: 2150, y: 500, type: 'cactus' }
        ],
        boss: { x: 3450, y: 400, type: 'giant_cactus' },
        goalX: 3600
    },
    // Level 3 - Cave - Bat enemies + Crystal Golem Boss
    {
        theme: 'cave',
        width: 4200,
        enemyType: 'bat',
        platforms: [
            { x: 0, y: 550, w: 400, h: 50, type: 'stone' },
            { x: 200, y: 420, w: 100, h: 25, type: 'stone' },
            { x: 50, y: 300, w: 120, h: 25, type: 'crystal' },
            { x: 250, y: 200, w: 100, h: 25, type: 'stone' },
            { x: 450, y: 300, w: 150, h: 25, type: 'stone' },
            { x: 500, y: 550, w: 300, h: 50, type: 'stone' },
            { x: 900, y: 350, w: 150, h: 25, type: 'crystal' },
            { x: 1100, y: 450, w: 200, h: 25, type: 'stone' },
            { x: 1150, y: 550, w: 400, h: 50, type: 'stone' },
            { x: 1400, y: 350, w: 100, h: 25, type: 'stone' },
            { x: 1600, y: 250, w: 120, h: 25, type: 'crystal' },
            { x: 1800, y: 350, w: 150, h: 25, type: 'stone' },
            { x: 1700, y: 550, w: 500, h: 50, type: 'stone' },
            { x: 2300, y: 550, w: 400, h: 50, type: 'stone' },
            { x: 2350, y: 350, w: 120, h: 25, type: 'crystal' },
            { x: 2750, y: 350, w: 150, h: 25, type: 'stone' },
            { x: 2800, y: 550, w: 400, h: 50, type: 'stone' },
            { x: 3300, y: 550, w: 400, h: 50, type: 'stone' },
            { x: 3400, y: 380, w: 150, h: 25, type: 'crystal' },
            { x: 3800, y: 550, w: 400, h: 50, type: 'stone' }
        ],
        movingPlatforms: [
            { x: 700, y: 420, w: 100, h: 25, type: 'stone', moveX: 150, moveY: 0, speed: 2 },
            { x: 2050, y: 420, w: 100, h: 25, type: 'stone', moveX: 0, moveY: 100, speed: 1.5 },
            { x: 2550, y: 250, w: 100, h: 25, type: 'crystal', moveX: 150, moveY: 0, speed: 2 },
            { x: 3000, y: 420, w: 100, h: 25, type: 'stone', moveX: 0, moveY: 100, speed: 2 },
            { x: 3600, y: 280, w: 120, h: 25, type: 'crystal', moveX: 150, moveY: 0, speed: 1.5 }
        ],
        coins: [
            { x: 230, y: 370 }, { x: 80, y: 250 }, { x: 280, y: 150 },
            { x: 500, y: 250 }, { x: 750, y: 370 }, { x: 950, y: 300 },
            { x: 1180, y: 400 }, { x: 1430, y: 300 }, { x: 1640, y: 200 },
            { x: 1850, y: 300 }, { x: 2100, y: 370 }, { x: 2380, y: 300 },
            { x: 2600, y: 200 }, { x: 2800, y: 300 }, { x: 3050, y: 370 },
            { x: 3450, y: 330 }, { x: 3650, y: 230 },
            { x: 600, y: 500 }, { x: 1250, y: 500 }, { x: 1850, y: 500 },
            { x: 2450, y: 500 }, { x: 2950, y: 500 }, { x: 3450, y: 500 }
        ],
        enemies: [
            { x: 150, y: 500, left: 50, right: 350 },
            { x: 600, y: 500, left: 500, right: 780 },
            { x: 1250, y: 500, left: 1150, right: 1500 },
            { x: 1850, y: 500, left: 1700, right: 2150 },
            { x: 2450, y: 500, left: 2300, right: 2650 },
            { x: 2950, y: 500, left: 2800, right: 3150 }
        ],
        obstacles: [
            { x: 300, y: 505, type: 'stalagmite' },
            { x: 700, y: 505, type: 'stalagmite' },
            { x: 1400, y: 505, type: 'stalagmite' },
            { x: 2100, y: 505, type: 'stalagmite' },
            { x: 2600, y: 505, type: 'stalagmite' },
            { x: 3100, y: 505, type: 'stalagmite' }
        ],
        boss: { x: 3900, y: 450, type: 'crystal_golem' },
        goalX: 4100
    },
    // Level 4 - Sky - Cloud enemies + Thunder Cloud Boss
    {
        theme: 'sky',
        width: 4700,
        enemyType: 'cloud_enemy',
        platforms: [
            { x: 0, y: 550, w: 200, h: 50, type: 'cloud' },
            { x: 250, y: 480, w: 100, h: 25, type: 'cloud' },
            { x: 420, y: 400, w: 80, h: 25, type: 'cloud' },
            { x: 570, y: 320, w: 100, h: 25, type: 'cloud' },
            { x: 750, y: 250, w: 120, h: 25, type: 'rainbow' },
            { x: 950, y: 200, w: 150, h: 25, type: 'cloud' },
            { x: 1180, y: 280, w: 100, h: 25, type: 'cloud' },
            { x: 1550, y: 280, w: 100, h: 25, type: 'cloud' },
            { x: 1750, y: 200, w: 150, h: 25, type: 'rainbow' },
            { x: 2000, y: 150, w: 100, h: 25, type: 'cloud' },
            { x: 2200, y: 220, w: 120, h: 25, type: 'cloud' },
            { x: 2650, y: 250, w: 100, h: 25, type: 'cloud' },
            { x: 2850, y: 180, w: 120, h: 25, type: 'rainbow' },
            { x: 3050, y: 250, w: 100, h: 25, type: 'cloud' },
            { x: 3500, y: 400, w: 120, h: 25, type: 'cloud' },
            { x: 3700, y: 480, w: 100, h: 25, type: 'cloud' },
            { x: 3900, y: 550, w: 200, h: 50, type: 'cloud' },
            { x: 4200, y: 550, w: 500, h: 50, type: 'cloud' }
        ],
        movingPlatforms: [
            { x: 1350, y: 350, w: 120, h: 25, type: 'rainbow', moveX: 0, moveY: 100, speed: 1.5 },
            { x: 2400, y: 300, w: 150, h: 25, type: 'cloud', moveX: 180, moveY: 0, speed: 2 },
            { x: 3250, y: 330, w: 150, h: 25, type: 'rainbow', moveX: 0, moveY: 120, speed: 1.5 }
        ],
        coins: [
            { x: 280, y: 430 }, { x: 445, y: 350 }, { x: 600, y: 270 },
            { x: 790, y: 200 }, { x: 1000, y: 150 }, { x: 1210, y: 230 },
            { x: 1400, y: 300 }, { x: 1580, y: 230 }, { x: 1800, y: 150 },
            { x: 2030, y: 100 }, { x: 2240, y: 170 }, { x: 2480, y: 250 },
            { x: 2680, y: 200 }, { x: 2890, y: 130 }, { x: 3080, y: 200 },
            { x: 3310, y: 280 }, { x: 3540, y: 350 }, { x: 3730, y: 430 },
            { x: 4000, y: 500 }, { x: 4300, y: 500 }
        ],
        enemies: [
            { x: 1000, y: 160, left: 950, right: 1100 },
            { x: 1800, y: 160, left: 1750, right: 1900 },
            { x: 2700, y: 210, left: 2650, right: 2750 },
            { x: 4280, y: 510, left: 4200, right: 4480 }
        ],
        obstacles: [],
        boss: { x: 4400, y: 470, type: 'thunder_cloud' },
        goalX: 4600
    },
    // Level 5 - Volcano (Final challenge) - Fire Slime enemies + Lava Dragon Boss
    {
        theme: 'volcano',
        width: 5200,
        enemyType: 'fire_slime',
        platforms: [
            { x: 0, y: 550, w: 250, h: 50, type: 'rock' },
            { x: 300, y: 480, w: 80, h: 25, type: 'rock' },
            { x: 450, y: 400, w: 80, h: 25, type: 'lava' },
            { x: 600, y: 320, w: 80, h: 25, type: 'rock' },
            { x: 750, y: 400, w: 100, h: 25, type: 'rock' },
            { x: 920, y: 550, w: 200, h: 50, type: 'rock' },
            { x: 1150, y: 320, w: 100, h: 25, type: 'lava' },
            { x: 1320, y: 250, w: 80, h: 25, type: 'rock' },
            { x: 1470, y: 180, w: 100, h: 25, type: 'lava' },
            { x: 1650, y: 250, w: 120, h: 25, type: 'rock' },
            { x: 1850, y: 350, w: 150, h: 25, type: 'rock' },
            { x: 1900, y: 550, w: 300, h: 50, type: 'rock' },
            { x: 2300, y: 550, w: 250, h: 50, type: 'rock' },
            { x: 2350, y: 350, w: 80, h: 25, type: 'lava' },
            { x: 2700, y: 180, w: 80, h: 25, type: 'lava' },
            { x: 2880, y: 250, w: 120, h: 25, type: 'rock' },
            { x: 3080, y: 350, w: 100, h: 25, type: 'rock' },
            { x: 3100, y: 550, w: 300, h: 50, type: 'rock' },
            { x: 3450, y: 320, w: 100, h: 25, type: 'lava' },
            { x: 3780, y: 150, w: 120, h: 25, type: 'lava' },
            { x: 4150, y: 320, w: 80, h: 25, type: 'rock' },
            { x: 4300, y: 420, w: 100, h: 25, type: 'rock' },
            { x: 4500, y: 550, w: 200, h: 50, type: 'rock' },
            { x: 4750, y: 550, w: 450, h: 50, type: 'rock' }
        ],
        movingPlatforms: [
            { x: 1000, y: 420, w: 80, h: 25, type: 'rock', moveX: 100, moveY: 0, speed: 3 },
            { x: 2100, y: 420, w: 100, h: 25, type: 'rock', moveX: 0, moveY: 100, speed: 2 },
            { x: 2500, y: 250, w: 100, h: 25, type: 'lava', moveX: 150, moveY: 0, speed: 2.5 },
            { x: 3280, y: 420, w: 80, h: 25, type: 'rock', moveX: 0, moveY: 80, speed: 2 },
            { x: 3620, y: 220, w: 80, h: 25, type: 'lava', moveX: 120, moveY: 0, speed: 2 },
            { x: 3980, y: 220, w: 100, h: 25, type: 'rock', moveX: 0, moveY: 100, speed: 2.5 }
        ],
        coins: [
            { x: 330, y: 430 }, { x: 480, y: 350 }, { x: 630, y: 270 },
            { x: 780, y: 350 }, { x: 1050, y: 370 }, { x: 1180, y: 270 },
            { x: 1350, y: 200 }, { x: 1500, y: 130 }, { x: 1690, y: 200 },
            { x: 1900, y: 300 }, { x: 2150, y: 370 }, { x: 2380, y: 300 },
            { x: 2550, y: 200 }, { x: 2730, y: 130 }, { x: 2920, y: 200 },
            { x: 3110, y: 300 }, { x: 3330, y: 370 }, { x: 3480, y: 270 },
            { x: 3660, y: 170 }, { x: 3820, y: 100 }, { x: 4030, y: 170 },
            { x: 4180, y: 270 }, { x: 4330, y: 370 }, { x: 4580, y: 500 },
            { x: 4850, y: 500 },
            { x: 1000, y: 500 }, { x: 2000, y: 500 }, { x: 2400, y: 500 },
            { x: 3200, y: 500 }
        ],
        enemies: [
            { x: 1000, y: 515, left: 920, right: 1100 },
            { x: 2000, y: 515, left: 1900, right: 2150 },
            { x: 2400, y: 515, left: 2300, right: 2530 },
            { x: 3200, y: 515, left: 3100, right: 3380 },
            { x: 1700, y: 215, left: 1650, right: 1770 },
            { x: 2930, y: 215, left: 2880, right: 3000 }
        ],
        obstacles: [
            { x: 500, y: 515, type: 'lava_rock' },
            { x: 1500, y: 515, type: 'lava_rock' },
            { x: 2200, y: 515, type: 'lava_rock' },
            { x: 2900, y: 515, type: 'lava_rock' },
            { x: 3500, y: 515, type: 'lava_rock' }
        ],
        boss: { x: 4900, y: 450, type: 'lava_dragon' },
        goalX: 5100
    }
];

// Game State
const game = {
    canvas: null,
    ctx: null,
    running: false,
    score: 0,
    lives: 3,
    level: 1,
    highscore: 0,
    keys: {},
    player: null,
    platforms: [],
    movingPlatforms: [],
    coins: [],
    enemies: [],
    obstacles: [],
    boss: null,
    bossDefeated: false,
    particles: [],
    goal: null,
    cameraX: 0,
    levelWidth: 3000,
    theme: null,
    levelStartTime: 0,
    levelTime: 0,
    coinsCollected: 0,
    totalCoins: 0,
    playerName: 'Player',
    highscores: [],
    // User profile system
    userProfile: {
        name: 'Player',
        totalCoins: 0,
        ownedSkins: ['default'],
        ownedUpgrades: [],
        selectedSkin: 'default',
        extraLives: 0
    }
};

// Shop items configuration
const SHOP = {
    skins: [
        { id: 'default', name: 'Klassischer Bär', price: 0, color: '#8B4513' },
        { id: 'polar', name: 'Eisbär', price: 50, color: '#F5F5F5' },
        { id: 'panda', name: 'Pandabär', price: 75, color: '#1a1a1a' },
        { id: 'golden', name: 'Goldener Bär', price: 150, color: '#FFD700' },
        { id: 'pink', name: 'Rosa Bär', price: 100, color: '#FF69B4' },
        { id: 'blue', name: 'Blauer Bär', price: 100, color: '#4169E1' }
    ],
    upgrades: [
        { id: 'extra_life_1', name: '+1 Startleben', price: 100, type: 'extraLife', value: 1, maxOwned: 1 },
        { id: 'extra_life_2', name: '+2 Startleben', price: 250, type: 'extraLife', value: 2, maxOwned: 1, requires: 'extra_life_1' },
        { id: 'coin_magnet', name: 'Münzmagnet', price: 200, type: 'coinMagnet', description: 'Münzen werden angezogen' },
        { id: 'double_coins', name: 'Doppelte Münzen', price: 300, type: 'doubleCoins', description: '2x Münzen aus Leveln' }
    ]
};

// Load user profile from localStorage (by player name)
function loadUserProfile(playerName) {
    let allProfiles = JSON.parse(localStorage.getItem('littleBearProfiles') || '{}');

    // TEMP: Reset Mario's profile once to give fresh 7000 coins (remove this after testing)
    if (playerName === 'Mario' && !localStorage.getItem('marioResetDone')) {
        delete allProfiles['Mario'];
        localStorage.setItem('littleBearProfiles', JSON.stringify(allProfiles));
        localStorage.setItem('marioResetDone', 'true');
    }

    if (playerName && allProfiles[playerName]) {
        game.userProfile = { ...game.userProfile, ...allProfiles[playerName] };
    } else {
        // Reset to default for new player
        game.userProfile = {
            name: playerName || 'Player',
            totalCoins: 0,
            ownedSkins: ['default'],
            ownedUpgrades: [],
            selectedSkin: 'default',
            extraLives: 0
        };

        // TEST: Give Mario 7000 coins when first created
        if (playerName === 'Mario') {
            game.userProfile.totalCoins = 7000;
        }
    }

    game.userProfile.name = playerName || 'Player';
    game.playerName = game.userProfile.name;
}

// Save user profile to localStorage (by player name)
function saveUserProfile() {
    const allProfiles = JSON.parse(localStorage.getItem('littleBearProfiles') || '{}');
    allProfiles[game.userProfile.name] = game.userProfile;
    localStorage.setItem('littleBearProfiles', JSON.stringify(allProfiles));
}

// Add coins to user profile
function addCoinsToProfile(amount, level) {
    let finalAmount = amount;

    // Guests get only 25% of coins
    if (API.isGuest) {
        finalAmount = Math.floor(amount * API.GUEST_COIN_MULTIPLIER);
    } else {
        // Double coins upgrade only works for registered users
        if (game.userProfile.ownedUpgrades.includes('double_coins')) {
            finalAmount *= 2;
        }
    }

    game.userProfile.totalCoins += finalAmount;
    saveUserProfile();

    // Sync with server if logged in
    if (!API.isGuest) {
        API.addCoins(finalAmount, level || game.level, {
            maxLevel: game.level,
            score: game.score,
            duration: Math.floor((Date.now() - game.levelStartTime) / 1000)
        });
    }

    return finalAmount;
}

// Buy item from shop
function buyShopItem(type, itemId) {
    const items = type === 'skins' ? SHOP.skins : SHOP.upgrades;
    const item = items.find(i => i.id === itemId);

    if (!item) return { success: false, message: 'Artikel nicht gefunden' };

    // Check if already owned
    if (type === 'skins' && game.userProfile.ownedSkins.includes(itemId)) {
        return { success: false, message: 'Bereits gekauft' };
    }
    if (type === 'upgrades' && game.userProfile.ownedUpgrades.includes(itemId)) {
        return { success: false, message: 'Bereits gekauft' };
    }

    // Check requirements
    if (item.requires && !game.userProfile.ownedUpgrades.includes(item.requires)) {
        return { success: false, message: 'Voraussetzung nicht erfüllt' };
    }

    // Check if enough coins
    if (game.userProfile.totalCoins < item.price) {
        return { success: false, message: 'Nicht genug Münzen' };
    }

    // Purchase
    game.userProfile.totalCoins -= item.price;

    if (type === 'skins') {
        game.userProfile.ownedSkins.push(itemId);
    } else {
        game.userProfile.ownedUpgrades.push(itemId);
        // Apply upgrade effects
        if (item.type === 'extraLife') {
            game.userProfile.extraLives += item.value;
        }
    }

    saveUserProfile();
    return { success: true, message: 'Kauf erfolgreich!' };
}

// Select skin
function selectSkin(skinId) {
    if (game.userProfile.ownedSkins.includes(skinId)) {
        game.userProfile.selectedSkin = skinId;
        saveUserProfile();
        return true;
    }
    return false;
}

// Get current skin color
function getCurrentSkinColor() {
    const skin = SHOP.skins.find(s => s.id === game.userProfile.selectedSkin);
    return skin ? skin.color : '#8B4513';
}

// Load highscores from localStorage
function loadHighscores() {
    const saved = localStorage.getItem('littleBearHighscores');
    if (saved) {
        game.highscores = JSON.parse(saved);
    } else {
        game.highscores = [];
    }
    updateHighscoreDisplays();
}

// Save highscore to localStorage and server
async function saveHighscore() {
    const newEntry = {
        name: game.playerName,
        score: game.score
    };

    // Save to local storage (for guests and offline)
    game.highscores.push(newEntry);
    game.highscores.sort((a, b) => b.score - a.score);
    game.highscores = game.highscores.slice(0, 5);
    localStorage.setItem('littleBearHighscores', JSON.stringify(game.highscores));

    // Save to server if logged in
    if (!API.isGuest) {
        const result = await API.saveHighscore(game.score, game.level);
        if (result) {
            console.log('Highscore saved to server, rank:', result.rank);
        }
        // Refresh global highscores
        loadGlobalHighscores();
    }

    updateHighscoreDisplays();
}

// Check if current score qualifies for highscore
function isHighscore() {
    if (game.highscores.length < 5) return true;
    return game.score > game.highscores[game.highscores.length - 1].score;
}

// Render highscore list HTML
function renderHighscoreList(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (game.highscores.length === 0) {
        container.innerHTML = '<li style="justify-content: center; color: #888;">Noch keine Highscores</li>';
        return;
    }

    game.highscores.forEach((entry, index) => {
        const li = document.createElement('li');
        const isCurrentPlayer = entry.name === game.playerName && entry.score === game.score;
        if (isCurrentPlayer) {
            li.classList.add('current-player');
        }

        li.innerHTML = `
            <span class="rank">#${index + 1}</span>
            <span class="player-name">${entry.name}</span>
            <span class="player-score">${entry.score}</span>
        `;
        container.appendChild(li);
    });
}

// Update all highscore displays
function updateHighscoreDisplays() {
    renderHighscoreList('highscore-entries');
    renderHighscoreList('win-highscore-entries');
    renderHighscoreList('gameover-highscore-entries');
}

// Player Class
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.PLAYER.WIDTH;
        this.height = CONFIG.PLAYER.HEIGHT;
        this.velX = 0;
        this.velY = 0;
        this.jumping = false;
        this.grounded = false;
        this.facingRight = true;
        this.onPlatform = null;
        this.jumpCount = 0;
        this.maxJumps = 2; // Double jump
        this.canJump = true;
    }

    update() {
        // Horizontal movement
        if (game.keys['ArrowLeft'] || game.keys['KeyA']) {
            if (this.velX > -CONFIG.PLAYER.SPEED) {
                this.velX--;
            }
            this.facingRight = false;
        }
        if (game.keys['ArrowRight'] || game.keys['KeyD']) {
            if (this.velX < CONFIG.PLAYER.SPEED) {
                this.velX++;
            }
            this.facingRight = true;
        }

        // Jumping (with double jump)
        const jumpKeyPressed = game.keys['Space'] || game.keys['ArrowUp'] || game.keys['KeyW'];
        if (jumpKeyPressed && this.canJump && this.jumpCount < this.maxJumps) {
            this.jumping = true;
            this.grounded = false;
            this.velY = -CONFIG.PLAYER.JUMP_FORCE;
            this.jumpCount++;
            this.canJump = false;

            // Different particle colors for double jump
            if (this.jumpCount === 1) {
                createParticles(this.x + this.width / 2, this.y + this.height, 5, '#A0522D');
            } else {
                // Double jump effect - sparkles!
                createParticles(this.x + this.width / 2, this.y + this.height / 2, 8, '#FFD700');
            }
        }
        // Reset canJump when key is released (prevents holding jump)
        if (!jumpKeyPressed) {
            this.canJump = true;
        }

        // Apply gravity
        this.velY += CONFIG.GRAVITY;

        // Apply friction
        this.velX *= CONFIG.FRICTION;

        // Move with platform if standing on one
        if (this.onPlatform && this.grounded) {
            this.x += this.onPlatform.velX || 0;
            this.y += this.onPlatform.velY || 0;
        }

        // Update position
        this.x += this.velX;
        this.y += this.velY;

        // Ground collision
        this.grounded = false;
        this.onPlatform = null;

        // Platform collision (static)
        for (let platform of game.platforms) {
            const collision = this.checkCollision(platform);
            if (collision) {
                this.handleCollision(collision, platform);
            }
        }

        // Platform collision (moving)
        for (let platform of game.movingPlatforms) {
            const collision = this.checkCollision(platform);
            if (collision) {
                this.handleCollision(collision, platform);
                if (collision === 'bottom') {
                    this.onPlatform = platform;
                }
            }
        }

        // World bounds
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > game.levelWidth) this.x = game.levelWidth - this.width;

        // Fall off screen
        if (this.y > CONFIG.HEIGHT + 100) {
            this.die();
        }

        // Coin Magnet effect
        if (game.userProfile.ownedUpgrades.includes('coin_magnet')) {
            const magnetRange = 150;
            for (let coin of game.coins) {
                const dx = (this.x + this.width / 2) - (coin.x + coin.width / 2);
                const dy = (this.y + this.height / 2) - (coin.y + coin.height / 2);
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < magnetRange && distance > 0) {
                    const speed = 5 * (1 - distance / magnetRange);
                    coin.x += (dx / distance) * speed;
                    coin.y += (dy / distance) * speed;
                }
            }
        }

        // Coin collection
        for (let i = game.coins.length - 1; i >= 0; i--) {
            const coin = game.coins[i];
            if (this.intersects(coin)) {
                game.coins.splice(i, 1);
                game.coinsCollected++;
                game.score += 10;
                updateUI();
                createParticles(coin.x + coin.width / 2, coin.y + coin.height / 2, 8, '#FFD700');
            }
        }

        // Enemy collision
        for (let enemy of game.enemies) {
            if (this.intersects(enemy)) {
                if (this.velY > 0 && this.y + this.height - 10 < enemy.y + enemy.height / 2) {
                    enemy.alive = false;
                    this.velY = -10;
                    game.score += 50;
                    updateUI();
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 10, '#FF6347');
                } else if (enemy.alive) {
                    this.die();
                }
            }
        }

        // Boss collision
        if (game.boss && game.boss.alive && this.intersects(game.boss)) {
            // Allow jumping on top 85% of boss (very forgiving for tall bosses like giant_cactus)
            if (this.velY > 0 && this.y + this.height - 5 < game.boss.y + game.boss.height * 0.85) {
                // Player jumped on boss
                const killed = game.boss.takeDamage();
                this.velY = -12; // Bigger bounce

                if (killed) {
                    // Boss defeated!
                    game.bossDefeated = true;
                    createParticles(game.boss.x + game.boss.width / 2, game.boss.y + game.boss.height / 2, 30, '#FFD700');
                    createParticles(game.boss.x + game.boss.width / 2, game.boss.y + game.boss.height / 2, 20, '#FF4500');
                } else {
                    // Boss damaged
                    createParticles(game.boss.x + game.boss.width / 2, game.boss.y + game.boss.height / 2, 15, '#FF0000');
                }
            } else {
                // Player touched boss from side - take damage
                this.die();
            }
        }

        // Obstacle collision (cacti/lava hurt, ruins/stalagmites block without damage)
        for (let obstacle of game.obstacles) {
            if (this.intersects(obstacle)) {
                if (obstacle.type === 'ruins' || obstacle.type === 'stalagmite') {
                    // Ruins and stalagmites act as solid obstacles - block player without damage
                    const collision = this.checkCollision(obstacle);
                    if (collision) {
                        this.handleCollision(collision, obstacle);
                    }
                } else {
                    // Other obstacles (cacti, lava_rock, etc.) hurt the player on contact
                    this.die();
                }
            }
        }

        // Goal collision - only if boss is defeated (or no boss exists)
        if (game.goal && this.intersects(game.goal)) {
            if (!game.boss || game.bossDefeated) {
                levelComplete();
            }
        }
    }

    handleCollision(collision, platform) {
        if (collision === 'bottom') {
            this.grounded = true;
            this.jumping = false;
            this.velY = 0;
            this.y = platform.y - this.height;
            this.jumpCount = 0; // Reset double jump when landing
        } else if (collision === 'top') {
            this.velY = 0;
            this.y = platform.y + platform.height;
        } else if (collision === 'left') {
            this.velX = 0;
            this.x = platform.x - this.width;
        } else if (collision === 'right') {
            this.velX = 0;
            this.x = platform.x + platform.width;
        }
    }

    checkCollision(platform) {
        if (!this.intersects(platform)) return null;

        const overlapLeft = (this.x + this.width) - platform.x;
        const overlapRight = (platform.x + platform.width) - this.x;
        const overlapTop = (this.y + this.height) - platform.y;
        const overlapBottom = (platform.y + platform.height) - this.y;

        const minOverlapX = Math.min(overlapLeft, overlapRight);
        const minOverlapY = Math.min(overlapTop, overlapBottom);

        if (minOverlapY < minOverlapX) {
            return overlapTop < overlapBottom ? 'bottom' : 'top';
        } else {
            return overlapLeft < overlapRight ? 'left' : 'right';
        }
    }

    intersects(obj) {
        return this.x < obj.x + obj.width &&
               this.x + this.width > obj.x &&
               this.y < obj.y + obj.height &&
               this.y + this.height > obj.y;
    }

    die() {
        game.lives--;
        updateUI();
        createParticles(this.x + this.width / 2, this.y + this.height / 2, 15, '#FF0000');

        if (game.lives <= 0) {
            gameOver();
        } else {
            this.respawn();
        }
    }

    respawn() {
        this.x = 100;
        this.y = 300;
        this.velX = 0;
        this.velY = 0;
        this.jumpCount = 0;
        game.cameraX = 0;

        // Reset enemies and boss
        resetEnemies();
    }

    draw(ctx) {
        const screenX = this.x - game.cameraX;
        const skinColor = getCurrentSkinColor();

        // Determine secondary colors based on skin
        let earColor, faceColor;
        if (skinColor === '#F5F5F5') { // Polar bear
            earColor = '#E8E8E8';
            faceColor = '#FFFFFF';
        } else if (skinColor === '#1a1a1a') { // Panda
            earColor = '#000000';
            faceColor = '#FFFFFF';
        } else if (skinColor === '#FFD700') { // Golden
            earColor = '#DAA520';
            faceColor = '#FFF8DC';
        } else if (skinColor === '#FF69B4') { // Pink
            earColor = '#FF1493';
            faceColor = '#FFB6C1';
        } else if (skinColor === '#4169E1') { // Ice
            earColor = '#1E90FF';
            faceColor = '#B0E0E6';
        } else { // Default brown
            earColor = '#A0522D';
            faceColor = '#DEB887';
        }

        // Body
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.roundRect(screenX, this.y, this.width, this.height, 8);
        ctx.fill();

        // Ears
        ctx.fillStyle = earColor;
        ctx.beginPath();
        ctx.arc(screenX + 8, this.y + 5, 8, 0, Math.PI * 2);
        ctx.arc(screenX + this.width - 8, this.y + 5, 8, 0, Math.PI * 2);
        ctx.fill();

        // Inner ears
        ctx.fillStyle = faceColor;
        ctx.beginPath();
        ctx.arc(screenX + 8, this.y + 5, 4, 0, Math.PI * 2);
        ctx.arc(screenX + this.width - 8, this.y + 5, 4, 0, Math.PI * 2);
        ctx.fill();

        // Face
        ctx.fillStyle = faceColor;
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 25, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000';
        const eyeOffsetX = this.facingRight ? 2 : -2;
        ctx.beginPath();
        ctx.arc(screenX + 12 + eyeOffsetX, this.y + 18, 4, 0, Math.PI * 2);
        ctx.arc(screenX + this.width - 12 + eyeOffsetX, this.y + 18, 4, 0, Math.PI * 2);
        ctx.fill();

        // Nose
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(screenX + this.width / 2, this.y + 25, 4, 0, Math.PI * 2);
        ctx.fill();

        // Belly
        ctx.fillStyle = faceColor;
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + this.height - 15, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Platform Class
class Platform {
    constructor(x, y, width, height, type = 'grass') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
    }

    draw(ctx) {
        const screenX = this.x - game.cameraX;
        if (screenX + this.width < 0 || screenX > CONFIG.WIDTH) return;

        const theme = game.theme;
        this.drawPlatform(ctx, screenX, theme);
    }

    drawPlatform(ctx, screenX, theme) {
        switch(this.type) {
            case 'grass':
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(screenX, this.y + 10, this.width, this.height - 10);
                ctx.fillStyle = '#228B22';
                ctx.beginPath();
                ctx.roundRect(screenX, this.y, this.width, 15, [8, 8, 0, 0]);
                ctx.fill();
                ctx.fillStyle = '#32CD32';
                for (let i = 0; i < this.width; i += 20) {
                    ctx.fillRect(screenX + i + 5, this.y + 2, 8, 4);
                }
                break;

            case 'stone':
                ctx.fillStyle = '#696969';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#808080';
                for (let i = 0; i < this.width; i += 30) {
                    for (let j = 0; j < this.height; j += 20) {
                        ctx.fillRect(screenX + i + 5, this.y + j + 5, 15, 10);
                    }
                }
                break;

            case 'sand':
                ctx.fillStyle = '#CD853F';
                ctx.fillRect(screenX, this.y + 8, this.width, this.height - 8);
                ctx.fillStyle = '#D2B48C';
                ctx.beginPath();
                ctx.roundRect(screenX, this.y, this.width, 12, [6, 6, 0, 0]);
                ctx.fill();
                ctx.fillStyle = '#F4A460';
                for (let i = 0; i < this.width; i += 25) {
                    ctx.beginPath();
                    ctx.arc(screenX + i + 10, this.y + 6, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'crystal':
                ctx.fillStyle = '#4A4A4A';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#9932CC';
                for (let i = 0; i < this.width; i += 40) {
                    ctx.beginPath();
                    ctx.moveTo(screenX + i + 10, this.y + this.height);
                    ctx.lineTo(screenX + i + 20, this.y);
                    ctx.lineTo(screenX + i + 30, this.y + this.height);
                    ctx.fill();
                }
                ctx.fillStyle = '#BA55D3';
                for (let i = 0; i < this.width; i += 40) {
                    ctx.beginPath();
                    ctx.moveTo(screenX + i + 15, this.y + this.height);
                    ctx.lineTo(screenX + i + 20, this.y + 5);
                    ctx.lineTo(screenX + i + 25, this.y + this.height);
                    ctx.fill();
                }
                break;

            case 'cloud':
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                for (let i = 0; i < this.width; i += 30) {
                    ctx.arc(screenX + i + 15, this.y + this.height / 2, 18, 0, Math.PI * 2);
                }
                ctx.fill();
                ctx.fillStyle = '#F0F8FF';
                for (let i = 0; i < this.width; i += 30) {
                    ctx.beginPath();
                    ctx.arc(screenX + i + 15, this.y + this.height / 2 - 5, 12, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'rainbow':
                const colors = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#45B7D1', '#96CEB4'];
                const stripeHeight = this.height / colors.length;
                for (let i = 0; i < colors.length; i++) {
                    ctx.fillStyle = colors[i];
                    ctx.fillRect(screenX, this.y + i * stripeHeight, this.width, stripeHeight + 1);
                }
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(screenX, this.y, this.width, this.height / 3);
                break;

            case 'rock':
                ctx.fillStyle = '#463E3F';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#5C5355';
                for (let i = 0; i < this.width; i += 25) {
                    for (let j = 0; j < this.height; j += 15) {
                        ctx.fillRect(screenX + i + 3, this.y + j + 3, 12, 8);
                    }
                }
                // Cracks
                ctx.strokeStyle = '#2F2F2F';
                ctx.lineWidth = 1;
                for (let i = 0; i < this.width; i += 50) {
                    ctx.beginPath();
                    ctx.moveTo(screenX + i + 20, this.y);
                    ctx.lineTo(screenX + i + 25, this.y + this.height);
                    ctx.stroke();
                }
                break;

            case 'lava':
                ctx.fillStyle = '#8B0000';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#FF4500';
                ctx.beginPath();
                ctx.roundRect(screenX + 2, this.y + 2, this.width - 4, this.height - 4, 4);
                ctx.fill();
                // Glow effect
                ctx.fillStyle = '#FF6347';
                for (let i = 0; i < this.width; i += 20) {
                    const glowY = Math.sin(Date.now() / 200 + i) * 3;
                    ctx.beginPath();
                    ctx.arc(screenX + i + 10, this.y + this.height / 2 + glowY, 6, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
        }
    }
}

// Moving Platform Class
class MovingPlatform extends Platform {
    constructor(x, y, width, height, type, moveX, moveY, speed) {
        super(x, y, width, height, type);
        this.startX = x;
        this.startY = y;
        this.moveX = moveX;
        this.moveY = moveY;
        this.speed = speed;
        this.progress = 0;
        this.direction = 1;
        this.velX = 0;
        this.velY = 0;
    }

    update() {
        const oldX = this.x;
        const oldY = this.y;

        this.progress += this.speed * this.direction * 0.02;

        if (this.progress >= 1 || this.progress <= 0) {
            this.direction *= -1;
            this.progress = Math.max(0, Math.min(1, this.progress));
        }

        this.x = this.startX + this.moveX * this.progress;
        this.y = this.startY + this.moveY * this.progress;

        this.velX = this.x - oldX;
        this.velY = this.y - oldY;
    }

    draw(ctx) {
        const screenX = this.x - game.cameraX;
        if (screenX + this.width < 0 || screenX > CONFIG.WIDTH) return;

        // Draw glow/indicator for moving platforms
        ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
        ctx.fillRect(screenX - 3, this.y - 3, this.width + 6, this.height + 6);

        this.drawPlatform(ctx, screenX, game.theme);
    }
}

// Coin Class
class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 25;
        this.height = 25;
        this.angle = Math.random() * Math.PI * 2;
    }

    update() {
        this.angle += 0.1;
    }

    draw(ctx) {
        const screenX = this.x - game.cameraX;
        if (screenX + this.width < 0 || screenX > CONFIG.WIDTH) return;

        const bounce = Math.sin(this.angle) * 3;

        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(screenX + this.width / 2, this.y + this.height / 2 + bounce, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.arc(screenX + this.width / 2, this.y + this.height / 2 + bounce, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('$', screenX + this.width / 2, this.y + this.height / 2 + bounce + 5);
    }
}

// Enemy Class - now with different types per level
class Enemy {
    constructor(x, y, patrolLeft, patrolRight, type = 'default') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.velX = 2;
        this.patrolLeft = patrolLeft;
        this.patrolRight = patrolRight;
        this.alive = true;
        this.animFrame = 0;

        // Set size based on type
        switch(type) {
            case 'mushroom':
                this.width = 35;
                this.height = 40;
                break;
            case 'scorpion':
                this.width = 45;
                this.height = 30;
                this.velX = 2.5;
                break;
            case 'bat':
                this.width = 40;
                this.height = 25;
                this.velX = 3;
                break;
            case 'cloud_enemy':
                this.width = 40;
                this.height = 35;
                this.velX = 1.5;
                break;
            case 'fire_slime':
                this.width = 40;
                this.height = 35;
                this.velX = 2;
                break;
            default:
                this.width = 35;
                this.height = 35;
        }
    }

    update() {
        if (!this.alive) return;

        this.x += this.velX;
        this.animFrame += 0.1;

        if (this.x <= this.patrolLeft || this.x + this.width >= this.patrolRight) {
            this.velX *= -1;
        }
    }

    draw(ctx) {
        if (!this.alive) return;

        const screenX = this.x - game.cameraX;
        if (screenX + this.width < 0 || screenX > CONFIG.WIDTH) return;

        switch(this.type) {
            case 'mushroom':
                this.drawMushroom(ctx, screenX);
                break;
            case 'scorpion':
                this.drawScorpion(ctx, screenX);
                break;
            case 'bat':
                this.drawBat(ctx, screenX);
                break;
            case 'cloud_enemy':
                this.drawCloudEnemy(ctx, screenX);
                break;
            case 'fire_slime':
                this.drawFireSlime(ctx, screenX);
                break;
            default:
                this.drawDefault(ctx, screenX);
        }
    }

    // Grass Mushroom Enemy (Level 1)
    drawMushroom(ctx, screenX) {
        // Stem
        ctx.fillStyle = '#F5DEB3';
        ctx.fillRect(screenX + 10, this.y + 20, 15, 20);

        // Cap (red with white spots)
        ctx.fillStyle = '#DC143C';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 15, 18, 15, 0, Math.PI, 0);
        ctx.fill();

        // White spots on cap
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(screenX + 10, this.y + 8, 4, 0, Math.PI * 2);
        ctx.arc(screenX + 25, this.y + 10, 3, 0, Math.PI * 2);
        ctx.arc(screenX + 18, this.y + 5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Angry eyes
        ctx.fillStyle = '#000';
        const eyeDir = this.velX > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.arc(screenX + 12 + eyeDir, this.y + 25, 3, 0, Math.PI * 2);
        ctx.arc(screenX + 23 + eyeDir, this.y + 25, 3, 0, Math.PI * 2);
        ctx.fill();

        // Angry eyebrows
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX + 8, this.y + 20);
        ctx.lineTo(screenX + 15, this.y + 22);
        ctx.moveTo(screenX + 27, this.y + 20);
        ctx.lineTo(screenX + 20, this.y + 22);
        ctx.stroke();
    }

    // Desert Scorpion Enemy (Level 2)
    drawScorpion(ctx, screenX) {
        const facingRight = this.velX > 0;

        // Body
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 20, 18, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Tail segments
        ctx.fillStyle = '#A0522D';
        const tailX = facingRight ? screenX : screenX + this.width;
        const tailDir = facingRight ? -1 : 1;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.arc(tailX + tailDir * (5 + i * 8), this.y + 15 - i * 4, 5 - i * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Stinger
        ctx.fillStyle = '#2F2F2F';
        ctx.beginPath();
        ctx.moveTo(tailX + tailDir * 35, this.y);
        ctx.lineTo(tailX + tailDir * 40, this.y + 5);
        ctx.lineTo(tailX + tailDir * 35, this.y + 8);
        ctx.fill();

        // Pincers
        const pincerX = facingRight ? screenX + this.width - 5 : screenX + 5;
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(pincerX, this.y + 22, 8, 5, facingRight ? -0.3 : 0.3, 0, Math.PI * 2);
        ctx.ellipse(pincerX, this.y + 12, 8, 5, facingRight ? 0.3 : -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(screenX + (facingRight ? 30 : 15), this.y + 18, 3, 0, Math.PI * 2);
        ctx.arc(screenX + (facingRight ? 35 : 10), this.y + 22, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Cave Bat Enemy (Level 3)
    drawBat(ctx, screenX) {
        const wingFlap = Math.sin(this.animFrame * 3) * 10;

        // Wings
        ctx.fillStyle = '#4A0080';
        ctx.beginPath();
        // Left wing
        ctx.moveTo(screenX + this.width / 2, this.y + 12);
        ctx.quadraticCurveTo(screenX - 5, this.y + wingFlap, screenX, this.y + 20);
        ctx.lineTo(screenX + this.width / 2, this.y + 15);
        // Right wing
        ctx.moveTo(screenX + this.width / 2, this.y + 12);
        ctx.quadraticCurveTo(screenX + this.width + 5, this.y + wingFlap, screenX + this.width, this.y + 20);
        ctx.lineTo(screenX + this.width / 2, this.y + 15);
        ctx.fill();

        // Body
        ctx.fillStyle = '#800080';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 15, 10, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.fillStyle = '#4A0080';
        ctx.beginPath();
        ctx.moveTo(screenX + 12, this.y + 8);
        ctx.lineTo(screenX + 15, this.y);
        ctx.lineTo(screenX + 18, this.y + 8);
        ctx.moveTo(screenX + 22, this.y + 8);
        ctx.lineTo(screenX + 25, this.y);
        ctx.lineTo(screenX + 28, this.y + 8);
        ctx.fill();

        // Eyes (glowing)
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(screenX + 16, this.y + 12, 3, 0, Math.PI * 2);
        ctx.arc(screenX + 24, this.y + 12, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Sky Cloud Enemy (Level 4)
    drawCloudEnemy(ctx, screenX) {
        const bounce = Math.sin(this.animFrame) * 3;

        // Angry cloud body
        ctx.fillStyle = '#708090';
        ctx.beginPath();
        ctx.arc(screenX + 10, this.y + 20 + bounce, 12, 0, Math.PI * 2);
        ctx.arc(screenX + 20, this.y + 15 + bounce, 14, 0, Math.PI * 2);
        ctx.arc(screenX + 30, this.y + 20 + bounce, 12, 0, Math.PI * 2);
        ctx.fill();

        // Angry eyes
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(screenX + 14, this.y + 18 + bounce, 4, 0, Math.PI * 2);
        ctx.arc(screenX + 26, this.y + 18 + bounce, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        const eyeDir = this.velX > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.arc(screenX + 14 + eyeDir, this.y + 18 + bounce, 2, 0, Math.PI * 2);
        ctx.arc(screenX + 26 + eyeDir, this.y + 18 + bounce, 2, 0, Math.PI * 2);
        ctx.fill();

        // Lightning bolt underneath
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.moveTo(screenX + 20, this.y + 28 + bounce);
        ctx.lineTo(screenX + 15, this.y + 35 + bounce);
        ctx.lineTo(screenX + 20, this.y + 33 + bounce);
        ctx.lineTo(screenX + 18, this.y + 42 + bounce);
        ctx.lineTo(screenX + 25, this.y + 32 + bounce);
        ctx.lineTo(screenX + 22, this.y + 32 + bounce);
        ctx.closePath();
        ctx.fill();
    }

    // Volcano Fire Slime Enemy (Level 5)
    drawFireSlime(ctx, screenX) {
        const wobble = Math.sin(this.animFrame * 2) * 2;

        // Glowing aura
        ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 25, 25 + wobble, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main body
        const gradient = ctx.createRadialGradient(
            screenX + this.width / 2, this.y + 20, 5,
            screenX + this.width / 2, this.y + 25, 20
        );
        gradient.addColorStop(0, '#FFFF00');
        gradient.addColorStop(0.5, '#FF6600');
        gradient.addColorStop(1, '#CC0000');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 25 + wobble, 18, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flame particles on top
        ctx.fillStyle = '#FF4500';
        for (let i = 0; i < 3; i++) {
            const flameY = Math.sin(this.animFrame * 3 + i) * 5;
            ctx.beginPath();
            ctx.moveTo(screenX + 12 + i * 8, this.y + 15);
            ctx.lineTo(screenX + 15 + i * 8, this.y + 5 + flameY);
            ctx.lineTo(screenX + 18 + i * 8, this.y + 15);
            ctx.fill();
        }

        // Eyes
        ctx.fillStyle = '#000';
        const eyeDir = this.velX > 0 ? 2 : -2;
        ctx.beginPath();
        ctx.arc(screenX + 14 + eyeDir, this.y + 22, 3, 0, Math.PI * 2);
        ctx.arc(screenX + 26 + eyeDir, this.y + 22, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Default enemy (fallback)
    drawDefault(ctx, screenX) {
        let bodyColor = '#DC143C';
        if (game.theme === 'cave') bodyColor = '#8B008B';
        else if (game.theme === 'volcano') bodyColor = '#FF4500';
        else if (game.theme === 'sky') bodyColor = '#4169E1';
        else if (game.theme === 'desert') bodyColor = '#D2691E';

        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + this.height - 10, this.width / 2, this.height / 2, 0, Math.PI, 0);
        ctx.fill();

        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(screenX + 10, this.y + 15, 6, 0, Math.PI * 2);
        ctx.arc(screenX + this.width - 10, this.y + 15, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        const eyeDir = this.velX > 0 ? 2 : -2;
        ctx.beginPath();
        ctx.arc(screenX + 10 + eyeDir, this.y + 15, 3, 0, Math.PI * 2);
        ctx.arc(screenX + this.width - 10 + eyeDir, this.y + 15, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Boss Class
class Boss {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.alive = true;
        this.health = 3; // Bosses need 3 hits
        this.maxHealth = 3;
        this.animFrame = 0;
        this.invulnerable = 0;
        this.phase = 1;
        this.velX = 0;
        this.velY = 0;

        // Set size based on type
        switch(type) {
            case 'worm':
                this.width = 120;
                this.height = 60;
                this.velX = 1.5;
                break;
            case 'giant_cactus':
                this.width = 80;
                this.height = 150;
                this.velX = 1;
                break;
            case 'crystal_golem':
                this.width = 100;
                this.height = 100;
                this.velX = 1;
                break;
            case 'thunder_cloud':
                this.width = 150;
                this.height = 80;
                this.velX = 2;
                break;
            case 'lava_dragon':
                this.width = 150;
                this.height = 100;
                this.velX = 1.5;
                break;
            default:
                this.width = 100;
                this.height = 80;
        }

        this.startX = x;
        this.direction = 1;
    }

    update() {
        if (!this.alive) return;

        this.animFrame += 0.05;

        if (this.invulnerable > 0) {
            this.invulnerable--;
        }

        // Basic patrol movement
        this.x += this.velX * this.direction;

        // Reverse at boundaries
        if (this.x <= this.startX - 100 || this.x >= this.startX + 100) {
            this.direction *= -1;
        }

        // Phase-based behavior changes
        if (this.health <= this.maxHealth / 2 && this.phase === 1) {
            this.phase = 2;
            this.velX *= 1.5; // Speed up when damaged
        }
    }

    takeDamage() {
        if (this.invulnerable > 0) return false;

        this.health--;
        this.invulnerable = 60; // 1 second of invulnerability

        if (this.health <= 0) {
            this.alive = false;
            game.score += 500;
            updateUI();
            return true;
        }

        game.score += 100;
        updateUI();
        return false;
    }

    draw(ctx) {
        if (!this.alive) return;

        const screenX = this.x - game.cameraX;
        if (screenX + this.width < -50 || screenX > CONFIG.WIDTH + 50) return;

        // Flash when invulnerable
        if (this.invulnerable > 0 && Math.floor(this.invulnerable / 5) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        switch(this.type) {
            case 'worm':
                this.drawWorm(ctx, screenX);
                break;
            case 'giant_cactus':
                this.drawGiantCactus(ctx, screenX);
                break;
            case 'crystal_golem':
                this.drawCrystalGolem(ctx, screenX);
                break;
            case 'thunder_cloud':
                this.drawThunderCloud(ctx, screenX);
                break;
            case 'lava_dragon':
                this.drawLavaDragon(ctx, screenX);
                break;
        }

        ctx.globalAlpha = 1;

        // Draw health bar
        this.drawHealthBar(ctx, screenX);
    }

    drawHealthBar(ctx, screenX) {
        const barWidth = this.width;
        const barHeight = 8;
        const barY = this.y - 20;

        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(screenX, barY, barWidth, barHeight);

        // Health
        const healthPercent = this.health / this.maxHealth;
        ctx.fillStyle = healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000';
        ctx.fillRect(screenX, barY, barWidth * healthPercent, barHeight);

        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, barY, barWidth, barHeight);
    }

    // Giant Worm Boss (Level 1)
    drawWorm(ctx, screenX) {
        const segments = 5;
        const segmentWidth = 25;
        const waveOffset = Math.sin(this.animFrame * 2);
        const facingRight = this.direction > 0;

        // Draw segments from tail to head
        for (let i = segments - 1; i >= 0; i--) {
            // Flip segment positions based on direction
            const segX = facingRight
                ? screenX + i * 20
                : screenX + this.width - (i * 20) - segmentWidth;
            const segY = this.y + Math.sin(this.animFrame * 2 + i * 0.5) * 8;
            const size = 12 + (segments - i) * 3;

            // Segment body
            ctx.fillStyle = i === 0 ? '#8B4513' : '#A0522D';
            ctx.beginPath();
            ctx.ellipse(segX + segmentWidth / 2, segY + 30, size, size * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();

            // Segment texture
            ctx.fillStyle = '#6B3510';
            ctx.beginPath();
            ctx.arc(segX + segmentWidth / 2, segY + 30, size * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Head position based on direction
        const headX = facingRight
            ? screenX + this.width - 30
            : screenX + 30;
        const headY = this.y + waveOffset * 5;

        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(headX, headY + 30, 25, 20, facingRight ? 0.3 : -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Angry eyes - flip position based on direction
        const eyeOffsetX = facingRight ? 10 : -10;
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(headX + eyeOffsetX, headY + 22, 6, 0, Math.PI * 2);
        ctx.arc(headX + eyeOffsetX, headY + 38, 6, 0, Math.PI * 2);
        ctx.fill();

        const pupilOffsetX = facingRight ? 12 : -12;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(headX + pupilOffsetX, headY + 22, 3, 0, Math.PI * 2);
        ctx.arc(headX + pupilOffsetX, headY + 38, 3, 0, Math.PI * 2);
        ctx.fill();

        // Mouth/mandibles - flip based on direction
        ctx.fillStyle = '#4A2500';
        ctx.beginPath();
        if (facingRight) {
            ctx.moveTo(headX + 20, headY + 25);
            ctx.lineTo(headX + 35, headY + 30);
            ctx.lineTo(headX + 20, headY + 35);
        } else {
            ctx.moveTo(headX - 20, headY + 25);
            ctx.lineTo(headX - 35, headY + 30);
            ctx.lineTo(headX - 20, headY + 35);
        }
        ctx.fill();
    }

    // Giant Cactus Boss (Level 2)
    drawGiantCactus(ctx, screenX) {
        const sway = Math.sin(this.animFrame) * 3;

        // Main body
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.roundRect(screenX + 20 + sway, this.y + 30, 40, 120, 15);
        ctx.fill();

        // Left arm
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.roundRect(screenX - 10 + sway, this.y + 50, 35, 20, 10);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(screenX - 10 + sway, this.y + 30, 20, 40, 10);
        ctx.fill();

        // Right arm
        ctx.beginPath();
        ctx.roundRect(screenX + 55 + sway, this.y + 70, 35, 20, 10);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(screenX + 70 + sway, this.y + 50, 20, 40, 10);
        ctx.fill();

        // Spines
        ctx.strokeStyle = '#006400';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const spineY = this.y + 40 + i * 12;
            ctx.beginPath();
            ctx.moveTo(screenX + 20 + sway, spineY);
            ctx.lineTo(screenX + 10 + sway, spineY - 5);
            ctx.moveTo(screenX + 60 + sway, spineY);
            ctx.lineTo(screenX + 70 + sway, spineY - 5);
            ctx.stroke();
        }

        // Angry face
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(screenX + 30 + sway, this.y + 60, 5, 0, Math.PI * 2);
        ctx.arc(screenX + 50 + sway, this.y + 60, 5, 0, Math.PI * 2);
        ctx.fill();

        // Angry eyebrows
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screenX + 22 + sway, this.y + 50);
        ctx.lineTo(screenX + 35 + sway, this.y + 55);
        ctx.moveTo(screenX + 58 + sway, this.y + 50);
        ctx.lineTo(screenX + 45 + sway, this.y + 55);
        ctx.stroke();

        // Mouth
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.arc(screenX + 40 + sway, this.y + 80, 12, 0, Math.PI);
        ctx.fill();

        // Flower on top (gets angrier with less health)
        if (this.health > 1) {
            ctx.fillStyle = '#FF69B4';
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                ctx.beginPath();
                ctx.ellipse(
                    screenX + 40 + sway + Math.cos(angle) * 12,
                    this.y + 20 + Math.sin(angle) * 12,
                    8, 6, angle, 0, Math.PI * 2
                );
                ctx.fill();
            }
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(screenX + 40 + sway, this.y + 20, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Crystal Golem Boss (Level 3)
    drawCrystalGolem(ctx, screenX) {
        const pulse = Math.sin(this.animFrame * 2) * 0.1 + 1;

        // Glowing aura
        ctx.fillStyle = 'rgba(148, 0, 211, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX + 50, this.y + 50, 60 * pulse, 50 * pulse, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (crystal formation)
        ctx.fillStyle = '#9932CC';
        ctx.beginPath();
        ctx.moveTo(screenX + 50, this.y);
        ctx.lineTo(screenX + 90, this.y + 40);
        ctx.lineTo(screenX + 80, this.y + 100);
        ctx.lineTo(screenX + 20, this.y + 100);
        ctx.lineTo(screenX + 10, this.y + 40);
        ctx.closePath();
        ctx.fill();

        // Crystal highlights
        ctx.fillStyle = '#DA70D6';
        ctx.beginPath();
        ctx.moveTo(screenX + 50, this.y + 10);
        ctx.lineTo(screenX + 70, this.y + 45);
        ctx.lineTo(screenX + 50, this.y + 60);
        ctx.lineTo(screenX + 30, this.y + 45);
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#FF00FF';
        ctx.beginPath();
        ctx.arc(screenX + 35, this.y + 50, 8, 0, Math.PI * 2);
        ctx.arc(screenX + 65, this.y + 50, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(screenX + 35, this.y + 50, 4, 0, Math.PI * 2);
        ctx.arc(screenX + 65, this.y + 50, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Thunder Cloud Boss (Level 4)
    drawThunderCloud(ctx, screenX) {
        const rumble = Math.sin(this.animFrame * 5) * 2;

        // Dark storm cloud
        ctx.fillStyle = '#2F4F4F';
        ctx.beginPath();
        ctx.arc(screenX + 30, this.y + 40 + rumble, 30, 0, Math.PI * 2);
        ctx.arc(screenX + 75, this.y + 35 + rumble, 35, 0, Math.PI * 2);
        ctx.arc(screenX + 120, this.y + 40 + rumble, 30, 0, Math.PI * 2);
        ctx.arc(screenX + 50, this.y + 55 + rumble, 25, 0, Math.PI * 2);
        ctx.arc(screenX + 100, this.y + 55 + rumble, 25, 0, Math.PI * 2);
        ctx.fill();

        // Angry face
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(screenX + 55, this.y + 40 + rumble, 8, 0, Math.PI * 2);
        ctx.arc(screenX + 95, this.y + 40 + rumble, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(screenX + 55, this.y + 40 + rumble, 4, 0, Math.PI * 2);
        ctx.arc(screenX + 95, this.y + 40 + rumble, 4, 0, Math.PI * 2);
        ctx.fill();

        // Lightning bolts
        ctx.fillStyle = '#FFFF00';
        const bolt1X = screenX + 40 + Math.sin(this.animFrame * 3) * 10;
        const bolt2X = screenX + 110 + Math.sin(this.animFrame * 3 + 1) * 10;

        // Bolt 1
        ctx.beginPath();
        ctx.moveTo(bolt1X, this.y + 65);
        ctx.lineTo(bolt1X - 10, this.y + 90);
        ctx.lineTo(bolt1X, this.y + 85);
        ctx.lineTo(bolt1X - 5, this.y + 110);
        ctx.lineTo(bolt1X + 5, this.y + 90);
        ctx.lineTo(bolt1X + 3, this.y + 92);
        ctx.closePath();
        ctx.fill();

        // Bolt 2
        ctx.beginPath();
        ctx.moveTo(bolt2X, this.y + 65);
        ctx.lineTo(bolt2X + 10, this.y + 90);
        ctx.lineTo(bolt2X, this.y + 85);
        ctx.lineTo(bolt2X + 5, this.y + 110);
        ctx.lineTo(bolt2X - 5, this.y + 90);
        ctx.lineTo(bolt2X - 3, this.y + 92);
        ctx.closePath();
        ctx.fill();
    }

    // Lava Dragon Boss (Level 5)
    drawLavaDragon(ctx, screenX) {
        const breathe = Math.sin(this.animFrame) * 3;
        const facingRight = this.direction > 0;

        // Glowing effect
        ctx.fillStyle = 'rgba(255, 69, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(screenX + 75, this.y + 50, 80, 60, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        const gradient = ctx.createRadialGradient(
            screenX + 75, this.y + 50, 10,
            screenX + 75, this.y + 50, 60
        );
        gradient.addColorStop(0, '#FFFF00');
        gradient.addColorStop(0.5, '#FF4500');
        gradient.addColorStop(1, '#8B0000');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(screenX + 75, this.y + 55 + breathe, 50, 35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        const headX = facingRight ? screenX + 120 : screenX + 30;
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.ellipse(headX, this.y + 40 + breathe, 25, 20, facingRight ? 0.3 : -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Horns
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.moveTo(headX - 15, this.y + 25 + breathe);
        ctx.lineTo(headX - 20, this.y + 5 + breathe);
        ctx.lineTo(headX - 5, this.y + 30 + breathe);
        ctx.moveTo(headX + 15, this.y + 25 + breathe);
        ctx.lineTo(headX + 20, this.y + 5 + breathe);
        ctx.lineTo(headX + 5, this.y + 30 + breathe);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#FFFF00';
        ctx.beginPath();
        ctx.arc(headX - 8, this.y + 35 + breathe, 6, 0, Math.PI * 2);
        ctx.arc(headX + 8, this.y + 35 + breathe, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(headX - 8, this.y + 35 + breathe, 3, 0, Math.PI * 2);
        ctx.arc(headX + 8, this.y + 35 + breathe, 3, 0, Math.PI * 2);
        ctx.fill();

        // Fire breath (phase 2)
        if (this.phase >= 2 && Math.sin(this.animFrame * 3) > 0) {
            ctx.fillStyle = 'rgba(255, 100, 0, 0.7)';
            const breathX = facingRight ? headX + 20 : headX - 20;
            ctx.beginPath();
            ctx.moveTo(breathX, this.y + 45 + breathe);
            ctx.lineTo(breathX + (facingRight ? 50 : -50), this.y + 35 + breathe);
            ctx.lineTo(breathX + (facingRight ? 40 : -40), this.y + 50 + breathe);
            ctx.lineTo(breathX + (facingRight ? 55 : -55), this.y + 55 + breathe);
            ctx.lineTo(breathX, this.y + 50 + breathe);
            ctx.fill();
        }

        // Tail
        ctx.fillStyle = '#FF4500';
        const tailX = facingRight ? screenX + 10 : screenX + 140;
        ctx.beginPath();
        ctx.moveTo(screenX + 25, this.y + 60 + breathe);
        for (let i = 0; i < 4; i++) {
            const tx = tailX + (facingRight ? -1 : 1) * i * 12;
            const ty = this.y + 50 + breathe + Math.sin(this.animFrame * 2 + i) * 8;
            ctx.lineTo(tx, ty);
        }
        ctx.lineTo(tailX + (facingRight ? -1 : 1) * 30, this.y + 45 + breathe);
        ctx.fill();

        // Wings
        ctx.fillStyle = '#CC0000';
        const wingFlap = Math.sin(this.animFrame * 2) * 15;
        ctx.beginPath();
        ctx.moveTo(screenX + 60, this.y + 40 + breathe);
        ctx.quadraticCurveTo(screenX + 40, this.y - 10 + wingFlap, screenX + 20, this.y + 20 + breathe);
        ctx.lineTo(screenX + 50, this.y + 45 + breathe);
        ctx.moveTo(screenX + 90, this.y + 40 + breathe);
        ctx.quadraticCurveTo(screenX + 110, this.y - 10 + wingFlap, screenX + 130, this.y + 20 + breathe);
        ctx.lineTo(screenX + 100, this.y + 45 + breathe);
        ctx.fill();
    }
}

// Obstacle Class (for cacti, ruins, etc.)
class Obstacle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;

        switch(type) {
            case 'cactus':
                this.width = 30;
                this.height = 50;
                break;
            case 'ruins':
                this.width = 60;
                this.height = 40;
                break;
            case 'stalagmite':
                this.width = 25;
                this.height = 45;
                break;
            case 'lava_rock':
                this.width = 40;
                this.height = 35;
                break;
            default:
                this.width = 30;
                this.height = 30;
        }
    }

    draw(ctx) {
        const screenX = this.x - game.cameraX;
        if (screenX + this.width < 0 || screenX > CONFIG.WIDTH) return;

        switch(this.type) {
            case 'cactus':
                this.drawCactus(ctx, screenX);
                break;
            case 'ruins':
                this.drawRuins(ctx, screenX);
                break;
            case 'stalagmite':
                this.drawStalagmite(ctx, screenX);
                break;
            case 'lava_rock':
                this.drawLavaRock(ctx, screenX);
                break;
        }
    }

    drawCactus(ctx, screenX) {
        // Main body
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.roundRect(screenX + 8, this.y, 14, this.height, 5);
        ctx.fill();

        // Arms
        ctx.beginPath();
        ctx.roundRect(screenX, this.y + 15, 12, 8, 4);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(screenX, this.y + 5, 8, 18, 4);
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(screenX + 18, this.y + 25, 12, 8, 4);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(screenX + 22, this.y + 18, 8, 15, 4);
        ctx.fill();

        // Spines
        ctx.strokeStyle = '#006400';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(screenX + 8, this.y + 5 + i * 10);
            ctx.lineTo(screenX + 3, this.y + 3 + i * 10);
            ctx.moveTo(screenX + 22, this.y + 5 + i * 10);
            ctx.lineTo(screenX + 27, this.y + 3 + i * 10);
            ctx.stroke();
        }
    }

    drawRuins(ctx, screenX) {
        // Stone blocks
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(screenX, this.y + 20, 25, 20);
        ctx.fillRect(screenX + 35, this.y + 15, 25, 25);
        ctx.fillRect(screenX + 15, this.y + 10, 30, 15);

        // Cracks and texture
        ctx.strokeStyle = '#6B3510';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screenX + 10, this.y + 20);
        ctx.lineTo(screenX + 15, this.y + 35);
        ctx.moveTo(screenX + 45, this.y + 15);
        ctx.lineTo(screenX + 50, this.y + 30);
        ctx.stroke();

        // Hieroglyphics
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(screenX + 5, this.y + 25, 4, 4);
        ctx.fillRect(screenX + 40, this.y + 22, 4, 4);
    }

    drawStalagmite(ctx, screenX) {
        ctx.fillStyle = '#4A4A4A';
        ctx.beginPath();
        ctx.moveTo(screenX, this.y + this.height);
        ctx.lineTo(screenX + this.width / 2, this.y);
        ctx.lineTo(screenX + this.width, this.y + this.height);
        ctx.closePath();
        ctx.fill();

        // Highlight
        ctx.fillStyle = '#6A6A6A';
        ctx.beginPath();
        ctx.moveTo(screenX + 5, this.y + this.height);
        ctx.lineTo(screenX + this.width / 2, this.y + 5);
        ctx.lineTo(screenX + this.width / 2, this.y + this.height);
        ctx.closePath();
        ctx.fill();
    }

    drawLavaRock(ctx, screenX) {
        // Dark rock
        ctx.fillStyle = '#2F2F2F';
        ctx.beginPath();
        ctx.moveTo(screenX + 5, this.y + this.height);
        ctx.lineTo(screenX, this.y + 20);
        ctx.lineTo(screenX + 10, this.y + 5);
        ctx.lineTo(screenX + 25, this.y);
        ctx.lineTo(screenX + 35, this.y + 10);
        ctx.lineTo(screenX + this.width, this.y + 25);
        ctx.lineTo(screenX + this.width - 5, this.y + this.height);
        ctx.closePath();
        ctx.fill();

        // Glowing cracks
        ctx.strokeStyle = '#FF4500';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX + 15, this.y + 10);
        ctx.lineTo(screenX + 20, this.y + 25);
        ctx.lineTo(screenX + 25, this.y + this.height);
        ctx.stroke();
    }
}

// Goal Flag Class
class Goal {
    constructor(x) {
        this.x = x;
        this.y = 450;
        this.width = 50;
        this.height = 100;
        this.flagWave = 0;
    }

    update() {
        this.flagWave += 0.1;
    }

    draw(ctx) {
        const screenX = this.x - game.cameraX;
        if (screenX + this.width < 0 || screenX > CONFIG.WIDTH) return;

        ctx.fillStyle = '#8B4513';
        ctx.fillRect(screenX + 5, this.y, 8, this.height);

        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(screenX + 9, this.y, 8, 0, Math.PI * 2);
        ctx.fill();

        const waveOffset = Math.sin(this.flagWave) * 3;
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.moveTo(screenX + 13, this.y + 5);
        ctx.lineTo(screenX + 55 + waveOffset, this.y + 25);
        ctx.lineTo(screenX + 13, this.y + 45);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('★', screenX + 32 + waveOffset / 2, this.y + 30);
    }
}

// Particle Class
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.velX = (Math.random() - 0.5) * 8;
        this.velY = (Math.random() - 0.5) * 8 - 3;
        this.life = 1;
        this.color = color;
        this.size = Math.random() * 6 + 3;
    }

    update() {
        this.x += this.velX;
        this.y += this.velY;
        this.velY += 0.2;
        this.life -= 0.03;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const screenX = this.x - game.cameraX;
        const radius = Math.max(0.1, this.size * this.life);
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(screenX, this.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function createParticles(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        game.particles.push(new Particle(x, y, color));
    }
}

// Reset enemies and boss when player respawns
function resetEnemies() {
    const levelData = LEVELS[game.level - 1];

    // Reset enemies
    game.enemies = [];
    const enemyType = levelData.enemyType || 'default';
    for (let e of levelData.enemies) {
        game.enemies.push(new Enemy(e.x, e.y, e.left, e.right, enemyType));
    }

    // Reset boss
    if (levelData.boss) {
        game.boss = new Boss(levelData.boss.x, levelData.boss.y, levelData.boss.type);
        game.bossDefeated = false;
    }
}

// Level Generation
function generateLevel(levelNum) {
    const levelData = LEVELS[levelNum - 1];
    game.levelWidth = levelData.width;
    game.theme = levelData.theme;

    game.platforms = [];
    game.movingPlatforms = [];
    game.coins = [];
    game.enemies = [];
    game.obstacles = [];
    game.boss = null;
    game.bossDefeated = false;

    // Create static platforms
    for (let p of levelData.platforms) {
        game.platforms.push(new Platform(p.x, p.y, p.w, p.h, p.type));
    }

    // Create moving platforms
    if (levelData.movingPlatforms) {
        for (let p of levelData.movingPlatforms) {
            game.movingPlatforms.push(new MovingPlatform(p.x, p.y, p.w, p.h, p.type, p.moveX, p.moveY, p.speed));
        }
    }

    // Create coins
    for (let c of levelData.coins) {
        game.coins.push(new Coin(c.x, c.y));
    }

    // Create enemies with level-specific type
    const enemyType = levelData.enemyType || 'default';
    for (let e of levelData.enemies) {
        game.enemies.push(new Enemy(e.x, e.y, e.left, e.right, enemyType));
    }

    // Create obstacles
    if (levelData.obstacles) {
        for (let o of levelData.obstacles) {
            game.obstacles.push(new Obstacle(o.x, o.y, o.type));
        }
    }

    // Create boss
    if (levelData.boss) {
        game.boss = new Boss(levelData.boss.x, levelData.boss.y, levelData.boss.type);
    }

    // Create goal
    game.goal = new Goal(levelData.goalX);

    // Initialize timer and coin tracking
    game.levelStartTime = Date.now();
    game.levelTime = 0;
    game.coinsCollected = 0;
    game.totalCoins = game.coins.length;
}

// Camera
function updateCamera() {
    const targetX = game.player.x - CONFIG.WIDTH / 3;
    game.cameraX += (targetX - game.cameraX) * 0.1;

    if (game.cameraX < 0) game.cameraX = 0;
    if (game.cameraX > game.levelWidth - CONFIG.WIDTH) {
        game.cameraX = game.levelWidth - CONFIG.WIDTH;
    }
}

// Draw Background based on theme
function drawBackground(ctx) {
    const themeData = THEMES[game.theme];

    // Draw sky gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
    gradient.addColorStop(0, themeData.sky[0]);
    gradient.addColorStop(1, themeData.sky[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    // Draw clouds (if theme has them)
    if (themeData.clouds) {
        ctx.fillStyle = themeData.clouds;
        const cloudOffset = -game.cameraX * 0.3;
        for (let i = 0; i < 10; i++) {
            const x = (i * 400 + cloudOffset) % (CONFIG.WIDTH + 200) - 100;
            const y = 50 + (i % 3) * 40;

            ctx.beginPath();
            ctx.arc(x, y, 30, 0, Math.PI * 2);
            ctx.arc(x + 25, y - 10, 25, 0, Math.PI * 2);
            ctx.arc(x + 50, y, 30, 0, Math.PI * 2);
            ctx.arc(x + 25, y + 10, 20, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw hills (if theme has them)
    if (themeData.hills) {
        ctx.fillStyle = themeData.hills;
        const hillOffset = -game.cameraX * 0.5;
        for (let i = 0; i < 15; i++) {
            const x = (i * 300 + hillOffset) % (CONFIG.WIDTH + 300) - 150;
            ctx.beginPath();
            ctx.ellipse(x, CONFIG.HEIGHT - 50, 150, 80, 0, Math.PI, 0);
            ctx.fill();
        }
    }

    // Theme-specific decorations
    if (game.theme === 'cave') {
        // Stalactites
        ctx.fillStyle = '#3D3D3D';
        for (let i = 0; i < 20; i++) {
            const x = (i * 150 - game.cameraX * 0.2) % (CONFIG.WIDTH + 100) - 50;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + 15, 40 + (i % 3) * 20);
            ctx.lineTo(x + 30, 0);
            ctx.fill();
        }
        // Glowing crystals
        ctx.fillStyle = 'rgba(153, 50, 204, 0.3)';
        for (let i = 0; i < 8; i++) {
            const x = (i * 200 - game.cameraX * 0.1) % (CONFIG.WIDTH + 100);
            ctx.beginPath();
            ctx.arc(x, 100 + (i % 4) * 50, 20 + Math.sin(Date.now() / 500 + i) * 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (game.theme === 'volcano') {
        // Lava pools at bottom
        ctx.fillStyle = '#FF4500';
        for (let i = 0; i < 10; i++) {
            const x = (i * 300 - game.cameraX * 0.4) % (CONFIG.WIDTH + 200) - 100;
            const bubbleY = Math.sin(Date.now() / 300 + i) * 5;
            ctx.beginPath();
            ctx.ellipse(x, CONFIG.HEIGHT - 20 + bubbleY, 80, 20, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        // Ash particles
        ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
        for (let i = 0; i < 30; i++) {
            const x = (i * 80 + Date.now() / 50) % CONFIG.WIDTH;
            const y = (i * 50 + Date.now() / 30) % CONFIG.HEIGHT;
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    if (game.theme === 'desert') {
        // Cacti in background
        ctx.fillStyle = '#228B22';
        const cactusOffset = -game.cameraX * 0.4;
        for (let i = 0; i < 8; i++) {
            const x = (i * 350 + cactusOffset) % (CONFIG.WIDTH + 300) - 100;
            // Main body
            ctx.fillRect(x, CONFIG.HEIGHT - 150, 20, 100);
            // Arms
            ctx.fillRect(x - 15, CONFIG.HEIGHT - 120, 15, 10);
            ctx.fillRect(x - 15, CONFIG.HEIGHT - 120, 10, 30);
            ctx.fillRect(x + 20, CONFIG.HEIGHT - 100, 15, 10);
            ctx.fillRect(x + 25, CONFIG.HEIGHT - 100, 10, 25);
        }
    }

    if (game.theme === 'sky') {
        // Floating islands in background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        const islandOffset = -game.cameraX * 0.2;
        for (let i = 0; i < 6; i++) {
            const x = (i * 400 + islandOffset) % (CONFIG.WIDTH + 300) - 100;
            const y = 400 + (i % 3) * 50;
            ctx.beginPath();
            ctx.ellipse(x, y, 60, 25, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        // Birds
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const x = (i * 200 + Date.now() / 20) % (CONFIG.WIDTH + 100);
            const y = 80 + (i % 3) * 30;
            const wingFlap = Math.sin(Date.now() / 100 + i) * 5;
            ctx.beginPath();
            ctx.moveTo(x - 10, y + wingFlap);
            ctx.lineTo(x, y);
            ctx.lineTo(x + 10, y + wingFlap);
            ctx.stroke();
        }
    }
}

// UI Update
function updateUI() {
    document.getElementById('score-value').textContent = game.score;
    document.getElementById('lives-value').textContent = game.lives;
    document.getElementById('level-value').textContent = game.level;
    document.getElementById('coins-value').textContent = `${game.coinsCollected}/${game.totalCoins}`;
}

// Update timer display
function updateTimer() {
    if (game.running && game.levelStartTime > 0) {
        const elapsed = Math.floor((Date.now() - game.levelStartTime) / 1000);
        document.getElementById('timer-value').textContent = formatTime(elapsed);
    }
}

// Level Complete
function levelComplete() {
    game.running = false;

    // Calculate time taken
    const timeTaken = Math.floor((Date.now() - game.levelStartTime) / 1000);
    game.levelTime = timeTaken;

    // Time bonus: max 500 points, decreases with time (5 points per second lost, min 0)
    const maxTimeBonus = 500;
    const timeBonus = Math.max(0, maxTimeBonus - (timeTaken * 5));

    // Coin bonus: already added during collection (10 per coin)
    // Additional bonus for collecting all coins
    const allCoinsBonus = (game.coinsCollected === game.totalCoins && game.totalCoins > 0) ? 200 : 0;

    // Lives bonus
    const livesBonus = game.lives * 100;

    // Add bonuses to score
    game.score += timeBonus + allCoinsBonus + livesBonus;

    // Calculate earned coins for profile (before guest penalty)
    let baseEarnedCoins = 10 + (game.level * 5); // Base coins per level
    baseEarnedCoins += Math.floor(timeBonus / 50); // Bonus for time
    baseEarnedCoins += game.coinsCollected; // Collected coins count
    if (allCoinsBonus > 0) baseEarnedCoins += 10; // Bonus for all coins

    // Add coins to profile (returns actual amount after guest penalty)
    const actualEarnedCoins = addCoinsToProfile(baseEarnedCoins, game.level);

    updateUI();

    if (game.level >= LEVELS.length) {
        // Game complete - save highscore only at the end
        const bonusCoins = addCoinsToProfile(50, game.level); // Bonus for completing the game
        saveHighscore();
        updateCoinsDisplay();
        document.getElementById('win-score').textContent = game.score;
        document.getElementById('ui').classList.add('hidden');

        // Add guest warning to game complete screen
        const gameCompleteEl = document.getElementById('game-complete');
        const existingWarning = gameCompleteEl.querySelector('.level-guest-warning');
        if (existingWarning) existingWarning.remove();
        if (API.isGuest) {
            const warning = document.createElement('div');
            warning.innerHTML = getGuestWarningHtml('levelEnd');
            gameCompleteEl.insertBefore(warning.firstChild, gameCompleteEl.querySelector('button'));
        }

        gameCompleteEl.classList.remove('hidden');
    } else {
        document.getElementById('completed-level').textContent = game.level;
        document.getElementById('level-score').textContent = game.score;
        document.getElementById('level-time').textContent = formatTime(timeTaken);
        document.getElementById('level-coins').textContent = `${game.coinsCollected}/${game.totalCoins}`;
        document.getElementById('level-time-bonus').textContent = `+${timeBonus}`;
        document.getElementById('level-earned-coins').textContent = actualEarnedCoins;

        // Add guest warning to level complete screen
        const levelCompleteEl = document.getElementById('level-complete');
        const existingWarning = levelCompleteEl.querySelector('.level-guest-warning');
        if (existingWarning) existingWarning.remove();
        if (API.isGuest) {
            const warning = document.createElement('div');
            warning.innerHTML = getGuestWarningHtml('levelEnd');
            levelCompleteEl.insertBefore(warning.firstChild, levelCompleteEl.querySelector('button'));
        }

        levelCompleteEl.classList.remove('hidden');
    }
}

// Format time as MM:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Next Level
function nextLevel() {
    document.getElementById('level-complete').classList.add('hidden');
    game.level++;
    game.cameraX = 0;
    game.particles = [];
    game.obstacles = [];
    game.boss = null;
    game.bossDefeated = false;
    updateUI();

    generateLevel(game.level);
    game.player = new Player(100, 400);
    game.running = true;
    gameLoop();
}

// Game Over
function gameOver() {
    game.running = false;
    saveHighscore();
    updateCoinsDisplay();
    document.getElementById('final-score').textContent = game.score;
    document.getElementById('ui').classList.add('hidden');
    document.getElementById('game-over').classList.remove('hidden');
}

// Game Loop
function gameLoop() {
    if (!game.running) return;

    const ctx = game.ctx;

    // Clear canvas
    ctx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

    // Draw background
    drawBackground(ctx);

    // Update and draw static platforms
    for (let platform of game.platforms) {
        platform.draw(ctx);
    }

    // Update and draw moving platforms
    for (let platform of game.movingPlatforms) {
        platform.update();
        platform.draw(ctx);
    }

    // Update and draw goal
    if (game.goal) {
        game.goal.update();
        game.goal.draw(ctx);
    }

    // Update and draw coins
    for (let coin of game.coins) {
        coin.update();
        coin.draw(ctx);
    }

    // Update and draw enemies
    game.enemies = game.enemies.filter(e => e.alive);
    for (let enemy of game.enemies) {
        enemy.update();
        enemy.draw(ctx);
    }

    // Draw obstacles
    for (let obstacle of game.obstacles) {
        obstacle.draw(ctx);
    }

    // Update and draw boss
    if (game.boss && game.boss.alive) {
        game.boss.update();
        game.boss.draw(ctx);
    }

    // Update and draw player
    game.player.update();
    game.player.draw(ctx);

    // Update camera
    updateCamera();

    // Update and draw particles
    game.particles = game.particles.filter(p => p.life > 0);
    for (let particle of game.particles) {
        particle.update();
        particle.draw(ctx);
    }

    // Update timer display
    updateTimer();

    requestAnimationFrame(gameLoop);
}

// Render shop items
function renderShop() {
    renderSkinsShop();
    renderUpgradesShop();
    updateCoinsDisplay();
}

function renderSkinsShop() {
    const grid = document.getElementById('skins-grid');
    grid.innerHTML = '';

    SHOP.skins.forEach(skin => {
        const owned = game.userProfile.ownedSkins.includes(skin.id);
        const selected = game.userProfile.selectedSkin === skin.id;

        const item = document.createElement('div');
        item.className = `shop-item ${owned ? 'owned' : ''} ${selected ? 'selected' : ''}`;

        item.innerHTML = `
            <div class="item-preview">
                <div class="bear-preview" style="background: ${skin.color};"></div>
            </div>
            <div class="item-name">${skin.name}</div>
            <div class="item-price ${skin.price === 0 ? 'free' : ''}">${skin.price === 0 ? 'Gratis' : skin.price + ' Münzen'}</div>
            ${owned ? (selected ? '<span class="item-status selected">Ausgewählt</span>' : `<button class="select-btn" data-skin="${skin.id}">Auswählen</button>`) : `<button class="buy-btn" data-type="skins" data-id="${skin.id}" ${game.userProfile.totalCoins < skin.price ? 'disabled' : ''}>Kaufen</button>`}
        `;

        grid.appendChild(item);
    });

    // Add event listeners for select buttons
    grid.querySelectorAll('.select-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectSkin(btn.dataset.skin);
            renderSkinsShop();
        });
    });

    // Add event listeners for buy buttons
    grid.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const result = buyShopItem(btn.dataset.type, btn.dataset.id);
            if (result.success) {
                selectSkin(btn.dataset.id);
                updateCoinsDisplay();
                renderShop();
            } else {
                alert(result.message);
            }
        });
    });
}

function renderUpgradesShop() {
    const grid = document.getElementById('upgrades-grid');
    grid.innerHTML = '';

    SHOP.upgrades.forEach(upgrade => {
        const owned = game.userProfile.ownedUpgrades.includes(upgrade.id);
        const locked = upgrade.requires && !game.userProfile.ownedUpgrades.includes(upgrade.requires);

        const item = document.createElement('div');
        item.className = `shop-item ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}`;

        item.innerHTML = `
            <div class="item-preview">
                <div style="font-size: 30px;">${upgrade.type === 'extraLife' ? '❤️' : upgrade.type === 'coinMagnet' ? '🧲' : '💰'}</div>
            </div>
            <div class="item-name">${upgrade.name}</div>
            ${upgrade.description ? `<div class="item-description">${upgrade.description}</div>` : ''}
            <div class="item-price">${upgrade.price} Münzen</div>
            ${owned ? '<span class="item-status owned">Gekauft</span>' : `<button class="buy-btn" data-type="upgrades" data-id="${upgrade.id}" ${locked || game.userProfile.totalCoins < upgrade.price ? 'disabled' : ''}>${locked ? 'Gesperrt' : 'Kaufen'}</button>`}
        `;

        grid.appendChild(item);
    });

    // Add event listeners for buy buttons
    grid.querySelectorAll('.buy-btn').forEach(btn => {
        if (!btn.disabled) {
            btn.addEventListener('click', () => {
                const result = buyShopItem(btn.dataset.type, btn.dataset.id);
                if (result.success) {
                    updateCoinsDisplay();
                    renderShop();
                } else {
                    alert(result.message);
                }
            });
        }
    });
}

function updateCoinsDisplay() {
    document.getElementById('user-coins-display').textContent = game.userProfile.totalCoins;
    document.getElementById('shop-coins-display').textContent = game.userProfile.totalCoins;
}

function openShop() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('shop-screen').classList.remove('hidden');
    renderShop();
}

function closeShop() {
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    updateCoinsDisplay();
}

// Initialize Game
async function init() {
    game.canvas = document.getElementById('gameCanvas');
    game.ctx = game.canvas.getContext('2d');
    game.canvas.width = CONFIG.WIDTH;
    game.canvas.height = CONFIG.HEIGHT;

    // Initialize API and check for existing session
    const hasSession = await API.init();

    if (hasSession) {
        // User is logged in - sync profile from server
        game.userProfile = {
            name: API.user.username,
            totalCoins: API.user.totalCoins,
            ownedSkins: ['default', ...(API.user.purchasedSkins || [])],
            ownedUpgrades: API.user.purchasedUpgrades || [],
            selectedSkin: API.user.selectedSkin || 'default',
            extraLives: calculateExtraLives(API.user.purchasedUpgrades || [])
        };
        game.playerName = API.user.username;
        showStartScreen();
    } else {
        // Show auth screen for new users
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('start-screen').classList.add('hidden');
    }

    // Set up auth form handlers
    setupAuthHandlers();

    // Keyboard handlers
    document.addEventListener('keydown', (e) => {
        game.keys[e.code] = true;
        if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        game.keys[e.code] = false;
    });

    // Game buttons
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', () => { showStartScreen(); });
    document.getElementById('next-level-btn').addEventListener('click', nextLevel);
    document.getElementById('play-again-btn').addEventListener('click', () => { showStartScreen(); });

    // Shop buttons
    document.getElementById('shop-btn').addEventListener('click', openShop);
    document.getElementById('shop-close-btn').addEventListener('click', closeShop);

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', () => {
        API.logout();
        showAuthScreen();
    });

    // Update coins display when player name changes (for guests)
    document.getElementById('player-name')?.addEventListener('change', (e) => {
        const playerName = e.target.value.trim() || 'Player';
        loadUserProfile(playerName);
        updateCoinsDisplay();
    });

    // Shop tabs
    document.querySelectorAll('.shop-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + '-tab').classList.add('active');
        });
    });
}

function calculateExtraLives(upgrades) {
    let extra = 0;
    if (upgrades.includes('extra_life_1')) extra += 1;
    if (upgrades.includes('extra_life_2')) extra += 2;
    return extra;
}

function setupAuthHandlers() {
    // Login form
    document.getElementById('login-btn')?.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorEl = document.getElementById('login-error');

        if (!email || !password) {
            errorEl.textContent = 'Bitte alle Felder ausfullen';
            return;
        }

        const result = await API.login(email, password);
        if (result.ok) {
            game.userProfile = {
                name: result.data.user.username,
                totalCoins: result.data.user.totalCoins,
                ownedSkins: ['default', ...(result.data.user.purchasedSkins || [])],
                ownedUpgrades: result.data.user.purchasedUpgrades || [],
                selectedSkin: result.data.user.selectedSkin || 'default',
                extraLives: calculateExtraLives(result.data.user.purchasedUpgrades || [])
            };
            game.playerName = result.data.user.username;
            showStartScreen();
        } else {
            errorEl.textContent = result.data.error || 'Login fehlgeschlagen';
        }
    });

    // Register form
    document.getElementById('register-btn')?.addEventListener('click', async () => {
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const errorEl = document.getElementById('register-error');

        if (!username || !email || !password) {
            errorEl.textContent = 'Bitte alle Felder ausfullen';
            return;
        }

        const result = await API.register(username, email, password);
        if (result.ok) {
            game.userProfile = {
                name: result.data.user.username,
                totalCoins: result.data.user.totalCoins,
                ownedSkins: ['default'],
                ownedUpgrades: [],
                selectedSkin: 'default',
                extraLives: 0
            };
            game.playerName = result.data.user.username;

            // Zeige Bestätigungsmeldung
            if (result.data.user.emailVerified) {
                showRegistrationSuccess('Registrierung erfolgreich! Du kannst jetzt spielen.');
            } else {
                showRegistrationSuccess('Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse.');
            }
        } else {
            errorEl.textContent = result.data.error || 'Registrierung fehlgeschlagen';
        }
    });

    // Forgot password
    document.getElementById('forgot-btn')?.addEventListener('click', async () => {
        const email = document.getElementById('forgot-email').value;
        const messageEl = document.getElementById('forgot-message');
        const errorEl = document.getElementById('forgot-error');

        if (!email) {
            errorEl.textContent = 'Bitte E-Mail eingeben';
            return;
        }

        try {
            const response = await API.request('/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email })
            });
            if (response.ok) {
                messageEl.textContent = 'Falls ein Account existiert, wurde eine E-Mail gesendet';
                errorEl.textContent = '';
            }
        } catch (e) {
            errorEl.textContent = 'Fehler beim Senden';
        }
    });

    // Form switching
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('forgot-form').classList.add('hidden');
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('forgot-form').classList.add('hidden');
    });

    document.getElementById('show-forgot')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('forgot-form').classList.remove('hidden');
    });

    document.getElementById('back-to-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('forgot-form').classList.add('hidden');
    });

    // Guest mode
    document.getElementById('guest-btn')?.addEventListener('click', () => {
        API.isGuest = true;
        const lastPlayer = localStorage.getItem('littleBearLastPlayer') || 'Guest';
        loadUserProfile(lastPlayer);
        game.playerName = lastPlayer;
        document.getElementById('player-name').value = lastPlayer;
        showStartScreen();
    });
}

function startGame() {
    // For guests, load profile from input
    if (API.isGuest) {
        const nameInput = document.getElementById('player-name');
        const playerName = nameInput?.value.trim() || 'Guest';
        loadUserProfile(playerName);
        saveUserProfile();
        localStorage.setItem('littleBearLastPlayer', playerName);
    }
    updateCoinsDisplay();

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    document.getElementById('level-complete').classList.add('hidden');
    document.getElementById('game-complete').classList.add('hidden');
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('ui').classList.remove('hidden');

    game.score = 0;
    game.lives = 3 + game.userProfile.extraLives; // Apply extra lives from upgrades
    game.level = 1;
    game.cameraX = 0;
    game.particles = [];
    game.obstacles = [];
    game.boss = null;
    game.bossDefeated = false;
    updateUI();

    // Show guest warning before level starts
    if (API.isGuest) {
        showGuestLevelWarning();
    }

    generateLevel(game.level);
    game.player = new Player(100, 400);
    game.running = true;
    gameLoop();
}

// Show guest warning before level
function showGuestLevelWarning() {
    // Create a temporary overlay warning
    const overlay = document.createElement('div');
    overlay.id = 'guest-level-warning-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    overlay.innerHTML = `
        <div style="text-align: center; color: white; padding: 30px;">
            <h2 style="color: #FFD700; margin-bottom: 20px;">Gast-Modus</h2>
            <div class="guest-coins-warning" style="margin-bottom: 20px;">
                Als Gast bekommst du nur <strong>25%</strong> der Coins!<br><br>
                Registrierte Spieler bekommen <strong>4x mehr Coins</strong><br>
                und erscheinen in der globalen Rangliste!
            </div>
            <button id="continue-guest-btn" style="margin-right: 10px;">Weiter als Gast</button>
            <button id="register-instead-btn" class="shop-button">Jetzt Registrieren</button>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('continue-guest-btn').addEventListener('click', () => {
        overlay.remove();
    });

    document.getElementById('register-instead-btn').addEventListener('click', () => {
        overlay.remove();
        game.running = false;
        document.getElementById('ui').classList.add('hidden');
        showAuthScreen();
    });
}

window.addEventListener('load', init);
