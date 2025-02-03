const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/authMiddleware');
const Item = require('../models/Item');
const itemController = require('../controllers/itemController');

const router = express.Router();

// Setup Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer setup for file validation and storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },  // Max file size 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only JPEG, PNG, GIF are allowed.'));
    }
    cb(null, true);
  },
}).array('media', 3);  // Limit to 3 files

// Routes
router.post(
  '/',
  authMiddleware,
  upload,
  body('title').notEmpty().withMessage('Title is required'),
  body('price').notEmpty().isNumeric().withMessage('Price must be a number'),
  body('description').notEmpty().withMessage('Description is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('category').notEmpty().withMessage('Category is required'),
  async (req, res, next) => {
    // Validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Call the item controller to handle the upload
    await itemController.createItem(req, res, next);
  }
);

// Get all items (with pagination)
router.get('/', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch items' });
  }
});

module.exports = router;
