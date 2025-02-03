const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { body, validationResult } = require('express-validator');

const authMiddleware = require('../middleware/authMiddleware');
const Item = require('../models/Item');
const itemController = require('../controllers/itemController');

const router = express.Router();

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
    }
}).any(); // Change `.array('media', 3)` to `.any()` to allow all fields

// Routes
router.post(
    '/',
    authMiddleware,
    upload,
    // Update these to match your frontend
    body('title').notEmpty().withMessage('Title is required'),
    body('price').notEmpty().isNumeric().withMessage('Price must be a number'),
    body('description').notEmpty().withMessage('Description is required'),
    body('location').notEmpty().withMessage('Location is required'),
    body('category').notEmpty().withMessage('Category is required'),
    async (req, res, next) => {
        // Log incoming request details for debugging
        console.log('Request body:', req.body);
        console.log('Request files:', req.files);

        // Validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Validation errors:', errors.array());
            return res.status(400).json({ 
                success: false,
                errors: errors.array(),
                message: errors.array().map(err => err.msg).join(', ')
            });
        }

        try {
            // Call the item controller to handle the upload
            await itemController.createItem(req, res, next);
        } catch (error) {
            console.error('Item creation error:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to create item',
                error: error.message 
            });
        }
    }
);

module.exports = router;
