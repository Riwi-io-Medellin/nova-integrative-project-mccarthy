process.env.TZ = 'America/Bogota';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const connectMongo = require('./config/mongo');

const app  = express();
const PORT = process.env.PORT || 3000;

connectMongo();

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
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const FRONT = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONT));

app.use('/api/auth',      require('./routes/auth.routes'));
app.use('/api/users',     require('./routes/users.routes'));
app.use('/api/novedades', require('./routes/novedades.routes'));
app.use('/api/catalogs',  require('./routes/catalogs.routes'));
app.use('/api/audit',     require('./routes/audit.routes'));

app.get("/api/health", async (_, res) => {
  try {
    const pool = require("./config/mysql");
    await pool.query("SELECT 1");
    res.json({ ok: true, time: new Date() });
  } catch (err) {
    res.status(500).json({ ok: false, error: "DB no disponible" });
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

app.use((err, _req, res, _next) => {
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(FRONT, 'pages', 'login.html'));
});

app.listen(PORT, () => {
  console.log('Nova API corriendo en http://localhost:' + PORT);
});
