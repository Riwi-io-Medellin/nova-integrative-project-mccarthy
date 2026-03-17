// routes/novedades.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/novedades.controller');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

router.use(authMiddleware);

router.get('/stats',         requireAdmin, ctrl.getStats);
router.get('/mias',          ctrl.getMias);
router.get('/',              requireAdmin, ctrl.getAll);
router.get('/:id',           requireAdmin, ctrl.getOne);
router.post('/',             upload.single('excuse'), ctrl.create);
router.patch('/:id/status',  requireAdmin, ctrl.updateStatus);
router.get('/:id/ai',        requireAdmin, ctrl.aiAnalysis);
router.delete('/:id',        requireAdmin, ctrl.remove);

module.exports = router;
