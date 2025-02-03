const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'NGN',  // Default to Nigerian Naira
    },
    description: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    images: {
      type: [String],  // Store Cloudinary image URLs
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',  // Reference to User model
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Item', itemSchema);
