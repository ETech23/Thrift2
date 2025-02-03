const cloudinary = require('cloudinary').v2;
const Item = require('../models/Item');

const createItem = async (req, res) => {
    try {
        // Enhanced logging
        console.log("Full Request Body:", JSON.stringify(req.body, null, 2));
        console.log("Uploaded Files:", req.files);

        // Destructure with both name and title to handle potential variations
        const { 
            name = req.body.title, 
            price, 
            currency, 
            description, 
            location, 
            category 
        } = req.body;

        const files = req.files;

        // Validate required fields
        const requiredFields = [
            { field: 'name', value: name },
            { field: 'price', value: price },
            { field: 'description', value: description },
            { field: 'location', value: location },
            { field: 'category', value: category }
        ];

        const missingFields = requiredFields
            .filter(({ value }) => !value)
            .map(({ field }) => field);

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Missing required fields: ${missingFields.join(', ')}`,
                missingFields
            });
        }

        if (!files || files.length === 0) {
            return res.status(400).json({ 
                success: false,
                message: "No images uploaded" 
            });
        }

        // Cloudinary Upload Function
        const uploadToCloudinary = (file) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'ecommerce/items' },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result.secure_url);
                    }
                );
                stream.end(file.buffer);
            });
        };

        // Upload all images to Cloudinary
        const uploadedImages = await Promise.all(files.map(uploadToCloudinary));

        // Ensure price is a number
        const numericPrice = Number(price);
        if (isNaN(numericPrice)) {
            return res.status(400).json({
                success: false,
                error: 'Price must be a valid number'
            });
        }

        // Save item to MongoDB
        const newItem = new Item({
            name,  // Changed from title to name
            price: numericPrice,
            currency,
            description,
            location,
            category,
            images: uploadedImages,
            user: req.user.id, // Extracted from JWT payload
        });

        await newItem.save();

        res.status(201).json({
            success: true,
            message: 'Item uploaded successfully!',
            item: newItem,
        });

    } catch (error) {
        console.error('Item creation error:', error);
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
};

module.exports = {
    createItem,
};
