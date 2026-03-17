// controllers/catalogs.controller.js
const pool = require('../config/mysql');

// GET /api/catalogs — todos los catálogos para formularios
exports.getAll = async (_, res) => {
  try {
    const [roles, estados, horarios, tipos, prioridades, clanes, cohortes] = await Promise.all([
      pool.query('SELECT nombre FROM roles ORDER BY id'),
      pool.query('SELECT nombre FROM estados ORDER BY id'),
      pool.query('SELECT nombre FROM horarios ORDER BY id'),
      pool.query('SELECT nombre FROM tipos_documento ORDER BY id'),
      pool.query('SELECT id, tipo_de_prioridad AS nombre FROM prioridades ORDER BY id'),
      pool.query('SELECT id, nombre FROM clan ORDER BY nombre'),
      pool.query('SELECT id, numero FROM cohorte ORDER BY numero'),
    ]);
    res.json({
      roles:           roles[0].map(r => r.nombre),
      estados:         estados[0].map(e => e.nombre),
      horarios:        horarios[0].map(h => h.nombre),
      tipos_documento: tipos[0].map(t => t.nombre),
      prioridades:     prioridades[0],
      clanes:          clanes[0],                          // [{ id, nombre }]
      cohortes:        cohortes[0],                        // [{ id, numero }]
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── CLAN CRUD ──────────────────────────────────────────
exports.getClanes = async (_, res) => {
  try {
    const [rows] = await pool.query('SELECT id, nombre FROM clan ORDER BY nombre');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.createClan = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const [r] = await pool.query('INSERT INTO clan (nombre) VALUES (?)', [nombre.trim()]);
    res.status(201).json({ id: r.insertId, nombre: nombre.trim() });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.updateClan = async (req, res) => {
  const { nombre } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
  try {
    const [r] = await pool.query('UPDATE clan SET nombre=? WHERE id=?', [nombre.trim(), req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
    res.json({ id: req.params.id, nombre: nombre.trim() });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.deleteClan = async (req, res) => {
  try {
    const [r] = await pool.query('DELETE FROM clan WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ── COHORTE CRUD (numero INT) ──────────────────────────
exports.getCohortes = async (_, res) => {
  try {
    const [rows] = await pool.query('SELECT id, numero FROM cohorte ORDER BY numero');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.createCohorte = async (req, res) => {
  const num = parseInt(req.body.numero, 10);
  if (isNaN(num) || num < 1) return res.status(400).json({ error: 'Número de cohorte inválido' });
  try {
    const [r] = await pool.query('INSERT INTO cohorte (numero) VALUES (?)', [num]);
    res.status(201).json({ id: r.insertId, numero: num });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'La cohorte ya existe' });
    res.status(500).json({ error: err.message });
  }
};
exports.updateCohorte = async (req, res) => {
  const num = parseInt(req.body.numero, 10);
  if (isNaN(num) || num < 1) return res.status(400).json({ error: 'Número inválido' });
  try {
    const [r] = await pool.query('UPDATE cohorte SET numero=? WHERE id=?', [num, req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
    res.json({ id: req.params.id, numero: num });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.deleteCohorte = async (req, res) => {
  try {
    const [r] = await pool.query('DELETE FROM cohorte WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
