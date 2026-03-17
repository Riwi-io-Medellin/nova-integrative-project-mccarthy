// middleware/auth.js
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'nova_secret';

/**
 * Middleware que verifica el JWT y adjunta req.user
 */
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

/**
 * Verifica que el usuario tenga rol admin/profesional
 */
const requireAdmin = (req, res, next) => {
  const role = (req.user?.role || '').toLowerCase();
  if (!['administrador', 'admin'].includes(role))
    return res.status(403).json({ error: 'Acceso denegado' });
  next();
};

const generateToken = (payload) =>
  jwt.sign(payload, SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });

module.exports = { authMiddleware, requireAdmin, generateToken };
