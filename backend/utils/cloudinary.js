// ================================
// CLOUDINARY IMAGE UPLOAD UTILITY
// ================================
// Handles uploading images to Cloudinary cloud storage

const cloudinary = require('cloudinary').v2;
const multer = require('multer');

/**
 * Configure Cloudinary with credentials from .env
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * MULTER CONFIGURATION
 * Multer handles file uploads from frontend
 * We store files in memory (RAM) temporarily
 */
const storage = multer.memoryStorage();

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    cb(null, true); // Accept file
  } else {
    cb(new Error('Only image files are allowed!'), false); // Reject file
  }
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024  // Max 5MB file size
  },
  fileFilter: fileFilter
});

/**
 * UPLOAD IMAGE TO CLOUDINARY
 * Takes file buffer and uploads to cloud
 */
const uploadToCloudinary = (fileBuffer, folder = 'complaints') => {
  return new Promise((resolve, reject) => {
    // Create upload stream
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `clean-city/${folder}`,  // Organize in folders
        resource_type: 'image',
        transformation: [
          { width: 1000, crop: 'limit' },  // Max width 1000px
          { quality: 'auto' }               // Auto optimize quality
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    
    // Convert buffer to stream and pipe to Cloudinary
    const streamifier = require('streamifier');
    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

/**
 * DELETE IMAGE FROM CLOUDINARY
 * Removes image using its public_id
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    throw error;
  }
};

/**
 * UPLOAD MULTIPLE IMAGES
 * For cleanup proof or multiple photos
 */
const uploadMultiple = async (fileBuffers, folder = 'complaints') => {
  try {
    const uploadPromises = fileBuffers.map(buffer => 
      uploadToCloudinary(buffer, folder)
    );
    
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    console.error('Multiple upload error:', error);
    throw error;
  }
};

module.exports = {
  upload,
  uploadToCloudinary,
  deleteFromCloudinary,
  uploadMultiple,
  cloudinary
};

/**
 * BEGINNER EXPLANATION:
 * 
 * WHY CLOUDINARY?
 * - Free tier: 25GB storage, 25GB bandwidth/month
 * - Automatic image optimization
 * - CDN (fast image delivery worldwide)
 * - No need to store images on our server
 * 
 * HOW IMAGE UPLOAD WORKS:
 * 
 * 1. Frontend sends image file
 * 2. Multer receives it in memory (RAM)
 * 3. We convert to buffer (raw data)
 * 4. Upload buffer to Cloudinary
 * 5. Cloudinary returns URL
 * 6. We save URL in MongoDB
 * 
 * FILE FLOW:
 * User's Computer → Multer (RAM) → Cloudinary (Cloud) → URL in Database
 * 
 * MULTER:
 * - Middleware to handle multipart/form-data (file uploads)
 * - memoryStorage = stores file in RAM temporarily
 * - fileFilter = checks if file is valid image
 * 
 * BUFFER:
 * - Raw binary data of file
 * - Like: <Buffer 89 50 4e 47 0d 0a 1a 0a...>
 * 
 * TRANSFORMATION:
 * - width: 1000 → resize large images
 * - quality: auto → reduce file size automatically
 * 
 * USAGE EXAMPLE IN ROUTE:
 * router.post('/upload', upload.single('photo'), async (req, res) => {
 *   const result = await uploadToCloudinary(req.file.buffer);
 *   res.json({ url: result.secure_url });
 * });
 */