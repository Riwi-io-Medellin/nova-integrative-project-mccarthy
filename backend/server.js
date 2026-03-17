process.env.TZ = 'America/Bogota';

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const connectMongo = require('./config/mongo');

const app  = express();
const PORT = process.env.PORT || 3000;

connectMongo();

// ── 1. Headers de seguridad HTTP (helmet) ─────────────────
// Agrega automaticamente: X-Content-Type-Options, X-Frame-Options,
// Strict-Transport-Security, X-XSS-Protection y otros
app.use(helmet({
  contentSecurityPolicy: false, // desactivado para no romper el frontend vanilla
}));

// ── 2. CORS ───────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Origen no permitido: ' + origin));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── 3. Rate limiting ──────────────────────────────────────

// Login y registro: max 10 intentos cada 15 minutos por IP
// Evita ataques de fuerza bruta para adivinar contrasenas
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  message: { error: 'Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Recuperacion de contrasena: max 5 intentos cada 15 minutos por IP
// Evita abuso del sistema de emails
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiadas solicitudes de recuperacion. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// API general: max 200 peticiones cada 10 minutos por IP
// Evita scraping masivo o abuso general de la API
const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 200,
  message: { error: 'Demasiadas peticiones. Espera unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── 4. Parsers ────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── 5. Frontend estatico ──────────────────────────────────
const FRONT = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONT));

// ── 6. Rutas con rate limiting aplicado ───────────────────
// Los limiters de auth van ANTES de registrar las rutas
app.use('/api/auth/login',           authLimiter);
app.use('/api/auth/register',        authLimiter);
app.use('/api/auth/forgot-password', forgotLimiter);
app.use('/api/auth/reset-password',  forgotLimiter);

// Limiter general para el resto de la API
app.use('/api', apiLimiter);

app.use('/api/auth',      require('./routes/auth.routes'));
app.use('/api/users',     require('./routes/users.routes'));
app.use('/api/novedades', require('./routes/novedades.routes'));
app.use('/api/catalogs',  require('./routes/catalogs.routes'));
app.use('/api/audit',     require('./routes/audit.routes'));

app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date() }));

// ── 7. Ruta no encontrada ─────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── 8. Manejador de errores global (sin exponer detalles) ──
// Nunca envia err.message al cliente en produccion
app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  // Loguear internamente con el detalle real
  console.error('Error interno:', err.message);
  // Al cliente solo un mensaje generico
  res.status(err.status || 500).json({ error: 'Error interno del servidor' });
});

// ── 9. Fallback al frontend ───────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONT, 'pages', 'login.html'));
});

app.listen(PORT, () => {
  console.log('Nova API corriendo en http://localhost:' + PORT);
});
