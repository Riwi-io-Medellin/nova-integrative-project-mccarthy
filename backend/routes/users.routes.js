// routes/users.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/users.controller');
const { authMiddleware, requireAdmin } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

const multer  = require('multer');
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5*1024*1024 } });

router.use(authMiddleware);

router.get('/stats',       requireAdmin, ctrl.getStats);
router.get('/',            requireAdmin, ctrl.getAll);
router.get('/:id',         requireAdmin, ctrl.getOne);
router.post('/',           requireAdmin, upload.single('avatar'), ctrl.create);
router.put('/:id',         requireAdmin, upload.single('avatar'), ctrl.update);
router.delete('/:id',      requireAdmin, ctrl.remove);
router.post('/bulk-import',requireAdmin, csvUpload.single('csv'), ctrl.bulkImport);

module.exports = router;
