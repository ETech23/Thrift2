const cloudinary = require('cloudinary').v2;
const Item = require('../models/Item');

const createItem = async (req, res) => {
    try {
        console.log("Request Body:", req.body);  // Debugging
        console.log("Uploaded Files:", req.files); // Debugging

        const { title, price, currency, description, location, category } = req.body;
        const files = req.files;

        if (!files || files.length === 0) {
            return res.status(400).json({ message: "No images uploaded" });
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

        // Save item to MongoDB
        const newItem = new Item({
            title,
            price,
            currency,
            description,
            location,
            category,
            images: uploadedImages,
            user: req.user.id, // Extracted from JWT payload
        });

        await newItem.save();

        res.status(201).json({
            message: 'Item uploaded successfully!',
            item: newItem,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
module.exports = {
  createItem,
};
