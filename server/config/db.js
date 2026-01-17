const { Pool } = require('pg');

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is not set!');
    console.error('Please set DATABASE_URL in Railway Variables or .env file');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initDatabase() {
    const client = await pool.connect();

    try {
        // Create users table (email ist optional für Kinder ohne E-Mail)
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                email_verified BOOLEAN DEFAULT FALSE,
                verification_token VARCHAR(255),
                reset_token VARCHAR(255),
                reset_token_expires TIMESTAMP,
                total_coins INTEGER DEFAULT 0,
                purchased_skins TEXT[] DEFAULT '{}',
                purchased_upgrades TEXT[] DEFAULT '{}',
                selected_skin VARCHAR(50) DEFAULT 'default',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        `);

        // Migration: E-Mail optional machen für bestehende Datenbanken
        await client.query(`
            DO $$
            BEGIN
                -- Prüfe ob email NOT NULL constraint existiert und entferne ihn
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'email' AND is_nullable = 'NO'
                ) THEN
                    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
                END IF;
            END $$;
        `);

        // Create highscores table
        await client.query(`
            CREATE TABLE IF NOT EXISTS highscores (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                username VARCHAR(50) NOT NULL,
                score INTEGER NOT NULL,
                level_reached INTEGER DEFAULT 1,
                platform VARCHAR(10) DEFAULT 'pc',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add platform column if it doesn't exist (for existing databases)
        await client.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                               WHERE table_name = 'highscores' AND column_name = 'platform') THEN
                    ALTER TABLE highscores ADD COLUMN platform VARCHAR(10) DEFAULT 'pc';
                END IF;
            END $$;
        `);

        // Create index for faster highscore queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_highscores_score ON highscores(score DESC)
        `);

        // Create index for platform-filtered queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_highscores_platform_score ON highscores(platform, score DESC)
        `);

        // Create game_sessions table for statistics
        await client.query(`
            CREATE TABLE IF NOT EXISTS game_sessions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                coins_earned INTEGER DEFAULT 0,
                max_level INTEGER DEFAULT 1,
                final_score INTEGER DEFAULT 0,
                duration_seconds INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create friends table for friend relationships
        await client.query(`
            CREATE TABLE IF NOT EXISTS friends (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                friend_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                accepted_at TIMESTAMP,
                UNIQUE(user_id, friend_id)
            )
        `);

        // Create index for faster friend queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id)
        `);
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id)
        `);

        // Create daily_challenges table for tracking user challenges
        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_challenges (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                challenge_id INTEGER NOT NULL,
                challenge_date DATE NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                accepted_at TIMESTAMP,
                completed_at TIMESTAMP,
                reward_claimed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, challenge_date)
            )
        `);

        // Create index for faster challenge queries
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_daily_challenges_user_date ON daily_challenges(user_id, challenge_date)
        `);

        console.log('Database tables created successfully');
    } finally {
        client.release();
    }
}

module.exports = { pool, initDatabase };
