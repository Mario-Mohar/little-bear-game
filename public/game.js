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
        if (this.isGuest || !this.token) {
            console.log('saveHighscore skipped: guest or no token');
            return null;
        }
        try {
            console.log('Saving highscore:', score, 'level:', levelReached);
            const response = await this.request('/highscores', {
                method: 'POST',
                body: JSON.stringify({ score, levelReached })
            });
            if (response.ok) {
                const result = await response.json();
                console.log('Highscore saved successfully:', result);
                return result;
            } else {
                const error = await response.text();
                console.error('Failed to save highscore, status:', response.status, 'error:', error);
            }
        } catch (e) { console.error('Failed to save highscore:', e); }
        return null;
    },

    async getHighscores(limit = 10) {
        try {
            // Add cache buster to prevent stale data
            const cacheBuster = Date.now();
            const response = await this.request('/highscores?limit=' + limit + '&_=' + cacheBuster);
            if (response.ok) {
                return await response.json();
            } else {
                console.error('Failed to get highscores, status:', response.status);
            }
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
    },

    async updateSelectedSkin(skinId) {
        if (this.isGuest || !this.token) return false;
        try {
            const response = await this.request('/users/profile', {
                method: 'PUT',
                body: JSON.stringify({ selectedSkin: skinId })
            });
            if (response.ok && this.user) {
                this.user.selectedSkin = skinId;
            }
            return response.ok;
        } catch (e) { console.error('Failed to update skin:', e); }
        return false;
    }
};

// ============================================
// AUTH UI FUNCTIONS
// ============================================

function showAuthScreen() {
    hideAllScreens();
    document.getElementById('auth-screen').classList.remove('hidden');
    loadGlobalHighscores();
}

function hideAllScreens() {
    const screens = ['auth-screen', 'start-screen', 'game-over', 'level-complete', 'game-complete', 'shop-screen', 'ui'];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

function showStartScreen() {
    hideTouchControls();
    hideAllScreens();
    document.getElementById('start-screen').classList.remove('hidden');
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
    console.log('Loading global highscores...');
    const data = await API.getHighscores(10);
    if (data && data.highscores) {
        console.log('Highscores loaded:', data.highscores.length, 'entries, top score:', data.highscores[0]?.score);
        displayHighscores(data.highscores, 'highscore-entries');
        displayHighscores(data.highscores, 'win-highscore-entries');
        displayHighscores(data.highscores, 'gameover-highscore-entries');
        displayHighscores(data.highscores, 'auth-highscore-entries');
    } else {
        console.error('Failed to load highscores - no data returned');
    }

    // Show user's rank
    if (!API.isGuest) {
        const rankData = await API.getMyRank();
        console.log('User rank data:', rankData);
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

// Mobile Detection
function isMobileDevice() {
    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    );
}

const IS_MOBILE = isMobileDevice();

// Design height for level scaling
const DESIGN_HEIGHT = 600;

// Touch controls height - matches CSS values in style.css + safety buffer
function getTouchControlsHeight() {
    if (!IS_MOBILE) return 0;

    // Must match CSS media queries in style.css for #touch-controls
    // Default: height: 140px + 20px padding = 160px effective
    // @media (max-width: 480px): height: 120px + 20px padding = 140px
    // @media (max-height: 500px) and (orientation: landscape): height: 100px + 20px = 120px
    // Add extra buffer for browser chrome (address bar, etc.)
    const browserBuffer = 20;

    if (window.innerHeight <= 500 && window.matchMedia('(orientation: landscape)').matches) {
        return 100 + browserBuffer;
    } else if (window.innerWidth <= 480) {
        return 120 + browserBuffer;
    }
    return 140 + browserBuffer;
}

let TOUCH_CONTROLS_HEIGHT = getTouchControlsHeight();

// Game Configuration
const CONFIG = {
    WIDTH: window.innerWidth,
    HEIGHT: window.innerHeight,
    // Effective game height excludes touch controls area on mobile
    GAME_HEIGHT: window.innerHeight - (IS_MOBILE ? 140 : 0),
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

// Handle window resize
let lastYOffset = null;

function resizeCanvas() {
    const oldGameHeight = CONFIG.GAME_HEIGHT;
    CONFIG.WIDTH = window.innerWidth;
    CONFIG.HEIGHT = window.innerHeight;
    // Recalculate touch controls height for orientation/size changes
    TOUCH_CONTROLS_HEIGHT = getTouchControlsHeight();
    CONFIG.GAME_HEIGHT = window.innerHeight - TOUCH_CONTROLS_HEIGHT;

    if (game.canvas) {
        game.canvas.width = CONFIG.WIDTH;
        game.canvas.height = CONFIG.HEIGHT;
    }

    // Reposition all game elements when game height changes
    if (game.state === 'playing' && oldGameHeight !== CONFIG.GAME_HEIGHT) {
        const oldYOffset = oldGameHeight - DESIGN_HEIGHT;
        const newYOffset = CONFIG.GAME_HEIGHT - DESIGN_HEIGHT;
        const deltaY = newYOffset - oldYOffset;

        // Reposition player
        if (game.player) {
            game.player.y += deltaY;
        }

        // Reposition static platforms
        for (let p of game.platforms) {
            p.y += deltaY;
        }

        // Reposition moving platforms
        for (let p of game.movingPlatforms) {
            p.y += deltaY;
            p.startY += deltaY;
        }

        // Reposition fading platforms
        for (let p of game.fadingPlatforms) {
            p.y += deltaY;
        }

        // Reposition coins
        for (let c of game.coins) {
            c.y += deltaY;
        }

        // Reposition enemies
        for (let e of game.enemies) {
            e.y += deltaY;
        }

        // Reposition obstacles
        for (let o of game.obstacles) {
            o.y += deltaY;
        }

        // Reposition boss
        if (game.boss) {
            game.boss.y += deltaY;
        }

        // Reposition goal
        if (game.goal) {
            game.goal.y += deltaY;
        }

        // Reposition powerups
        for (let p of game.powerups) {
            p.y += deltaY;
        }

        // Reposition projectiles
        for (let p of game.projectiles) {
            p.y += deltaY;
        }
    }
}

window.addEventListener('resize', resizeCanvas);

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
    },
    // New worlds (Level 6-15)
    beach: {
        sky: ['#87CEEB', '#FFE4B5'],
        hills: '#C2B280',
        clouds: 'rgba(255, 255, 255, 0.9)',
        platformColors: { sand: ['#F4A460', '#DEB887', '#D2B48C'], wood: ['#8B4513', '#A0522D', '#654321'] }
    },
    jungle: {
        sky: ['#228B22', '#90EE90'],
        hills: '#2E8B57',
        clouds: null,
        platformColors: { moss: ['#556B2F', '#6B8E23', '#8B4513'], wood: ['#5D4E37', '#8B7355', '#3D2914'] }
    },
    underwater: {
        sky: ['#006994', '#00CED1'],
        hills: null,
        clouds: null,
        platformColors: { coral: ['#FF7F50', '#FF6347', '#E9967A'], seaweed: ['#20B2AA', '#3CB371', '#2E8B57'] }
    },
    snow: {
        sky: ['#B0E0E6', '#FFFFFF'],
        hills: '#F0F8FF',
        clouds: 'rgba(200, 200, 220, 0.8)',
        platformColors: { ice: ['#E0FFFF', '#B0E0E6', '#87CEEB'], snow: ['#FFFAFA', '#F5F5F5', '#DCDCDC'] }
    },
    swamp: {
        sky: ['#556B2F', '#8FBC8F'],
        hills: '#6B8E23',
        clouds: 'rgba(154, 205, 50, 0.4)',
        platformColors: { mud: ['#5D4E37', '#8B7355', '#6B4423'], moss: ['#556B2F', '#6B8E23', '#808000'] }
    },
    ruins: {
        sky: ['#DEB887', '#F5DEB3'],
        hills: '#D2B48C',
        clouds: 'rgba(245, 222, 179, 0.5)',
        platformColors: { sandstone: ['#D2691E', '#CD853F', '#DEB887'], gold: ['#FFD700', '#DAA520', '#B8860B'] }
    },
    factory: {
        sky: ['#2F4F4F', '#708090'],
        hills: null,
        clouds: 'rgba(105, 105, 105, 0.7)',
        platformColors: { metal: ['#708090', '#778899', '#696969'], conveyor: ['#4A4A4A', '#5A5A5A', '#FFD700'] }
    },
    underground: {
        sky: ['#3D2914', '#5C4033'],
        hills: null,
        clouds: null,
        platformColors: { dirt: ['#8B4513', '#A0522D', '#6B4423'], roots: ['#5D4E37', '#8B7355', '#654321'] }
    },
    candy: {
        sky: ['#FFB6C1', '#FFDAB9'],
        hills: '#FF69B4',
        clouds: 'rgba(255, 255, 255, 0.9)',
        platformColors: { candy: ['#FF69B4', '#FF1493', '#FFB6C1'], chocolate: ['#8B4513', '#D2691E', '#A0522D'] }
    },
    space: {
        sky: ['#000033', '#191970'],
        hills: null,
        clouds: null,
        platformColors: { asteroid: ['#4A4A4A', '#696969', '#808080'], energy: ['#00FFFF', '#00CED1', '#7B68EE'] }
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
            { x: 2000, y: 510, left: 1850, right: 2250 },
            // Gegner auf Plattformen (verschoben um Coin-Überlappung zu vermeiden)
            { x: 250, y: 415, left: 200, right: 300 },
            { x: 920, y: 265, left: 850, right: 950 },
            { x: 2400, y: 265, left: 2350, right: 2470 }
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
            { x: 3350, y: 520, left: 3300, right: 3550 },
            // Gegner auf Plattformen (verschoben um Überlappung zu vermeiden)
            { x: 550, y: 465, left: 400, right: 550 },
            { x: 780, y: 415, left: 650, right: 800 },
            { x: 3050, y: 285, left: 2950, right: 3100 }
        ],
        obstacles: [
            { x: 520, y: 450, type: 'cactus' },
            { x: 700, y: 410, type: 'ruins' },
            { x: 1850, y: 450, type: 'cactus' },
            { x: 2350, y: 510, type: 'ruins' },
            { x: 2300, y: 500, type: 'cactus' }
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
            { x: 2950, y: 500, left: 2800, right: 3150 },
            // Gegner auf Plattformen (angepasste Positionen)
            { x: 550, y: 265, left: 450, right: 600 },
            { x: 1000, y: 315, left: 900, right: 1050 },
            { x: 1700, y: 215, left: 1600, right: 1720 },
            { x: 2500, y: 315, left: 2350, right: 2520 },
            { x: 3500, y: 345, left: 3400, right: 3550 }
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
            { x: 4280, y: 510, left: 4200, right: 4480 },
            // Mehr Gegner auf Plattformen (angepasste Positionen)
            { x: 500, y: 285, left: 450, right: 570 },
            { x: 1100, y: 245, left: 1050, right: 1180 },
            { x: 2100, y: 185, left: 2050, right: 2200 },
            { x: 2950, y: 215, left: 2900, right: 3050 },
            { x: 3450, y: 365, left: 3400, right: 3520 }
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
            { x: 2930, y: 215, left: 2880, right: 3000 },
            // Mehr Gegner auf Plattformen (angepasste Positionen)
            { x: 850, y: 365, left: 750, right: 850 },
            { x: 1250, y: 285, left: 1150, right: 1250 },
            { x: 1950, y: 315, left: 1850, right: 2000 },
            { x: 3200, y: 315, left: 3080, right: 3200 },
            { x: 4400, y: 385, left: 4300, right: 4400 }
        ],
        obstacles: [
            { x: 500, y: 515, type: 'lava_rock' },
            { x: 1500, y: 515, type: 'lava_rock' },
            { x: 2200, y: 515, type: 'lava_rock' },
            { x: 2900, y: 515, type: 'lava_rock' },
            { x: 3500, y: 515, type: 'lava_rock' }
        ],
        fadingPlatforms: [
            { x: 800, y: 350, w: 80, h: 25, type: 'lava', visibleTime: 180, invisibleTime: 50 },
            { x: 2050, y: 300, w: 80, h: 25, type: 'lava', visibleTime: 170, invisibleTime: 55 },
            { x: 3550, y: 280, w: 80, h: 25, type: 'lava', visibleTime: 160, invisibleTime: 60 }
        ],
        boss: { x: 4900, y: 450, type: 'lava_dragon' },
        goalX: 5100
    },
    // Level 6 - Beach - Crab enemies + Octopus Boss
    {
        theme: 'beach',
        width: 4000,
        enemyType: 'crab',
        platforms: [
            { x: 0, y: 550, w: 400, h: 50, type: 'sand' },
            { x: 500, y: 550, w: 350, h: 50, type: 'sand' },
            { x: 950, y: 550, w: 500, h: 50, type: 'sand' },
            { x: 1550, y: 550, w: 400, h: 50, type: 'sand' },
            { x: 2050, y: 550, w: 500, h: 50, type: 'sand' },
            { x: 2650, y: 550, w: 350, h: 50, type: 'sand' },
            { x: 3100, y: 550, w: 900, h: 50, type: 'sand' },
            { x: 200, y: 450, w: 100, h: 25, type: 'wood' },
            { x: 400, y: 380, w: 120, h: 25, type: 'wood' },
            { x: 700, y: 320, w: 100, h: 25, type: 'sand' },
            { x: 1000, y: 400, w: 150, h: 25, type: 'wood' },
            { x: 1300, y: 350, w: 120, h: 25, type: 'sand' },
            { x: 1600, y: 280, w: 100, h: 25, type: 'wood' },
            { x: 1900, y: 380, w: 130, h: 25, type: 'sand' },
            { x: 2200, y: 300, w: 120, h: 25, type: 'wood' },
            { x: 2500, y: 400, w: 140, h: 25, type: 'sand' },
            { x: 2800, y: 320, w: 100, h: 25, type: 'wood' },
            { x: 3200, y: 350, w: 130, h: 25, type: 'sand' },
            { x: 3500, y: 280, w: 100, h: 25, type: 'wood' }
        ],
        movingPlatforms: [
            { x: 550, y: 450, w: 100, h: 25, type: 'wood', moveX: 120, moveY: 0, speed: 2 },
            { x: 1450, y: 300, w: 100, h: 25, type: 'wood', moveX: 0, moveY: 80, speed: 1.5 },
            { x: 2350, y: 350, w: 100, h: 25, type: 'wood', moveX: 100, moveY: 0, speed: 2 }
        ],
        coins: [
            { x: 230, y: 400 }, { x: 430, y: 330 }, { x: 730, y: 270 },
            { x: 1030, y: 350 }, { x: 1330, y: 300 }, { x: 1630, y: 230 },
            { x: 1930, y: 330 }, { x: 2230, y: 250 }, { x: 2530, y: 350 },
            { x: 2830, y: 270 }, { x: 3230, y: 300 }, { x: 3530, y: 230 },
            { x: 150, y: 500 }, { x: 600, y: 500 }, { x: 1100, y: 500 },
            { x: 1700, y: 500 }, { x: 2200, y: 500 }, { x: 2800, y: 500 },
            { x: 3300, y: 500 }, { x: 3600, y: 500 }
        ],
        enemies: [
            { x: 250, y: 520, left: 50, right: 350 },
            { x: 700, y: 520, left: 550, right: 800 },
            { x: 1200, y: 520, left: 1000, right: 1400 },
            { x: 1800, y: 520, left: 1600, right: 1900 },
            { x: 2350, y: 520, left: 2100, right: 2500 },
            { x: 2900, y: 520, left: 2700, right: 2950 },
            { x: 3450, y: 520, left: 3150, right: 3600 },
            // Gegner auf Plattformen
            { x: 500, y: 345, left: 400, right: 520 },
            { x: 780, y: 285, left: 700, right: 800 },
            { x: 1380, y: 315, left: 1300, right: 1420 },
            { x: 1980, y: 345, left: 1900, right: 2030 },
            { x: 2580, y: 365, left: 2500, right: 2640 },
            { x: 3280, y: 315, left: 3200, right: 3330 }
        ],
        obstacles: [],
        fadingPlatforms: [
            { x: 550, y: 350, w: 80, h: 25, type: 'sand', visibleTime: 170, invisibleTime: 55 },
            { x: 1150, y: 300, w: 80, h: 25, type: 'wood', visibleTime: 160, invisibleTime: 60 },
            { x: 2650, y: 350, w: 80, h: 25, type: 'sand', visibleTime: 150, invisibleTime: 65 }
        ],
        boss: { x: 3700, y: 420, type: 'octopus' },
        goalX: 3900
    },
    // Level 7 - Jungle - Snake enemies + Gorilla Boss
    {
        theme: 'jungle',
        width: 4200,
        enemyType: 'snake',
        platforms: [
            { x: 0, y: 550, w: 350, h: 50, type: 'moss' },
            { x: 450, y: 550, w: 400, h: 50, type: 'moss' },
            { x: 950, y: 550, w: 350, h: 50, type: 'moss' },
            { x: 1400, y: 550, w: 500, h: 50, type: 'moss' },
            { x: 2000, y: 550, w: 400, h: 50, type: 'moss' },
            { x: 2500, y: 550, w: 450, h: 50, type: 'moss' },
            { x: 3050, y: 550, w: 350, h: 50, type: 'moss' },
            { x: 3500, y: 550, w: 700, h: 50, type: 'moss' },
            { x: 150, y: 450, w: 120, h: 25, type: 'wood' },
            { x: 350, y: 350, w: 100, h: 25, type: 'moss' },
            { x: 600, y: 280, w: 130, h: 25, type: 'wood' },
            { x: 900, y: 380, w: 100, h: 25, type: 'moss' },
            { x: 1150, y: 300, w: 120, h: 25, type: 'wood' },
            { x: 1450, y: 400, w: 140, h: 25, type: 'moss' },
            { x: 1750, y: 320, w: 100, h: 25, type: 'wood' },
            { x: 2050, y: 250, w: 130, h: 25, type: 'moss' },
            { x: 2350, y: 380, w: 120, h: 25, type: 'wood' },
            { x: 2650, y: 300, w: 100, h: 25, type: 'moss' },
            { x: 2950, y: 400, w: 140, h: 25, type: 'wood' },
            { x: 3250, y: 320, w: 120, h: 25, type: 'moss' },
            { x: 3550, y: 250, w: 100, h: 25, type: 'wood' },
            { x: 3850, y: 350, w: 130, h: 25, type: 'moss' }
        ],
        movingPlatforms: [
            { x: 500, y: 400, w: 100, h: 25, type: 'wood', moveX: 0, moveY: 100, speed: 1.5 },
            { x: 1300, y: 350, w: 100, h: 25, type: 'wood', moveX: 130, moveY: 0, speed: 2 },
            { x: 2200, y: 280, w: 100, h: 25, type: 'wood', moveX: 0, moveY: 90, speed: 1.8 },
            { x: 3100, y: 350, w: 100, h: 25, type: 'wood', moveX: 100, moveY: 0, speed: 2 }
        ],
        coins: [
            { x: 180, y: 400 }, { x: 380, y: 300 }, { x: 630, y: 230 },
            { x: 930, y: 330 }, { x: 1180, y: 250 }, { x: 1480, y: 350 },
            { x: 1780, y: 270 }, { x: 2080, y: 200 }, { x: 2380, y: 330 },
            { x: 2680, y: 250 }, { x: 2980, y: 350 }, { x: 3280, y: 270 },
            { x: 3580, y: 200 }, { x: 3880, y: 300 },
            { x: 100, y: 500 }, { x: 550, y: 500 }, { x: 1050, y: 500 },
            { x: 1550, y: 500 }, { x: 2150, y: 500 }, { x: 2650, y: 500 },
            { x: 3200, y: 500 }, { x: 3700, y: 500 }
        ],
        enemies: [
            { x: 200, y: 525, left: 50, right: 300 },
            { x: 650, y: 525, left: 500, right: 800 },
            { x: 1150, y: 525, left: 1000, right: 1250 },
            { x: 1700, y: 525, left: 1450, right: 1850 },
            { x: 2250, y: 525, left: 2050, right: 2350 },
            { x: 2750, y: 525, left: 2550, right: 2900 },
            { x: 3300, y: 525, left: 3100, right: 3350 },
            { x: 3800, y: 525, left: 3550, right: 3950 },
            // Gegner auf Plattformen
            { x: 420, y: 315, left: 350, right: 450 },
            { x: 680, y: 245, left: 600, right: 730 },
            { x: 1220, y: 265, left: 1150, right: 1270 },
            { x: 1820, y: 285, left: 1750, right: 1850 },
            { x: 2420, y: 345, left: 2350, right: 2470 },
            { x: 3030, y: 365, left: 2950, right: 3090 },
            { x: 3620, y: 215, left: 3550, right: 3650 }
        ],
        obstacles: [],
        fadingPlatforms: [
            { x: 280, y: 380, w: 80, h: 25, type: 'wood', visibleTime: 160, invisibleTime: 60 },
            { x: 1050, y: 340, w: 80, h: 25, type: 'moss', visibleTime: 150, invisibleTime: 65 },
            { x: 1950, y: 280, w: 80, h: 25, type: 'wood', visibleTime: 140, invisibleTime: 70 },
            { x: 2850, y: 350, w: 80, h: 25, type: 'moss', visibleTime: 130, invisibleTime: 75 }
        ],
        boss: { x: 3950, y: 410, type: 'gorilla' },
        goalX: 4100
    },
    // Level 8 - Underwater - Jellyfish enemies + Shark Boss
    {
        theme: 'underwater',
        width: 4400,
        enemyType: 'jellyfish',
        platforms: [
            { x: 0, y: 550, w: 400, h: 50, type: 'coral' },
            { x: 500, y: 550, w: 350, h: 50, type: 'seaweed' },
            { x: 950, y: 550, w: 400, h: 50, type: 'coral' },
            { x: 1450, y: 550, w: 350, h: 50, type: 'seaweed' },
            { x: 1900, y: 550, w: 500, h: 50, type: 'coral' },
            { x: 2500, y: 550, w: 400, h: 50, type: 'seaweed' },
            { x: 3000, y: 550, w: 350, h: 50, type: 'coral' },
            { x: 3450, y: 550, w: 950, h: 50, type: 'seaweed' },
            { x: 200, y: 450, w: 100, h: 25, type: 'coral' },
            { x: 450, y: 380, w: 120, h: 25, type: 'seaweed' },
            { x: 700, y: 300, w: 100, h: 25, type: 'coral' },
            { x: 1000, y: 400, w: 130, h: 25, type: 'seaweed' },
            { x: 1300, y: 320, w: 120, h: 25, type: 'coral' },
            { x: 1600, y: 250, w: 100, h: 25, type: 'seaweed' },
            { x: 1950, y: 380, w: 140, h: 25, type: 'coral' },
            { x: 2250, y: 300, w: 120, h: 25, type: 'seaweed' },
            { x: 2550, y: 400, w: 100, h: 25, type: 'coral' },
            { x: 2850, y: 320, w: 130, h: 25, type: 'seaweed' },
            { x: 3150, y: 250, w: 120, h: 25, type: 'coral' },
            { x: 3500, y: 380, w: 100, h: 25, type: 'seaweed' },
            { x: 3800, y: 300, w: 140, h: 25, type: 'coral' },
            { x: 4100, y: 380, w: 120, h: 25, type: 'seaweed' }
        ],
        movingPlatforms: [
            { x: 350, y: 350, w: 100, h: 25, type: 'coral', moveX: 0, moveY: 100, speed: 1.2 },
            { x: 1100, y: 280, w: 100, h: 25, type: 'coral', moveX: 120, moveY: 0, speed: 1.8 },
            { x: 1800, y: 320, w: 100, h: 25, type: 'coral', moveX: 0, moveY: 80, speed: 1.5 },
            { x: 2700, y: 280, w: 100, h: 25, type: 'coral', moveX: 100, moveY: 0, speed: 2 },
            { x: 3350, y: 300, w: 100, h: 25, type: 'coral', moveX: 0, moveY: 90, speed: 1.3 }
        ],
        coins: [
            { x: 230, y: 400 }, { x: 480, y: 330 }, { x: 730, y: 250 },
            { x: 1030, y: 350 }, { x: 1330, y: 270 }, { x: 1630, y: 200 },
            { x: 1980, y: 330 }, { x: 2280, y: 250 }, { x: 2580, y: 350 },
            { x: 2880, y: 270 }, { x: 3180, y: 200 }, { x: 3530, y: 330 },
            { x: 3830, y: 250 }, { x: 4130, y: 330 },
            { x: 100, y: 500 }, { x: 600, y: 500 }, { x: 1100, y: 500 },
            { x: 1600, y: 500 }, { x: 2100, y: 500 }, { x: 2650, y: 500 },
            { x: 3150, y: 500 }, { x: 3650, y: 500 }, { x: 4050, y: 500 }
        ],
        enemies: [
            { x: 280, y: 505, left: 50, right: 350 },
            { x: 700, y: 505, left: 550, right: 800 },
            { x: 1200, y: 505, left: 1000, right: 1300 },
            { x: 1700, y: 505, left: 1500, right: 1750 },
            { x: 2200, y: 505, left: 1950, right: 2350 },
            { x: 2750, y: 505, left: 2550, right: 2850 },
            { x: 3250, y: 505, left: 3050, right: 3300 },
            { x: 3750, y: 505, left: 3500, right: 3900 },
            // Gegner auf Plattformen
            { x: 500, y: 345, left: 400, right: 520 },
            { x: 930, y: 285, left: 850, right: 970 },
            { x: 1380, y: 215, left: 1300, right: 1420 },
            { x: 1830, y: 295, left: 1750, right: 1870 },
            { x: 2330, y: 365, left: 2250, right: 2370 },
            { x: 2880, y: 285, left: 2800, right: 2920 },
            { x: 3380, y: 215, left: 3300, right: 3420 },
            { x: 4150, y: 505, left: 3950, right: 4250 }
        ],
        obstacles: [],
        fadingPlatforms: [
            { x: 600, y: 350, w: 80, h: 25, type: 'coral', visibleTime: 150, invisibleTime: 65 },
            { x: 1200, y: 280, w: 80, h: 25, type: 'seaweed', visibleTime: 140, invisibleTime: 70 },
            { x: 2000, y: 340, w: 80, h: 25, type: 'coral', visibleTime: 130, invisibleTime: 75 },
            { x: 3000, y: 280, w: 80, h: 25, type: 'seaweed', visibleTime: 120, invisibleTime: 80 }
        ],
        boss: { x: 4150, y: 460, type: 'shark' },
        goalX: 4300
    },
    // Level 9 - Snow - Penguin enemies + Yeti Boss
    {
        theme: 'snow',
        width: 4600,
        enemyType: 'penguin',
        platforms: [
            { x: 0, y: 550, w: 350, h: 50, type: 'snow' },
            { x: 450, y: 550, w: 400, h: 50, type: 'ice' },
            { x: 950, y: 550, w: 350, h: 50, type: 'snow' },
            { x: 1400, y: 550, w: 450, h: 50, type: 'ice' },
            { x: 1950, y: 550, w: 400, h: 50, type: 'snow' },
            { x: 2450, y: 550, w: 350, h: 50, type: 'ice' },
            { x: 2900, y: 550, w: 500, h: 50, type: 'snow' },
            { x: 3500, y: 550, w: 400, h: 50, type: 'ice' },
            { x: 4000, y: 550, w: 600, h: 50, type: 'snow' },
            { x: 150, y: 450, w: 100, h: 25, type: 'ice' },
            { x: 400, y: 370, w: 120, h: 25, type: 'snow' },
            { x: 650, y: 290, w: 100, h: 25, type: 'ice' },
            { x: 950, y: 400, w: 130, h: 25, type: 'snow' },
            { x: 1200, y: 320, w: 120, h: 25, type: 'ice' },
            { x: 1500, y: 250, w: 100, h: 25, type: 'snow' },
            { x: 1800, y: 380, w: 140, h: 25, type: 'ice' },
            { x: 2100, y: 300, w: 120, h: 25, type: 'snow' },
            { x: 2400, y: 400, w: 100, h: 25, type: 'ice' },
            { x: 2700, y: 320, w: 130, h: 25, type: 'snow' },
            { x: 3000, y: 250, w: 120, h: 25, type: 'ice' },
            { x: 3300, y: 380, w: 100, h: 25, type: 'snow' },
            { x: 3600, y: 300, w: 140, h: 25, type: 'ice' },
            { x: 3900, y: 400, w: 120, h: 25, type: 'snow' },
            { x: 4200, y: 320, w: 100, h: 25, type: 'ice' }
        ],
        movingPlatforms: [
            { x: 300, y: 400, w: 100, h: 25, type: 'ice', moveX: 100, moveY: 0, speed: 2.5 },
            { x: 1050, y: 280, w: 100, h: 25, type: 'ice', moveX: 0, moveY: 100, speed: 1.5 },
            { x: 1650, y: 320, w: 100, h: 25, type: 'ice', moveX: 120, moveY: 0, speed: 2 },
            { x: 2550, y: 280, w: 100, h: 25, type: 'ice', moveX: 0, moveY: 90, speed: 1.8 },
            { x: 3450, y: 350, w: 100, h: 25, type: 'ice', moveX: 100, moveY: 0, speed: 2.2 }
        ],
        coins: [
            { x: 180, y: 400 }, { x: 430, y: 320 }, { x: 680, y: 240 },
            { x: 980, y: 350 }, { x: 1230, y: 270 }, { x: 1530, y: 200 },
            { x: 1830, y: 330 }, { x: 2130, y: 250 }, { x: 2430, y: 350 },
            { x: 2730, y: 270 }, { x: 3030, y: 200 }, { x: 3330, y: 330 },
            { x: 3630, y: 250 }, { x: 3930, y: 350 }, { x: 4230, y: 270 },
            { x: 100, y: 500 }, { x: 550, y: 500 }, { x: 1050, y: 500 },
            { x: 1550, y: 500 }, { x: 2100, y: 500 }, { x: 2600, y: 500 },
            { x: 3100, y: 500 }, { x: 3650, y: 500 }, { x: 4150, y: 500 }
        ],
        enemies: [
            { x: 200, y: 510, left: 50, right: 300 },
            { x: 650, y: 510, left: 500, right: 800 },
            { x: 1150, y: 510, left: 1000, right: 1300 },
            { x: 1700, y: 510, left: 1450, right: 1800 },
            { x: 2200, y: 510, left: 2000, right: 2300 },
            { x: 2700, y: 510, left: 2500, right: 2750 },
            { x: 3200, y: 510, left: 2950, right: 3350 },
            { x: 3750, y: 510, left: 3550, right: 3850 },
            { x: 4250, y: 510, left: 4050, right: 4350 },
            // Gegner auf Plattformen
            { x: 480, y: 335, left: 400, right: 520 },
            { x: 720, y: 255, left: 650, right: 750 },
            { x: 1280, y: 285, left: 1200, right: 1320 },
            { x: 1570, y: 215, left: 1500, right: 1600 },
            { x: 2180, y: 265, left: 2100, right: 2220 },
            { x: 2780, y: 285, left: 2700, right: 2830 },
            { x: 3380, y: 345, left: 3300, right: 3400 },
            { x: 3980, y: 365, left: 3900, right: 4020 }
        ],
        obstacles: [],
        fadingPlatforms: [
            { x: 550, y: 340, w: 80, h: 25, type: 'ice', visibleTime: 140, invisibleTime: 70 },
            { x: 1350, y: 280, w: 80, h: 25, type: 'snow', visibleTime: 130, invisibleTime: 75 },
            { x: 1950, y: 340, w: 80, h: 25, type: 'ice', visibleTime: 120, invisibleTime: 80 },
            { x: 2850, y: 280, w: 80, h: 25, type: 'snow', visibleTime: 110, invisibleTime: 85 },
            { x: 3750, y: 350, w: 80, h: 25, type: 'ice', visibleTime: 100, invisibleTime: 90 }
        ],
        boss: { x: 4350, y: 400, type: 'yeti' },
        goalX: 4500
    },
    // Level 10 - Swamp - Frog enemies + Swamp Monster Boss
    {
        theme: 'swamp',
        width: 4800,
        enemyType: 'frog',
        platforms: [
            { x: 0, y: 550, w: 300, h: 50, type: 'mud' },
            { x: 400, y: 550, w: 350, h: 50, type: 'moss' },
            { x: 850, y: 550, w: 300, h: 50, type: 'mud' },
            { x: 1250, y: 550, w: 400, h: 50, type: 'moss' },
            { x: 1750, y: 550, w: 350, h: 50, type: 'mud' },
            { x: 2200, y: 550, w: 300, h: 50, type: 'moss' },
            { x: 2600, y: 550, w: 450, h: 50, type: 'mud' },
            { x: 3150, y: 550, w: 350, h: 50, type: 'moss' },
            { x: 3600, y: 550, w: 300, h: 50, type: 'mud' },
            { x: 4000, y: 550, w: 800, h: 50, type: 'moss' },
            { x: 150, y: 450, w: 100, h: 25, type: 'moss' },
            { x: 350, y: 370, w: 120, h: 25, type: 'mud' },
            { x: 600, y: 290, w: 100, h: 25, type: 'moss' },
            { x: 900, y: 400, w: 130, h: 25, type: 'mud' },
            { x: 1150, y: 320, w: 120, h: 25, type: 'moss' },
            { x: 1450, y: 250, w: 100, h: 25, type: 'mud' },
            { x: 1750, y: 380, w: 140, h: 25, type: 'moss' },
            { x: 2050, y: 300, w: 120, h: 25, type: 'mud' },
            { x: 2350, y: 400, w: 100, h: 25, type: 'moss' },
            { x: 2650, y: 320, w: 130, h: 25, type: 'mud' },
            { x: 2950, y: 250, w: 120, h: 25, type: 'moss' },
            { x: 3250, y: 380, w: 100, h: 25, type: 'mud' },
            { x: 3550, y: 300, w: 140, h: 25, type: 'moss' },
            { x: 3850, y: 400, w: 120, h: 25, type: 'mud' },
            { x: 4150, y: 320, w: 100, h: 25, type: 'moss' },
            { x: 4450, y: 400, w: 130, h: 25, type: 'mud' }
        ],
        movingPlatforms: [
            { x: 250, y: 400, w: 100, h: 25, type: 'moss', moveX: 0, moveY: 100, speed: 1.5 },
            { x: 1000, y: 280, w: 100, h: 25, type: 'moss', moveX: 120, moveY: 0, speed: 2 },
            { x: 1600, y: 320, w: 100, h: 25, type: 'moss', moveX: 0, moveY: 90, speed: 1.8 },
            { x: 2500, y: 280, w: 100, h: 25, type: 'moss', moveX: 100, moveY: 0, speed: 2.2 },
            { x: 3400, y: 350, w: 100, h: 25, type: 'moss', moveX: 0, moveY: 80, speed: 1.6 }
        ],
        coins: [
            { x: 180, y: 400 }, { x: 380, y: 320 }, { x: 630, y: 240 },
            { x: 930, y: 350 }, { x: 1180, y: 270 }, { x: 1480, y: 200 },
            { x: 1780, y: 330 }, { x: 2080, y: 250 }, { x: 2380, y: 350 },
            { x: 2680, y: 270 }, { x: 2980, y: 200 }, { x: 3280, y: 330 },
            { x: 3580, y: 250 }, { x: 3880, y: 350 }, { x: 4180, y: 270 },
            { x: 4480, y: 350 },
            { x: 100, y: 500 }, { x: 500, y: 500 }, { x: 950, y: 500 },
            { x: 1400, y: 500 }, { x: 1900, y: 500 }, { x: 2350, y: 500 },
            { x: 2800, y: 500 }, { x: 3300, y: 500 }, { x: 3750, y: 500 },
            { x: 4200, y: 500 }
        ],
        enemies: [
            { x: 180, y: 515, left: 50, right: 250 },
            { x: 600, y: 515, left: 450, right: 700 },
            { x: 1050, y: 515, left: 900, right: 1100 },
            { x: 1500, y: 515, left: 1300, right: 1600 },
            { x: 2000, y: 515, left: 1800, right: 2050 },
            { x: 2450, y: 515, left: 2250, right: 2450 },
            { x: 2900, y: 515, left: 2650, right: 3000 },
            { x: 3400, y: 515, left: 3200, right: 3450 },
            { x: 3850, y: 515, left: 3650, right: 3850 },
            { x: 4300, y: 515, left: 4050, right: 4450 },
            // Gegner auf Plattformen
            { x: 420, y: 345, left: 350, right: 470 },
            { x: 720, y: 265, left: 650, right: 770 },
            { x: 1230, y: 285, left: 1150, right: 1270 },
            { x: 1570, y: 215, left: 1500, right: 1620 },
            { x: 1980, y: 345, left: 1900, right: 2020 },
            { x: 2430, y: 265, left: 2350, right: 2470 },
            { x: 2780, y: 215, left: 2700, right: 2820 },
            { x: 3320, y: 345, left: 3250, right: 3350 },
            { x: 3930, y: 365, left: 3850, right: 3970 }
        ],
        obstacles: [],
        fadingPlatforms: [
            { x: 550, y: 320, w: 100, h: 25, type: 'moss', visibleTime: 150, invisibleTime: 60 },
            { x: 1350, y: 280, w: 100, h: 25, type: 'mud', visibleTime: 140, invisibleTime: 70 },
            { x: 2100, y: 320, w: 100, h: 25, type: 'moss', visibleTime: 130, invisibleTime: 80 },
            { x: 3000, y: 280, w: 100, h: 25, type: 'mud', visibleTime: 120, invisibleTime: 90 }
        ],
        boss: { x: 4550, y: 430, type: 'swamp_monster' },
        goalX: 4700
    },
    // Level 11 - Ruins - Mummy enemies + Pharaoh Boss
    {
        theme: 'ruins',
        width: 5000,
        enemyType: 'mummy',
        platforms: [
            { x: 0, y: 550, w: 400, h: 50, type: 'sandstone' },
            { x: 500, y: 550, w: 350, h: 50, type: 'gold' },
            { x: 950, y: 550, w: 400, h: 50, type: 'sandstone' },
            { x: 1450, y: 550, w: 350, h: 50, type: 'gold' },
            { x: 1900, y: 550, w: 450, h: 50, type: 'sandstone' },
            { x: 2450, y: 550, w: 400, h: 50, type: 'gold' },
            { x: 2950, y: 550, w: 350, h: 50, type: 'sandstone' },
            { x: 3400, y: 550, w: 500, h: 50, type: 'gold' },
            { x: 4000, y: 550, w: 1000, h: 50, type: 'sandstone' },
            { x: 200, y: 450, w: 100, h: 25, type: 'gold' },
            { x: 450, y: 370, w: 120, h: 25, type: 'sandstone' },
            { x: 700, y: 290, w: 100, h: 25, type: 'gold' },
            { x: 1000, y: 400, w: 130, h: 25, type: 'sandstone' },
            { x: 1300, y: 320, w: 120, h: 25, type: 'gold' },
            { x: 1600, y: 250, w: 100, h: 25, type: 'sandstone' },
            { x: 1950, y: 380, w: 140, h: 25, type: 'gold' },
            { x: 2250, y: 300, w: 120, h: 25, type: 'sandstone' },
            { x: 2550, y: 400, w: 100, h: 25, type: 'gold' },
            { x: 2850, y: 320, w: 130, h: 25, type: 'sandstone' },
            { x: 3150, y: 250, w: 120, h: 25, type: 'gold' },
            { x: 3500, y: 380, w: 100, h: 25, type: 'sandstone' },
            { x: 3800, y: 300, w: 140, h: 25, type: 'gold' },
            { x: 4150, y: 400, w: 120, h: 25, type: 'sandstone' },
            { x: 4450, y: 320, w: 100, h: 25, type: 'gold' },
            { x: 4700, y: 400, w: 130, h: 25, type: 'sandstone' }
        ],
        movingPlatforms: [
            { x: 350, y: 400, w: 100, h: 25, type: 'gold', moveX: 0, moveY: 100, speed: 1.5 },
            { x: 1150, y: 280, w: 100, h: 25, type: 'gold', moveX: 130, moveY: 0, speed: 2 },
            { x: 1800, y: 320, w: 100, h: 25, type: 'gold', moveX: 0, moveY: 90, speed: 1.8 },
            { x: 2700, y: 280, w: 100, h: 25, type: 'gold', moveX: 100, moveY: 0, speed: 2.2 },
            { x: 3650, y: 350, w: 100, h: 25, type: 'gold', moveX: 0, moveY: 80, speed: 1.6 },
            { x: 4300, y: 280, w: 100, h: 25, type: 'gold', moveX: 110, moveY: 0, speed: 2 }
        ],
        coins: [
            { x: 230, y: 400 }, { x: 480, y: 320 }, { x: 730, y: 240 },
            { x: 1030, y: 350 }, { x: 1330, y: 270 }, { x: 1630, y: 200 },
            { x: 1980, y: 330 }, { x: 2280, y: 250 }, { x: 2580, y: 350 },
            { x: 2880, y: 270 }, { x: 3180, y: 200 }, { x: 3530, y: 330 },
            { x: 3830, y: 250 }, { x: 4180, y: 350 }, { x: 4480, y: 270 },
            { x: 4730, y: 350 },
            { x: 100, y: 500 }, { x: 600, y: 500 }, { x: 1100, y: 500 },
            { x: 1600, y: 500 }, { x: 2050, y: 500 }, { x: 2600, y: 500 },
            { x: 3100, y: 500 }, { x: 3600, y: 500 }, { x: 4200, y: 500 },
            { x: 4600, y: 500 }
        ],
        enemies: [
            { x: 280, y: 500, left: 50, right: 350 },
            { x: 700, y: 500, left: 550, right: 800 },
            { x: 1200, y: 500, left: 1000, right: 1300 },
            { x: 1700, y: 500, left: 1500, right: 1750 },
            { x: 2150, y: 500, left: 1950, right: 2300 },
            { x: 2700, y: 500, left: 2500, right: 2800 },
            { x: 3200, y: 500, left: 3000, right: 3300 },
            { x: 3700, y: 500, left: 3450, right: 3850 },
            { x: 4300, y: 500, left: 4050, right: 4500 },
            { x: 4700, y: 500, left: 4500, right: 4800 },
            // Gegner auf Plattformen
            { x: 520, y: 335, left: 450, right: 570 },
            { x: 820, y: 255, left: 750, right: 870 },
            { x: 1370, y: 285, left: 1250, right: 1370 },
            { x: 1680, y: 215, left: 1600, right: 1720 },
            { x: 2080, y: 345, left: 2000, right: 2120 },
            { x: 2480, y: 265, left: 2400, right: 2520 },
            { x: 2930, y: 215, left: 2800, right: 2920 },
            { x: 3420, y: 345, left: 3300, right: 3420 },
            { x: 3780, y: 265, left: 3700, right: 3820 },
            { x: 4230, y: 345, left: 4100, right: 4220 }
        ],
        obstacles: [],
        fadingPlatforms: [
            { x: 600, y: 320, w: 100, h: 25, type: 'sandstone', visibleTime: 140, invisibleTime: 70 },
            { x: 1400, y: 280, w: 100, h: 25, type: 'gold', visibleTime: 130, invisibleTime: 80 },
            { x: 2200, y: 320, w: 100, h: 25, type: 'sandstone', visibleTime: 120, invisibleTime: 90 },
            { x: 3100, y: 280, w: 100, h: 25, type: 'gold', visibleTime: 110, invisibleTime: 100 },
            { x: 3900, y: 320, w: 100, h: 25, type: 'sandstone', visibleTime: 100, invisibleTime: 100 }
        ],
        boss: { x: 4750, y: 410, type: 'pharaoh' },
        goalX: 4900
    },
    // Level 12 - Factory - Robot enemies + Mega Robot Boss
    {
        theme: 'factory',
        width: 5200,
        enemyType: 'robot',
        platforms: [
            { x: 0, y: 550, w: 350, h: 50, type: 'metal' },
            { x: 450, y: 550, w: 400, h: 50, type: 'conveyor' },
            { x: 950, y: 550, w: 350, h: 50, type: 'metal' },
            { x: 1400, y: 550, w: 450, h: 50, type: 'conveyor' },
            { x: 1950, y: 550, w: 400, h: 50, type: 'metal' },
            { x: 2450, y: 550, w: 350, h: 50, type: 'conveyor' },
            { x: 2900, y: 550, w: 500, h: 50, type: 'metal' },
            { x: 3500, y: 550, w: 400, h: 50, type: 'conveyor' },
            { x: 4000, y: 550, w: 350, h: 50, type: 'metal' },
            { x: 4450, y: 550, w: 750, h: 50, type: 'conveyor' },
            { x: 150, y: 450, w: 100, h: 25, type: 'metal' },
            { x: 400, y: 370, w: 120, h: 25, type: 'conveyor' },
            { x: 650, y: 290, w: 100, h: 25, type: 'metal' },
            { x: 950, y: 400, w: 130, h: 25, type: 'conveyor' },
            { x: 1200, y: 320, w: 120, h: 25, type: 'metal' },
            { x: 1500, y: 250, w: 100, h: 25, type: 'conveyor' },
            { x: 1800, y: 380, w: 140, h: 25, type: 'metal' },
            { x: 2100, y: 300, w: 120, h: 25, type: 'conveyor' },
            { x: 2400, y: 400, w: 100, h: 25, type: 'metal' },
            { x: 2700, y: 320, w: 130, h: 25, type: 'conveyor' },
            { x: 3000, y: 250, w: 120, h: 25, type: 'metal' },
            { x: 3300, y: 380, w: 100, h: 25, type: 'conveyor' },
            { x: 3600, y: 300, w: 140, h: 25, type: 'metal' },
            { x: 3900, y: 400, w: 120, h: 25, type: 'conveyor' },
            { x: 4200, y: 320, w: 100, h: 25, type: 'metal' },
            { x: 4500, y: 400, w: 130, h: 25, type: 'conveyor' },
            { x: 4800, y: 320, w: 120, h: 25, type: 'metal' }
        ],
        movingPlatforms: [
            { x: 300, y: 400, w: 100, h: 25, type: 'metal', moveX: 100, moveY: 0, speed: 2.5 },
            { x: 1050, y: 280, w: 100, h: 25, type: 'metal', moveX: 0, moveY: 100, speed: 1.5 },
            { x: 1650, y: 320, w: 100, h: 25, type: 'metal', moveX: 120, moveY: 0, speed: 2 },
            { x: 2550, y: 280, w: 100, h: 25, type: 'metal', moveX: 0, moveY: 90, speed: 1.8 },
            { x: 3450, y: 350, w: 100, h: 25, type: 'metal', moveX: 100, moveY: 0, speed: 2.2 },
            { x: 4350, y: 280, w: 100, h: 25, type: 'metal', moveX: 0, moveY: 80, speed: 1.6 }
        ],
        coins: [
            { x: 180, y: 400 }, { x: 430, y: 320 }, { x: 680, y: 240 },
            { x: 980, y: 350 }, { x: 1230, y: 270 }, { x: 1530, y: 200 },
            { x: 1830, y: 330 }, { x: 2130, y: 250 }, { x: 2430, y: 350 },
            { x: 2730, y: 270 }, { x: 3030, y: 200 }, { x: 3330, y: 330 },
            { x: 3630, y: 250 }, { x: 3930, y: 350 }, { x: 4230, y: 270 },
            { x: 4530, y: 350 }, { x: 4830, y: 270 },
            { x: 100, y: 500 }, { x: 550, y: 500 }, { x: 1050, y: 500 },
            { x: 1550, y: 500 }, { x: 2100, y: 500 }, { x: 2600, y: 500 },
            { x: 3100, y: 500 }, { x: 3650, y: 500 }, { x: 4150, y: 500 },
            { x: 4650, y: 500 }
        ],
        enemies: [
            { x: 200, y: 505, left: 50, right: 300 },
            { x: 650, y: 505, left: 500, right: 800 },
            { x: 1150, y: 505, left: 1000, right: 1300 },
            { x: 1700, y: 505, left: 1450, right: 1800 },
            { x: 2200, y: 505, left: 2000, right: 2300 },
            { x: 2700, y: 505, left: 2500, right: 2750 },
            { x: 3200, y: 505, left: 2950, right: 3350 },
            { x: 3750, y: 505, left: 3550, right: 3850 },
            { x: 4250, y: 505, left: 4050, right: 4300 },
            { x: 4750, y: 505, left: 4500, right: 4900 },
            // Gegner auf Plattformen
            { x: 480, y: 335, left: 400, right: 520 },
            { x: 730, y: 255, left: 650, right: 750 },
            { x: 1280, y: 285, left: 1200, right: 1320 },
            { x: 1580, y: 215, left: 1500, right: 1600 },
            { x: 1880, y: 345, left: 1800, right: 1940 },
            { x: 2180, y: 265, left: 2100, right: 2220 },
            { x: 2780, y: 285, left: 2700, right: 2830 },
            { x: 3080, y: 215, left: 3000, right: 3120 },
            { x: 3680, y: 265, left: 3600, right: 3740 },
            { x: 4280, y: 285, left: 4200, right: 4300 }
        ],
        obstacles: [],
        fadingPlatforms: [
            { x: 550, y: 320, w: 100, h: 25, type: 'metal', visibleTime: 130, invisibleTime: 80 },
            { x: 1300, y: 280, w: 100, h: 25, type: 'conveyor', visibleTime: 120, invisibleTime: 90 },
            { x: 2000, y: 320, w: 100, h: 25, type: 'metal', visibleTime: 110, invisibleTime: 100 },
            { x: 2800, y: 280, w: 100, h: 25, type: 'conveyor', visibleTime: 100, invisibleTime: 100 },
            { x: 3500, y: 320, w: 100, h: 25, type: 'metal', visibleTime: 90, invisibleTime: 110 },
            { x: 4100, y: 280, w: 100, h: 25, type: 'conveyor', visibleTime: 80, invisibleTime: 120 }
        ],
        boss: { x: 4950, y: 390, type: 'mega_robot' },
        goalX: 5100
    },
    // Level 13 - Underground - Mole enemies + Worm King Boss
    {
        theme: 'underground',
        width: 5400,
        enemyType: 'mole',
        platforms: [
            { x: 0, y: 550, w: 400, h: 50, type: 'dirt' },
            { x: 500, y: 550, w: 350, h: 50, type: 'roots' },
            { x: 950, y: 550, w: 400, h: 50, type: 'dirt' },
            { x: 1450, y: 550, w: 350, h: 50, type: 'roots' },
            { x: 1900, y: 550, w: 500, h: 50, type: 'dirt' },
            { x: 2500, y: 550, w: 400, h: 50, type: 'roots' },
            { x: 3000, y: 550, w: 350, h: 50, type: 'dirt' },
            { x: 3450, y: 550, w: 500, h: 50, type: 'roots' },
            { x: 4050, y: 550, w: 400, h: 50, type: 'dirt' },
            { x: 4550, y: 550, w: 850, h: 50, type: 'roots' },
            { x: 200, y: 450, w: 100, h: 25, type: 'roots' },
            { x: 450, y: 370, w: 120, h: 25, type: 'dirt' },
            { x: 700, y: 290, w: 100, h: 25, type: 'roots' },
            { x: 1000, y: 400, w: 130, h: 25, type: 'dirt' },
            { x: 1300, y: 320, w: 120, h: 25, type: 'roots' },
            { x: 1600, y: 250, w: 100, h: 25, type: 'dirt' },
            { x: 1950, y: 380, w: 140, h: 25, type: 'roots' },
            { x: 2250, y: 300, w: 120, h: 25, type: 'dirt' },
            { x: 2550, y: 400, w: 100, h: 25, type: 'roots' },
            { x: 2850, y: 320, w: 130, h: 25, type: 'dirt' },
            { x: 3150, y: 250, w: 120, h: 25, type: 'roots' },
            { x: 3500, y: 380, w: 100, h: 25, type: 'dirt' },
            { x: 3800, y: 300, w: 140, h: 25, type: 'roots' },
            { x: 4150, y: 400, w: 120, h: 25, type: 'dirt' },
            { x: 4450, y: 320, w: 100, h: 25, type: 'roots' },
            { x: 4750, y: 400, w: 130, h: 25, type: 'dirt' },
            { x: 5050, y: 320, w: 120, h: 25, type: 'roots' }
        ],
        movingPlatforms: [
            { x: 350, y: 400, w: 100, h: 25, type: 'dirt', moveX: 0, moveY: 100, speed: 1.5 },
            { x: 1150, y: 280, w: 100, h: 25, type: 'dirt', moveX: 130, moveY: 0, speed: 2 },
            { x: 1800, y: 320, w: 100, h: 25, type: 'dirt', moveX: 0, moveY: 90, speed: 1.8 },
            { x: 2700, y: 280, w: 100, h: 25, type: 'dirt', moveX: 100, moveY: 0, speed: 2.2 },
            { x: 3650, y: 350, w: 100, h: 25, type: 'dirt', moveX: 0, moveY: 80, speed: 1.6 },
            { x: 4600, y: 280, w: 100, h: 25, type: 'dirt', moveX: 110, moveY: 0, speed: 2 }
        ],
        coins: [
            { x: 230, y: 400 }, { x: 480, y: 320 }, { x: 730, y: 240 },
            { x: 1030, y: 350 }, { x: 1330, y: 270 }, { x: 1630, y: 200 },
            { x: 1980, y: 330 }, { x: 2280, y: 250 }, { x: 2580, y: 350 },
            { x: 2880, y: 270 }, { x: 3180, y: 200 }, { x: 3530, y: 330 },
            { x: 3830, y: 250 }, { x: 4180, y: 350 }, { x: 4480, y: 270 },
            { x: 4780, y: 350 }, { x: 5080, y: 270 },
            { x: 100, y: 500 }, { x: 600, y: 500 }, { x: 1100, y: 500 },
            { x: 1600, y: 500 }, { x: 2100, y: 500 }, { x: 2650, y: 500 },
            { x: 3150, y: 500 }, { x: 3650, y: 500 }, { x: 4200, y: 500 },
            { x: 4700, y: 500 }, { x: 5100, y: 500 }
        ],
        enemies: [
            { x: 280, y: 515, left: 50, right: 350 },
            { x: 700, y: 515, left: 550, right: 800 },
            { x: 1200, y: 515, left: 1000, right: 1300 },
            { x: 1700, y: 515, left: 1500, right: 1750 },
            { x: 2200, y: 515, left: 1950, right: 2350 },
            { x: 2750, y: 515, left: 2550, right: 2850 },
            { x: 3250, y: 515, left: 3050, right: 3300 },
            { x: 3750, y: 515, left: 3500, right: 3900 },
            { x: 4300, y: 515, left: 4100, right: 4400 },
            { x: 4800, y: 515, left: 4600, right: 4950 },
            { x: 5200, y: 515, left: 4950, right: 5250 },
            // Gegner auf Plattformen
            { x: 530, y: 335, left: 450, right: 570 },
            { x: 780, y: 255, left: 700, right: 800 },
            { x: 1380, y: 285, left: 1300, right: 1420 },
            { x: 1680, y: 215, left: 1600, right: 1700 },
            { x: 2030, y: 345, left: 1950, right: 2090 },
            { x: 2330, y: 265, left: 2250, right: 2370 },
            { x: 2930, y: 285, left: 2850, right: 2980 },
            { x: 3230, y: 215, left: 3150, right: 3270 },
            { x: 3580, y: 345, left: 3500, right: 3600 },
            { x: 3880, y: 265, left: 3800, right: 3940 },
            { x: 4530, y: 285, left: 4450, right: 4570 }
        ],
        obstacles: [],
        fadingPlatforms: [
            { x: 600, y: 320, w: 100, h: 25, type: 'dirt', visibleTime: 120, invisibleTime: 90 },
            { x: 1400, y: 280, w: 100, h: 25, type: 'roots', visibleTime: 110, invisibleTime: 100 },
            { x: 2100, y: 320, w: 100, h: 25, type: 'dirt', visibleTime: 100, invisibleTime: 100 },
            { x: 2900, y: 280, w: 100, h: 25, type: 'roots', visibleTime: 90, invisibleTime: 110 },
            { x: 3600, y: 320, w: 100, h: 25, type: 'dirt', visibleTime: 80, invisibleTime: 120 },
            { x: 4300, y: 280, w: 100, h: 25, type: 'roots', visibleTime: 70, invisibleTime: 130 },
            { x: 4900, y: 320, w: 100, h: 25, type: 'dirt', visibleTime: 60, invisibleTime: 140 }
        ],
        boss: { x: 5150, y: 450, type: 'worm_king' },
        goalX: 5300
    },
    // Level 14 - Candy World - Gummy Bear enemies + Candy Boss
    {
        theme: 'candy',
        width: 5600,
        enemyType: 'gummy_bear',
        platforms: [
            { x: 0, y: 550, w: 350, h: 50, type: 'candy' },
            { x: 450, y: 550, w: 400, h: 50, type: 'chocolate' },
            { x: 950, y: 550, w: 350, h: 50, type: 'candy' },
            { x: 1400, y: 550, w: 450, h: 50, type: 'chocolate' },
            { x: 1950, y: 550, w: 400, h: 50, type: 'candy' },
            { x: 2450, y: 550, w: 350, h: 50, type: 'chocolate' },
            { x: 2900, y: 550, w: 500, h: 50, type: 'candy' },
            { x: 3500, y: 550, w: 400, h: 50, type: 'chocolate' },
            { x: 4000, y: 550, w: 350, h: 50, type: 'candy' },
            { x: 4450, y: 550, w: 500, h: 50, type: 'chocolate' },
            { x: 5050, y: 550, w: 550, h: 50, type: 'candy' },
            { x: 150, y: 450, w: 100, h: 25, type: 'chocolate' },
            { x: 400, y: 370, w: 120, h: 25, type: 'candy' },
            { x: 650, y: 290, w: 100, h: 25, type: 'chocolate' },
            { x: 950, y: 400, w: 130, h: 25, type: 'candy' },
            { x: 1200, y: 320, w: 120, h: 25, type: 'chocolate' },
            { x: 1500, y: 250, w: 100, h: 25, type: 'candy' },
            { x: 1800, y: 380, w: 140, h: 25, type: 'chocolate' },
            { x: 2100, y: 300, w: 120, h: 25, type: 'candy' },
            { x: 2400, y: 400, w: 100, h: 25, type: 'chocolate' },
            { x: 2700, y: 320, w: 130, h: 25, type: 'candy' },
            { x: 3000, y: 250, w: 120, h: 25, type: 'chocolate' },
            { x: 3300, y: 380, w: 100, h: 25, type: 'candy' },
            { x: 3600, y: 300, w: 140, h: 25, type: 'chocolate' },
            { x: 3900, y: 400, w: 120, h: 25, type: 'candy' },
            { x: 4200, y: 320, w: 100, h: 25, type: 'chocolate' },
            { x: 4500, y: 400, w: 130, h: 25, type: 'candy' },
            { x: 4800, y: 320, w: 120, h: 25, type: 'chocolate' },
            { x: 5150, y: 400, w: 100, h: 25, type: 'candy' }
        ],
        movingPlatforms: [
            { x: 300, y: 400, w: 100, h: 25, type: 'candy', moveX: 100, moveY: 0, speed: 2.5 },
            { x: 1050, y: 280, w: 100, h: 25, type: 'candy', moveX: 0, moveY: 100, speed: 1.5 },
            { x: 1650, y: 320, w: 100, h: 25, type: 'candy', moveX: 120, moveY: 0, speed: 2 },
            { x: 2550, y: 280, w: 100, h: 25, type: 'candy', moveX: 0, moveY: 90, speed: 1.8 },
            { x: 3450, y: 350, w: 100, h: 25, type: 'candy', moveX: 100, moveY: 0, speed: 2.2 },
            { x: 4350, y: 280, w: 100, h: 25, type: 'candy', moveX: 0, moveY: 80, speed: 1.6 },
            { x: 5000, y: 350, w: 100, h: 25, type: 'candy', moveX: 100, moveY: 0, speed: 2 }
        ],
        coins: [
            { x: 180, y: 400 }, { x: 430, y: 320 }, { x: 680, y: 240 },
            { x: 980, y: 350 }, { x: 1230, y: 270 }, { x: 1530, y: 200 },
            { x: 1830, y: 330 }, { x: 2130, y: 250 }, { x: 2430, y: 350 },
            { x: 2730, y: 270 }, { x: 3030, y: 200 }, { x: 3330, y: 330 },
            { x: 3630, y: 250 }, { x: 3930, y: 350 }, { x: 4230, y: 270 },
            { x: 4530, y: 350 }, { x: 4830, y: 270 }, { x: 5180, y: 350 },
            { x: 100, y: 500 }, { x: 550, y: 500 }, { x: 1050, y: 500 },
            { x: 1550, y: 500 }, { x: 2100, y: 500 }, { x: 2600, y: 500 },
            { x: 3100, y: 500 }, { x: 3650, y: 500 }, { x: 4150, y: 500 },
            { x: 4650, y: 500 }, { x: 5200, y: 500 }
        ],
        enemies: [
            { x: 200, y: 510, left: 50, right: 300 },
            { x: 650, y: 510, left: 500, right: 800 },
            { x: 1150, y: 510, left: 1000, right: 1300 },
            { x: 1700, y: 510, left: 1450, right: 1800 },
            { x: 2200, y: 510, left: 2000, right: 2300 },
            { x: 2700, y: 510, left: 2500, right: 2750 },
            { x: 3200, y: 510, left: 2950, right: 3350 },
            { x: 3750, y: 510, left: 3550, right: 3850 },
            { x: 4250, y: 510, left: 4050, right: 4350 },
            { x: 4750, y: 510, left: 4500, right: 4900 },
            { x: 5300, y: 510, left: 5100, right: 5400 },
            // Gegner auf Plattformen
            { x: 480, y: 335, left: 400, right: 520 },
            { x: 730, y: 255, left: 650, right: 750 },
            { x: 1280, y: 285, left: 1200, right: 1320 },
            { x: 1580, y: 215, left: 1500, right: 1600 },
            { x: 1880, y: 345, left: 1800, right: 1940 },
            { x: 2180, y: 265, left: 2100, right: 2220 },
            { x: 2780, y: 285, left: 2700, right: 2830 },
            { x: 3080, y: 215, left: 3000, right: 3120 },
            { x: 3380, y: 345, left: 3300, right: 3400 },
            { x: 3980, y: 365, left: 3900, right: 4020 },
            { x: 4580, y: 365, left: 4500, right: 4630 }
        ],
        obstacles: [],
        fadingPlatforms: [
            { x: 550, y: 320, w: 100, h: 25, type: 'candy', visibleTime: 110, invisibleTime: 100 },
            { x: 1300, y: 280, w: 100, h: 25, type: 'chocolate', visibleTime: 100, invisibleTime: 100 },
            { x: 2000, y: 320, w: 100, h: 25, type: 'candy', visibleTime: 90, invisibleTime: 110 },
            { x: 2700, y: 280, w: 100, h: 25, type: 'chocolate', visibleTime: 80, invisibleTime: 120 },
            { x: 3400, y: 320, w: 100, h: 25, type: 'candy', visibleTime: 70, invisibleTime: 130 },
            { x: 4100, y: 280, w: 100, h: 25, type: 'chocolate', visibleTime: 60, invisibleTime: 140 },
            { x: 4800, y: 320, w: 100, h: 25, type: 'candy', visibleTime: 50, invisibleTime: 150 }
        ],
        boss: { x: 5350, y: 410, type: 'candy_boss' },
        goalX: 5500
    },
    // Level 15 - Space (Final Level) - Alien enemies + UFO Boss
    {
        theme: 'space',
        width: 6000,
        enemyType: 'alien',
        platforms: [
            { x: 0, y: 550, w: 300, h: 50, type: 'asteroid' },
            { x: 400, y: 550, w: 350, h: 50, type: 'energy' },
            { x: 850, y: 550, w: 300, h: 50, type: 'asteroid' },
            { x: 1250, y: 550, w: 400, h: 50, type: 'energy' },
            { x: 1750, y: 550, w: 350, h: 50, type: 'asteroid' },
            { x: 2200, y: 550, w: 300, h: 50, type: 'energy' },
            { x: 2600, y: 550, w: 450, h: 50, type: 'asteroid' },
            { x: 3150, y: 550, w: 350, h: 50, type: 'energy' },
            { x: 3600, y: 550, w: 300, h: 50, type: 'asteroid' },
            { x: 4000, y: 550, w: 400, h: 50, type: 'energy' },
            { x: 4500, y: 550, w: 350, h: 50, type: 'asteroid' },
            { x: 4950, y: 550, w: 300, h: 50, type: 'energy' },
            { x: 5350, y: 550, w: 650, h: 50, type: 'asteroid' },
            { x: 150, y: 450, w: 100, h: 25, type: 'energy' },
            { x: 350, y: 370, w: 120, h: 25, type: 'asteroid' },
            { x: 600, y: 290, w: 100, h: 25, type: 'energy' },
            { x: 900, y: 400, w: 130, h: 25, type: 'asteroid' },
            { x: 1150, y: 320, w: 120, h: 25, type: 'energy' },
            { x: 1450, y: 250, w: 100, h: 25, type: 'asteroid' },
            { x: 1750, y: 380, w: 140, h: 25, type: 'energy' },
            { x: 2050, y: 300, w: 120, h: 25, type: 'asteroid' },
            { x: 2350, y: 400, w: 100, h: 25, type: 'energy' },
            { x: 2650, y: 320, w: 130, h: 25, type: 'asteroid' },
            { x: 2950, y: 250, w: 120, h: 25, type: 'energy' },
            { x: 3250, y: 380, w: 100, h: 25, type: 'asteroid' },
            { x: 3550, y: 300, w: 140, h: 25, type: 'energy' },
            { x: 3850, y: 400, w: 120, h: 25, type: 'asteroid' },
            { x: 4150, y: 320, w: 100, h: 25, type: 'energy' },
            { x: 4450, y: 250, w: 130, h: 25, type: 'asteroid' },
            { x: 4750, y: 380, w: 120, h: 25, type: 'energy' },
            { x: 5050, y: 300, w: 100, h: 25, type: 'asteroid' },
            { x: 5350, y: 400, w: 140, h: 25, type: 'energy' },
            { x: 5650, y: 320, w: 120, h: 25, type: 'asteroid' }
        ],
        movingPlatforms: [
            { x: 250, y: 400, w: 100, h: 25, type: 'energy', moveX: 0, moveY: 100, speed: 1.5 },
            { x: 1000, y: 280, w: 100, h: 25, type: 'energy', moveX: 120, moveY: 0, speed: 2.5 },
            { x: 1600, y: 320, w: 100, h: 25, type: 'energy', moveX: 0, moveY: 90, speed: 2 },
            { x: 2500, y: 280, w: 100, h: 25, type: 'energy', moveX: 100, moveY: 0, speed: 2.2 },
            { x: 3400, y: 350, w: 100, h: 25, type: 'energy', moveX: 0, moveY: 80, speed: 1.8 },
            { x: 4300, y: 280, w: 100, h: 25, type: 'energy', moveX: 110, moveY: 0, speed: 2.5 },
            { x: 5200, y: 350, w: 100, h: 25, type: 'energy', moveX: 0, moveY: 100, speed: 1.5 }
        ],
        coins: [
            { x: 180, y: 400 }, { x: 380, y: 320 }, { x: 630, y: 240 },
            { x: 930, y: 350 }, { x: 1180, y: 270 }, { x: 1480, y: 200 },
            { x: 1780, y: 330 }, { x: 2080, y: 250 }, { x: 2380, y: 350 },
            { x: 2680, y: 270 }, { x: 2980, y: 200 }, { x: 3280, y: 330 },
            { x: 3580, y: 250 }, { x: 3880, y: 350 }, { x: 4180, y: 270 },
            { x: 4480, y: 200 }, { x: 4780, y: 330 }, { x: 5080, y: 250 },
            { x: 5380, y: 350 }, { x: 5680, y: 270 },
            { x: 100, y: 500 }, { x: 500, y: 500 }, { x: 950, y: 500 },
            { x: 1400, y: 500 }, { x: 1900, y: 500 }, { x: 2350, y: 500 },
            { x: 2800, y: 500 }, { x: 3300, y: 500 }, { x: 3750, y: 500 },
            { x: 4200, y: 500 }, { x: 4650, y: 500 }, { x: 5100, y: 500 },
            { x: 5550, y: 500 }
        ],
        enemies: [
            { x: 180, y: 505, left: 50, right: 250 },
            { x: 600, y: 505, left: 450, right: 700 },
            { x: 1050, y: 505, left: 900, right: 1100 },
            { x: 1500, y: 505, left: 1300, right: 1600 },
            { x: 2000, y: 505, left: 1800, right: 2100 },
            { x: 2450, y: 505, left: 2250, right: 2450 },
            { x: 2900, y: 505, left: 2650, right: 3000 },
            { x: 3400, y: 505, left: 3200, right: 3450 },
            { x: 3850, y: 505, left: 3650, right: 3850 },
            { x: 4300, y: 505, left: 4050, right: 4350 },
            { x: 4750, y: 505, left: 4550, right: 4850 },
            { x: 5200, y: 505, left: 5000, right: 5200 },
            { x: 5650, y: 505, left: 5400, right: 5750 },
            // Gegner auf Plattformen
            { x: 420, y: 335, left: 350, right: 470 },
            { x: 680, y: 255, left: 600, right: 700 },
            { x: 1230, y: 285, left: 1150, right: 1270 },
            { x: 1530, y: 215, left: 1450, right: 1550 },
            { x: 1830, y: 345, left: 1750, right: 1890 },
            { x: 2130, y: 265, left: 2050, right: 2170 },
            { x: 2730, y: 285, left: 2650, right: 2780 },
            { x: 3030, y: 215, left: 2950, right: 3070 },
            { x: 3330, y: 345, left: 3250, right: 3350 },
            { x: 3630, y: 265, left: 3550, right: 3690 },
            { x: 4230, y: 285, left: 4150, right: 4270 },
            { x: 4830, y: 345, left: 4750, right: 4870 }
        ],
        obstacles: [],
        fadingPlatforms: [
            { x: 500, y: 320, w: 100, h: 25, type: 'energy', visibleTime: 100, invisibleTime: 100 },
            { x: 1200, y: 280, w: 100, h: 25, type: 'asteroid', visibleTime: 90, invisibleTime: 110 },
            { x: 1900, y: 320, w: 100, h: 25, type: 'energy', visibleTime: 80, invisibleTime: 120 },
            { x: 2600, y: 280, w: 100, h: 25, type: 'asteroid', visibleTime: 70, invisibleTime: 130 },
            { x: 3300, y: 320, w: 100, h: 25, type: 'energy', visibleTime: 60, invisibleTime: 140 },
            { x: 4000, y: 280, w: 100, h: 25, type: 'asteroid', visibleTime: 50, invisibleTime: 150 },
            { x: 4700, y: 320, w: 100, h: 25, type: 'energy', visibleTime: 40, invisibleTime: 160 },
            { x: 5400, y: 280, w: 100, h: 25, type: 'asteroid', visibleTime: 30, invisibleTime: 170 }
        ],
        boss: { x: 5750, y: 440, type: 'ufo' },
        goalX: 5900
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
    fadingPlatforms: [],
    coins: [],
    enemies: [],
    obstacles: [],
    boss: null,
    bossDefeated: false,
    bossHintShown: false,
    projectiles: [],
    powerups: [],
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
async function buyShopItem(type, itemId) {
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

    // Sync with server if logged in
    if (!API.isGuest) {
        const result = await API.purchase(type, itemId);
        if (result && result.ok) {
            // Update local profile from server response
            game.userProfile.totalCoins = result.data.totalCoins;
            game.userProfile.ownedSkins = ['default', ...(result.data.purchasedSkins || [])];
            game.userProfile.ownedUpgrades = result.data.purchasedUpgrades || [];
            game.userProfile.extraLives = calculateExtraLives(game.userProfile.ownedUpgrades);
            return { success: true, message: 'Kauf erfolgreich!' };
        } else {
            return { success: false, message: result?.data?.error || 'Kauf fehlgeschlagen' };
        }
    }

    // Guest purchase (local only)
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
async function selectSkin(skinId) {
    if (game.userProfile.ownedSkins.includes(skinId)) {
        game.userProfile.selectedSkin = skinId;
        saveUserProfile();

        // Sync with server if logged in
        if (!API.isGuest) {
            await API.updateSelectedSkin(skinId);
        }
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
        try {
            const result = await API.saveHighscore(game.score, game.level);
            if (result) {
                console.log('Highscore saved to server, rank:', result.rank);
            } else {
                console.error('Failed to save highscore - no result');
            }
        } catch (e) {
            console.error('Error saving highscore:', e);
        }
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
        this.invulnerable = 0; // Invulnerability frames after being hit

        // Power-up effects
        this.hasSpeedBoost = false;
        this.speedBoostTimer = 0;
        this.hasTripleJump = false;
        this.tripleJumpTimer = 0;
    }

    update() {
        // Decrease invulnerability timer
        if (this.invulnerable > 0) {
            this.invulnerable--;
        }

        // Update power-up timers
        if (this.speedBoostTimer > 0) {
            this.speedBoostTimer--;
            if (this.speedBoostTimer <= 0) {
                this.hasSpeedBoost = false;
            }
        }
        if (this.tripleJumpTimer > 0) {
            this.tripleJumpTimer--;
            if (this.tripleJumpTimer <= 0) {
                this.hasTripleJump = false;
                this.maxJumps = 2; // Reset to double jump
            }
        }

        // Calculate speed (with speed boost)
        const currentSpeed = this.hasSpeedBoost ? CONFIG.PLAYER.SPEED * 1.6 : CONFIG.PLAYER.SPEED;

        // Horizontal movement
        if (game.keys['ArrowLeft'] || game.keys['KeyA']) {
            if (this.velX > -currentSpeed) {
                this.velX -= this.hasSpeedBoost ? 1.5 : 1;
            }
            this.facingRight = false;
        }
        if (game.keys['ArrowRight'] || game.keys['KeyD']) {
            if (this.velX < currentSpeed) {
                this.velX += this.hasSpeedBoost ? 1.5 : 1;
            }
            this.facingRight = true;
        }

        // Jumping (with double/triple jump)
        const jumpKeyPressed = game.keys['Space'] || game.keys['ArrowUp'] || game.keys['KeyW'];
        if (jumpKeyPressed && this.canJump && this.jumpCount < this.maxJumps) {
            this.jumping = true;
            this.grounded = false;
            this.velY = -CONFIG.PLAYER.JUMP_FORCE;
            this.jumpCount++;
            this.canJump = false;

            // Different particle colors for each jump
            if (this.jumpCount === 1) {
                createParticles(this.x + this.width / 2, this.y + this.height, 5, '#A0522D');
            } else if (this.jumpCount === 2) {
                // Double jump effect - sparkles!
                createParticles(this.x + this.width / 2, this.y + this.height / 2, 8, '#FFD700');
            } else if (this.jumpCount === 3) {
                // Triple jump effect - purple sparkles!
                createParticles(this.x + this.width / 2, this.y + this.height / 2, 10, '#9932CC');
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

        // Platform collision (fading) - only when solid
        for (let platform of game.fadingPlatforms) {
            if (platform.isSolid) {
                const collision = this.checkCollision(platform);
                if (collision) {
                    this.handleCollision(collision, platform);
                }
            }
        }

        // World bounds
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > game.levelWidth) this.x = game.levelWidth - this.width;

        // Fall off screen (use GAME_HEIGHT to account for touch controls)
        if (this.y > CONFIG.GAME_HEIGHT + 100) {
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
            if (enemy.alive && this.intersects(enemy)) {
                const playerBottom = this.y + this.height;
                const enemyTop = enemy.y;

                // Spieler besiegt Gegner wenn:
                // - Spieler fällt aktiv nach unten (velY > 0)
                // - Spieler-Füße sind in der oberen Hälfte des Gegners (nicht tiefer als 40%)
                const isFalling = this.velY > 0;
                const feetNearTop = playerBottom < enemyTop + enemy.height * 0.4;

                if (isFalling && feetNearTop) {
                    // Player jumped on enemy - Gegner besiegt
                    enemy.alive = false;
                    this.velY = -12;
                    game.score += 50;
                    updateUI();
                    createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 10, '#FF6347');
                } else if (this.invulnerable <= 0) {
                    // Player touched enemy from side or below - Spieler verliert Leben (only if not invulnerable)
                    this.die();
                }
            }
        }

        // Boss collision
        if (game.boss && game.boss.alive && this.intersects(game.boss)) {
            const playerBottom = this.y + this.height;
            const bossTop = game.boss.y;

            // Spieler besiegt Boss wenn:
            // - Spieler fällt aktiv nach unten (velY > 0)
            // - Spieler-Füße sind in der oberen Hälfte des Bosses (nicht tiefer als 40%)
            const isFalling = this.velY > 0;
            const feetNearTop = playerBottom < bossTop + game.boss.height * 0.4;

            if (isFalling && feetNearTop) {
                // Player jumped on boss
                const killed = game.boss.takeDamage();
                this.velY = -14; // Bigger bounce

                if (killed) {
                    // Boss defeated!
                    game.bossDefeated = true;
                    createParticles(game.boss.x + game.boss.width / 2, game.boss.y + game.boss.height / 2, 30, '#FFD700');
                    createParticles(game.boss.x + game.boss.width / 2, game.boss.y + game.boss.height / 2, 20, '#FF4500');
                } else {
                    // Boss damaged
                    createParticles(game.boss.x + game.boss.width / 2, game.boss.y + game.boss.height / 2, 15, '#FF0000');
                }
            } else if (game.boss.invulnerable > 0) {
                // Boss is invulnerable - just bounce player back without damage
                this.velY = -8;
                this.velX = this.x < game.boss.x ? -5 : 5;
            } else if (this.invulnerable <= 0) {
                // Player touched boss from side or below - take damage (only if not invulnerable)
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
            const bossExists = game.boss !== null && game.boss !== undefined;
            const bossIsDead = bossExists && (!game.boss.alive || game.bossDefeated);
            const canFinish = !bossExists || bossIsDead;

            if (canFinish) {
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
        this.y = 300 + getYOffset();
        this.velX = 0;
        this.velY = 0;
        this.jumpCount = 0;
        this.invulnerable = 120; // 2 seconds of invulnerability after respawn
        game.cameraX = 0;

        // Reset maxJumps based on current power-up state
        this.maxJumps = this.hasTripleJump ? 3 : 2;

        // Reset enemies and boss
        resetEnemies();
    }

    draw(ctx) {
        // Blink when invulnerable
        if (this.invulnerable > 0 && Math.floor(this.invulnerable / 5) % 2 === 0) {
            return; // Skip drawing every other 5 frames for blink effect
        }

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

            // === NEW PLATFORM TYPES ===
            case 'wood':
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#A0522D';
                for (let i = 0; i < this.width; i += 15) {
                    ctx.fillRect(screenX + i, this.y, 2, this.height);
                }
                ctx.fillStyle = '#654321';
                for (let j = 0; j < this.height; j += 8) {
                    ctx.fillRect(screenX, this.y + j, this.width, 1);
                }
                break;

            case 'moss':
                ctx.fillStyle = '#556B2F';
                ctx.fillRect(screenX, this.y + 5, this.width, this.height - 5);
                ctx.fillStyle = '#6B8E23';
                ctx.beginPath();
                ctx.roundRect(screenX, this.y, this.width, 10, [5, 5, 0, 0]);
                ctx.fill();
                ctx.fillStyle = '#9ACD32';
                for (let i = 0; i < this.width; i += 12) {
                    ctx.beginPath();
                    ctx.arc(screenX + i + 6, this.y + 3, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'coral':
                ctx.fillStyle = '#FF7F50';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#FF6347';
                for (let i = 0; i < this.width; i += 25) {
                    ctx.beginPath();
                    ctx.moveTo(screenX + i + 5, this.y + this.height);
                    ctx.lineTo(screenX + i + 12, this.y);
                    ctx.lineTo(screenX + i + 19, this.y + this.height);
                    ctx.fill();
                }
                ctx.fillStyle = '#E9967A';
                for (let i = 0; i < this.width; i += 30) {
                    ctx.beginPath();
                    ctx.arc(screenX + i + 15, this.y + 8, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'seaweed':
                ctx.fillStyle = '#20B2AA';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#3CB371';
                for (let i = 0; i < this.width; i += 15) {
                    const wave = Math.sin(Date.now() / 300 + i) * 3;
                    ctx.beginPath();
                    ctx.moveTo(screenX + i + 7, this.y + this.height);
                    ctx.quadraticCurveTo(screenX + i + 7 + wave, this.y + this.height / 2, screenX + i + 7, this.y);
                    ctx.lineTo(screenX + i + 10, this.y);
                    ctx.quadraticCurveTo(screenX + i + 10 + wave, this.y + this.height / 2, screenX + i + 10, this.y + this.height);
                    ctx.fill();
                }
                break;

            case 'ice':
                ctx.fillStyle = '#B0E0E6';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#E0FFFF';
                ctx.beginPath();
                ctx.roundRect(screenX + 2, this.y + 2, this.width - 4, this.height / 2, 3);
                ctx.fill();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                for (let i = 0; i < this.width; i += 20) {
                    ctx.fillRect(screenX + i + 5, this.y + 3, 8, 4);
                }
                break;

            case 'snow':
                ctx.fillStyle = '#F5F5F5';
                ctx.fillRect(screenX, this.y + 8, this.width, this.height - 8);
                ctx.fillStyle = '#FFFAFA';
                ctx.beginPath();
                ctx.roundRect(screenX, this.y, this.width, 12, [8, 8, 0, 0]);
                ctx.fill();
                ctx.fillStyle = '#DCDCDC';
                for (let i = 0; i < this.width; i += 18) {
                    ctx.beginPath();
                    ctx.arc(screenX + i + 9, this.y + 5, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'mud':
                ctx.fillStyle = '#5D4E37';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#8B7355';
                for (let i = 0; i < this.width; i += 20) {
                    ctx.beginPath();
                    ctx.arc(screenX + i + 10, this.y + this.height / 2, 6, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.fillStyle = '#6B4423';
                ctx.beginPath();
                ctx.roundRect(screenX, this.y, this.width, 5, [3, 3, 0, 0]);
                ctx.fill();
                break;

            case 'sandstone':
                ctx.fillStyle = '#D2691E';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#CD853F';
                for (let i = 0; i < this.width; i += 25) {
                    for (let j = 0; j < this.height; j += 15) {
                        ctx.fillRect(screenX + i + 2, this.y + j + 2, 18, 10);
                    }
                }
                ctx.strokeStyle = '#8B4513';
                ctx.lineWidth = 1;
                for (let i = 0; i < this.width; i += 25) {
                    ctx.beginPath();
                    ctx.moveTo(screenX + i, this.y);
                    ctx.lineTo(screenX + i, this.y + this.height);
                    ctx.stroke();
                }
                break;

            case 'gold':
                ctx.fillStyle = '#DAA520';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.roundRect(screenX + 3, this.y + 3, this.width - 6, this.height - 6, 3);
                ctx.fill();
                ctx.fillStyle = '#B8860B';
                for (let i = 0; i < this.width; i += 15) {
                    ctx.fillRect(screenX + i + 6, this.y + 5, 3, this.height - 10);
                }
                // Shine effect
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.fillRect(screenX + 5, this.y + 5, this.width / 4, 5);
                break;

            case 'metal':
                ctx.fillStyle = '#708090';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#778899';
                for (let i = 0; i < this.width; i += 30) {
                    ctx.beginPath();
                    ctx.arc(screenX + i + 8, this.y + this.height / 2, 4, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(screenX + i + 22, this.y + this.height / 2, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.strokeStyle = '#4A4A4A';
                ctx.lineWidth = 2;
                ctx.strokeRect(screenX + 1, this.y + 1, this.width - 2, this.height - 2);
                break;

            case 'conveyor':
                ctx.fillStyle = '#4A4A4A';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#5A5A5A';
                const offset = (Date.now() / 50) % 20;
                for (let i = -20; i < this.width + 20; i += 20) {
                    ctx.fillRect(screenX + i + offset, this.y + 3, 10, this.height - 6);
                }
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(screenX, this.y, this.width, 3);
                ctx.fillRect(screenX, this.y + this.height - 3, this.width, 3);
                break;

            case 'dirt':
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#A0522D';
                for (let i = 0; i < this.width; i += 12) {
                    for (let j = 0; j < this.height; j += 10) {
                        ctx.beginPath();
                        ctx.arc(screenX + i + 6, this.y + j + 5, 3, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
                ctx.fillStyle = '#6B4423';
                ctx.beginPath();
                ctx.roundRect(screenX, this.y, this.width, 6, [4, 4, 0, 0]);
                ctx.fill();
                break;

            case 'roots':
                ctx.fillStyle = '#5D4E37';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#8B7355';
                for (let i = 0; i < this.width; i += 20) {
                    ctx.beginPath();
                    ctx.moveTo(screenX + i, this.y);
                    ctx.quadraticCurveTo(screenX + i + 10, this.y + this.height / 2, screenX + i + 5, this.y + this.height);
                    ctx.lineTo(screenX + i + 8, this.y + this.height);
                    ctx.quadraticCurveTo(screenX + i + 13, this.y + this.height / 2, screenX + i + 3, this.y);
                    ctx.fill();
                }
                break;

            case 'candy':
                const candyColors = ['#FF69B4', '#FF1493', '#FFB6C1', '#FF6EB4'];
                const stripeW = 15;
                for (let i = 0; i < this.width; i += stripeW) {
                    ctx.fillStyle = candyColors[Math.floor(i / stripeW) % candyColors.length];
                    ctx.fillRect(screenX + i, this.y, stripeW, this.height);
                }
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.fillRect(screenX, this.y, this.width, this.height / 3);
                break;

            case 'chocolate':
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#D2691E';
                for (let i = 0; i < this.width; i += 20) {
                    ctx.beginPath();
                    ctx.roundRect(screenX + i + 2, this.y + 2, 16, this.height - 4, 3);
                    ctx.fill();
                }
                ctx.fillStyle = '#A0522D';
                ctx.fillRect(screenX, this.y + this.height - 4, this.width, 4);
                break;

            case 'asteroid':
                ctx.fillStyle = '#4A4A4A';
                ctx.beginPath();
                ctx.roundRect(screenX, this.y, this.width, this.height, 8);
                ctx.fill();
                ctx.fillStyle = '#696969';
                for (let i = 0; i < this.width; i += 25) {
                    ctx.beginPath();
                    ctx.arc(screenX + i + 12, this.y + this.height / 2, 6, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.fillStyle = '#808080';
                for (let i = 0; i < this.width; i += 35) {
                    ctx.beginPath();
                    ctx.arc(screenX + i + 8, this.y + 8, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;

            case 'energy':
                ctx.fillStyle = '#191970';
                ctx.fillRect(screenX, this.y, this.width, this.height);
                const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7;
                ctx.fillStyle = `rgba(0, 255, 255, ${pulse})`;
                ctx.beginPath();
                ctx.roundRect(screenX + 3, this.y + 3, this.width - 6, this.height - 6, 4);
                ctx.fill();
                ctx.fillStyle = '#7B68EE';
                for (let i = 0; i < this.width; i += 15) {
                    const sparkY = Math.sin(Date.now() / 100 + i) * 3;
                    ctx.beginPath();
                    ctx.arc(screenX + i + 7, this.y + this.height / 2 + sparkY, 3, 0, Math.PI * 2);
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

// Fading Platform Class - becomes transparent and lets player fall through
class FadingPlatform extends Platform {
    constructor(x, y, width, height, type, fadeSpeed = 0.02, visibleTime = 120, invisibleTime = 80) {
        super(x, y, width, height, type);
        this.fadeSpeed = fadeSpeed;
        this.visibleTime = visibleTime;
        this.invisibleTime = invisibleTime;
        this.alpha = 1;
        this.timer = 0;
        this.isSolid = true;
        this.state = 'visible'; // 'visible', 'fading_out', 'invisible', 'fading_in'
    }

    update() {
        this.timer++;

        switch (this.state) {
            case 'visible':
                if (this.timer >= this.visibleTime) {
                    this.state = 'fading_out';
                    this.timer = 0;
                }
                break;
            case 'fading_out':
                this.alpha -= this.fadeSpeed;
                if (this.alpha <= 0.2) {
                    this.alpha = 0.2;
                    this.isSolid = false;
                    this.state = 'invisible';
                    this.timer = 0;
                }
                break;
            case 'invisible':
                if (this.timer >= this.invisibleTime) {
                    this.state = 'fading_in';
                    this.timer = 0;
                }
                break;
            case 'fading_in':
                this.alpha += this.fadeSpeed;
                if (this.alpha >= 1) {
                    this.alpha = 1;
                    this.isSolid = true;
                    this.state = 'visible';
                    this.timer = 0;
                }
                break;
        }
    }

    draw(ctx) {
        const screenX = this.x - game.cameraX;
        if (screenX + this.width < 0 || screenX > CONFIG.WIDTH) return;

        // Save context and apply alpha
        ctx.save();
        ctx.globalAlpha = this.alpha;

        // Draw warning glow when about to fade
        if (this.state === 'visible' && this.timer > this.visibleTime * 0.7) {
            const pulseAlpha = Math.sin(this.timer * 0.3) * 0.3 + 0.3;
            ctx.fillStyle = `rgba(255, 100, 100, ${pulseAlpha})`;
            ctx.fillRect(screenX - 3, this.y - 3, this.width + 6, this.height + 6);
        }

        // Draw ghostly outline when invisible
        if (!this.isSolid) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(screenX, this.y, this.width, this.height);
            ctx.setLineDash([]);
        }

        this.drawPlatform(ctx, screenX, game.theme);
        ctx.restore();
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

// PowerUp Class - collectible bonuses (Level 6+)
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 30;
        this.height = 30;
        this.collected = false;
        this.animFrame = 0;
        this.floatOffset = Math.random() * Math.PI * 2;

        // Configure based on type
        switch(type) {
            case 'extra_life':
                this.color = '#FF69B4';
                this.icon = '❤️';
                this.glowColor = '#FF1493';
                break;
            case 'speed_boost':
                this.color = '#00BFFF';
                this.icon = '⚡';
                this.glowColor = '#1E90FF';
                this.duration = 300; // 5 seconds at 60fps
                break;
            case 'time_bonus':
                this.color = '#FFD700';
                this.icon = '⏱️';
                this.glowColor = '#FFA500';
                this.timeBonus = 15; // 15 seconds bonus
                break;
            case 'triple_jump':
                this.color = '#9932CC';
                this.icon = '🦘';
                this.glowColor = '#8A2BE2';
                this.duration = 600; // 10 seconds at 60fps
                break;
        }
    }

    update() {
        this.animFrame += 0.1;
        this.floatOffset += 0.05;
    }

    draw(ctx) {
        if (this.collected) return;

        const screenX = this.x - game.cameraX;
        if (screenX + this.width < 0 || screenX > CONFIG.WIDTH) return;

        const float = Math.sin(this.floatOffset) * 5;
        const pulse = Math.sin(this.animFrame * 2) * 0.2 + 1;
        const centerX = screenX + this.width / 2;
        const centerY = this.y + this.height / 2 + float;

        // Outer glow
        ctx.save();
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 15 * pulse;

        // Background circle
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 18 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Inner circle
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Icon
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, centerX, centerY);

        // Sparkle effect
        if (Math.random() < 0.1) {
            const sparkleX = centerX + (Math.random() - 0.5) * 30;
            const sparkleY = centerY + (Math.random() - 0.5) * 30;
            ctx.fillStyle = '#FFFFFF';
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.arc(sparkleX, sparkleY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    collidesWith(player) {
        return !this.collected &&
            this.x < player.x + player.width &&
            this.x + this.width > player.x &&
            this.y < player.y + player.height &&
            this.y + this.height > player.y;
    }

    collect() {
        if (this.collected) return;
        this.collected = true;

        switch(this.type) {
            case 'extra_life':
                game.lives++;
                updateUI();
                showPowerUpMessage('Extra Leben!', this.color);
                break;

            case 'speed_boost':
                game.player.speedBoostTimer = this.duration;
                game.player.hasSpeedBoost = true;
                showPowerUpMessage('Geschwindigkeitsboost!', this.color);
                break;

            case 'time_bonus':
                game.levelStartTime += this.timeBonus * 1000; // Add 15 seconds
                showPowerUpMessage('+' + this.timeBonus + ' Sekunden!', this.color);
                break;

            case 'triple_jump':
                game.player.tripleJumpTimer = this.duration;
                game.player.hasTripleJump = true;
                game.player.maxJumps = 3;
                showPowerUpMessage('Dreifach-Sprung!', this.color);
                break;
        }

        // Create collection particles
        for (let i = 0; i < 12; i++) {
            game.particles.push(new Particle(
                this.x + this.width / 2,
                this.y + this.height / 2,
                this.color
            ));
        }
    }
}

// Show power-up collection message
function showPowerUpMessage(text, color) {
    const msg = document.createElement('div');
    msg.className = 'powerup-message';
    msg.textContent = text;
    msg.style.color = color;
    msg.style.position = 'fixed';
    msg.style.top = '30%';
    msg.style.left = '50%';
    msg.style.transform = 'translateX(-50%)';
    msg.style.fontSize = '28px';
    msg.style.fontWeight = 'bold';
    msg.style.textShadow = '2px 2px 4px black';
    msg.style.zIndex = '1000';
    msg.style.pointerEvents = 'none';
    msg.style.animation = 'powerupFade 1.5s ease-out forwards';
    document.body.appendChild(msg);

    setTimeout(() => msg.remove(), 1500);
}

// Enemy Class - now with different types per level
class Enemy {
    constructor(x, y, patrolLeft, patrolRight, type = 'default') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.velX = 2;
        this.baseVelX = 2;
        this.patrolLeft = patrolLeft;
        this.patrolRight = patrolRight;
        this.alive = true;
        this.animFrame = 0;

        // Unpredictable behavior (activated for Level 10+)
        this.unpredictable = false;
        this.pauseTimer = 0;
        this.isPaused = false;
        this.speedBoostTimer = 0;
        this.isSpeedBoosted = false;
        this.reverseTimer = 0;

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
            // New enemy types (Level 6-15)
            case 'crab':
                this.width = 45;
                this.height = 30;
                this.velX = 2.5;
                break;
            case 'snake':
                this.width = 50;
                this.height = 25;
                this.velX = 2.5;
                break;
            case 'jellyfish':
                this.width = 35;
                this.height = 45;
                this.velX = 2.8;
                this.floatOffset = 0;
                break;
            case 'penguin':
                this.width = 35;
                this.height = 40;
                this.velX = 2.8;
                break;
            case 'frog':
                this.width = 40;
                this.height = 35;
                this.velX = 3;
                this.jumpTimer = 0;
                break;
            case 'mummy':
                this.width = 35;
                this.height = 50;
                this.velX = 3;
                break;
            case 'robot':
                this.width = 40;
                this.height = 45;
                this.velX = 3.2;
                break;
            case 'mole':
                this.width = 40;
                this.height = 35;
                this.velX = 3.2;
                break;
            case 'gummy_bear':
                this.width = 35;
                this.height = 40;
                this.velX = 3.5;
                break;
            case 'alien':
                this.width = 40;
                this.height = 45;
                this.velX = 4;
                break;
            default:
                this.width = 35;
                this.height = 35;
        }

        // Store base velocity after type-specific adjustments
        this.baseVelX = this.velX;
    }

    update() {
        if (!this.alive) return;

        // Unpredictable behavior for Level 10+
        if (this.unpredictable) {
            // Random pause behavior
            if (!this.isPaused && this.pauseTimer <= 0 && Math.random() < 0.005) {
                this.isPaused = true;
                this.pauseTimer = 30 + Math.floor(Math.random() * 60); // Pause for 0.5-1.5 seconds
            }

            if (this.isPaused) {
                this.pauseTimer--;
                if (this.pauseTimer <= 0) {
                    this.isPaused = false;
                    this.pauseTimer = 60 + Math.floor(Math.random() * 120); // Cooldown before next pause
                }
            }

            // Random speed boost
            if (!this.isSpeedBoosted && this.speedBoostTimer <= 0 && Math.random() < 0.003) {
                this.isSpeedBoosted = true;
                this.speedBoostTimer = 40 + Math.floor(Math.random() * 40); // Boost for 0.7-1.3 seconds
            }

            if (this.isSpeedBoosted) {
                this.speedBoostTimer--;
                if (this.speedBoostTimer <= 0) {
                    this.isSpeedBoosted = false;
                    this.speedBoostTimer = 90 + Math.floor(Math.random() * 90); // Cooldown
                }
            }

            // Random sudden direction change
            if (this.reverseTimer <= 0 && Math.random() < 0.002) {
                this.velX *= -1;
                this.reverseTimer = 60; // Can't reverse again for 1 second
            }
            if (this.reverseTimer > 0) this.reverseTimer--;

            // Apply speed modifications
            if (this.isPaused) {
                // Don't move when paused
                this.animFrame += 0.02; // Slow animation when paused
            } else {
                const speedMultiplier = this.isSpeedBoosted ? 2.0 : 1.0;
                const currentSpeed = Math.abs(this.baseVelX) * speedMultiplier;
                this.velX = this.velX > 0 ? currentSpeed : -currentSpeed;
                this.x += this.velX;
                this.animFrame += this.isSpeedBoosted ? 0.2 : 0.1;
            }
        } else {
            // Normal behavior
            this.x += this.velX;
            this.animFrame += 0.1;
        }

        // Finde die Plattform unter dem Gegner
        const feetY = this.y + this.height;
        let currentPlatform = null;

        for (let platform of game.platforms) {
            if (this.x + this.width > platform.x && this.x < platform.x + platform.width &&
                feetY >= platform.y - 5 && feetY <= platform.y + 20) {
                currentPlatform = platform;
                break;
            }
        }

        // Prüfe auch bewegende Plattformen
        if (!currentPlatform && game.movingPlatforms) {
            for (let platform of game.movingPlatforms) {
                if (this.x + this.width > platform.x && this.x < platform.x + platform.width &&
                    feetY >= platform.y - 5 && feetY <= platform.y + 20) {
                    currentPlatform = platform;
                    break;
                }
            }
        }

        // Berechne effektive Grenzen
        let effectiveLeft = this.patrolLeft;
        let effectiveRight = this.patrolRight;

        // Wenn auf Plattform, beschränke auf Plattformgrenzen
        if (currentPlatform) {
            const platformLeft = currentPlatform.x + 10;
            const platformRight = currentPlatform.x + currentPlatform.width - 10;
            effectiveLeft = Math.max(this.patrolLeft, platformLeft);
            effectiveRight = Math.min(this.patrolRight, platformRight);
        }

        // Stelle sicher, dass es genug Platz zum Bewegen gibt
        if (effectiveRight - effectiveLeft < this.width + 20) {
            // Nicht genug Platz - nutze nur Patrol-Grenzen
            effectiveLeft = this.patrolLeft;
            effectiveRight = this.patrolRight;
        }

        // Prüfe Grenzen und kehre um (nur einmal!)
        if (this.x <= effectiveLeft) {
            this.x = effectiveLeft;
            if (this.velX < 0) this.velX *= -1;
        } else if (this.x + this.width >= effectiveRight) {
            this.x = effectiveRight - this.width;
            if (this.velX > 0) this.velX *= -1;
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
            // New enemy types (Level 6-15)
            case 'crab':
                this.drawCrab(ctx, screenX);
                break;
            case 'snake':
                this.drawSnake(ctx, screenX);
                break;
            case 'jellyfish':
                this.drawJellyfish(ctx, screenX);
                break;
            case 'penguin':
                this.drawPenguin(ctx, screenX);
                break;
            case 'frog':
                this.drawFrog(ctx, screenX);
                break;
            case 'mummy':
                this.drawMummy(ctx, screenX);
                break;
            case 'robot':
                this.drawRobot(ctx, screenX);
                break;
            case 'mole':
                this.drawMole(ctx, screenX);
                break;
            case 'gummy_bear':
                this.drawGummyBear(ctx, screenX);
                break;
            case 'alien':
                this.drawAlien(ctx, screenX);
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

    // === NEW ENEMY DRAW METHODS ===

    // Beach Crab Enemy (Level 6)
    drawCrab(ctx, screenX) {
        const facingRight = this.velX > 0;
        const legMove = Math.sin(this.animFrame * 4) * 5;

        // Body
        ctx.fillStyle = '#FF6347';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 18, 20, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shell pattern
        ctx.fillStyle = '#CD5C5C';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 16, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Legs
        ctx.strokeStyle = '#FF6347';
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(screenX + 8, this.y + 20);
            ctx.lineTo(screenX - 5 + i * 3, this.y + 28 + legMove);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(screenX + this.width - 8, this.y + 20);
            ctx.lineTo(screenX + this.width + 5 - i * 3, this.y + 28 - legMove);
            ctx.stroke();
        }

        // Claws
        ctx.fillStyle = '#FF4500';
        const clawX = facingRight ? screenX + this.width - 5 : screenX + 5;
        ctx.beginPath();
        ctx.ellipse(clawX + (facingRight ? 8 : -8), this.y + 10, 10, 6, facingRight ? 0.3 : -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(clawX + (facingRight ? 5 : -5), this.y + 5, 6, 4, facingRight ? -0.5 : 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Eyes on stalks
        ctx.fillStyle = '#FF6347';
        ctx.fillRect(screenX + 15, this.y, 3, 10);
        ctx.fillRect(screenX + 27, this.y, 3, 10);
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(screenX + 16, this.y, 4, 0, Math.PI * 2);
        ctx.arc(screenX + 28, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Jungle Snake Enemy (Level 7)
    drawSnake(ctx, screenX) {
        const wave = Math.sin(this.animFrame * 2);
        const facingRight = this.velX > 0;

        // Body segments with wave
        ctx.fillStyle = '#228B22';
        for (let i = 0; i < 5; i++) {
            const segX = screenX + (facingRight ? i * 10 : this.width - i * 10 - 10);
            const segY = this.y + 12 + Math.sin(this.animFrame * 3 + i) * 4;
            ctx.beginPath();
            ctx.ellipse(segX + 5, segY, 8, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Pattern
        ctx.fillStyle = '#32CD32';
        for (let i = 0; i < 5; i++) {
            const segX = screenX + (facingRight ? i * 10 : this.width - i * 10 - 10);
            const segY = this.y + 12 + Math.sin(this.animFrame * 3 + i) * 4;
            ctx.beginPath();
            ctx.ellipse(segX + 5, segY - 2, 4, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Head
        const headX = facingRight ? screenX + this.width - 12 : screenX;
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.ellipse(headX + 6, this.y + 12, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(headX + (facingRight ? 10 : 2), this.y + 8, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(headX + (facingRight ? 11 : 1), this.y + 8, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Tongue
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(headX + (facingRight ? 16 : -4), this.y + 14);
        ctx.lineTo(headX + (facingRight ? 22 : -10), this.y + 12 + wave * 3);
        ctx.lineTo(headX + (facingRight ? 24 : -12), this.y + 10);
        ctx.moveTo(headX + (facingRight ? 22 : -10), this.y + 12 + wave * 3);
        ctx.lineTo(headX + (facingRight ? 24 : -12), this.y + 16);
        ctx.stroke();
    }

    // Underwater Jellyfish Enemy (Level 8)
    drawJellyfish(ctx, screenX) {
        const float = Math.sin(this.animFrame) * 5;
        const pulse = Math.sin(this.animFrame * 2) * 3;

        // Tentacles
        ctx.strokeStyle = 'rgba(147, 112, 219, 0.8)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
            const tentacleWave = Math.sin(this.animFrame * 2 + i) * 8;
            ctx.beginPath();
            ctx.moveTo(screenX + 5 + i * 7, this.y + 25 + float);
            ctx.quadraticCurveTo(
                screenX + 5 + i * 7 + tentacleWave,
                this.y + 35 + float,
                screenX + 5 + i * 7,
                this.y + 45 + float
            );
            ctx.stroke();
        }

        // Bell (translucent)
        ctx.fillStyle = 'rgba(186, 85, 211, 0.6)';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 15 + float, 16 + pulse, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner glow
        ctx.fillStyle = 'rgba(238, 130, 238, 0.5)';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 12 + float, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(screenX + 13, this.y + 15 + float, 3, 0, Math.PI * 2);
        ctx.arc(screenX + 22, this.y + 15 + float, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // Snow Penguin Enemy (Level 9)
    drawPenguin(ctx, screenX) {
        const waddle = Math.sin(this.animFrame * 4) * 3;
        const facingRight = this.velX > 0;

        // Body
        ctx.fillStyle = '#1C1C1C';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2 + waddle, this.y + 25, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // Belly
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2 + waddle, this.y + 28, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#1C1C1C';
        ctx.beginPath();
        ctx.arc(screenX + this.width / 2 + waddle, this.y + 8, 10, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(screenX + 13 + waddle, this.y + 6, 4, 0, Math.PI * 2);
        ctx.arc(screenX + 22 + waddle, this.y + 6, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        const eyeDir = facingRight ? 1 : -1;
        ctx.beginPath();
        ctx.arc(screenX + 13 + waddle + eyeDir, this.y + 6, 2, 0, Math.PI * 2);
        ctx.arc(screenX + 22 + waddle + eyeDir, this.y + 6, 2, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.moveTo(screenX + this.width / 2 + waddle, this.y + 10);
        ctx.lineTo(screenX + this.width / 2 + waddle + (facingRight ? 8 : -8), this.y + 13);
        ctx.lineTo(screenX + this.width / 2 + waddle, this.y + 16);
        ctx.fill();

        // Feet
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.ellipse(screenX + 12 + waddle, this.y + 38, 6, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(screenX + 23 + waddle, this.y + 38, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Swamp Frog Enemy (Level 10)
    drawFrog(ctx, screenX) {
        const jump = Math.abs(Math.sin(this.animFrame * 2)) * 8;
        const crouch = jump > 4 ? 0 : 3;

        // Back legs
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.ellipse(screenX + 5, this.y + 30 - jump + crouch, 8, 5, -0.5, 0, Math.PI * 2);
        ctx.ellipse(screenX + this.width - 5, this.y + 30 - jump + crouch, 8, 5, 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = '#32CD32';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 22 - jump, 16, 12 - crouch, 0, 0, Math.PI * 2);
        ctx.fill();

        // Spots
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.arc(screenX + 15, this.y + 20 - jump, 4, 0, Math.PI * 2);
        ctx.arc(screenX + 28, this.y + 22 - jump, 3, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (bulging)
        ctx.fillStyle = '#ADFF2F';
        ctx.beginPath();
        ctx.arc(screenX + 12, this.y + 8 - jump, 8, 0, Math.PI * 2);
        ctx.arc(screenX + 28, this.y + 8 - jump, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        const eyeDir = this.velX > 0 ? 2 : -2;
        ctx.beginPath();
        ctx.arc(screenX + 12 + eyeDir, this.y + 8 - jump, 3, 0, Math.PI * 2);
        ctx.arc(screenX + 28 + eyeDir, this.y + 8 - jump, 3, 0, Math.PI * 2);
        ctx.fill();

        // Mouth
        ctx.strokeStyle = '#006400';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenX + this.width / 2, this.y + 22 - jump, 8, 0.2, Math.PI - 0.2);
        ctx.stroke();
    }

    // Ruins Mummy Enemy (Level 11)
    drawMummy(ctx, screenX) {
        const sway = Math.sin(this.animFrame) * 2;
        const facingRight = this.velX > 0;

        // Body wrapped in bandages
        ctx.fillStyle = '#DEB887';
        ctx.fillRect(screenX + 10 + sway, this.y + 15, 15, 35);

        // Bandage wrapping effect
        ctx.strokeStyle = '#F5DEB3';
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(screenX + 8 + sway, this.y + 18 + i * 5);
            ctx.lineTo(screenX + 27 + sway, this.y + 20 + i * 5);
            ctx.stroke();
        }

        // Head
        ctx.fillStyle = '#DEB887';
        ctx.beginPath();
        ctx.arc(screenX + this.width / 2 + sway, this.y + 10, 12, 0, Math.PI * 2);
        ctx.fill();

        // Head bandages
        ctx.strokeStyle = '#F5DEB3';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.arc(screenX + this.width / 2 + sway, this.y + 10, 10 - i * 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Glowing eyes
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.arc(screenX + 13 + sway, this.y + 8, 3, 0, Math.PI * 2);
        ctx.arc(screenX + 22 + sway, this.y + 8, 3, 0, Math.PI * 2);
        ctx.fill();

        // Arms reaching out
        ctx.fillStyle = '#DEB887';
        const armReach = facingRight ? 10 : -10;
        ctx.fillRect(screenX + (facingRight ? 25 : 0) + sway, this.y + 20, 15 + Math.abs(armReach), 6);
    }

    // Factory Robot Enemy (Level 12)
    drawRobot(ctx, screenX) {
        const bob = Math.sin(this.animFrame * 3) * 2;
        const facingRight = this.velX > 0;

        // Legs
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(screenX + 10, this.y + 35 + bob, 8, 10);
        ctx.fillRect(screenX + 22, this.y + 35 + bob, 8, 10);

        // Body
        ctx.fillStyle = '#708090';
        ctx.fillRect(screenX + 5, this.y + 15 + bob, 30, 22);

        // Chest panel
        ctx.fillStyle = '#2F4F4F';
        ctx.fillRect(screenX + 10, this.y + 20 + bob, 20, 12);

        // Lights on chest
        const blinkOn = Math.sin(this.animFrame * 5) > 0;
        ctx.fillStyle = blinkOn ? '#FF0000' : '#8B0000';
        ctx.beginPath();
        ctx.arc(screenX + 15, this.y + 26 + bob, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = blinkOn ? '#00FF00' : '#006400';
        ctx.beginPath();
        ctx.arc(screenX + 25, this.y + 26 + bob, 3, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#778899';
        ctx.fillRect(screenX + 8, this.y + bob, 24, 16);

        // Antenna
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(screenX + 18, this.y - 8 + bob, 4, 10);
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(screenX + 20, this.y - 10 + bob, 4, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#00FFFF';
        ctx.fillRect(screenX + 12, this.y + 5 + bob, 6, 4);
        ctx.fillRect(screenX + 22, this.y + 5 + bob, 6, 4);

        // Arms
        ctx.fillStyle = '#708090';
        ctx.fillRect(screenX - 3, this.y + 18 + bob, 8, 6);
        ctx.fillRect(screenX + 35, this.y + 18 + bob, 8, 6);
    }

    // Underground Mole Enemy (Level 13)
    drawMole(ctx, screenX) {
        const dig = Math.sin(this.animFrame * 4) * 3;
        const facingRight = this.velX > 0;

        // Body
        ctx.fillStyle = '#5D4E37';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 20, 18, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // Fur texture
        ctx.fillStyle = '#8B7355';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 18, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Nose (big pink)
        ctx.fillStyle = '#FFB6C1';
        ctx.beginPath();
        ctx.ellipse(screenX + (facingRight ? this.width - 5 : 5), this.y + 18, 8, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (tiny, moles are nearly blind)
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(screenX + (facingRight ? 28 : 12), this.y + 14, 2, 0, Math.PI * 2);
        ctx.fill();

        // Claws
        ctx.fillStyle = '#3D2914';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(screenX + 5 + i * 5, this.y + 32);
            ctx.lineTo(screenX + 3 + i * 5, this.y + 35 + dig);
            ctx.lineTo(screenX + 7 + i * 5, this.y + 35 + dig);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(screenX + this.width - 5 - i * 5, this.y + 32);
            ctx.lineTo(screenX + this.width - 3 - i * 5, this.y + 35 - dig);
            ctx.lineTo(screenX + this.width - 7 - i * 5, this.y + 35 - dig);
            ctx.fill();
        }
    }

    // Candy Gummy Bear Enemy (Level 14)
    drawGummyBear(ctx, screenX) {
        const bounce = Math.abs(Math.sin(this.animFrame * 3)) * 5;
        const squish = bounce > 2 ? 0.9 : 1.1;

        // Random bright color based on position
        const colors = ['#FF69B4', '#00CED1', '#FFD700', '#32CD32', '#FF6347'];
        const colorIndex = Math.floor(this.x / 100) % colors.length;
        const mainColor = colors[colorIndex];

        // Body
        ctx.fillStyle = mainColor;
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 25 - bounce, 14 * squish, 16 / squish, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.beginPath();
        ctx.arc(screenX + 10, this.y + 5 - bounce, 6, 0, Math.PI * 2);
        ctx.arc(screenX + 25, this.y + 5 - bounce, 6, 0, Math.PI * 2);
        ctx.fill();

        // Shine effect (gummy look)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2 - 4, this.y + 20 - bounce, 5, 8, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000';
        const eyeDir = this.velX > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.arc(screenX + 13 + eyeDir, this.y + 18 - bounce, 3, 0, Math.PI * 2);
        ctx.arc(screenX + 22 + eyeDir, this.y + 18 - bounce, 3, 0, Math.PI * 2);
        ctx.fill();

        // Cute mouth
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenX + this.width / 2, this.y + 26 - bounce, 5, 0.2, Math.PI - 0.2);
        ctx.stroke();
    }

    // Space Alien Enemy (Level 15)
    drawAlien(ctx, screenX) {
        const hover = Math.sin(this.animFrame * 2) * 4;
        const facingRight = this.velX > 0;

        // Glow effect
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 25 + hover, 25, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        ctx.fillStyle = '#32CD32';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 28 + hover, 14, 16, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head (big)
        ctx.fillStyle = '#7CFC00';
        ctx.beginPath();
        ctx.ellipse(screenX + this.width / 2, this.y + 12 + hover, 16, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Big black eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(screenX + 12, this.y + 10 + hover, 6, 8, -0.2, 0, Math.PI * 2);
        ctx.ellipse(screenX + 28, this.y + 10 + hover, 6, 8, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Eye shine
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(screenX + 10, this.y + 8 + hover, 2, 0, Math.PI * 2);
        ctx.arc(screenX + 26, this.y + 8 + hover, 2, 0, Math.PI * 2);
        ctx.fill();

        // Antennae
        ctx.strokeStyle = '#32CD32';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX + 15, this.y + 2 + hover);
        ctx.lineTo(screenX + 12, this.y - 8 + hover);
        ctx.moveTo(screenX + 25, this.y + 2 + hover);
        ctx.lineTo(screenX + 28, this.y - 8 + hover);
        ctx.stroke();
        ctx.fillStyle = '#ADFF2F';
        ctx.beginPath();
        ctx.arc(screenX + 12, this.y - 10 + hover, 4, 0, Math.PI * 2);
        ctx.arc(screenX + 28, this.y - 10 + hover, 4, 0, Math.PI * 2);
        ctx.fill();

        // Arms
        ctx.fillStyle = '#32CD32';
        ctx.beginPath();
        ctx.ellipse(screenX + 3, this.y + 28 + hover, 5, 8, -0.5, 0, Math.PI * 2);
        ctx.ellipse(screenX + this.width - 3, this.y + 28 + hover, 5, 8, 0.5, 0, Math.PI * 2);
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
            // New Boss Types (Level 6-15)
            case 'octopus':
                this.width = 140;
                this.height = 120;
                this.velX = 1.5;
                break;
            case 'gorilla':
                this.width = 120;
                this.height = 130;
                this.velX = 1.2;
                break;
            case 'shark':
                this.width = 160;
                this.height = 80;
                this.velX = 2.5;
                break;
            case 'yeti':
                this.width = 130;
                this.height = 140;
                this.velX = 1;
                this.health = 4;
                this.maxHealth = 4;
                break;
            case 'swamp_monster':
                this.width = 120;
                this.height = 110;
                this.velX = 1.3;
                this.health = 4;
                this.maxHealth = 4;
                break;
            case 'pharaoh':
                this.width = 100;
                this.height = 130;
                this.velX = 1.5;
                this.health = 4;
                this.maxHealth = 4;
                break;
            case 'mega_robot':
                this.width = 130;
                this.height = 150;
                this.velX = 1.2;
                this.health = 4;
                this.maxHealth = 4;
                break;
            case 'worm_king':
                this.width = 160;
                this.height = 90;
                this.velX = 1.8;
                this.health = 4;
                this.maxHealth = 4;
                break;
            case 'candy_boss':
                this.width = 140;
                this.height = 130;
                this.velX = 2;
                this.health = 5;
                this.maxHealth = 5;
                break;
            case 'ufo':
                this.width = 160;
                this.height = 100;
                this.velX = 2.5;
                this.health = 5;
                this.maxHealth = 5;
                break;
            default:
                this.width = 100;
                this.height = 80;
        }

        this.startX = x;
        this.direction = 1;

        // Shooting properties (activated for Level 10+)
        this.canShoot = false;
        this.shootCooldown = 0;
        this.shootPattern = 0;

        // Set projectile type based on boss type
        switch(type) {
            case 'yeti':
                this.projectileType = 'iceball';
                this.shootInterval = 90; // 1.5 seconds
                break;
            case 'swamp_monster':
                this.projectileType = 'slime';
                this.shootInterval = 70;
                break;
            case 'pharaoh':
                this.projectileType = 'rock';
                this.shootInterval = 80;
                break;
            case 'mega_robot':
                this.projectileType = 'laser';
                this.shootInterval = 50;
                break;
            case 'worm_king':
                this.projectileType = 'slime';
                this.shootInterval = 60;
                break;
            case 'candy_boss':
                this.projectileType = 'fireball';
                this.shootInterval = 55;
                break;
            case 'ufo':
                this.projectileType = 'laser';
                this.shootInterval = 40;
                break;
            default:
                this.projectileType = 'fireball';
                this.shootInterval = 100;
        }
    }

    shoot() {
        if (!this.canShoot || this.shootCooldown > 0 || !game.player) return;

        const playerX = game.player.x + game.player.width / 2;
        const playerY = game.player.y + game.player.height / 2;
        const bossX = this.x + this.width / 2;
        const bossY = this.y + this.height / 2;

        // Calculate direction to player
        const dx = playerX - bossX;
        const dy = playerY - bossY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only shoot if player is within range
        if (distance > 500) return;

        let velX, velY;
        const speed = 4;

        // Different shooting patterns based on phase and type
        if (this.phase === 2) {
            // Phase 2: More aggressive shooting
            this.shootPattern = (this.shootPattern + 1) % 3;

            if (this.shootPattern === 0) {
                // Aimed shot
                velX = (dx / distance) * speed;
                velY = (dy / distance) * speed;
                game.projectiles.push(new Projectile(bossX, bossY, velX, velY, this.projectileType));
            } else if (this.shootPattern === 1) {
                // Spread shot (3 projectiles)
                for (let angle = -0.3; angle <= 0.3; angle += 0.3) {
                    const spreadX = (dx / distance) * Math.cos(angle) - (dy / distance) * Math.sin(angle);
                    const spreadY = (dx / distance) * Math.sin(angle) + (dy / distance) * Math.cos(angle);
                    game.projectiles.push(new Projectile(bossX, bossY, spreadX * speed, spreadY * speed, this.projectileType));
                }
            } else {
                // Vertical barrage
                game.projectiles.push(new Projectile(bossX - 30, bossY, 0, speed, this.projectileType));
                game.projectiles.push(new Projectile(bossX + 30, bossY, 0, speed, this.projectileType));
            }
            this.shootCooldown = Math.floor(this.shootInterval * 0.6); // Faster shooting in phase 2
        } else {
            // Phase 1: Simple aimed shot
            velX = (dx / distance) * speed;
            velY = (dy / distance) * speed;
            game.projectiles.push(new Projectile(bossX, bossY, velX, velY, this.projectileType));
            this.shootCooldown = this.shootInterval;
        }
    }

    update() {
        if (!this.alive) return;

        this.animFrame += 0.05;

        if (this.invulnerable > 0) {
            this.invulnerable--;
        }

        // Shooting logic
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }
        this.shoot();

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
            // New Boss Types (Level 6-15)
            case 'octopus':
                this.drawOctopus(ctx, screenX);
                break;
            case 'gorilla':
                this.drawGorilla(ctx, screenX);
                break;
            case 'shark':
                this.drawShark(ctx, screenX);
                break;
            case 'yeti':
                this.drawYeti(ctx, screenX);
                break;
            case 'swamp_monster':
                this.drawSwampMonster(ctx, screenX);
                break;
            case 'pharaoh':
                this.drawPharaoh(ctx, screenX);
                break;
            case 'mega_robot':
                this.drawMegaRobot(ctx, screenX);
                break;
            case 'worm_king':
                this.drawWormKing(ctx, screenX);
                break;
            case 'candy_boss':
                this.drawCandyBoss(ctx, screenX);
                break;
            case 'ufo':
                this.drawUFO(ctx, screenX);
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

    // === NEW BOSS DRAW METHODS ===

    // Giant Octopus Boss (Level 6 - Beach)
    drawOctopus(ctx, screenX) {
        const pulse = Math.sin(this.animFrame) * 5;
        const facingRight = this.direction > 0;

        // Tentacles
        ctx.fillStyle = '#8B008B';
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const tentacleWave = Math.sin(this.animFrame * 2 + i) * 15;
            ctx.beginPath();
            const startX = screenX + 70 + Math.cos(angle) * 30;
            const startY = this.y + 70 + Math.sin(angle) * 20;
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(
                startX + Math.cos(angle) * 30 + tentacleWave,
                startY + 30,
                startX + Math.cos(angle) * 50,
                startY + 50
            );
            ctx.lineWidth = 12;
            ctx.strokeStyle = '#8B008B';
            ctx.stroke();
        }

        // Suction cups
        ctx.fillStyle = '#DDA0DD';
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            for (let j = 1; j < 4; j++) {
                ctx.beginPath();
                ctx.arc(
                    screenX + 70 + Math.cos(angle) * (30 + j * 15),
                    this.y + 70 + Math.sin(angle) * 20 + j * 12,
                    4, 0, Math.PI * 2
                );
                ctx.fill();
            }
        }

        // Head
        ctx.fillStyle = '#9932CC';
        ctx.beginPath();
        ctx.ellipse(screenX + 70, this.y + 50 + pulse, 45, 40, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.ellipse(screenX + 50, this.y + 45, 15, 12, 0, 0, Math.PI * 2);
        ctx.ellipse(screenX + 90, this.y + 45, 15, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        const eyeDir = facingRight ? 3 : -3;
        ctx.beginPath();
        ctx.arc(screenX + 50 + eyeDir, this.y + 45, 6, 0, Math.PI * 2);
        ctx.arc(screenX + 90 + eyeDir, this.y + 45, 6, 0, Math.PI * 2);
        ctx.fill();

        // Ink spray (phase 2)
        if (this.phase >= 2 && Math.sin(this.animFrame * 4) > 0.5) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.arc(
                    screenX + 70 + (facingRight ? 60 : -60) + Math.random() * 30,
                    this.y + 60 + Math.random() * 20,
                    8 + Math.random() * 8, 0, Math.PI * 2
                );
                ctx.fill();
            }
        }
    }

    // Gorilla King Boss (Level 7 - Jungle)
    drawGorilla(ctx, screenX) {
        const beat = Math.sin(this.animFrame * 4) * 5;
        const facingRight = this.direction > 0;

        // Body
        ctx.fillStyle = '#2F2F2F';
        ctx.beginPath();
        ctx.ellipse(screenX + 60, this.y + 80, 50, 45, 0, 0, Math.PI * 2);
        ctx.fill();

        // Chest
        ctx.fillStyle = '#4A4A4A';
        ctx.beginPath();
        ctx.ellipse(screenX + 60, this.y + 85, 35, 35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Arms
        ctx.fillStyle = '#2F2F2F';
        const armSwing = this.phase >= 2 ? beat * 2 : 0;
        ctx.beginPath();
        ctx.ellipse(screenX + 15 - armSwing, this.y + 70, 20, 35, -0.3, 0, Math.PI * 2);
        ctx.ellipse(screenX + 105 + armSwing, this.y + 70, 20, 35, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Hands
        ctx.fillStyle = '#1C1C1C';
        ctx.beginPath();
        ctx.arc(screenX + 10 - armSwing, this.y + 100, 15, 0, Math.PI * 2);
        ctx.arc(screenX + 110 + armSwing, this.y + 100, 15, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#2F2F2F';
        ctx.beginPath();
        ctx.ellipse(screenX + 60, this.y + 30, 35, 30, 0, 0, Math.PI * 2);
        ctx.fill();

        // Face
        ctx.fillStyle = '#1C1C1C';
        ctx.beginPath();
        ctx.ellipse(screenX + 60, this.y + 35, 25, 20, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (angry)
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.arc(screenX + 48, this.y + 25, 8, 0, Math.PI * 2);
        ctx.arc(screenX + 72, this.y + 25, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(screenX + 48 + (facingRight ? 2 : -2), this.y + 25, 4, 0, Math.PI * 2);
        ctx.arc(screenX + 72 + (facingRight ? 2 : -2), this.y + 25, 4, 0, Math.PI * 2);
        ctx.fill();

        // Angry eyebrows
        ctx.strokeStyle = '#2F2F2F';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(screenX + 40, this.y + 15);
        ctx.lineTo(screenX + 55, this.y + 20);
        ctx.moveTo(screenX + 80, this.y + 15);
        ctx.lineTo(screenX + 65, this.y + 20);
        ctx.stroke();

        // Crown
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(screenX + 35, this.y + 5);
        ctx.lineTo(screenX + 40, this.y - 15);
        ctx.lineTo(screenX + 50, this.y);
        ctx.lineTo(screenX + 60, this.y - 20);
        ctx.lineTo(screenX + 70, this.y);
        ctx.lineTo(screenX + 80, this.y - 15);
        ctx.lineTo(screenX + 85, this.y + 5);
        ctx.fill();
    }

    // Shark Boss (Level 8 - Underwater)
    drawShark(ctx, screenX) {
        const swim = Math.sin(this.animFrame) * 8;
        const facingRight = this.direction > 0;

        // Body
        ctx.fillStyle = '#4682B4';
        ctx.beginPath();
        ctx.ellipse(screenX + 80, this.y + 40 + swim, 70, 30, 0, 0, Math.PI * 2);
        ctx.fill();

        // Underside
        ctx.fillStyle = '#B0C4DE';
        ctx.beginPath();
        ctx.ellipse(screenX + 80, this.y + 50 + swim, 50, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dorsal fin
        ctx.fillStyle = '#4682B4';
        ctx.beginPath();
        ctx.moveTo(screenX + 70, this.y + 15 + swim);
        ctx.lineTo(screenX + 80, this.y - 15 + swim);
        ctx.lineTo(screenX + 95, this.y + 20 + swim);
        ctx.fill();

        // Tail
        const tailX = facingRight ? screenX : screenX + 140;
        ctx.beginPath();
        ctx.moveTo(tailX + (facingRight ? 20 : -20), this.y + 40 + swim);
        ctx.lineTo(tailX, this.y + 20 + swim);
        ctx.lineTo(tailX + (facingRight ? -10 : 10), this.y + 40 + swim);
        ctx.lineTo(tailX, this.y + 60 + swim);
        ctx.fill();

        // Head
        const headX = facingRight ? screenX + 130 : screenX + 30;
        ctx.fillStyle = '#4682B4';
        ctx.beginPath();
        ctx.ellipse(headX, this.y + 40 + swim, 30, 25, facingRight ? 0.2 : -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(headX + (facingRight ? -5 : 5), this.y + 35 + swim, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(headX + (facingRight ? -5 : 5), this.y + 35 + swim, 3, 0, Math.PI * 2);
        ctx.fill();

        // Teeth
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const toothX = headX + (facingRight ? 15 : -15) + (facingRight ? i * 4 : -i * 4);
            ctx.moveTo(toothX, this.y + 45 + swim);
            ctx.lineTo(toothX + 2, this.y + 55 + swim);
            ctx.lineTo(toothX + 4, this.y + 45 + swim);
        }
        ctx.fill();
    }

    // Yeti Boss (Level 9 - Snow)
    drawYeti(ctx, screenX) {
        const stomp = Math.abs(Math.sin(this.animFrame * 2)) * 5;
        const facingRight = this.direction > 0;

        // Body (furry)
        ctx.fillStyle = '#F5F5F5';
        ctx.beginPath();
        ctx.ellipse(screenX + 65, this.y + 85, 55, 50, 0, 0, Math.PI * 2);
        ctx.fill();

        // Fur texture
        ctx.fillStyle = '#E8E8E8';
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            ctx.arc(
                screenX + 30 + Math.random() * 70,
                this.y + 60 + Math.random() * 60,
                5 + Math.random() * 5, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // Arms
        ctx.fillStyle = '#F5F5F5';
        const armRaise = this.phase >= 2 ? stomp * 3 : stomp;
        ctx.beginPath();
        ctx.ellipse(screenX + 15, this.y + 60 - armRaise, 25, 40, -0.4, 0, Math.PI * 2);
        ctx.ellipse(screenX + 115, this.y + 60 - armRaise, 25, 40, 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = '#F5F5F5';
        ctx.beginPath();
        ctx.ellipse(screenX + 65, this.y + 25, 40, 35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Face
        ctx.fillStyle = '#ADD8E6';
        ctx.beginPath();
        ctx.ellipse(screenX + 65, this.y + 30, 25, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(screenX + 52, this.y + 22, 8, 0, Math.PI * 2);
        ctx.arc(screenX + 78, this.y + 22, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#87CEEB';
        ctx.beginPath();
        ctx.arc(screenX + 52 + (facingRight ? 2 : -2), this.y + 22, 4, 0, Math.PI * 2);
        ctx.arc(screenX + 78 + (facingRight ? 2 : -2), this.y + 22, 4, 0, Math.PI * 2);
        ctx.fill();

        // Horns
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(screenX + 35, this.y + 5);
        ctx.lineTo(screenX + 25, this.y - 25);
        ctx.lineTo(screenX + 45, this.y + 10);
        ctx.moveTo(screenX + 95, this.y + 5);
        ctx.lineTo(screenX + 105, this.y - 25);
        ctx.lineTo(screenX + 85, this.y + 10);
        ctx.fill();

        // Mouth (roaring)
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.ellipse(screenX + 65, this.y + 45, 15, 10 + stomp, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Swamp Monster Boss (Level 10 - Swamp)
    drawSwampMonster(ctx, screenX) {
        const bubble = Math.sin(this.animFrame * 3) * 8;
        const facingRight = this.direction > 0;

        // Slime drips
        ctx.fillStyle = 'rgba(107, 142, 35, 0.5)';
        for (let i = 0; i < 6; i++) {
            const dripY = (this.animFrame * 50 + i * 30) % 80;
            ctx.beginPath();
            ctx.ellipse(
                screenX + 20 + i * 20,
                this.y + 100 + dripY,
                5, 10, 0, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // Body (blob-like)
        ctx.fillStyle = '#6B8E23';
        ctx.beginPath();
        ctx.ellipse(screenX + 60, this.y + 60 + bubble, 55, 50, 0, 0, Math.PI * 2);
        ctx.fill();

        // Texture
        ctx.fillStyle = '#556B2F';
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            ctx.arc(
                screenX + 25 + Math.random() * 70,
                this.y + 40 + Math.random() * 50 + bubble,
                8 + Math.random() * 8, 0, Math.PI * 2
            );
            ctx.fill();
        }

        // Eyes (multiple)
        ctx.fillStyle = '#ADFF2F';
        ctx.beginPath();
        ctx.arc(screenX + 40, this.y + 35 + bubble, 12, 0, Math.PI * 2);
        ctx.arc(screenX + 70, this.y + 30 + bubble, 15, 0, Math.PI * 2);
        ctx.arc(screenX + 90, this.y + 45 + bubble, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        const eyeDir = facingRight ? 3 : -3;
        ctx.beginPath();
        ctx.arc(screenX + 40 + eyeDir, this.y + 35 + bubble, 5, 0, Math.PI * 2);
        ctx.arc(screenX + 70 + eyeDir, this.y + 30 + bubble, 6, 0, Math.PI * 2);
        ctx.arc(screenX + 90 + eyeDir, this.y + 45 + bubble, 4, 0, Math.PI * 2);
        ctx.fill();

        // Mouth
        ctx.fillStyle = '#2F4F4F';
        ctx.beginPath();
        ctx.ellipse(screenX + 60, this.y + 75 + bubble, 25, 15, 0, 0, Math.PI);
        ctx.fill();
    }

    // Pharaoh Boss (Level 11 - Ruins)
    drawPharaoh(ctx, screenX) {
        const hover = Math.sin(this.animFrame) * 5;
        const facingRight = this.direction > 0;

        // Aura
        ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(screenX + 50, this.y + 70 + hover, 60, 70, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body (wrapped)
        ctx.fillStyle = '#DEB887';
        ctx.fillRect(screenX + 25, this.y + 50 + hover, 50, 75);

        // Bandage pattern
        ctx.strokeStyle = '#F5DEB3';
        ctx.lineWidth = 3;
        for (let i = 0; i < 10; i++) {
            ctx.beginPath();
            ctx.moveTo(screenX + 20, this.y + 55 + i * 8 + hover);
            ctx.lineTo(screenX + 80, this.y + 58 + i * 8 + hover);
            ctx.stroke();
        }

        // Arms crossed
        ctx.fillStyle = '#DEB887';
        ctx.beginPath();
        ctx.moveTo(screenX + 25, this.y + 60 + hover);
        ctx.lineTo(screenX + 10, this.y + 80 + hover);
        ctx.lineTo(screenX + 75, this.y + 70 + hover);
        ctx.fill();

        // Head/Mask
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.ellipse(screenX + 50, this.y + 30 + hover, 30, 28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Headdress
        ctx.fillStyle = '#4169E1';
        ctx.beginPath();
        ctx.moveTo(screenX + 20, this.y + 30 + hover);
        ctx.lineTo(screenX + 10, this.y + 60 + hover);
        ctx.lineTo(screenX + 25, this.y + 50 + hover);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(screenX + 80, this.y + 30 + hover);
        ctx.lineTo(screenX + 90, this.y + 60 + hover);
        ctx.lineTo(screenX + 75, this.y + 50 + hover);
        ctx.fill();

        // Face
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(screenX + 40, this.y + 25 + hover, 6, 8, -0.2, 0, Math.PI * 2);
        ctx.ellipse(screenX + 60, this.y + 25 + hover, 6, 8, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Glowing eyes (phase 2)
        if (this.phase >= 2) {
            ctx.fillStyle = '#FF4500';
            ctx.beginPath();
            ctx.arc(screenX + 40, this.y + 25 + hover, 4, 0, Math.PI * 2);
            ctx.arc(screenX + 60, this.y + 25 + hover, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Staff
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(screenX + (facingRight ? 75 : 15), this.y + 20 + hover, 6, 100);
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(screenX + (facingRight ? 78 : 18), this.y + 15 + hover, 12, 0, Math.PI * 2);
        ctx.fill();
    }

    // Mega Robot Boss (Level 12 - Factory)
    drawMegaRobot(ctx, screenX) {
        const step = Math.abs(Math.sin(this.animFrame * 2)) * 5;
        const facingRight = this.direction > 0;

        // Legs
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(screenX + 30, this.y + 110, 25, 40);
        ctx.fillRect(screenX + 75, this.y + 110, 25, 40);

        // Feet
        ctx.fillStyle = '#2F2F2F';
        ctx.fillRect(screenX + 20, this.y + 140 + step, 45, 15);
        ctx.fillRect(screenX + 65, this.y + 140 - step, 45, 15);

        // Body
        ctx.fillStyle = '#708090';
        ctx.fillRect(screenX + 15, this.y + 40, 100, 75);

        // Chest panel
        ctx.fillStyle = '#2F4F4F';
        ctx.fillRect(screenX + 30, this.y + 50, 70, 55);

        // Reactor core
        const coreGlow = Math.sin(this.animFrame * 3) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(0, 255, 255, ${coreGlow})`;
        ctx.beginPath();
        ctx.arc(screenX + 65, this.y + 77, 20, 0, Math.PI * 2);
        ctx.fill();

        // Arms
        ctx.fillStyle = '#708090';
        const armSwing = this.phase >= 2 ? step * 2 : 0;
        ctx.fillRect(screenX - 15, this.y + 50 - armSwing, 30, 60);
        ctx.fillRect(screenX + 115, this.y + 50 + armSwing, 30, 60);

        // Hands (claws)
        ctx.fillStyle = '#4A4A4A';
        ctx.beginPath();
        ctx.moveTo(screenX - 15, this.y + 105 - armSwing);
        ctx.lineTo(screenX - 25, this.y + 125 - armSwing);
        ctx.lineTo(screenX - 5, this.y + 115 - armSwing);
        ctx.lineTo(screenX + 5, this.y + 125 - armSwing);
        ctx.lineTo(screenX + 15, this.y + 105 - armSwing);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(screenX + 115, this.y + 105 + armSwing);
        ctx.lineTo(screenX + 105, this.y + 125 + armSwing);
        ctx.lineTo(screenX + 125, this.y + 115 + armSwing);
        ctx.lineTo(screenX + 135, this.y + 125 + armSwing);
        ctx.lineTo(screenX + 145, this.y + 105 + armSwing);
        ctx.fill();

        // Head
        ctx.fillStyle = '#778899';
        ctx.fillRect(screenX + 35, this.y + 5, 60, 40);

        // Eyes
        ctx.fillStyle = this.phase >= 2 ? '#FF0000' : '#00FF00';
        ctx.fillRect(screenX + 45, this.y + 15, 15, 10);
        ctx.fillRect(screenX + 70, this.y + 15, 15, 10);

        // Antenna
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(screenX + 62, this.y - 15, 6, 25);
        const antennaGlow = Math.sin(this.animFrame * 5) > 0;
        ctx.fillStyle = antennaGlow ? '#FF0000' : '#8B0000';
        ctx.beginPath();
        ctx.arc(screenX + 65, this.y - 20, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    // Worm King Boss (Level 13 - Underground)
    drawWormKing(ctx, screenX) {
        const wave = this.animFrame;
        const facingRight = this.direction > 0;

        // Body segments
        ctx.fillStyle = '#8B4513';
        for (let i = 0; i < 8; i++) {
            const segX = screenX + (facingRight ? i * 20 : 140 - i * 20);
            const segY = this.y + 45 + Math.sin(wave + i * 0.5) * 15;
            ctx.beginPath();
            ctx.ellipse(segX + 10, segY, 18, 22, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Segment rings
        ctx.strokeStyle = '#A0522D';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const segX = screenX + (facingRight ? i * 20 : 140 - i * 20);
            const segY = this.y + 45 + Math.sin(wave + i * 0.5) * 15;
            ctx.beginPath();
            ctx.ellipse(segX + 10, segY, 16, 20, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Head
        const headX = facingRight ? screenX + 145 : screenX + 15;
        const headY = this.y + 45 + Math.sin(wave + 4) * 15;
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.ellipse(headX, headY, 25, 30, facingRight ? 0.3 : -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Crown
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(headX - 20, headY - 25);
        ctx.lineTo(headX - 15, headY - 45);
        ctx.lineTo(headX - 5, headY - 30);
        ctx.lineTo(headX, headY - 50);
        ctx.lineTo(headX + 5, headY - 30);
        ctx.lineTo(headX + 15, headY - 45);
        ctx.lineTo(headX + 20, headY - 25);
        ctx.fill();

        // Mouth
        ctx.fillStyle = '#2F2F2F';
        ctx.beginPath();
        ctx.arc(headX + (facingRight ? 15 : -15), headY, 15, 0, Math.PI * 2);
        ctx.fill();

        // Teeth
        ctx.fillStyle = '#FFF';
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(headX + (facingRight ? 20 : -20), headY - 10 + i * 4);
            ctx.lineTo(headX + (facingRight ? 30 : -30), headY - 8 + i * 4);
            ctx.lineTo(headX + (facingRight ? 20 : -20), headY - 6 + i * 4);
            ctx.fill();
        }

        // Eyes
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.arc(headX - 5, headY - 10, 6, 0, Math.PI * 2);
        ctx.arc(headX + 5, headY - 10, 6, 0, Math.PI * 2);
        ctx.fill();
    }

    // Candy Boss (Level 14 - Candy)
    drawCandyBoss(ctx, screenX) {
        const bounce = Math.abs(Math.sin(this.animFrame * 2)) * 10;
        const spin = this.animFrame;

        // Rainbow swirl body
        const colors = ['#FF69B4', '#FFD700', '#00CED1', '#32CD32', '#FF6347', '#9370DB'];
        for (let i = 0; i < 6; i++) {
            ctx.fillStyle = colors[i];
            ctx.beginPath();
            ctx.arc(
                screenX + 70,
                this.y + 70 - bounce,
                50 - i * 5,
                spin + i * 0.5,
                spin + i * 0.5 + Math.PI * 1.5
            );
            ctx.lineTo(screenX + 70, this.y + 70 - bounce);
            ctx.fill();
        }

        // Outer swirl
        ctx.fillStyle = '#FF69B4';
        ctx.beginPath();
        ctx.ellipse(screenX + 70, this.y + 70 - bounce, 55, 50, 0, 0, Math.PI * 2);
        ctx.fill();

        // Face area
        ctx.fillStyle = '#FFB6C1';
        ctx.beginPath();
        ctx.ellipse(screenX + 70, this.y + 60 - bounce, 40, 35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Candy eyes
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(screenX + 50, this.y + 50 - bounce, 15, 0, Math.PI * 2);
        ctx.arc(screenX + 90, this.y + 50 - bounce, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FF1493';
        ctx.beginPath();
        ctx.arc(screenX + 50, this.y + 50 - bounce, 8, 0, Math.PI * 2);
        ctx.arc(screenX + 90, this.y + 50 - bounce, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(screenX + 48, this.y + 47 - bounce, 3, 0, Math.PI * 2);
        ctx.arc(screenX + 88, this.y + 47 - bounce, 3, 0, Math.PI * 2);
        ctx.fill();

        // Mouth
        ctx.fillStyle = '#FF1493';
        ctx.beginPath();
        ctx.arc(screenX + 70, this.y + 75 - bounce, 15, 0, Math.PI);
        ctx.fill();

        // Candy wrapper ears
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.moveTo(screenX + 20, this.y + 40 - bounce);
        ctx.lineTo(screenX - 10, this.y + 30 - bounce);
        ctx.lineTo(screenX + 25, this.y + 60 - bounce);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(screenX + 120, this.y + 40 - bounce);
        ctx.lineTo(screenX + 150, this.y + 30 - bounce);
        ctx.lineTo(screenX + 115, this.y + 60 - bounce);
        ctx.fill();
    }

    // UFO Boss (Level 15 - Space)
    drawUFO(ctx, screenX) {
        const hover = Math.sin(this.animFrame * 2) * 8;
        const rotation = this.animFrame * 0.5;

        // Tractor beam (phase 2)
        if (this.phase >= 2) {
            const beamPulse = Math.sin(this.animFrame * 4) * 0.3 + 0.5;
            ctx.fillStyle = `rgba(0, 255, 255, ${beamPulse})`;
            ctx.beginPath();
            ctx.moveTo(screenX + 50, this.y + 60 + hover);
            ctx.lineTo(screenX + 20, this.y + 150);
            ctx.lineTo(screenX + 140, this.y + 150);
            ctx.lineTo(screenX + 110, this.y + 60 + hover);
            ctx.fill();
        }

        // UFO body glow
        ctx.fillStyle = 'rgba(127, 255, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX + 80, this.y + 50 + hover, 85, 45, 0, 0, Math.PI * 2);
        ctx.fill();

        // UFO body
        ctx.fillStyle = '#708090';
        ctx.beginPath();
        ctx.ellipse(screenX + 80, this.y + 55 + hover, 70, 25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dome
        ctx.fillStyle = 'rgba(135, 206, 250, 0.7)';
        ctx.beginPath();
        ctx.ellipse(screenX + 80, this.y + 35 + hover, 35, 30, 0, Math.PI, 0);
        ctx.fill();

        // Dome reflection
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX + 70, this.y + 25 + hover, 15, 12, -0.3, 0, Math.PI * 2);
        ctx.fill();

        // Alien inside
        ctx.fillStyle = '#32CD32';
        ctx.beginPath();
        ctx.ellipse(screenX + 80, this.y + 30 + hover, 15, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(screenX + 73, this.y + 28 + hover, 4, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(screenX + 87, this.y + 28 + hover, 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rotating lights
        ctx.fillStyle = '#FF0000';
        for (let i = 0; i < 8; i++) {
            const lightAngle = rotation + (i / 8) * Math.PI * 2;
            const lightX = screenX + 80 + Math.cos(lightAngle) * 55;
            const lightY = this.y + 55 + hover + Math.sin(lightAngle) * 15;
            const lightOn = Math.sin(this.animFrame * 5 + i) > 0;
            ctx.fillStyle = lightOn ? '#FF0000' : '#8B0000';
            ctx.beginPath();
            ctx.arc(lightX, lightY, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Bottom lights
        ctx.fillStyle = '#00FFFF';
        for (let i = 0; i < 5; i++) {
            const pulse = Math.sin(this.animFrame * 3 + i) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(0, 255, 255, ${pulse})`;
            ctx.beginPath();
            ctx.arc(screenX + 40 + i * 20, this.y + 70 + hover, 5, 0, Math.PI * 2);
            ctx.fill();
        }
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
        this.y = 450 + getYOffset();
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

// Projectile Class - Boss projectiles for defense
class Projectile {
    constructor(x, y, velX, velY, type = 'fireball') {
        this.x = x;
        this.y = y;
        this.velX = velX;
        this.velY = velY;
        this.type = type;
        this.alive = true;
        this.animFrame = 0;

        // Set size based on type
        switch(type) {
            case 'fireball':
                this.width = 20;
                this.height = 20;
                this.color = '#FF4500';
                break;
            case 'iceball':
                this.width = 18;
                this.height = 18;
                this.color = '#00BFFF';
                break;
            case 'laser':
                this.width = 30;
                this.height = 8;
                this.color = '#FF0000';
                break;
            case 'slime':
                this.width = 16;
                this.height = 16;
                this.color = '#32CD32';
                break;
            case 'rock':
                this.width = 22;
                this.height = 22;
                this.color = '#808080';
                break;
            default:
                this.width = 15;
                this.height = 15;
                this.color = '#FF4500';
        }
    }

    update() {
        this.x += this.velX;
        this.y += this.velY;
        this.animFrame += 0.2;

        // Gravity for some projectiles
        if (this.type === 'rock' || this.type === 'slime') {
            this.velY += 0.15;
        }

        // Check collision with platforms (projectiles get blocked)
        for (let platform of game.platforms) {
            if (this.x + this.width > platform.x &&
                this.x < platform.x + platform.width &&
                this.y + this.height > platform.y &&
                this.y < platform.y + platform.height) {
                this.alive = false;
                // Create small impact particles
                for (let i = 0; i < 4; i++) {
                    game.particles.push(new Particle(
                        this.x + this.width / 2,
                        this.y + this.height / 2,
                        this.color
                    ));
                }
                return;
            }
        }

        // Check collision with moving platforms
        if (game.movingPlatforms) {
            for (let platform of game.movingPlatforms) {
                if (this.x + this.width > platform.x &&
                    this.x < platform.x + platform.width &&
                    this.y + this.height > platform.y &&
                    this.y < platform.y + platform.height) {
                    this.alive = false;
                    for (let i = 0; i < 4; i++) {
                        game.particles.push(new Particle(
                            this.x + this.width / 2,
                            this.y + this.height / 2,
                            this.color
                        ));
                    }
                    return;
                }
            }
        }

        // Remove if off screen
        if (this.x < game.cameraX - 100 || this.x > game.cameraX + CONFIG.WIDTH + 100 ||
            this.y < -100 || this.y > CONFIG.HEIGHT + 100) {
            this.alive = false;
        }
    }

    draw(ctx) {
        if (!this.alive) return;

        const screenX = this.x - game.cameraX;

        ctx.save();

        switch(this.type) {
            case 'fireball':
                // Animated fireball
                const fireGlow = ctx.createRadialGradient(
                    screenX + this.width/2, this.y + this.height/2, 2,
                    screenX + this.width/2, this.y + this.height/2, this.width/2 + 5
                );
                fireGlow.addColorStop(0, '#FFFF00');
                fireGlow.addColorStop(0.5, '#FF4500');
                fireGlow.addColorStop(1, 'rgba(255,0,0,0)');
                ctx.fillStyle = fireGlow;
                ctx.beginPath();
                ctx.arc(screenX + this.width/2, this.y + this.height/2, this.width/2 + 5, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#FFFF00';
                ctx.beginPath();
                ctx.arc(screenX + this.width/2, this.y + this.height/2, this.width/3, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'iceball':
                // Spinning ice crystal
                ctx.translate(screenX + this.width/2, this.y + this.height/2);
                ctx.rotate(this.animFrame);
                ctx.fillStyle = '#00BFFF';
                ctx.beginPath();
                ctx.moveTo(0, -this.height/2);
                ctx.lineTo(this.width/3, 0);
                ctx.lineTo(0, this.height/2);
                ctx.lineTo(-this.width/3, 0);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'laser':
                // Glowing laser beam
                ctx.fillStyle = '#FF0000';
                ctx.shadowColor = '#FF0000';
                ctx.shadowBlur = 10;
                ctx.fillRect(screenX, this.y, this.width, this.height);
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(screenX + 2, this.y + 2, this.width - 4, this.height - 4);
                break;

            case 'slime':
                // Bouncy slime ball
                const squish = Math.sin(this.animFrame * 2) * 2;
                ctx.fillStyle = '#32CD32';
                ctx.beginPath();
                ctx.ellipse(screenX + this.width/2, this.y + this.height/2,
                    this.width/2 + squish, this.height/2 - squish, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.beginPath();
                ctx.arc(screenX + this.width/3, this.y + this.height/3, 3, 0, Math.PI * 2);
                ctx.fill();
                break;

            case 'rock':
                // Tumbling rock
                ctx.translate(screenX + this.width/2, this.y + this.height/2);
                ctx.rotate(this.animFrame);
                ctx.fillStyle = '#696969';
                ctx.beginPath();
                ctx.moveTo(-this.width/2, -this.height/3);
                ctx.lineTo(0, -this.height/2);
                ctx.lineTo(this.width/2, -this.height/4);
                ctx.lineTo(this.width/3, this.height/2);
                ctx.lineTo(-this.width/3, this.height/2);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#808080';
                ctx.beginPath();
                ctx.arc(-3, -3, 4, 0, Math.PI * 2);
                ctx.fill();
                break;
        }

        ctx.restore();
    }

    collidesWith(player) {
        return this.alive &&
            this.x < player.x + player.width &&
            this.x + this.width > player.x &&
            this.y < player.y + player.height &&
            this.y + this.height > player.y;
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
    const yOffset = getYOffset();

    // Reset enemies
    game.enemies = [];
    const enemyType = levelData.enemyType || 'default';
    for (let e of levelData.enemies) {
        const enemy = new Enemy(e.x, e.y + yOffset, e.left, e.right, enemyType);
        // Activate unpredictable behavior for Level 10+
        if (game.level >= 10) {
            enemy.unpredictable = true;
        }
        game.enemies.push(enemy);
    }

    // Reset boss
    if (levelData.boss) {
        game.boss = new Boss(levelData.boss.x, levelData.boss.y + yOffset, levelData.boss.type);
        game.bossDefeated = false;
        // Activate shooting for Level 10+ bosses
        if (game.level >= 10) {
            game.boss.canShoot = true;
        }
    }

    // Reset projectiles
    game.projectiles = [];
}

// Level Generation
function getYOffset() {
    // Use GAME_HEIGHT to position elements above touch controls on mobile
    return CONFIG.GAME_HEIGHT - DESIGN_HEIGHT;
}

// Spawn power-ups based on level and rarity
function spawnPowerUps(levelData, yOffset) {
    // Power-up spawn chances - reduced for more challenge
    const spawnChances = {
        extra_life: 0.008,   // 0.8% - Extremely rare
        time_bonus: 0.03,    // 3% - Rare
        speed_boost: 0.06,   // 6% - Uncommon
        triple_jump: 0.04    // 4% - Rare
    };

    // Higher levels have slightly better spawn rates
    const levelBonus = Math.min((game.level - 6) * 0.005, 0.02);

    // Find suitable spawn locations (on platforms, not too close to start/end)
    const validPlatforms = levelData.platforms.filter(p =>
        p.x > 400 && p.x < levelData.width - 500 && p.w >= 80
    );

    if (validPlatforms.length === 0) return;

    // Determine how many power-ups to spawn (max 1-2 based on level size)
    const maxPowerUps = Math.min(2, Math.floor(levelData.width / 2000));
    let spawnedCount = 0;

    // Shuffle platforms to randomize spawn locations
    const shuffled = [...validPlatforms].sort(() => Math.random() - 0.5);

    for (let platform of shuffled) {
        if (spawnedCount >= maxPowerUps) break;

        // Random chance to spawn on this platform (80% chance to skip)
        if (Math.random() > 0.20) continue;

        // Determine which power-up type to spawn
        const roll = Math.random();
        let type = null;

        // Roll for each type in order of rarity
        if (roll < (spawnChances.extra_life + levelBonus * 0.5)) {
            type = 'extra_life';
        } else if (roll < (spawnChances.extra_life + spawnChances.time_bonus + levelBonus)) {
            type = 'time_bonus';
        } else if (roll < (spawnChances.extra_life + spawnChances.time_bonus + spawnChances.triple_jump + levelBonus)) {
            type = 'triple_jump';
        } else if (roll < (spawnChances.extra_life + spawnChances.time_bonus + spawnChances.triple_jump + spawnChances.speed_boost + levelBonus)) {
            type = 'speed_boost';
        }

        if (type) {
            // Spawn slightly above the platform center
            const spawnX = platform.x + platform.w / 2 - 15 + (Math.random() - 0.5) * 40;
            const spawnY = platform.y - 50 + yOffset;

            game.powerups.push(new PowerUp(spawnX, spawnY, type));
            spawnedCount++;
        }
    }

    // 40% chance to spawn at least one common power-up if none spawned
    if (spawnedCount === 0 && shuffled.length > 0 && Math.random() < 0.4) {
        const platform = shuffled[0];
        const types = ['speed_boost', 'speed_boost', 'triple_jump']; // Only common types
        const type = types[Math.floor(Math.random() * types.length)];
        const spawnX = platform.x + platform.w / 2 - 15;
        const spawnY = platform.y - 50 + yOffset;
        game.powerups.push(new PowerUp(spawnX, spawnY, type));
    }
}

function generateLevel(levelNum) {
    const levelData = LEVELS[levelNum - 1];
    game.levelWidth = levelData.width;
    game.theme = levelData.theme;

    game.platforms = [];
    game.movingPlatforms = [];
    game.fadingPlatforms = [];
    game.coins = [];
    game.enemies = [];
    game.obstacles = [];
    game.boss = null;
    game.bossDefeated = false;
    game.bossHintShown = false;

    const yOffset = getYOffset();

    // Create static platforms
    for (let p of levelData.platforms) {
        game.platforms.push(new Platform(p.x, p.y + yOffset, p.w, p.h, p.type));
    }

    // Create moving platforms
    if (levelData.movingPlatforms) {
        for (let p of levelData.movingPlatforms) {
            game.movingPlatforms.push(new MovingPlatform(p.x, p.y + yOffset, p.w, p.h, p.type, p.moveX, p.moveY, p.speed));
        }
    }

    // Create fading platforms
    if (levelData.fadingPlatforms) {
        for (let p of levelData.fadingPlatforms) {
            game.fadingPlatforms.push(new FadingPlatform(
                p.x, p.y + yOffset, p.w, p.h, p.type,
                p.fadeSpeed || 0.02,
                p.visibleTime || 120,
                p.invisibleTime || 80
            ));
        }
    }

    // Create coins
    for (let c of levelData.coins) {
        game.coins.push(new Coin(c.x, c.y + yOffset));
    }

    // Create enemies with level-specific type
    const enemyType = levelData.enemyType || 'default';
    for (let e of levelData.enemies) {
        const enemy = new Enemy(e.x, e.y + yOffset, e.left, e.right, enemyType);
        // Activate unpredictable behavior for Level 10+
        if (game.level >= 10) {
            enemy.unpredictable = true;
        }
        game.enemies.push(enemy);
    }

    // Create obstacles
    if (levelData.obstacles) {
        for (let o of levelData.obstacles) {
            game.obstacles.push(new Obstacle(o.x, o.y + yOffset, o.type));
        }
    }

    // Create boss
    if (levelData.boss) {
        game.boss = new Boss(levelData.boss.x, levelData.boss.y + yOffset, levelData.boss.type);
        // Activate shooting for Level 10+ bosses
        if (game.level >= 10) {
            game.boss.canShoot = true;
        }
    }

    // Initialize projectiles
    game.projectiles = [];

    // Spawn power-ups (Level 6+)
    game.powerups = [];
    if (game.level >= 6) {
        spawnPowerUps(levelData, yOffset);
    }

    // Create goal (uses yOffset internally)
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

// Draw active power-up indicators
function drawPowerUpIndicators(ctx) {
    if (!game.player) return;

    let yPos = 100;
    const xPos = CONFIG.WIDTH - 150;

    // Speed Boost indicator
    if (game.player.hasSpeedBoost && game.player.speedBoostTimer > 0) {
        const timeLeft = Math.ceil(game.player.speedBoostTimer / 60);
        const progress = game.player.speedBoostTimer / 300; // 300 = max duration

        drawPowerUpBar(ctx, xPos, yPos, '⚡ Speed', timeLeft, progress, '#00BFFF');
        yPos += 35;
    }

    // Triple Jump indicator
    if (game.player.hasTripleJump && game.player.tripleJumpTimer > 0) {
        const timeLeft = Math.ceil(game.player.tripleJumpTimer / 60);
        const progress = game.player.tripleJumpTimer / 600; // 600 = max duration

        drawPowerUpBar(ctx, xPos, yPos, '🦘 3x Jump', timeLeft, progress, '#9932CC');

        // Show remaining jumps
        const jumpsLeft = game.player.maxJumps - game.player.jumpCount;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`(${jumpsLeft} übrig)`, xPos + 130, yPos + 12);
        yPos += 35;
    }
}

function drawPowerUpBar(ctx, x, y, label, timeLeft, progress, color) {
    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x, y, 140, 28, 5);
    ctx.fill();

    // Progress bar background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 18, 100, 6, 3);
    ctx.fill();

    // Progress bar fill
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 18, 100 * progress, 6, 3);
    ctx.fill();

    // Label
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 8, y + 13);

    // Time
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText(timeLeft + 's', x + 130, y + 13);
}

// Level Complete
async function levelComplete() {
    game.running = false;
    hideTouchControls();

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

    hideAllScreens();

    if (game.level >= LEVELS.length) {
        // Game complete - save highscore only at the end
        const bonusCoins = addCoinsToProfile(50, game.level); // Bonus for completing the game
        await saveHighscore();
        updateCoinsDisplay();
        document.getElementById('win-score').textContent = game.score;

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
        await loadGlobalHighscores();
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
    hideAllScreens();
    document.getElementById('ui').classList.remove('hidden');
    showTouchControls();

    game.level++;
    game.cameraX = 0;
    game.particles = [];
    game.obstacles = [];
    game.boss = null;
    game.bossDefeated = false;
    updateUI();

    generateLevel(game.level);
    game.player = new Player(100, 400 + getYOffset());
    game.running = true;
    gameLoop();
}

// Game Over
async function gameOver() {
    game.running = false;
    hideTouchControls();
    await saveHighscore();
    updateCoinsDisplay();
    document.getElementById('final-score').textContent = game.score;
    hideAllScreens();
    document.getElementById('game-over').classList.remove('hidden');
    await loadGlobalHighscores();
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

    // Update and draw fading platforms
    for (let platform of game.fadingPlatforms) {
        platform.update();
        platform.draw(ctx);
    }

    // Update and draw goal (only show if boss is defeated or no boss exists)
    if (game.goal) {
        game.goal.update();
        // Only show goal if boss is dead
        const bossExists = game.boss !== null && game.boss !== undefined;
        const bossIsDead = bossExists && (!game.boss.alive || game.bossDefeated);
        const canShowGoal = !bossExists || bossIsDead;

        if (canShowGoal) {
            game.goal.draw(ctx);
        } else {
            // Draw locked goal indicator
            const screenX = game.goal.x - game.cameraX;
            if (screenX + 50 > 0 && screenX < CONFIG.WIDTH) {
                ctx.save();
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = '#888';
                ctx.fillRect(screenX + 5, game.goal.y, 8, 100);
                ctx.fillStyle = '#666';
                ctx.beginPath();
                ctx.moveTo(screenX + 13, game.goal.y + 5);
                ctx.lineTo(screenX + 55, game.goal.y + 25);
                ctx.lineTo(screenX + 13, game.goal.y + 45);
                ctx.closePath();
                ctx.fill();
                ctx.restore();

                // Draw lock icon
                ctx.fillStyle = '#FF4444';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('🔒 Besiege den Boss!', screenX + 30, game.goal.y - 15);
            }
        }
    }

    // Update and draw coins
    for (let coin of game.coins) {
        coin.update();
        coin.draw(ctx);
    }

    // Update and draw power-ups
    game.powerups = game.powerups.filter(p => !p.collected);
    for (let powerup of game.powerups) {
        powerup.update();
        powerup.draw(ctx);

        // Check collision with player
        if (powerup.collidesWith(game.player)) {
            powerup.collect();
        }
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

    // Update and draw projectiles
    game.projectiles = game.projectiles.filter(p => p.alive);
    for (let projectile of game.projectiles) {
        projectile.update();
        projectile.draw(ctx);

        // Check collision with player
        if (projectile.collidesWith(game.player) && game.player.invulnerable <= 0) {
            projectile.alive = false;
            game.lives--;
            game.player.invulnerable = 90; // 1.5 seconds invulnerability

            // Create hit particles
            for (let i = 0; i < 8; i++) {
                game.particles.push(new Particle(
                    game.player.x + game.player.width / 2,
                    game.player.y + game.player.height / 2,
                    projectile.color
                ));
            }

            updateUI();

            if (game.lives <= 0) {
                gameOver();
                return;
            }
        }
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

    // Draw power-up indicators
    drawPowerUpIndicators(ctx);

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
        btn.addEventListener('click', async () => {
            const result = await buyShopItem(btn.dataset.type, btn.dataset.id);
            if (result.success) {
                await selectSkin(btn.dataset.id);
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
            btn.addEventListener('click', async () => {
                const result = await buyShopItem(btn.dataset.type, btn.dataset.id);
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
    hideAllScreens();
    document.getElementById('shop-screen').classList.remove('hidden');
    renderShop();
}

function closeShop() {
    hideAllScreens();
    document.getElementById('start-screen').classList.remove('hidden');
    updateCoinsDisplay();
}

// Mobile Touch Controls Setup
function setupTouchControls() {
    const leftBtn = document.getElementById('touch-left-btn');
    const rightBtn = document.getElementById('touch-right-btn');
    const jumpBtn = document.getElementById('touch-jump-btn');

    // Helper to handle touch events
    function addTouchHandlers(element, keyCode) {
        // Touch start - button pressed
        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            game.keys[keyCode] = true;
            element.classList.add('pressed');
        }, { passive: false });

        // Touch end - button released
        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            game.keys[keyCode] = false;
            element.classList.remove('pressed');
        }, { passive: false });

        // Touch cancel - treat as release
        element.addEventListener('touchcancel', (e) => {
            game.keys[keyCode] = false;
            element.classList.remove('pressed');
        });

        // Also support mouse for testing on desktop
        element.addEventListener('mousedown', (e) => {
            e.preventDefault();
            game.keys[keyCode] = true;
            element.classList.add('pressed');
        });

        element.addEventListener('mouseup', (e) => {
            game.keys[keyCode] = false;
            element.classList.remove('pressed');
        });

        element.addEventListener('mouseleave', (e) => {
            game.keys[keyCode] = false;
            element.classList.remove('pressed');
        });
    }

    // Setup buttons
    if (leftBtn) addTouchHandlers(leftBtn, 'ArrowLeft');
    if (rightBtn) addTouchHandlers(rightBtn, 'ArrowRight');
    if (jumpBtn) addTouchHandlers(jumpBtn, 'Space');
}

// Show/hide touch controls based on game state
function showTouchControls() {
    if (IS_MOBILE) {
        document.getElementById('touch-controls')?.classList.remove('hidden');
    }
}

function hideTouchControls() {
    document.getElementById('touch-controls')?.classList.add('hidden');
}

// Initialize Game
async function init() {
    // Recalculate touch controls height now that DOM is ready
    TOUCH_CONTROLS_HEIGHT = getTouchControlsHeight();
    CONFIG.GAME_HEIGHT = window.innerHeight - TOUCH_CONTROLS_HEIGHT;

    console.log('Mobile detection:', IS_MOBILE);
    console.log('Touch controls height:', TOUCH_CONTROLS_HEIGHT);
    console.log('Window height:', window.innerHeight);
    console.log('Game height:', CONFIG.GAME_HEIGHT);

    game.canvas = document.getElementById('gameCanvas');
    game.ctx = game.canvas.getContext('2d');
    game.canvas.width = CONFIG.WIDTH;
    game.canvas.height = CONFIG.HEIGHT;

    // Initialize API and check for existing session
    const hasSession = await API.init();

    // Load global highscores for everyone (auth screen and start screen)
    loadGlobalHighscores();

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

    // Mobile Touch Controls
    if (IS_MOBILE) {
        // Show mobile controls hint, hide keyboard hint
        document.getElementById('controls-keyboard')?.classList.add('hidden');
        document.getElementById('controls-touch')?.classList.remove('hidden');

        // Setup touch button handlers
        setupTouchControls();
    }

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

    hideAllScreens();
    document.getElementById('ui').classList.remove('hidden');
    showTouchControls();

    // Update touch controls height and game height before generating level
    TOUCH_CONTROLS_HEIGHT = getTouchControlsHeight();
    CONFIG.GAME_HEIGHT = window.innerHeight - TOUCH_CONTROLS_HEIGHT;

    console.log('startGame - Touch height:', TOUCH_CONTROLS_HEIGHT, 'Game height:', CONFIG.GAME_HEIGHT, 'yOffset:', getYOffset());

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
    game.player = new Player(100, 400 + getYOffset());
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
