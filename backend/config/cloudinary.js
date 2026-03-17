// config/cloudinary.js — compatible con cloudinary v1.x
const cloudinary = require('cloudinary').v2;
const multer     = require('multer');
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer en memoria (no escribe en disco)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de archivo no permitido. Usa: JPG, PNG, WebP, GIF o PDF'));
  },
});

/**
 * Sube un Buffer a Cloudinary usando la API v1
 * @param {Buffer} buffer
 * @param {string} folder
 * @returns {Promise<{url: string, publicId: string}>}
 */
const uploadToCloudinary = (buffer, folder = 'nova/novedades') => {
  return new Promise((resolve, reject) => {
    // Si Cloudinary no está configurado, devuelve null sin fallar
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return resolve({ url: null, publicId: null });
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        allowed_formats: ['jpg','jpeg','png','webp','gif','pdf'],
      },
      (error, result) => {
        if (error) return reject(new Error('Cloudinary: ' + error.message));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

module.exports = { upload, uploadToCloudinary, cloudinary };
