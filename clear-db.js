require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function clearDb() {
    const client = await pool.connect();
    try {
        console.log("⚠️ Iniciando limpieza total de la base de datos...");

        // Array de tablas en orden para evitar conflictos de claves foráneas o usando CASCADE
        const tables = [
            'notifications',
            'messages',
            'bets',
            'players',
            'matches',
            'users',
            'teams',
            'simulation_state'
        ];

        for (const table of tables) {
            console.log(`- Eliminando tabla: ${table}`);
            await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
        }

        console.log("\n✅ Base de datos borrada por completo.");
        console.log("Puedes volver a inicializarla ejecutando: node init-db.js");

    } catch (e) {
        console.error("\n❌ ERROR durante la limpieza:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

// Para ejecutarlo, descomenta la línea de abajo o usa: node clear-db.js
clearDb();
