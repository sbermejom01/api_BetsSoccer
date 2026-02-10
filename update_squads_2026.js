require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

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

async function updateSquads() {
    const client = await pool.connect();
    try {
        console.log("Conectado a PostgreSQL. Actualizando plantillas...");

        // 1. Borrar jugadores actuales
        console.log("Eliminando jugadores antiguos...");
        await client.query('DELETE FROM players');

        // 2. Insertar nuevos jugadores
        const teamsRes = await client.query('SELECT name FROM teams');

        for (const team of teamsRes.rows) {
            const teamName = team.name;
            const playersList = REAL_PLAYERS[teamName] || REAL_PLAYERS['default'];

            console.log(`- Insertando plantilla 2025/2026 para ${teamName}...`);

            for (const playerName of playersList) {
                // Generar nombre específico si es genérico
                const finalName = REAL_PLAYERS[teamName] ? playerName : `${playerName} ${teamName.split(' ')[0]}`;
                const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(finalName)}`;

                await client.query(
                    'INSERT INTO players (name, team_name, avatar_url) VALUES ($1, $2, $3)',
                    [finalName, teamName, avatarUrl]
                );
            }
        }

        console.log("¡Plantillas actualizadas con éxito!");

    } catch (e) {
        console.error("Error al actualizar las plantillas:", e);
    } finally {
        client.release();
        await pool.end();
    }
}

updateSquads();
