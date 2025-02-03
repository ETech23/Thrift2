const cloudinary = require('cloudinary').v2;
const Item = require('../models/Item');

const createItem = async (req, res) => {
  try {
    const { title, price, currency, description, location, category } = req.body;
    const files = req.files;

    // Upload images to Cloudinary
    const uploadedImages = await Promise.all(files.map((file) => {
      return cloudinary.uploader.upload_stream({ folder: 'ecommerce/items' }, (error, result) => {
        if (error) {
          throw new Error('Error uploading to Cloudinary');
        }
        return result.secure_url;
      }).end(file.buffer);
    }));

    // Save item to MongoDB
    const newItem = new Item({
      title,
      price,
      currency,
      description,
      location,
      category,
      images: uploadedImages,
      user: req.user.id, // User from JWT payload
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
