const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5, // A bit more headroom
    idleTimeoutMillis: 30000, // 30s instead of 1s to prevent connection churn
    connectionTimeoutMillis: 30000, // 30s to allow for cold starts/latency
    keepAlive: true
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
