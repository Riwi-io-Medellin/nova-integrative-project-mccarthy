// models/AuditLog.js
const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema({
  action:      { type: String, required: true },   // CREATE_USER, UPDATE_NOVEDAD, etc.
  entity:      { type: String, required: true },   // 'usuario' | 'novedad'
  entityId:    { type: String },
  performedBy: {
    id:     String,
    nombre: String,
    correo: String,
    role:   String,
  },
  changes:     { type: mongoose.Schema.Types.Mixed },
  ip:          { type: String },
  timestamp:   { type: Date, default: Date.now },
}, { versionKey: false });

auditSchema.index({ timestamp: -1 });
auditSchema.index({ entity: 1, entityId: 1 });

const AuditLog = mongoose.model('AuditLog', auditSchema);

/**
 * Registra una acción en MongoDB (silencioso si Mongo no está disponible)
 */
const audit = async (action, entity, entityId, performedBy, changes, ip) => {
  try {
    if (mongoose.connection.readyState !== 1) return;
    await AuditLog.create({ action, entity, entityId: String(entityId), performedBy, changes, ip });
  } catch (e) {
    console.warn('audit log error:', e.message);
  }
};

module.exports = { AuditLog, audit };
