import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs/promises';
import pkg from 'cloudinary';
const { v2: cloudinary } = pkg;
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import { promisify } from 'util';

// Initialize environment variables
dotenv.config();

// Promisify jwt.verify
const verifyToken = promisify(jwt.verify);

// Get current file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate environment variables
const requiredEnvVars = [
  'MONGO_URI',
  'JWT_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'MAX_FILE_SIZE',
  'MAX_FILES',
  'CLOUDINARY_UPLOAD_TIMEOUT',
  'FUNCTION_TIMEOUT',
  'FRONTEND_URL'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

// Initialize Express app with security middleware
const app = express();

// Security middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing middleware with size limits
app.use(express.json({ limit: process.env.MAX_FILE_SIZE }));
app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_FILE_SIZE 
}));

// MongoDB connection with retry logic
class DatabaseConnection {
  static async connect() {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: parseInt(process.env.FUNCTION_TIMEOUT)
      });
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  static async disconnect() {
    try {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    } catch (error) {
      console.error('MongoDB disconnection error:', error);
      throw error;
    }
  }
}

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: parseInt(process.env.CLOUDINARY_UPLOAD_TIMEOUT)
});

// Post Schema using the latest Mongoose features
const postSchema = new mongoose.Schema({
  content: {
    type: String,
    trim: true
  },
  media: [{
    url: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true
    },
    publicId: {
      type: String,
      required: true,
      trim: true
    }
  }],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Create indexes
postSchema.index({ createdAt: -1 });
postSchema.index({ user: 1, createdAt: -1 });

const Post = mongoose.model('Post', postSchema);

// Modern authentication middleware using async/await
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// File upload configuration
class FileUploadConfig {
  static async initialize() {
    const uploadDir = path.join(__dirname, 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
    return uploadDir;
  }

  static createMulterConfig(uploadDir) {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
        cb(null, uniqueSuffix + path.extname(file.originalname));
      }
    });

    const fileFilter = (req, file, cb) => {
      const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'video/mp4']);
      if (allowedTypes.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and MP4 are allowed.'));
      }
    };

    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE),
        files: parseInt(process.env.MAX_FILES)
      }
    });
  }
}

// Resource cleanup utilities
class ResourceCleaner {
  static async cleanupFiles(files) {
    if (!files) return;
    
    await Promise.all(files.map(file => 
      fs.unlink(file.path).catch(err => 
        console.error(`Error deleting file ${file.path}:`, err)
      )
    ));
  }

  static async cleanupCloudinaryResources(mediaUrls) {
    if (!mediaUrls?.length) return;
    
    await Promise.all(mediaUrls.map(media => 
      cloudinary.uploader.destroy(media.publicId).catch(err => 
        console.error(`Error deleting Cloudinary resource ${media.publicId}:`, err)
      )
    ));
  }
}

// Initialize file upload
const uploadDir = await FileUploadConfig.initialize();
const upload = FileUploadConfig.createMulterConfig(uploadDir);

// Post creation endpoint
app.post('/api/posts', 
  authenticate, 
  upload.array('media', parseInt(process.env.MAX_FILES)), 
  async (req, res) => {
    const mediaUrls = [];

    try {
      const { content } = req.body;
      const mediaFiles = req.files;
      const userId = req.userId;

      if (!content && (!mediaFiles?.length)) {
        return res.status(400).json({
          success: false,
          message: 'Post must contain either content or media files'
        });
      }

      if (mediaFiles?.length) {
        await Promise.all(mediaFiles.map(async (file) => {
          try {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: 'marketplace_posts',
              resource_type: 'auto',
              timeout: parseInt(process.env.CLOUDINARY_UPLOAD_TIMEOUT)
            });

            mediaUrls.push({
              url: result.secure_url,
              type: result.resource_type,
              publicId: result.public_id
            });
          } catch (error) {
            throw new Error(`Failed to upload ${file.originalname}: ${error.message}`);
          }
        }));
      }

      const newPost = await Post.create({
        content,
        media: mediaUrls,
        user: userId
      });

      await ResourceCleaner.cleanupFiles(mediaFiles);

      return res.status(201).json({
        success: true,
        message: 'Post created successfully',
        post: newPost
      });
    } catch (error) {
      await ResourceCleaner.cleanupCloudinaryResources(mediaUrls);
      await ResourceCleaner.cleanupFiles(req.files);

      return res.status(500).json({
        success: false,
        message: 'Failed to create post',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const errorMessages = {
      LIMIT_FILE_SIZE: `File is too large. Maximum size is ${process.env.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      LIMIT_FILE_COUNT: `Too many files. Maximum is ${process.env.MAX_FILES} files`,
    };

    return res.status(400).json({
      success: false,
      message: errorMessages[error.code] || 'File upload error',
      error: error.message
    });
  }
  next(error);
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Starting graceful shutdown...`);
  
  try {
    await DatabaseConnection.disconnect();
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Start server and database
const startServer = async () => {
  try {
    await DatabaseConnection.connect();
    
    const server = app.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`);
    });

    // Handle shutdown signals
    ['SIGTERM', 'SIGINT'].forEach(signal => {
      process.on(signal, () => gracefulShutdown(signal));
    });

    // Handle uncaught errors
    process.on('unhandledRejection', (error) => {
      console.error('Unhandled Promise Rejection:', error);
      if (process.env.NODE_ENV === 'production') {
        gracefulShutdown('Unhandled Promise Rejection');
      }
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      if (process.env.NODE_ENV === 'production') {
        gracefulShutdown('Uncaught Exception');
      }
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
