const multer = require('multer');
const path = require('path');

// File filter for allowed image types
const imageFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('❌ Only image files are allowed (jpeg, jpg, png, gif, webp)'));
};

// General image upload (memory storage, files streamed to Cloudinary)
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: imageFileFilter
});

// Avatar upload — single file under field name "avatar"
const uploadAvatar = uploadImage.single('avatar');

// Cover image upload — single file under field name "cover"
const uploadCover = uploadImage.single('cover');

// Multi-image upload (e.g. post media) — up to 4 images under field "images"
const uploadImages = uploadImage.array('images', 4);

// Multer error handler wrapper
const handleUploadErrors = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // Multer-specific errors
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: '❌ File too large (max 5MB)' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ message: '❌ Too many files (max 4)' });
        }
        return res.status(400).json({ message: `❌ Upload error: ${err.message}` });
      }
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  };
};

module.exports = {
  uploadImage,
  uploadAvatar,
  uploadCover,
  uploadImages,
  handleUploadErrors
};
