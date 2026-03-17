// routes/audit.routes.js
const router = require('express').Router();
const { AuditLog } = require('../models/AuditLog');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const mongoose = require('mongoose');

router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ error: 'MongoDB no disponible' });
  try {
    const logs = await AuditLog.find().sort({ timestamp: -1 }).limit(500).lean();
    res.json(logs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
