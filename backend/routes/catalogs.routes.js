// routes/catalogs.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/catalogs.controller');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

router.get('/', authMiddleware, ctrl.getAll);

// Clanes
router.get   ('/clanes',        authMiddleware, requireAdmin, ctrl.getClanes);
router.post  ('/clanes',        authMiddleware, requireAdmin, ctrl.createClan);
router.put   ('/clanes/:id',    authMiddleware, requireAdmin, ctrl.updateClan);
router.delete('/clanes/:id',    authMiddleware, requireAdmin, ctrl.deleteClan);

// Cohortes
router.get   ('/cohortes',      authMiddleware, requireAdmin, ctrl.getCohortes);
router.post  ('/cohortes',      authMiddleware, requireAdmin, ctrl.createCohorte);
router.put   ('/cohortes/:id',  authMiddleware, requireAdmin, ctrl.updateCohorte);
router.delete('/cohortes/:id',  authMiddleware, requireAdmin, ctrl.deleteCohorte);

module.exports = router;
