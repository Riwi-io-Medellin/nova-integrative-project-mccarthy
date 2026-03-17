// controllers/users.controller.js
const bcrypt   = require('bcryptjs');
const pool     = require('../config/mysql');
const { audit } = require('../models/AuditLog');
const { uploadToCloudinary } = require('../config/cloudinary');

// ─── SELECT base: devuelve clan/cohorte como nombre/número via JOIN ───────────
const SELECT = `
  SELECT u.id, u.nombre, u.apellido,
         td.nombre  AS tipo_documento, u.documento,
         u.correo,  u.telefono,
         r.nombre   AS role,
         e.nombre   AS estado,
         cl.nombre  AS clan,   u.clan_id,
         co.numero  AS cohorte_numero, u.cohorte_id,
         h.nombre   AS horario, u.horario_id,
         u.avatar,  u.observaciones, u.created_at
  FROM   usuarios u
  JOIN   roles              r  ON u.role_id           = r.id
  JOIN   estados            e  ON u.estado_id         = e.id
  LEFT JOIN horarios        h  ON u.horario_id        = h.id
  LEFT JOIN tipos_documento td ON u.tipo_documento_id = td.id
  LEFT JOIN clan            cl ON u.clan_id           = cl.id
  LEFT JOIN cohorte         co ON u.cohorte_id        = co.id
`;

// ── Excluye campos sensibles de todas las respuestas ──────────────
const fmt = u => {
  const { password, reset_token, reset_token_expires, ...safe } = u;
  return {
    ...safe,
    id: String(u.id),
    corte: u.cohorte_numero !== null && u.cohorte_numero !== undefined
      ? `Cohorte ${u.cohorte_numero}` : null,
  };
};

// ─── GET ALL ───────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { search, role, estado } = req.query;
    let sql = SELECT + ' WHERE 1=1';
    const params = [];
    if (search) {
      sql += ' AND (u.nombre LIKE ? OR u.apellido LIKE ? OR u.correo LIKE ? OR u.documento LIKE ?)';
      const l = `%${search}%`;
      params.push(l, l, l, l);
    }
    if (role)   { sql += ' AND r.nombre=?'; params.push(role); }
    if (estado) { sql += ' AND e.nombre=?'; params.push(estado); }
    sql += ' ORDER BY u.id';
    const [rows] = await pool.query(sql, params);
    res.json(rows.map(fmt));
  } catch (err) { res.status(500).json({ error: 'Error interno del servidor' }); }
};

// ─── GET ONE ───────────────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const [[row]] = await pool.query(SELECT + ' WHERE u.id=?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    res.json(fmt(row));
  } catch (err) { res.status(500).json({ error: 'Error interno del servidor' }); }
};

// ─── CREATE ────────────────────────────────────────────────────────
exports.create = async (req, res) => {
  const b = req.body;
  const required = ['nombre','apellido','documento','correo','password','role'];
  for (const f of required)
    if (!b[f]) return res.status(400).json({ error: `Campo '${f}' requerido` });

  // Validacion de formato de correo
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(b.correo))
    return res.status(400).json({ error: 'El correo no tiene un formato valido' });

  // Validacion de longitudes maximas
  if (b.nombre.length > 100 || b.apellido.length > 100)
    return res.status(400).json({ error: 'Nombre o apellido demasiado largo (max 100 caracteres)' });
  if (b.password.length < 6)
    return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });

  try {
    const [[exists]] = await pool.query(
      'SELECT id FROM usuarios WHERE correo=? OR documento=?', [b.correo, b.documento]);
    if (exists) return res.status(409).json({ error: 'Correo o documento ya registrado' });

    const [[role]]   = await pool.query('SELECT id FROM roles WHERE nombre=?', [b.role]);
    if (!role) return res.status(400).json({ error: 'Rol invalido' });

    const [[estado]] = await pool.query('SELECT id FROM estados WHERE nombre=?', [b.estado||'Activo']);
    if (!estado) return res.status(400).json({ error: 'Estado invalido' });

    const [[horario]] = b.horario
      ? await pool.query('SELECT id FROM horarios WHERE nombre=?', [b.horario])
      : [[null]];

    const [[tipodoc]] = b.tipo_documento
      ? await pool.query('SELECT id FROM tipos_documento WHERE nombre=?', [b.tipo_documento])
      : [[null]];

    let clanId = null;
    if (b.clan) {
      const [[cl]] = await pool.query('SELECT id FROM clan WHERE nombre=?', [b.clan]);
      clanId = cl?.id || null;
    }

    let cohorteId = null;
    if (b.cohorte) {
      const num = parseInt(String(b.cohorte).replace(/\D/g, ''), 10);
      if (!isNaN(num)) {
        const [[co]] = await pool.query('SELECT id FROM cohorte WHERE numero=?', [num]);
        cohorteId = co?.id || null;
      }
    }

    let avatarUrl = b.avatar || null;
    if (req.file) {
      const { url } = await uploadToCloudinary(req.file.buffer, 'nova/avatars');
      avatarUrl = url;
    }

    const hash = await bcrypt.hash(b.password, 12);
    const [result] = await pool.query(
      `INSERT INTO usuarios
         (nombre,apellido,tipo_documento_id,documento,correo,password,
          telefono,role_id,estado_id,clan_id,cohorte_id,horario_id,avatar,observaciones)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.nombre, b.apellido, tipodoc?.id||null, b.documento, b.correo, hash,
       b.telefono||null, role.id, estado.id, clanId, cohorteId,
       horario?.id||null, avatarUrl, b.observaciones||null]
    );

    const [[user]] = await pool.query(SELECT + ' WHERE u.id=?', [result.insertId]);
    await audit('CREATE_USER', 'usuario', result.insertId, req.user, { correo: b.correo }, req.ip);
    res.status(201).json(fmt(user));
  } catch (err) { res.status(500).json({ error: 'Error interno del servidor' }); }
};

// ─── UPDATE ────────────────────────────────────────────────────────
exports.update = async (req, res) => {
  const b = req.body;
  const sets = [], vals = [];
  try {
    const simple = ['nombre','apellido','documento','correo','telefono','observaciones'];
    simple.forEach(f => { if (f in b) { sets.push(`${f}=?`); vals.push(b[f]||null); } });

    // Validacion de correo si se esta actualizando
    if (b.correo) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(b.correo))
        return res.status(400).json({ error: 'El correo no tiene un formato valido' });
    }

    if (b.password) {
      if (b.password.length < 6)
        return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres' });
      const hash = await bcrypt.hash(b.password, 12);
      sets.push('password=?'); vals.push(hash);
    }
    if ('estado' in b) {
      const [[e]] = await pool.query('SELECT id FROM estados WHERE nombre=?', [b.estado]);
      if (e) { sets.push('estado_id=?'); vals.push(e.id); }
    }
    if ('role' in b) {
      const [[r]] = await pool.query('SELECT id FROM roles WHERE nombre=?', [b.role]);
      if (r) { sets.push('role_id=?'); vals.push(r.id); }
    }
    if ('horario' in b) {
      const [[h]] = b.horario
        ? await pool.query('SELECT id FROM horarios WHERE nombre=?', [b.horario])
        : [[null]];
      sets.push('horario_id=?'); vals.push(h?.id||null);
    }
    if ('tipo_documento' in b) {
      const [[t]] = b.tipo_documento
        ? await pool.query('SELECT id FROM tipos_documento WHERE nombre=?', [b.tipo_documento])
        : [[null]];
      sets.push('tipo_documento_id=?'); vals.push(t?.id||null);
    }
    if ('clan' in b) {
      let clanId = null;
      if (b.clan) {
        const [[cl]] = await pool.query('SELECT id FROM clan WHERE nombre=?', [b.clan]);
        clanId = cl?.id || null;
      }
      sets.push('clan_id=?'); vals.push(clanId);
    }
    if ('cohorte' in b) {
      let cohorteId = null;
      if (b.cohorte) {
        const num = parseInt(String(b.cohorte).replace(/\D/g, ''), 10);
        if (!isNaN(num)) {
          const [[co]] = await pool.query('SELECT id FROM cohorte WHERE numero=?', [num]);
          cohorteId = co?.id || null;
        }
      }
      sets.push('cohorte_id=?'); vals.push(cohorteId);
    }
    if (req.file) {
      const { url } = await uploadToCloudinary(req.file.buffer, 'nova/avatars');
      sets.push('avatar=?'); vals.push(url);
    } else if ('avatar' in b) {
      sets.push('avatar=?'); vals.push(b.avatar||null);
    }

    if (!sets.length) return res.status(400).json({ error: 'Nada que actualizar' });
    vals.push(req.params.id);

    const [[prev]] = await pool.query(
      'SELECT u.correo, u.nombre, e.nombre AS estado_actual FROM usuarios u JOIN estados e ON u.estado_id=e.id WHERE u.id=?',
      [req.params.id]
    );

    await pool.query(`UPDATE usuarios SET ${sets.join(',')} WHERE id=?`, vals);
    const [[user]] = await pool.query(SELECT + ' WHERE u.id=?', [req.params.id]);

    if (b.estado === 'Activo' && prev?.estado_actual !== 'Activo') {
      try {
        const { sendMail } = require('../config/mailer');
        await sendMail(prev.correo, 'Tu cuenta en NOVA ha sido activada', `
          <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f8;padding:32px">
          <div style="max-width:520px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
            <div style="background:linear-gradient(135deg,#6d28d9,#8b5cf6);padding:28px;text-align:center">
              <h1 style="color:#fff;margin:0;font-size:1.4rem">Cuenta activada</h1>
            </div>
            <div style="padding:32px;color:#374151">
              <h2 style="color:#6d28d9;margin-top:0">Hola, ${prev.nombre}</h2>
              <p>Tu cuenta en <strong>NOVA</strong> ha sido activada por un administrador.</p>
              <p>Ya puedes iniciar sesion y comenzar a usar la plataforma.</p>
              <div style="text-align:center;margin:28px 0">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/pages/login.html"
                   style="background:#6d28d9;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:1rem">
                  Ir al login
                </a>
              </div>
            </div>
            <div style="background:#f9fafb;padding:16px;text-align:center;font-size:.8rem;color:#9ca3af;border-top:1px solid #e5e7eb">Mensaje automatico - No responder</div>
          </div></body></html>
        `);
      } catch (_) {}
    }

    await audit('UPDATE_USER', 'usuario', req.params.id, req.user, b, req.ip);
    res.json(fmt(user));
  } catch (err) { res.status(500).json({ error: 'Error interno del servidor' }); }
};

// ─── DELETE ────────────────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const [r] = await pool.query('DELETE FROM usuarios WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'No encontrado' });
    await audit('DELETE_USER', 'usuario', req.params.id, req.user, null, req.ip);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Error interno del servidor' }); }
};

// ─── STATS ─────────────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const [[{ total }]]     = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
    const [[{ activos }]]   = await pool.query(
      "SELECT COUNT(*) AS activos   FROM usuarios u JOIN estados e ON u.estado_id=e.id WHERE e.nombre='Activo'");
    const [[{ inactivos }]] = await pool.query(
      "SELECT COUNT(*) AS inactivos FROM usuarios u JOIN estados e ON u.estado_id=e.id WHERE e.nombre='Inactivo'");
    res.json({ total, activos, inactivos });
  } catch (err) { res.status(500).json({ error: 'Error interno del servidor' }); }
};

// ─── BULK IMPORT CSV ───────────────────────────────────────────────
exports.bulkImport = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo CSV requerido' });
  const csv = req.file.buffer.toString('utf8');
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return res.status(400).json({ error: 'CSV vacio o sin datos' });

  const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g,''));
  const needed = ['nombre','apellido','documento','correo','password'];
  for (const n of needed)
    if (!header.includes(n)) return res.status(400).json({ error: `Columna requerida: ${n}` });

  const results = { created: 0, skipped: 0, errors: [] };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(\".*?\"|[^,]+)(?=,|$)/g) || [];
    const row  = {};
    header.forEach((h, idx) => { row[h] = (cols[idx]||'').replace(/^"|"$/g,'').trim(); });

    if (!row.nombre || !row.apellido || !row.documento || !row.correo || !row.password) {
      results.errors.push({ fila: i+1, error: 'Campos requeridos vacios' }); continue;
    }

    // Validar formato de correo en importacion masiva
    if (!emailRegex.test(row.correo)) {
      results.errors.push({ fila: i+1, error: `Correo invalido: ${row.correo}` }); continue;
    }

    try {
      const [[exists]] = await pool.query(
        'SELECT id FROM usuarios WHERE correo=? OR documento=?', [row.correo, row.documento]);
      if (exists) { results.skipped++; continue; }

      const [[role]]   = await pool.query(
        'SELECT id FROM roles WHERE nombre=?', [row.role||'Coder']);
      const [[estado]] = await pool.query(
        'SELECT id FROM estados WHERE nombre=?', [row.estado||'Activo']);
      const [[horario]] = row.horario
        ? await pool.query('SELECT id FROM horarios WHERE nombre=?', [row.horario])
        : [[null]];
      const [[tipodoc]] = row.tipo_documento
        ? await pool.query('SELECT id FROM tipos_documento WHERE nombre=?', [row.tipo_documento])
        : [[null]];

      let clanId = null;
      if (row.clan) {
        const [[cl]] = await pool.query('SELECT id FROM clan WHERE nombre=?', [row.clan]);
        clanId = cl?.id || null;
      }
      let cohorteId = null;
      if (row.cohorte) {
        const num = parseInt(String(row.cohorte).replace(/\D/g,''), 10);
        if (!isNaN(num)) {
          const [[co]] = await pool.query('SELECT id FROM cohorte WHERE numero=?', [num]);
          cohorteId = co?.id || null;
        }
      }

      const isHashed = /^\$2[ab]\$\d+\$/.test(row.password);
      const hash = isHashed ? row.password : await bcrypt.hash(row.password, 12);

      await pool.query(
        `INSERT INTO usuarios
           (nombre,apellido,tipo_documento_id,documento,correo,password,
            telefono,role_id,estado_id,clan_id,cohorte_id,horario_id,observaciones)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.nombre, row.apellido, tipodoc?.id||null, row.documento, row.correo, hash,
         row.telefono||null, role?.id||2, estado?.id||1, clanId, cohorteId,
         horario?.id||null, row.observaciones||null]
      );
      results.created++;
    } catch (err) {
      results.errors.push({ fila: i+1, error: err.message });
    }
  }

  res.json({ ok: true, ...results });
};
