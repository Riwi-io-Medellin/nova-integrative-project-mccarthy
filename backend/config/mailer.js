// config/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || 'NOVA <novainterprise@gmail.com>';

const sendMail = async (to, subject, html) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('SMTP no configurado. Correo no enviado a:', to);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('Error al enviar correo a', to);
    console.error('Asunto:', subject);
    console.error('Error:', err.message);
    console.error('Codigo:', err.code || 'sin codigo');
    throw err;
  }
};

// ── Templates ─────────────────────────────────────────────
const tplBase = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', sans-serif; background:#f4f4f8; margin:0; padding:0; }
    .wrap { max-width:580px; margin:30px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,.08); }
    .header { background:linear-gradient(135deg,#6d28d9,#8b5cf6); padding:28px 32px; text-align:center; }
    .header h1 { color:#fff; margin:0; font-size:1.4rem; }
    .body { padding:32px; color:#374151; }
    .body h2 { color:#6d28d9; margin-top:0; }
    .pill { display:inline-block; padding:4px 14px; border-radius:999px; font-size:.85rem; font-weight:600; }
    .pill-pending  { background:#fef3c7; color:#92400e; }
    .pill-accepted { background:#d1fae5; color:#065f46; }
    .pill-rejected { background:#fee2e2; color:#991b1b; }
    .btn { display:inline-block; margin-top:20px; padding:12px 28px; background:#6d28d9; color:#fff; text-decoration:none; border-radius:8px; font-weight:600; }
    .footer { background:#f9fafb; padding:18px 32px; text-align:center; font-size:.8rem; color:#9ca3af; border-top:1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>NOVA — Sistema de Novedades</h1>
    </div>
    <div class="body">${content}</div>
    <div class="footer">Este es un mensaje automatico. Por favor no responda directamente a este correo.</div>
  </div>
</body>
</html>`;

const statusLabel = { pending: 'Pendiente', accepted: 'Aprobada', rejected: 'Rechazada' };
const statusClass = { pending: 'pill-pending', accepted: 'pill-accepted', rejected: 'pill-rejected' };

const mailNovedadCreada = async (to, nombre, novedad) => {
  const html = tplBase(`
    <h2>Hola, ${nombre}</h2>
    <p>Tu novedad ha sido registrada exitosamente en el sistema NOVA.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;color:#6b7280;width:140px">Tipo:</td><td><strong>${novedad.reason}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Fecha de ausencia:</td><td><strong>${novedad.date_of_absence}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Estado:</td><td><span class="pill pill-pending">Pendiente</span></td></tr>
    </table>
    <p>Te notificaremos cuando un profesional revise tu solicitud.</p>
  `);
  await sendMail(to, 'Novedad registrada — NOVA', html);
};

const mailEstadoCambiado = async (to, nombre, novedad) => {
  const s = novedad.status;
  const html = tplBase(`
    <h2>Hola, ${nombre}</h2>
    <p>El estado de tu novedad ha sido actualizado:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;color:#6b7280;width:140px">Tipo:</td><td><strong>${novedad.reason}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Fecha de ausencia:</td><td><strong>${novedad.date_of_absence}</strong></td></tr>
      <tr><td style="padding:8px 0;color:#6b7280">Nuevo estado:</td><td><span class="pill ${statusClass[s] || 'pill-pending'}">${statusLabel[s] || s}</span></td></tr>
      ${novedad.observacion ? `<tr><td style="padding:8px 0;color:#6b7280">Observacion:</td><td>${novedad.observacion}</td></tr>` : ''}
    </table>
    ${s === 'accepted' ? '<p style="color:#065f46">Tu solicitud fue aprobada. Puedes continuar con normalidad.</p>' : ''}
    ${s === 'rejected' ? '<p style="color:#991b1b">Tu solicitud fue rechazada. Si tienes dudas, comunicate con el area administrativa.</p>' : ''}
  `);
  await sendMail(to, `Estado de novedad: ${statusLabel[s] || s} — NOVA`, html);
};

module.exports = { sendMail, mailNovedadCreada, mailEstadoCambiado };
