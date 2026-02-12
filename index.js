require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const db = require('./db');
const SimulationEngine = require('./simulation');

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// --- INITIALIZATION MIDDLEWARE ---
async function awaitInit(req, res, next) {
    try {
        await sim.initialized;
        next();
    } catch (err) {
        console.error("⚠️ Solicitud rechazada por inicialización fallida/en curso:", err);
        res.status(503).json({ error: "Servicio inicializándose, por favor reintente", details: err.message });
    }
}
app.use('/api', awaitInit);

const SECRET_KEY = process.env.JWT_SECRET || "mi_clave_secreta_por_defecto_cambiame";

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Token no proporcionado" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Token inválido o expirado" });
        req.user = user;
        next();
    });
}

const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'BetBuddy API',
            version: '1.0.0',
            description: 'API para la aplicación de apuestas deportivas BetBuddy',
        },
        servers: [
            { url: `http://localhost:3000` },
            { url: `https://bets-soccer-backend.vercel.app` }
        ],
    },
    apis: [
        path.join(__dirname, 'index.js'),
        path.join(__dirname, 'swagger-docs.js')
    ],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Opciones para Swagger UI que cargan los assets desde CDN para evitar problemas en desplegables como Vercel
const swaggerUiOptions = {
    customCssUrl: 'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui.css',
    customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui-bundle.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui-standalone-preset.js'
    ]
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, swaggerUiOptions));

const sim = new SimulationEngine(null, null);

sim.initialized.then(() => {
    console.log("Simulación de liga inicializada con éxito.");
}).catch(err => {
    console.error("Error al inicializar la simulación:", err);
});

// --- ESQUEMAS DE VALIDACIÓN CON ZOD ---
const registerSchema = z.object({
    username: z.string().min(3).max(20),
    email: z.string().email(),
    password: z.string().min(4)
});

const betSchema = z.object({
    userId: z.number().int().positive(),
    matchId: z.number().int().positive(),
    homeScore: z.number().int().min(0),
    awayScore: z.number().int().min(0)
});

// --- ENDPOINTS DE AUTENTICACIÓN ---

app.post('/api/register', async (req, res) => {
    try {
        const result = registerSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ error: "Datos de registro inválidos", details: result.error.format() });
        }

        const { username, email, password } = result.data;

        const checkUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (checkUser.rows.length > 0) {
            return res.status(400).json({ error: "El email ya está registrado" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUserRes = await db.query(
            'INSERT INTO users (username, email, password, points, avatar) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [username, email, hashedPassword, 0, "account_circle"]
        );

        const newUser = {
            id: newUserRes.rows[0].id,
            username: newUserRes.rows[0].username,
            email: newUserRes.rows[0].email,
            points: newUserRes.rows[0].points,
            avatar: newUserRes.rows[0].avatar
        };

        sim.db.users.push({ ...newUser, password: hashedPassword });

        const token = jwt.sign({ id: newUser.id }, SECRET_KEY);
        res.json({ token, user: newUser });
    } catch (error) {
        console.error("Error en registro:", error);
        res.status(500).json({ error: "Error al registrar usuario" });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const token = jwt.sign({ id: user.id }, SECRET_KEY);

        const userResponse = {
            id: user.id,
            username: user.username,
            email: user.email,
            points: user.points,
            avatar: user.avatar
        };

        res.json({ token, user: userResponse });
    } catch (error) {
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// --- ENDPOINTS DE PARTIDOS Y APUESTAS ---

app.get('/api/matches', async (req, res) => {
    // Evitamos tick pesado en peticiones simples para evitar timeout
    res.json(sim.matches || []);
});

app.post('/api/bets', authenticateToken, async (req, res) => {
    try {
        const result = betSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ error: "Datos de apuesta inválidos", details: result.error.format() });
        }

        const { userId, matchId, homeScore, awayScore } = result.data;

        // Verificar que el usuario que hace la petición es el mismo que el userId de la apuesta
        if (req.user.id !== userId) {
            return res.status(403).json({ error: "No tienes permiso para realizar esta apuesta" });
        }

        const match = sim.allMatches.find(m => m.id === matchId);
        if (!match) return res.status(404).json({ error: "Partido no encontrado" });
        if (match.status !== 'pending') return res.status(400).json({ error: "No se pueden realizar apuestas en partidos ya iniciados" });

        const betRes = await db.query(
            'INSERT INTO bets (user_id, match_id, home_score, away_score) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, match_id) DO UPDATE SET home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score RETURNING *',
            [userId, matchId, homeScore, awayScore]
        );

        const newBet = {
            id: betRes.rows[0].id,
            userId: betRes.rows[0].user_id,
            matchId: betRes.rows[0].match_id,
            homeScore: betRes.rows[0].home_score,
            awayScore: betRes.rows[0].away_score,
            pointsEarned: betRes.rows[0].points_earned || 0
        };

        const existingIdx = sim.db.bets.findIndex(b => Number(b.userId) === Number(userId) && Number(b.matchId) === Number(matchId));
        if (existingIdx !== -1) sim.db.bets[existingIdx] = newBet;
        else sim.db.bets.push(newBet);

        const notif = { id: Date.now(), userId, title: 'Apuesta Recibida', message: `Has apostado para el ${match.home} vs ${match.away}`, createdAt: new Date().toISOString() };
        await db.query('INSERT INTO notifications (id, user_id, title, message, created_at) VALUES ($1, $2, $3, $4, $5)', [notif.id, notif.userId, notif.title, notif.message, notif.createdAt]);
        sim.db.notifications.push(notif);

        res.json(newBet);
    } catch (error) {
        console.error("Error al procesar apuesta:", error);
        res.status(500).json({ error: "Error al guardar apuesta", message: error.message });
    }
});

app.get('/api/leaderboard', (req, res) => {
    const sortedUsers = [...sim.db.users]
        .map(u => ({ id: u.id, username: u.username, points: u.points, avatar: u.avatar }))
        .sort((a, b) => b.points - a.points);
    res.json(sortedUsers);
});

app.get('/api/league/standings', async (req, res) => {
    await sim.tick();
    res.json(sim.getStandings());
});

app.get('/api/teams/:teamName/players', (req, res) => {
    const teamName = req.params.teamName;
    const players = sim.db.players.filter(p => p.team_name === teamName);
    res.json(players);
});

app.get('/api/players/top-scorers', (req, res) => {
    const topScorers = [...sim.db.players]
        .filter(p => p.goals > 0)
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 10);
    res.json(topScorers);
});

app.get('/api/simulation/state', async (req, res) => {
    await sim.tick();
    res.json(sim.state);
});

app.get('/api/league/results/:jornada', async (req, res) => {
    await sim.tick();
    const jornada = parseInt(req.params.jornada);
    res.json(sim.allMatches.filter(m => m.jornada === jornada));
});

app.get('/api/bets/user/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const userBets = sim.db.bets.filter(b => Number(b.userId) === userId);
    const enrichedBets = userBets.map(bet => {
        const match = sim.allMatches.find(m => Number(m.id) === Number(bet.matchId));
        return {
            ...bet,
            match: match || null,
            pointsEarned: bet.pointsEarned || 0,
            status: match && match.status === 'finished' ? (bet.pointsEarned > 0 ? 'win' : 'loss') : 'pending'
        };
    });
    res.json(enrichedBets);
});

app.get('/api/matches/:id', (req, res) => {
    const match = sim.allMatches.find(m => m.id === parseInt(req.params.id));
    if (!match) return res.status(404).json({ error: "Partido no encontrado" });
    res.json(match);
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { username, avatar } = req.body;

        await db.query(
            'UPDATE users SET username = COALESCE($1, username), avatar = COALESCE($2, avatar) WHERE id = $3',
            [username, avatar, id]
        );

        const userIdx = sim.db.users.findIndex(u => u.id === id);
        if (userIdx !== -1) {
            if (username) sim.db.users[userIdx].username = username;
            if (avatar) sim.db.users[userIdx].avatar = avatar;
        }

        const updatedUser = sim.db.users.find(u => u.id === id);
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ error: "Error al actualizar perfil" });
    }
});


// --- CHAT ENDPOINTS ---

app.get('/api/messages/:matchId', async (req, res, next) => {
    try {
        const matchId = parseInt(req.params.matchId);
        if (isNaN(matchId)) return res.status(400).json({ error: "ID de partido inválido" });
        const history = sim.db.messages.filter(m => m.matchId === matchId);
        res.json(history);
    } catch (error) {
        next(error);
    }
});

app.post('/api/messages', async (req, res, next) => {
    try {
        const { matchId, username, text } = req.body;
        if (!matchId || !username || !text || text.trim() === "") {
            return res.status(400).json({ error: "Datos faltantes o texto vacío" });
        }

        const newMessage = {
            match_id: parseInt(matchId),
            username: username,
            text: text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        await db.query('INSERT INTO messages (match_id, username, text, time) VALUES ($1, $2, $3, $4)',
            [newMessage.match_id, newMessage.username, newMessage.text, newMessage.time]);

        sim.db.messages.push({ ...newMessage, matchId: newMessage.match_id });
        res.json({ ...newMessage, matchId: newMessage.match_id });
    } catch (error) {
        next(error);
    }
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    console.error(`[Error] ${new Date().toISOString()}:`, err);
    res.status(err.status || 500).json({
        error: "Internal Server Error",
        message: process.env.NODE_ENV === 'production' ? "Algo salió mal" : err.message
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor BetBuddy corriendo en http://localhost:${PORT}`);
});