// routes/auth.routes.js
const router = require('express').Router();
const ctrl   = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth');

router.post('/login',           ctrl.login);
router.post('/register',        ctrl.register);
router.get('/me',               authMiddleware, ctrl.me);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password',  ctrl.resetPassword);

module.exports = router;
