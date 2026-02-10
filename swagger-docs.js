/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         username:
 *           type: string
 *         email:
 *           type: string
 *         points:
 *           type: integer
 *         avatar:
 *           type: string
 *
 *     Match:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         jornada:
 *           type: integer
 *         home:
 *           type: string
 *         away:
 *           type: string
 *         homeScore:
 *           type: integer
 *         awayScore:
 *           type: integer
 *         minute:
 *           type: integer
 *         status:
 *           type: string
 *           enum: [pending, live, finished]
 *         time:
 *           type: string
 *           format: date-time
 *         league:
 *           type: string
 *         events:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MatchEvent'
 *
 *     MatchEvent:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *         team:
 *           type: string
 *         player:
 *           type: string
 *         minute:
 *           type: integer
 *         score:
 *           type: string
 *
 *     Bet:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         userId:
 *           type: integer
 *         matchId:
 *           type: integer
 *         homeScore:
 *           type: integer
 *         awayScore:
 *           type: integer
 *         pointsEarned:
 *           type: integer
 *         match:
 *           $ref: '#/components/schemas/Match'
 *
 *     ChatMessage:
 *       type: object
 *       properties:
 *         matchId:
 *           type: integer
 *         username:
 *           type: string
 *         text:
 *           type: string
 *         time:
 *           type: string
 *
 *     Player:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         team_name:
 *           type: string
 *         avatar_url:
 *           type: string
 *         goals:
 *           type: integer
 *
 *     Standing:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         strength:
 *           type: integer
 *         pj:
 *           type: integer
 *         pg:
 *           type: integer
 *         pe:
 *           type: integer
 *         pp:
 *           type: integer
 *         gf:
 *           type: integer
 *         gc:
 *           type: integer
 *         pts:
 *           type: integer
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * tags:
 *   - name: Autenticacion
 *   - name: Partidos
 *   - name: Apuestas
 *   - name: Social
 *   - name: Liga
 *   - name: Sistema
 *   - name: Usuario
 *   - name: Chat
 */

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: Registra un nuevo usuario
 *     tags: [Autenticacion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string, minLength: 3, maxLength: 20 }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 4 }
 *     responses:
 *       200:
 *         description: Usuario registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 *       400:
 *         description: Datos de registro inválidos o email ya registrado
 *       500:
 *         description: Error interno del servidor
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/login:
 *   post:
 *     summary: Inicia sesión
 *     tags: [Autenticacion]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Credenciales inválidas
 *       500:
 *         description: Error interno del servidor
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/matches:
 *   get:
 *     summary: Obtiene los partidos de la jornada actual
 *     tags: [Partidos]
 *     responses:
 *       200:
 *         description: Lista de partidos de la jornada actual
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Match'
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/matches/{id}:
 *   get:
 *     summary: Obtiene los detalles de un partido específico
 *     tags: [Partidos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Detalles del partido encontrados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 *       404:
 *         description: Partido no encontrado
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/bets:
 *   post:
 *     summary: Realiza o actualiza una apuesta
 *     tags: [Apuestas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, matchId, homeScore, awayScore]
 *             properties:
 *               userId: { type: integer }
 *               matchId: { type: integer }
 *               homeScore: { type: integer, minimum: 0 }
 *               awayScore: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Apuesta guardada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bet'
 *       400:
 *         description: Datos de apuesta inválidos o partido ya iniciado
 *       401:
 *         description: No autorizado (Token faltante)
 *       403:
 *         description: Prohibido (Token inválido o el usuario no coincide con userId)
 *       404:
 *         description: Partido no encontrado
 *       500:
 *         description: Error al guardar la apuesta
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/bets/user/{userId}:
 *   get:
 *     summary: Obtiene todas las apuestas de un usuario específico
 *     tags: [Apuestas]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de apuestas del usuario con datos del partido enriquecidos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Bet'
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/leaderboard:
 *   get:
 *     summary: Ranking global de usuarios por puntos
 *     tags: [Social]
 *     responses:
 *       200:
 *         description: Lista de usuarios ordenada por puntuación
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/league/standings:
 *   get:
 *     summary: Obtiene la tabla de posiciones actual de la liga
 *     tags: [Liga]
 *     responses:
 *       200:
 *         description: Clasificación detallada de los equipos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Standing'
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/league/results/{jornada}:
 *   get:
 *     summary: Obtiene todos los partidos y resultados de una jornada específica
 *     tags: [Liga]
 *     parameters:
 *       - in: path
 *         name: jornada
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de partidos de la jornada solicitada
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Match'
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/teams/{teamName}/players:
 *   get:
 *     summary: Obtiene la lista de jugadores que pertenecen a un equipo
 *     tags: [Liga]
 *     parameters:
 *       - in: path
 *         name: teamName
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de jugadores del equipo
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Player'
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/players/top-scorers:
 *   get:
 *     summary: Obtiene los 10 máximos goleadores de la competición
 *     tags: [Liga]
 *     responses:
 *       200:
 *         description: Lista de los 10 jugadores con más goles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Player'
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/simulation/state:
 *   get:
 *     summary: Obtiene el estado actual de la simulación de la liga
 *     tags: [Sistema]
 *     responses:
 *       200:
 *         description: Información sobre la jornada actual y progreso de la liga
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 currentJornada: { type: integer }
 *                 leagueStarted: { type: boolean }
 *                 lastJornadaStart: { type: integer }
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/users/{id}:
 *   put:
 *     summary: Actualiza el perfil de un usuario (Nombre o Avatar)
 *     tags: [Usuario]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, minLength: 3 }
 *               avatar: { type: string }
 *     responses:
 *       200:
 *         description: Perfil actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: No autorizado
 *       500:
 *         description: Error al actualizar el perfil
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/messages/{matchId}:
 *   get:
 *     summary: Obtiene el historial de mensajes del chat de un partido
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de mensajes del partido
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ChatMessage'
 *       400:
 *         description: ID de partido inválido
 *       503:
 *         description: Servicio inicializándose
 *
 * /api/messages:
 *   post:
 *     summary: Envía un nuevo mensaje al chat de un partido
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [matchId, username, text]
 *             properties:
 *               matchId: { type: integer }
 *               username: { type: string }
 *               text: { type: string }
 *     responses:
 *       200:
 *         description: Mensaje enviado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ChatMessage'
 *       400:
 *         description: Datos faltantes o inválidos
 *       500:
 *         description: Error al guardar el mensaje
 *       503:
 *         description: Servicio inicializándose
 */
