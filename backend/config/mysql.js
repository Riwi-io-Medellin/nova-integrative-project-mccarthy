// config/mysql.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'nova',
  port:               process.env.DB_PORT     || 3306,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '-05:00',
  // ── Mantiene las conexiones vivas con pings TCP ──────
  enableKeepAlive:       true,
  keepAliveInitialDelay: 10000, // primer ping a los 10 segundos
});

module.exports = pool;
