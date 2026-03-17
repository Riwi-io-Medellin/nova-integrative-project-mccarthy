const pool     = require('../config/mysql');
const { audit } = require('../models/AuditLog');
const { uploadToCloudinary } = require('../config/cloudinary');
const { mailNovedadCreada, mailEstadoCambiado } = require('../config/mailer');
const Groq     = require('groq-sdk');

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const SELECT = `
  SELECT n.id, n.date_of_absence, n.reason, n.excuse_url, n.excuse_text,
         n.status, n.observacion, n.created_at, n.updated_at, n.student_id,
         COALESCE(u.nombre,'Sin nombre')    AS nombre,
         COALESCE(u.apellido,'')            AS apellido,
         COALESCE(u.correo,'Sin correo')    AS correo,
         COALESCE(u.documento,'-')          AS documento,
         COALESCE(p.tipo_de_prioridad,'Media') AS tipo_de_prioridad
  FROM   novedades n
  LEFT JOIN usuarios    u ON n.student_id   = u.id
  LEFT JOIN prioridades p ON n.prioridad_id = p.id
`;

function fechaLocal(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

exports.getAll = async (req, res) => {
  try {
    const { status, search } = req.query;
    let sql = SELECT + ' WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND n.status=?'; params.push(status); }
    if (search) {
      sql += ' AND (u.nombre LIKE ? OR u.apellido LIKE ? OR u.correo LIKE ? OR u.documento LIKE ? OR n.reason LIKE ?)';
      const l = `%${search}%`;
      params.push(l,l,l,l,l);
    }
    sql += ' ORDER BY n.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ ok: true, data: rows });
  } catch (err) { res.status(500).json({ ok: false, message: 'Error interno del servidor' }); }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await pool.query(SELECT + ' WHERE n.id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, message: 'No encontrada' });
    res.json({ ok: true, data: rows[0] });
  } catch (err) { res.status(500).json({ ok: false, message: 'Error interno del servidor' }); }
};

exports.getMias = async (req, res) => {
  try {
    const [rows] = await pool.query(
      SELECT + ' WHERE n.student_id=? ORDER BY n.created_at DESC',
      [req.user.id]
    );
    res.json({ ok: true, data: rows });
  } catch (err) { res.status(500).json({ ok: false, message: 'Error interno del servidor' }); }
};

async function aiPrioridad(reason, excuse_text) {
  if (!groq) return 2;
  try {
    const chat = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `Eres un asistente de RRHH. Analiza esta solicitud de ausencia y asigna una prioridad de forma objetiva y equilibrada.

Tipo de solicitud: ${reason}
Descripcion: ${excuse_text || 'Sin descripcion adicional'}

Responde UNICAMENTE con un JSON en este formato exacto (sin texto adicional):
{"prioridad": "Alta" | "Media" | "Baja", "motivo": "explicacion breve de 1 linea"}

Criterios (aplicar con equidad, sin sesgo negativo ni positivo):
- Alta: emergencias medicas, fallecimiento familiar, situaciones de fuerza mayor o urgencia real
- Media: citas medicas programadas, tramites importantes, permisos con justificacion razonable
- Baja: solicitudes no urgentes, actividades opcionales, permisos personales sin urgencia
- Si hay descripcion o contexto que justifique la solicitud, consideralo a favor.
- Ante la duda entre dos niveles, asigna el intermedio (Media).`
      }],
      temperature: 0.3,
      max_tokens: 120,
    });
    const text  = chat.choices[0].message.content;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return 2;
    const { prioridad } = JSON.parse(match[0]);
    const map = { 'Alta': 1, 'Media': 2, 'Baja': 3 };
    return map[prioridad] || 2;
  } catch {
    return 2;
  }
}

exports.create = async (req, res) => {
  try {
    const { date_of_absence, reason, excuse_text } = req.body;
    const student_id = req.body.student_id || req.user?.id;

    if (reason && reason.length > 200) return res.status(400).json({ ok: false, message: "El tipo de solicitud es demasiado largo (max 200 caracteres)" });
    if (excuse_text && excuse_text.length > 2000) return res.status(400).json({ ok: false, message: "La descripcion no puede superar 2000 caracteres" });

    if (!student_id || !date_of_absence || !reason)
      return res.status(400).json({ ok: false, message: 'Faltan campos obligatorios (fecha, motivo)' });

    let excuse_url = null;
    if (req.file) {
      const { url } = await uploadToCloudinary(req.file.buffer, 'nova/novedades');
      excuse_url = url;
    }

    const prioridad_id = await aiPrioridad(reason, excuse_text);

    const [result] = await pool.query(
      `INSERT INTO novedades (student_id,date_of_absence,reason,excuse_url,excuse_text,status,prioridad_id,created_at,updated_at)
       VALUES (?,?,?,?,?,'pending',?,NOW(),NOW())`,
      [student_id, date_of_absence, reason, excuse_url, excuse_text||null, prioridad_id]
    );

    const [[prioRow]] = await pool.query('SELECT tipo_de_prioridad FROM prioridades WHERE id=?', [prioridad_id]);

    const [[usuario]] = await pool.query('SELECT nombre, correo FROM usuarios WHERE id=?', [student_id]);
    if (usuario) {
      await mailNovedadCreada(usuario.correo, `${usuario.nombre}`, { reason, date_of_absence });
    }

    await audit('CREATE_NOVEDAD', 'novedad', result.insertId, req.user || { id: student_id }, { reason }, req.ip);
    res.status(201).json({
      ok: true,
      message: 'Novedad registrada exitosamente',
      id: result.insertId,
      prioridad_asignada: prioRow?.tipo_de_prioridad || 'Media',
      ia_activa: !!groq,
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status, observacion } = req.body;
    if (observacion && observacion.length > 1000) return res.status(400).json({ ok: false, message: "La observacion no puede superar 1000 caracteres" });
    const allowed = ['pending','accepted','rejected'];
    if (!allowed.includes(status))
      return res.status(400).json({ ok: false, message: `Estado invalido. Permitidos: ${allowed.join(', ')}` });

    const [result] = await pool.query(
      'UPDATE novedades SET status=?, observacion=?, updated_at=NOW() WHERE id=?',
      [status, observacion||null, req.params.id]
    );
    if (!result.affectedRows)
      return res.status(404).json({ ok: false, message: 'Novedad no encontrada' });

    const [[nov]] = await pool.query(
      `SELECT n.*, u.nombre, u.correo FROM novedades n
       JOIN usuarios u ON n.student_id=u.id WHERE n.id=?`, [req.params.id]
    );
    if (nov) {
      await mailEstadoCambiado(nov.correo, nov.nombre, { ...nov, status, observacion });
    }

    await audit('UPDATE_NOVEDAD_STATUS', 'novedad', req.params.id, req.user, { status, observacion }, req.ip);
    res.json({ ok: true, message: `Estado actualizado a "${status}"` });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM novedades WHERE id=?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ ok: false, message: 'No encontrada' });
    await audit('DELETE_NOVEDAD', 'novedad', req.params.id, req.user, null, req.ip);
    res.json({ ok: true, message: 'Novedad eliminada' });
  } catch (err) { res.status(500).json({ ok: false, message: 'Error interno del servidor' }); }
};

exports.getStats = async (req, res) => {
  try {
    const [[{ total }]]    = await pool.query('SELECT COUNT(*) AS total FROM novedades');
    const [[{ pending }]]  = await pool.query("SELECT COUNT(*) AS pending FROM novedades WHERE status='pending'");
    const [[{ accepted }]] = await pool.query("SELECT COUNT(*) AS accepted FROM novedades WHERE status='accepted'");
    const [[{ rejected }]] = await pool.query("SELECT COUNT(*) AS rejected FROM novedades WHERE status='rejected'");
    res.json({ ok: true, data: { total, pending, accepted, rejected } });
  } catch (err) { res.status(500).json({ ok: false, message: 'Error interno del servidor' }); }
};

exports.aiAnalysis = async (req, res) => {
  if (!groq) return res.status(503).json({ ok: false, message: 'IA no disponible (GROQ_API_KEY no configurada)' });
  try {
    const { id } = req.params;
    const [rows] = await pool.query(SELECT + ' WHERE n.id=?', [id]);
    if (!rows.length) return res.status(404).json({ ok: false, message: 'Novedad no encontrada' });
    const n = rows[0];

    const hoy            = new Date();
    const ausenciaStr    = n.date_of_absence instanceof Date
      ? n.date_of_absence.toISOString().split('T')[0]
      : String(n.date_of_absence).split('T')[0];
    const fechaAusencia  = new Date(ausenciaStr + 'T12:00:00');
    const fechaSolicitud = new Date(n.created_at);

    const diasAnticipacion  = Math.round((fechaAusencia - fechaSolicitud) / (1000 * 60 * 60 * 24));
    const diasDesdeHoy      = Math.round((fechaAusencia - hoy)            / (1000 * 60 * 60 * 24));
    const esFuturo          = diasDesdeHoy >= 0;
    const esPasada          = !esFuturo;

    const [[{ total_solicitudes }]] = await pool.query(
      'SELECT COUNT(*) AS total_solicitudes FROM novedades WHERE student_id=?', [n.student_id]
    );
    const [[{ rechazadas }]] = await pool.query(
      "SELECT COUNT(*) AS rechazadas FROM novedades WHERE student_id=? AND status='rejected'", [n.student_id]
    );
    const [[{ aceptadas }]] = await pool.query(
      "SELECT COUNT(*) AS aceptadas FROM novedades WHERE student_id=? AND status='accepted'", [n.student_id]
    );

    const prompt = `Eres un analista de RRHH. Debes evaluar esta solicitud de ausencia de forma objetiva, sin sesgo negativo ni positivo. Tu analisis debe basarse en los datos reales, no en suposiciones.

DATOS DE LA SOLICITUD
Tipo: ${n.reason}
Descripcion del usuario: ${n.excuse_text || 'Sin descripcion adicional'}
Prioridad asignada: ${n.tipo_de_prioridad}
Adjunto con documentacion: ${n.excuse_url ? 'SI' : 'NO'}

CONTEXTO TEMPORAL
Fecha de la ausencia: ${ausenciaStr}
Fecha de registro de la solicitud: ${fechaLocal(fechaSolicitud)}
Fecha actual: ${fechaLocal(hoy)}
Anticipacion: ${diasAnticipacion >= 0 ? diasAnticipacion + ' dias antes de la ausencia' : 'Solicitud retroactiva (' + Math.abs(diasAnticipacion) + ' dias despues de ocurrida)'}
Estado de la ausencia: ${esFuturo ? 'Futura (en ' + diasDesdeHoy + ' dias)' : 'Pasada (ocurrio hace ' + Math.abs(diasDesdeHoy) + ' dias)'}

HISTORIAL DEL ESTUDIANTE
Total solicitudes previas: ${Number(total_solicitudes) - 1}
Aceptadas: ${aceptadas}
Rechazadas: ${rechazadas}

INSTRUCCIONES
Analiza con criterio equilibrado:

1. DOCUMENTACION Y DESCRIPCION: Si el usuario adjunto un documento o dio una descripcion coherente, es un factor positivo. No penalices la ausencia de adjunto en situaciones donde no siempre es posible tenerlo (emergencias, imprevistos).
2. TIPO DE SOLICITUD: Evalua si el motivo es razonable para el contexto de un bootcamp. La mayoria de solicitudes tienen justificacion valida.
3. TEMPORALIDAD: La retroactividad no es automaticamente negativa. Las emergencias y situaciones imprevistas justifican solicitudes tardias. Considera anticipacion insuficiente solo si la solicitud claramente pudo hacerse antes.
4. HISTORIAL: Un historial con pocas solicitudes es neutro o positivo. No interpretes negativamente el numero de solicitudes si no hay un patron claro de abuso.
5. COHERENCIA: Verifica que el tipo de solicitud, la descripcion y la urgencia sean consistentes. Las inconsistencias reales son la razon principal para alertar.

Tu recomendacion debe ser APROBAR si los datos son coherentes y razonables, RECHAZAR solo si hay inconsistencias claras o ausencia total de justificacion, y REVISAR si genuinamente se necesita mas informacion.

Responde UNICAMENTE con este JSON exacto (sin texto adicional, sin markdown):
{
  "recomendacion": "APROBAR" | "RECHAZAR" | "REVISAR",
  "confianza": numero entero del 1 al 10,
  "motivo": "explicacion objetiva de 2-3 oraciones basada en los datos reales",
  "alertas": ["solo si hay inconsistencias reales, dejar vacio si no hay"],
  "observacion_sugerida": "texto profesional y neutral para el campo de observacion"
}`;

    const chat = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 600,
    });

    let analysis = {};
    try {
      const text  = chat.choices[0].message.content;
      const match = text.match(/\{[\s\S]*\}/);
      analysis = match ? JSON.parse(match[0]) : {
        recomendacion: 'REVISAR', confianza: 5,
        motivo: text, alertas: [], observacion_sugerida: ''
      };
    } catch {
      analysis = {
        recomendacion: 'REVISAR', confianza: 5,
        motivo: 'No se pudo procesar el analisis. Revisa manualmente.',
        alertas: [], observacion_sugerida: ''
      };
    }

    res.json({
      ok: true,
      data: {
        novedad: n,
        analysis,
        contexto: {
          dias_anticipacion: diasAnticipacion,
          dias_desde_hoy:    diasDesdeHoy,
          es_retroactiva:    esPasada && diasAnticipacion < 0,
          historial: {
            total:     Number(total_solicitudes) - 1,
            aceptadas: Number(aceptadas),
            rechazadas: Number(rechazadas)
          }
        }
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};
