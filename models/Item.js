const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
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
      default: 'NGN',
      required: [true, 'Currency is required']
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
      trim: true
    },
    images: {
      type: [String],
      required: [true, 'At least one image is required'],
      validate: {
        validator: function(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'At least one image is required'
      }
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Middleware to handle validation and cleanup
itemSchema.pre('save', function(next) {
  // Convert price to number if it's a string
  if (typeof this.price === 'string') {
    this.price = Number(this.price);
  }
  
  // Ensure images array contains no empty strings
  if (this.images) {
    this.images = this.images.filter(img => img && img.trim().length > 0);
  }
  
  next();
});

const Item = mongoose.model('Item', itemSchema);
module.exports = Item;
