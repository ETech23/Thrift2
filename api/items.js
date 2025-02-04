import connectDB from '../lib/mongodb';
import auth from '../middleware/auth';
import { uploadToCloudinary } from '../lib/cloudinary';
import Item from '../models/Item';

const parseMultipartForm = async (req) => {
  const form = new FormData();
  
  // Parse the raw body using multiparty
  return new Promise((resolve, reject) => {
    const multiparty = require('multiparty');
    const form = new multiparty.Form();
    
    form.parse(req, (err, fields, files) => {
      if (err) reject(err);
      resolve({ fields, files });
    });
  });
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Connect to database
    await connectDB();

    // Authenticate request
    const authResult = await auth(req, res);
    if (authResult.error) {
      return res.status(authResult.status).json({ error: authResult.error });
    }

    // Parse multipart form data
    const { fields, files } = await parseMultipartForm(req);

    // Validate required fields
    const requiredFields = ['name', 'price', 'currency', 'description', 'location', 'category'];
    const missingFields = requiredFields.filter(field => !fields[field] || !fields[field][0]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate files
    if (!files.media || files.media.length === 0) {
      return res.status(400).json({ error: 'At least one image is required' });
    }

    if (files.media.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 images allowed' });
    }

    // Upload images to Cloudinary
    const imagePromises = files.media.map(file => {
      return uploadToCloudinary(file);
    });
    
    const imageUrls = await Promise.all(imagePromises);

    // Create item
    const item = new Item({
      name: fields.name[0],
      price: Number(fields.price[0]),
      currency: fields.currency[0],
      description: fields.description[0],
      location: fields.location[0],
      category: fields.category[0],
      images: imageUrls,
      user: authResult.user.id
    });

    await item.validate();
    await item.save();

    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      item
    });

  } catch (error) {
    console.error('Error creating item:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation Error',
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      error: 'Server error while creating item'
    });
  }
}

