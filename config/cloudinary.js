const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Upload a file (buffer) to Cloudinary
 * @param {Buffer} buffer - File buffer from multer memory storage
 * @param {String} folder - Cloudinary folder (e.g. 'avatars', 'rooms', 'gifts')
 * @param {String} resourceType - 'image' | 'video' | 'raw'
 * @returns {Promise<{url, public_id}>}
 */
const uploadToCloudinary = async (buffer, folder = 'lovers', resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: resourceType,
          transformation: [
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }
          resolve({
            url: result.secure_url,
            public_id: result.public_id
          });
        }
      )
      .end(buffer);
  });
};

/**
 * Delete a file from Cloudinary by public_id
 * @param {String} publicId
 */
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary
};
