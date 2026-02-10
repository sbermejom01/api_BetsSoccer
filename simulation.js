const db = require('./db');
const path = require('path');

// TEAMS are now loaded from the database during initialization

class SimulationEngine {
    constructor(dbPath) {
        this.io = null;
        this.duracionRealJornada = 10 * 60; //minutos 
        this.jornadaInterval = this.duracionRealJornada * 60 * 1000;
        this.matchDuration = (this.jornadaInterval / 10) + (1 * 60 * 1000); // Back-to-back with 1min overlap
        this.isSaving = false;
        this.pendingSave = false;

        // Inicialización inmediata para evitar errores de 'undefined' en Serverless
        this.allMatches = [];
        this.teams = [];
        this.matches = [];
        this.db = { users: [], bets: [], messages: [], matches: [], allMatches: [], players: [], notifications: [] };

        this.initialized = this.init();
    }

    async init() {
        await this.loadData();
        // Catch-up logic: Si el servidor estuvo apagado, avanzamos el tiempo
        await this.catchUp();

        if (!this.state.leagueStarted || !this.allMatches || this.allMatches.length === 0) {
            await this.generateSchedule();
        } else if (this.allMatches.length < 380) {
            await this.repairSchedule();
        }

        this.setupCurrentJornadaMatches();
        this.startTick();
    }

    async catchUp() {
        if (!this.state.leagueStarted || !this.state.lastJornadaStart) return;

        const now = Date.now();
        let elapsed = now - this.state.lastJornadaStart;

        while (elapsed >= this.jornadaInterval && this.state.currentJornada < 38) {
            console.log(`[Sim] Catch-up: Avanzando de Jornada ${this.state.currentJornada}...`);
            await this.advanceJornada();
            elapsed = now - this.state.lastJornadaStart;
        }
    }

    async loadData() {
        try {
            const userRes = await db.query('SELECT * FROM users');
            const teamRes = await db.query('SELECT * FROM teams');
            const matchRes = await db.query('SELECT * FROM matches ORDER BY id ASC');
            const betRes = await db.query('SELECT * FROM bets');
            const msgRes = await db.query('SELECT * FROM messages');
            const stateRes = await db.query('SELECT state FROM simulation_state WHERE id = 1');
            const playerRes = await db.query('SELECT * FROM players');
            const notifRes = await db.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');

            this.db = {
                users: userRes.rows,
                bets: betRes.rows.map(b => ({ id: b.id, userId: b.user_id, matchId: b.match_id, homeScore: b.home_score, awayScore: b.away_score, pointsEarned: b.points_earned })),
                messages: msgRes.rows,
                matches: [], // Se llena en setupCurrentJornadaMatches
                allMatches: matchRes.rows.map(m => ({
                    id: m.id,
                    jornada: m.jornada,
                    home: m.home_team,
                    away: m.away_team,
                    homeScore: m.home_score,
                    awayScore: m.away_score,
                    status: m.status,
                    time: m.time.toISOString(),
                    league: m.league,
                    events: m.events
                })),
                teams: teamRes.rows,
                simulationState: stateRes.rows[0]?.state || null,
                players: playerRes.rows,
                notifications: notifRes.rows.map(n => ({
                    id: n.id,
                    userId: n.user_id,
                    title: n.title,
                    message: n.message,
                    createdAt: n.created_at
                }))
            };

            this.state = this.db.simulationState || {
                currentJornada: 1,
                leagueStarted: false,
                lastJornadaStart: null,
                jornadas: []
            };

            this.allMatches = this.db.allMatches || [];
            this.teams = this.db.teams;
        } catch (error) {
            console.error("Error crítico cargando datos de Postgres:", error);
            // Ya no hacemos fallback a arrays vacíos si es un error real
            // para evitar estados inconsistentes (404s falsos)
            throw error;
        }
    }

    async saveData() {
        if (this.isSaving) {
            this.pendingSave = true;
            return;
        }

        this.isSaving = true;

        try {
            const client = await db.pool.connect();
            try {
                await client.query('BEGIN');

                // Actualizar estado
                await client.query('INSERT INTO simulation_state (id, state) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state', [this.state]);

                // Actualizar equipos (esto puede ser lento si se hace mucho, pero son 20)
                for (const t of this.teams) {
                    await client.query(`
                        UPDATE teams SET pj=$1, pg=$2, pe=$3, pp=$4, gf=$5, gc=$6, pts=$7 
                        WHERE name=$8
                    `, [t.pj, t.pg, t.pe, t.pp, t.gf, t.gc, t.pts, t.name]);
                }

                // Actualizar partidos activos y los que hayan cambiado (esto es más complejo, simplificamos por ahora guardando todos los de la jornada actual o los live)
                const changedMatches = this.allMatches.filter(m => m.jornada === this.state.currentJornada || m.status !== 'pending');
                for (const m of changedMatches) {
                    await client.query(`
                        UPDATE matches SET home_score=$1, away_score=$2, status=$3, events=$4, time=$5
                        WHERE id=$6
                    `, [m.homeScore, m.awayScore, m.status, JSON.stringify(m.events), m.time, m.id]);
                }

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } catch (error) {
            console.error("Error al guardar en Postgres:", error);
        } finally {
            this.isSaving = false;
            if (this.pendingSave) {
                this.pendingSave = false;
                await this.saveData();
            }
        }
    }

    async generateSchedule() {
        if (!this.teams || this.teams.length === 0) {
            console.error("[Sim] No hay equipos cargados para generar el calendario");
            return;
        }
        const teams = [...this.teams].map(t => t.name);
        const numTeams = teams.length;
        const numDays = numTeams - 1;
        const matchesPerDay = numTeams / 2;

        let schedule = [];
        for (let i = 0; i < numDays; i++) {
            let jornada = [];
            for (let j = 0; j < matchesPerDay; j++) {
                const home = teams[j];
                const away = teams[numTeams - 1 - j];
                jornada.push({ home, away });
            }
            schedule.push(jornada);
            teams.splice(1, 0, teams.pop());
        }

        const secondRound = schedule.map(j => j.map(m => ({ home: m.away, away: m.home })));
        this.state.jornadas = [...schedule, ...secondRound];
        this.state.leagueStarted = true;
        this.state.currentJornada = 1;
        this.state.lastJornadaStart = Date.now();

        // Initialize all 380 matches with staggered times
        this.allMatches = [];
        const matchSpacing = this.jornadaInterval / 10;

        this.state.jornadas.forEach((jornada, jIdx) => {
            const jornadaStart = this.state.lastJornadaStart + (jIdx * this.jornadaInterval);
            jornada.forEach((m, mIdx) => {
                this.allMatches.push({
                    id: (jIdx * 10) + mIdx + 1,
                    jornada: jIdx + 1,
                    ...m,
                    homeScore: 0,
                    awayScore: 0,
                    status: 'pending',
                    // Escalonamiento: cada partido empieza uno tras otro
                    time: new Date(jornadaStart + (mIdx * matchSpacing)).toISOString(),
                    league: 'La Liga',
                    events: []
                });
            });
        });

        // Guardar partidos iniciales en bulk (Optimizado para Serverless)
        const CHUNK_SIZE = 50; // Insertar en lotes de 50 para no exceder límites de parámetros
        for (let i = 0; i < this.allMatches.length; i += CHUNK_SIZE) {
            const chunk = this.allMatches.slice(i, i + CHUNK_SIZE);
            const values = [];
            const placeholders = chunk.map((m, idx) => {
                const base = idx * 10;
                values.push(m.id, m.jornada, m.home, m.away, m.homeScore, m.awayScore, m.status, m.time, m.league, JSON.stringify(m.events));
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
            }).join(',');

            await db.query(`
                INSERT INTO matches (id, jornada, home_team, away_team, home_score, away_score, status, time, league, events)
                VALUES ${placeholders}
                ON CONFLICT (id) DO NOTHING
            `, values);
        }

        this.setupCurrentJornadaMatches();
        await this.saveData();
    }

    async repairSchedule() {
        if (!this.state.jornadas || this.state.jornadas.length === 0) return;

        for (const [jIdx, jornada] of this.state.jornadas.entries()) {
            for (const [mIdx, m] of jornada.entries()) {
                const matchId = (jIdx * 10) + mIdx + 1;
                const exists = this.allMatches.find(am => am.id === matchId);

                if (!exists) {
                    this.allMatches.push({
                        id: matchId,
                        jornada: jIdx + 1,
                        ...m,
                        homeScore: 0,
                        awayScore: 0,
                        status: 'pending',
                        time: new Date(this.state.lastJornadaStart + (jIdx * this.jornadaInterval) + 300000).toISOString(),
                        league: 'La Liga',
                        events: []
                    });
                }
            }
        }

        // Ordenar por ID para mantener consistencia
        this.allMatches.sort((a, b) => a.id - b.id);
        await this.saveData();
    }

    setupCurrentJornadaMatches() {
        this.matches = this.allMatches.filter(m => m.jornada === this.state.currentJornada);
    }

    startTick() {
        setInterval(() => this.tick(), 10000); // Check every 10s
    }

    async tick() {
        const now = Date.now();

        // 1. Simular progreso de partidos (Todos los partidos, por si hubo desconexión)
        for (const m of this.allMatches) {
            const matchStartTime = new Date(m.time).getTime();
            const matchEndTime = matchStartTime + this.matchDuration;

            // El partido ya debería haber terminado
            if (m.status !== 'finished' && now >= matchEndTime) {
                console.log(`[Sim] Finalizando partido atrasado: ${m.home} vs ${m.away}`);
                await this.fastForwardMatch(m);
            }
            // El partido debería estar en vivo
            else if (m.status === 'pending' && now >= matchStartTime && now < matchEndTime) {
                m.status = 'live';
            }
            // El partido está en vivo, simular un "paso" (esto solo añade goles si el servidor está despierto)
            else if (m.status === 'live') {
                const elapsed = now - matchStartTime;
                m.minute = Math.min(90, Math.max(0, Math.floor((elapsed / this.matchDuration) * 90)));
                this.simulateMatchProgress(m);
            }
        }

        // 2. Catch-up de jornadas
        if (this.state.leagueStarted && this.state.lastJornadaStart) {
            let elapsed = now - this.state.lastJornadaStart;
            while (elapsed >= this.jornadaInterval && this.state.currentJornada < 38) {
                console.log(`[Sim] Catch-up: Avanzando de Jornada ${this.state.currentJornada}...`);
                await this.advanceJornada();
                elapsed = now - this.state.lastJornadaStart;
            }
        }

        await this.saveData();
    }

    async fastForwardMatch(match) {
        if (match.status === 'finished') return;

        const homeT = this.teams.find(t => t.name === match.home);
        const awayT = this.teams.find(t => t.name === match.away);
        if (!homeT || !awayT) return;

        // Simulación rápida basada en fuerza de equipos
        const totalStr = homeT.strength + awayT.strength;
        const avgGoals = 2.5;

        // Simular goles usando una distribución simplificada
        const simGoles = (teamStr, otherStr) => {
            const lambda = (teamStr / (teamStr + otherStr)) * avgGoals;
            // Poisson aproximado
            let L = Math.exp(-lambda);
            let p = 1.0;
            let k = 0;
            do { k++; p *= Math.random(); } while (p > L);
            return k - 1;
        };

        match.homeScore = simGoles(homeT.strength, awayT.strength);
        match.awayScore = simGoles(awayT.strength, homeT.strength);

        match.events = [];
        // Generar eventos de goles
        for (let i = 0; i < match.homeScore; i++) {
            match.events.push(this.generateGoalEvent(match, 'home', true));
        }
        for (let i = 0; i < match.awayScore; i++) {
            match.events.push(this.generateGoalEvent(match, 'away', true));
        }
        match.events.sort((a, b) => a.minute - b.minute);

        // Corregir marcadores progresivos tras el sorteo de minutos
        let tempHome = 0;
        let tempAway = 0;
        match.events.forEach(ev => {
            if (ev.type === 'goal') {
                if (ev.team === match.home) tempHome++;
                else tempAway++;
                ev.score = `${tempHome}-${tempAway}`;
            }
        });

        await this.finishMatch(match);
    }

    generateGoalEvent(match, scoringTeam, isRandomMinute = false) {
        const teamName = scoringTeam === 'home' ? match.home : match.away;
        const teamPlayers = this.db.players.filter(p => p.team_name === teamName);
        const scorer = teamPlayers.length > 0
            ? teamPlayers[Math.floor(Math.random() * teamPlayers.length)]
            : { name: 'Jugador Desconocido', id: null, avatar_url: '' };

        const minute = isRandomMinute
            ? Math.floor(Math.random() * 90)
            : Math.floor(((Date.now() - new Date(match.time).getTime()) / this.matchDuration) * 90);

        if (scorer.id) {
            db.query('UPDATE players SET goals = goals + 1 WHERE id = $1', [scorer.id]).catch(() => { });
            const dbPlayer = this.db.players.find(p => p.id === scorer.id);
            if (dbPlayer) dbPlayer.goals++;
        }

        return {
            type: 'goal',
            team: teamName,
            player: scorer.name,
            playerId: scorer.id,
            playerAvatar: scorer.avatar_url,
            minute: Math.min(90, Math.max(1, minute)),
            score: `${match.homeScore}-${match.awayScore}` // Nota: Esto puede ser impreciso en simulación rápida, se arregla al final
        };
    }

    simulateMatchProgress(match) {
        // High quality chances: approx 1 chance every 30 seconds
        if (Math.random() > 0.85) {
            const homeT = this.teams.find(t => t.name === match.home);
            const awayT = this.teams.find(t => t.name === match.away);

            if (!homeT || !awayT) return;

            const totalStr = homeT.strength + awayT.strength;
            const scoringTeam = Math.random() < (homeT.strength / totalStr) ? 'home' : 'away';

            const currentTeamScore = scoringTeam === 'home' ? match.homeScore : match.awayScore;
            let goalThreshold = 0.7;

            if (currentTeamScore === 2) goalThreshold = 0.85;
            else if (currentTeamScore === 3) goalThreshold = 0.95;
            else if (currentTeamScore >= 4) goalThreshold = 0.98;

            if (Math.random() > goalThreshold) {
                if (scoringTeam === 'home') match.homeScore++;
                else match.awayScore++;

                const event = this.generateGoalEvent(match, scoringTeam);
                match.events.push(event);
            }
        }
    }

    async finishMatch(match) {
        match.status = 'finished';
        match.minute = 90;
        const homeTeam = this.teams.find(t => t.name === match.home);
        const awayTeam = this.teams.find(t => t.name === match.away);

        if (!homeTeam || !awayTeam) return;

        homeTeam.pj++; awayTeam.pj++;
        homeTeam.gf += match.homeScore; homeTeam.gc += match.awayScore;
        awayTeam.gf += match.awayScore; awayTeam.gc += match.homeScore;

        if (match.homeScore > match.awayScore) {
            homeTeam.pg++; homeTeam.pts += 3; awayTeam.pp++;
        } else if (match.homeScore < match.awayScore) {
            awayTeam.pg++; awayTeam.pts += 3; homeTeam.pp++;
        } else {
            homeTeam.pe++; homeTeam.pts += 1; awayTeam.pe++; awayTeam.pts += 1;
        }

        await this.resolveBets(match);
    }

    async resolveBets(match) {
        const matchBets = this.db.bets.filter(b => b.matchId === match.id);

        for (const bet of matchBets) {
            const user = this.db.users.find(u => u.id === bet.userId);
            if (!user) continue;

            let pointsEarned = 0;
            const isExact = bet.homeScore === match.homeScore && bet.awayScore === match.awayScore;

            const matchWinner = match.homeScore > match.awayScore ? 'home' : (match.homeScore < match.awayScore ? 'away' : 'draw');
            const betWinner = bet.homeScore > bet.awayScore ? 'home' : (bet.homeScore < bet.awayScore ? 'away' : 'draw');

            if (isExact) {
                pointsEarned = 10;
            } else if (matchWinner === betWinner) {
                pointsEarned = 5;
            }

            bet.pointsEarned = pointsEarned;
            await db.query('UPDATE bets SET points_earned = $1 WHERE id = $2', [pointsEarned, bet.id]);

            if (pointsEarned > 0) {
                user.points = (user.points || 0) + pointsEarned;
                const notification = {
                    id: Date.now() + Math.round(Math.random() * 1000),
                    userId: user.id,
                    title: '¡Apuesta Ganada!',
                    message: `Has ganado ${pointsEarned} puntos en el ${match.home} vs ${match.away}`,
                    createdAt: new Date().toISOString()
                };
                this.db.notifications.push(notification);

                await db.query('UPDATE users SET points = $1 WHERE id = $2', [user.points, user.id]);
                await db.query('INSERT INTO notifications (id, user_id, title, message, created_at) VALUES ($1, $2, $3, $4, $5)',
                    [notification.id, notification.userId, notification.title, notification.message, notification.createdAt]);
            }
        }
    }

    async advanceJornada() {
        if (this.state.currentJornada < 38) {
            // Antes de avanzar, nos aseguramos que todos los partidos de la jornada actual estén terminados
            const currentJornadaMatches = this.allMatches.filter(m => m.jornada === this.state.currentJornada);
            for (const m of currentJornadaMatches) {
                if (m.status !== 'finished') {
                    await this.fastForwardMatch(m);
                }
            }

            this.state.currentJornada++;
            this.state.lastJornadaStart = Date.now();
            this.setupCurrentJornadaMatches();
        }
    }

    getStandings() {
        return [...this.teams].sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc));
    }

}

module.exports = SimulationEngine;
