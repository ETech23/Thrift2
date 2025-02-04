const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    enum: ['NGN', 'USD', 'GBP', 'KES', 'GHS', 'ZAR', 'XAF', 'XOF', 'ETB', 'EGP']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Electronics', 'Fashion', 'Home & Garden', 'Vehicles',
      'Real Estate', 'Health & Beauty', 'Sports & Fitness',
      'Books & Stationery', 'Food & Groceries', 'Others'
    ]
  },
  images: {
    type: [String],
    required: [true, 'At least one image is required'],
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0 && v.length <= 3,
      message: 'Between 1 and 3 images are required'
    }
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Item || mongoose.model('Item', itemSchema);

