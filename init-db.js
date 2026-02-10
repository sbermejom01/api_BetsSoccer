require('dotenv').config();
const { Pool } = require('pg');

const TEAMS = [
    { name: 'Real Madrid', strength: 92 }, { name: 'FC Barcelona', strength: 90 },
    { name: 'Atlético Madrid', strength: 88 }, { name: 'Real Sociedad', strength: 84 },
    { name: 'Villarreal', strength: 82 }, { name: 'Real Betis', strength: 81 },
    { name: 'Athletic Club', strength: 83 }, { name: 'Sevilla FC', strength: 80 },
    { name: 'Osasuna', strength: 78 }, { name: 'Girona FC', strength: 85 },
    { name: 'Rayo Vallecano', strength: 76 }, { name: 'Celta de Vigo', strength: 77 },
    { name: 'Valencia CF', strength: 79 }, { name: 'Getafe CF', strength: 76 },
    { name: 'RCD Mallorca', strength: 75 }, { name: 'UD Las Palmas', strength: 74 },
    { name: 'Deportivo Alavés', strength: 73 }, { name: 'Granada CF', strength: 70 },
    { name: 'Cádiz CF', strength: 71 }, { name: 'UD Almería', strength: 69 }
];


const REAL_PLAYERS = {
    'Real Madrid': ['Thibaut Courtois', 'Dani Carvajal', 'Eder Militao', 'Antonio Rudiger', 'Ferland Mendy', 'Federico Valverde', 'Aurelien Tchouameni', 'Jude Bellingham', 'Rodrygo', 'Vinicius Jr', 'Kylian Mbappe', 'David Alaba', 'Eduardo Camavinga', 'Luka Modric', 'Arda Guler', 'Endrick', 'Brahim Diaz'],
    'FC Barcelona': ['Marc-Andre ter Stegen', 'Jules Kounde', 'Ronald Araujo', 'Pau Cubarsi', 'Alejandro Balde', 'Marc Casado', 'Pedri', 'Dani Olmo', 'Lamine Yamal', 'Robert Lewandowski', 'Raphinha', 'Gavi', 'Frenkie de Jong', 'Fermin Lopez', 'Ferran Torres', 'Wojciech Szczesny'],
    'Atlético Madrid': ['Jan Oblak', 'Nahuel Molina', 'Robin Le Normand', 'Jose Maria Gimenez', 'Reinildo Mandava', 'Koke', 'Conor Gallagher', 'Rodrigo De Paul', 'Antoine Griezmann', 'Julian Alvarez', 'Alexander Sorloth', 'Samuel Lino', 'Marcos Llorente', 'Angel Correa', 'Clement Lenglet'],
    'Real Sociedad': ['Alex Remiro', 'Jon Aramburu', 'Igor Zubeldia', 'Nayef Aguerd', 'Javi Lopez', 'Martin Zubimendi', 'Luka Sucic', 'Sergio Gomez', 'Takefusa Kubo', 'Mikel Oyarzabal', 'Orri Oskarsson', 'Brais Mendez', 'Sheraldo Becker', 'Ander Barrenetxea'],
    'Athletic Club': ['Unai Simon', 'Oscar de Marcos', 'Dani Vivian', 'Aitor Paredes', 'Yuri Berchiche', 'Inigo Ruiz de Galarreta', 'Benat Prados', 'Oihan Sancet', 'Iñaki Williams', 'Gorka Guruzeta', 'Nico Williams', 'Alvaro Djalo', 'Alex Berenguer', 'Unai Gomez'],
    'Girona FC': ['Paulo Gazzaniga', 'Alejandro Frances', 'David Lopez', 'Daley Blind', 'Miguel Gutierrez', 'Oriol Romeu', 'Yangel Herrera', 'Ivan Martin', 'Viktor Tsygankov', 'Abel Ruiz', 'Bryan Gil', 'Cristhian Stuani', 'Yaser Asprilla', 'Arnaut Danjuma'],
    'Real Betis': ['Rui Silva', 'Hector Bellerin', 'Diego Llorente', 'Natan', 'Romain Perraud', 'Marc Roca', 'Johnny Cardoso', 'Pablo Fornals', 'Giovani Lo Celso', 'Ez Abde', 'Vitor Roque', 'Isco', 'Chimy Avila', 'Cedric Bakambu'],
    'Villarreal': ['Diego Conde', 'Kiko Femenia', 'Raul Albiol', 'Logan Costa', 'Sergi Cardona', 'Santi Comesaña', 'Dani Parejo', 'Alex Baena', 'Ilias Akhomach', 'Ayoze Perez', 'Thierno Barry', 'Gerard Moreno', 'Yeremy Pino', 'Nicolas Pepe'],
    'Sevilla FC': ['Orjan Nyland', 'Jose Angel Carmona', 'Loic Bade', 'Kike Salas', 'Adria Pedrosa', 'Nemanja Gudelj', 'Albert Sambi Lokonga', 'Saul Niguez', 'Dodi Lukebakio', 'Isaac Romero', 'Chidera Ejuke', 'Kelechi Iheanacho', 'Jesus Navas', 'Suso'],
    'Osasuna': ['Sergio Herrera', 'Jesus Areso', 'Alejandro Catena', 'Enzo Boyomo', 'Abel Bretones', 'Lucas Torro', 'Jon Moncayola', 'Aimar Oroz', 'Ruben Garcia', 'Ante Budimir', 'Bryan Zaragoza', 'Moi Gomez', 'Raul Garcia'],
    'Rayo Vallecano': ['Augusto Batalla', 'Ivan Balliu', 'Florian Lejeune', 'Abdul Mumin', 'Pep Chavarria', 'Oscar Valentin', 'Unai Lopez', 'Jorge de Frutos', 'Isi Palazon', 'Sergio Camello', 'Adri Embarba', 'James Rodriguez', 'Randy Nteka'],
    'Celta de Vigo': ['Vicente Guaita', 'Oscar Mingueza', 'Carl Starfelt', 'Marcos Alonso', 'Hugo Alvarez', 'Fran Beltran', 'Ilaix Moriba', 'Iago Aspas', 'Borja Iglesias', 'Williot Swedberg', 'Anastasios Douvikas', 'Jonathan Bamba'],
    'Valencia CF': ['Giorgi Mamardashvili', 'Thierry Correia', 'Cristhian Mosquera', 'Cesar Tarrega', 'Jose Gaya', 'Pepelu', 'Javi Guerra', 'Diego Lopez', 'Andre Almeida', 'Hugo Duro', 'Luis Rioja', 'Rafa Mir', 'Dani Gomez'],
    'Getafe CF': ['David Soria', 'Juan Iglesias', 'Djene Dakonam', 'Omar Alderete', 'Diego Rico', 'Mauro Arambarri', 'Luis Milla', 'Christantus Uche', 'Carles Perez', 'Bertug Yildirim', 'Alex Sola', 'Borja Mayoral'],
    'RCD Mallorca': ['Dominik Greif', 'Pablo Maffeo', 'Martin Valjent', 'Antonio Raillo', 'Johan Mojica', 'Samu Costa', 'Sergi Darder', 'Dani Rodriguez', 'Robert Navarro', 'Vedat Muriqi', 'Takuma Asano', 'Cyle Larin'],
    'UD Las Palmas': ['Jasper Cillessen', 'Viti Rozada', 'Alex Suarez', 'Scott McKenna', 'Alex Muñoz', 'Kirian Rodriguez', 'Javi Muñoz', 'Alberto Moleiro', 'Sandro Ramirez', 'Oli McBurnie', 'Fabio Silva', 'Adnan Januzaj'],
    'Deportivo Alavés': ['Antonio Sivera', 'Nahuel Tenaglia', 'Abdel Abqar', 'Aleksandar Sedlar', 'Manu Sanchez', 'Ander Guevara', 'Antonio Blanco', 'Jon Guridi', 'Carlos Vicente', 'Kike Garcia', 'Toni Martinez', 'Stoichkov'],
    'Granada CF': ['Luca Zidane', 'Ricard Sanchez', 'Miguel Rubio', 'Ignasi Miquel', 'Carlos Neva', 'Martin Hongla', 'Sergio Ruiz', 'Gonzalo Villar', 'Myrto Uzuni', 'Lucas Boye', 'Giorgi Tsitaishvili', 'Reinier'],
    'Cádiz CF': ['David Gil', 'Iza Carcelen', 'Fali', 'Victor Chust', 'Jose Matos', 'Ruben Alcaraz', 'Gonzalo Escalante', 'Brian Ocampo', 'Chris Ramos', 'Roger Marti', 'Javi Ontiveros'],
    'UD Almería': ['Luis Maximiano', 'Marc Pubill', 'Chumi', 'Kaiky', 'Alex Centelles', 'Lucas Robertone', 'Dion Lopy', 'Nico Melamed', 'Sergio Arribas', 'Luis Suarez', 'Leo Baptistao'],
    'default': ['Portero Titular', 'Defensa Central', 'Lateral Derecho', 'Lateral Izquierdo', 'Mediocentro', 'Extremo Derecho', 'Extremo Izquierdo', 'Delantero Centro', 'Capitán Equipo', 'Promesa Joven', 'Veterano Club']
};

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDb() {
    const client = await pool.connect();
    try {
        console.log("Conectado a PostgreSQL. Creando tablas...");

        // Crear tablas individualmente para mejor control
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                points INTEGER DEFAULT 0,
                avatar TEXT
            )
        `);
        console.log("- Tabla 'users' lista.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS teams (
                name TEXT PRIMARY KEY,
                strength INTEGER DEFAULT 80,
                pj INTEGER DEFAULT 0,
                pg INTEGER DEFAULT 0,
                pe INTEGER DEFAULT 0,
                pp INTEGER DEFAULT 0,
                gf INTEGER DEFAULT 0,
                gc INTEGER DEFAULT 0,
                pts INTEGER DEFAULT 0
            )
        `);
        console.log("- Tabla 'teams' lista.");

        // Seeding teams if table is empty
        const teamsCheck = await client.query('SELECT COUNT(*) FROM teams');
        if (parseInt(teamsCheck.rows[0].count) === 0) {
            console.log("Sembrando equipos...");

            for (const team of TEAMS) {
                await client.query('INSERT INTO teams (name, strength) VALUES ($1, $2)', [team.name, team.strength]);
            }
            console.log("Sembrado de equipos completado.");
        }

        await client.query(`
            CREATE TABLE IF NOT EXISTS matches (
                id INTEGER PRIMARY KEY,
                jornada INTEGER NOT NULL,
                home_team TEXT REFERENCES teams(name),
                away_team TEXT REFERENCES teams(name),
                home_score INTEGER DEFAULT 0,
                away_score INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                time TIMESTAMPTZ,
                league TEXT,
                events JSONB DEFAULT '[]'
            )
        `);
        console.log("- Tabla 'matches' lista.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS bets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                match_id INTEGER REFERENCES matches(id),
                home_score INTEGER NOT NULL,
                away_score INTEGER NOT NULL,
                points_earned INTEGER DEFAULT 0,
                UNIQUE(user_id, match_id)
            )
        `);
        console.log("- Tabla 'bets' lista.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                match_id INTEGER REFERENCES matches(id),
                username TEXT NOT NULL,
                text TEXT NOT NULL,
                time TEXT NOT NULL
            )
        `);
        console.log("- Tabla 'messages' lista.");


        await client.query(`
            CREATE TABLE IF NOT EXISTS players (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                team_name TEXT REFERENCES teams(name),
                avatar_url TEXT NOT NULL,
                goals INTEGER DEFAULT 0
            )
        `);
        console.log("- Tabla 'players' lista.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS simulation_state (
                id SERIAL PRIMARY KEY,
                state JSONB NOT NULL
            )
        `);
        console.log("- Tabla 'simulation_state' lista.");

        await client.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id BIGINT PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("- Tabla 'notifications' lista.");



        // Seeding players if table is empty
        const playersCheck = await client.query('SELECT COUNT(*) FROM players');
        if (parseInt(playersCheck.rows[0].count) === 0) {
            console.log("\nSembrando jugadores reales...");


            const teamsRes = await client.query('SELECT name FROM teams');

            for (const team of teamsRes.rows) {
                const teamName = team.name;
                const playersList = REAL_PLAYERS[teamName] || REAL_PLAYERS['default'];

                console.log(`- Insertando plantilla para ${teamName}...`);

                for (const playerName of playersList) {
                    // Si es genérico, le añadimos el nombre del equipo para diferenciar
                    const finalName = REAL_PLAYERS[teamName] ? playerName : `${playerName} ${teamName.split(' ')[0]}`;
                    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(finalName)}`;
                    await client.query('INSERT INTO players (name, team_name, avatar_url) VALUES ($1, $2, $3)', [finalName, teamName, avatarUrl]);
                }
            }
            console.log("Sembrado de jugadores reales completado.");
        }

    } catch (e) {
        if (client) await client.query('ROLLBACK');
        console.error("\nERROR FATAL durante la inicialización:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

initDb();
