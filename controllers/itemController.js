const cloudinary = require('cloudinary').v2;
const Item = require('../models/Item');
const { validateImageFile } = require('../utils/fileValidation');

const createItem = async (req, res) => {
    try {
        // Log incoming request data
        console.log('Creating new item with data:', {
            body: req.body,
            files: req.files?.length || 0,
            userId: req.user?.id
        });

        // Validate required fields
        const requiredFields = ['name', 'price', 'description', 'location', 'category'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`,
                missingFields
            });
        }

        // Validate price
        const price = Number(req.body.price);
        if (isNaN(price) || price <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Price must be a valid positive number'
            });
        }

        // Validate files
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one image is required'
            });
        }

        // Upload images to Cloudinary
        const uploadPromises = req.files.map(file => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { 
                        folder: 'ecommerce/items',
                        format: 'webp',
                        transformation: [
                            { width: 1000, height: 1000, crop: 'limit' },
                            { quality: 'auto:good' }
                        ]
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result.secure_url);
                    }
                );
                stream.end(file.buffer);
            });
        });

        const uploadedImages = await Promise.all(uploadPromises);

        // Create new item
        const newItem = new Item({
            name: req.body.name,
            price,
            currency: req.body.currency || 'NGN',
            description: req.body.description,
            location: req.body.location,
            category: req.body.category,
            images: uploadedImages,
            user: req.user.id
        });

        // Validate the item before saving
        await newItem.validate();

        // Save the item
        await newItem.save();

        // Send success response
        res.status(201).json({
            success: true,
            message: 'Item created successfully',
            item: newItem
        });

    } catch (error) {
        console.error('Error creating item:', error);

        // Handle different types of errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                error: 'Validation Error',
                details: Object.values(error.errors).map(err => err.message)
            });
        }

        if (error.name === 'MongoError' && error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'Duplicate entry error'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Server error while creating item'
        });
    }
};

module.exports = {
    createItem
};
