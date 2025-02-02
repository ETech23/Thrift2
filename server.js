require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const http = require("http");
const { Server } = require("socket.io");
const router = express.Router();


// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server for Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "https://thrift-a.vercel.app" }
});

// Allow Frontend URL to Access Backend
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5000";

app.use(cors({
	origin: "https://thrift-a.vercel.app", // Allow only this frontend
    credentials: true,    // Allow cookies (if needed)
}));


// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI,).then(() => console.log("✅ MongoDB Connected")).catch(err => console.log("❌ MongoDB Error:", err));

// Configure Cloudinary
/**cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});**/

// Cloudinary Image Upload Setup 
/**
const storage = new CloudinaryStorage({
    cloudinary,
    params: { folder: "marketplace_items", allowed_formats: ["jpg", "png", "jpeg"] },
});

// Test route
app.get("/api/test", (req, res) => {
    res.json({ message: "API is working!" });
});
**/

// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

const User = mongoose.model("User", UserSchema);


app.get("/api/posts", async (req, res) => {
    try {
        const posts = await Post.find().populate("user", "username email"); // Fetch posts
        res.status(200).json({ success: true, posts });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ success: false, message: "Failed to fetch posts." });
    }
});

// Item Schema
const ItemSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    price: { 
        type: Number, 
        required: true 
    },
    currency: {
        type: String,
        required: true,
        default: 'NGN',
        enum: ['NGN', 'USD', 'EUR', 'GBP', 'KES', 'ZAR', 'AED', 'GHS', 'XAF', 'XOF']
    },
    formattedPrice: {
        type: String,
        required: true
    },
    category: { 
        type: String, 
        required: true 
    },
    location: { 
        type: String, 
        required: true 
    },
    imageUrl: { 
        type: String, 
        required: true 
    },
    anonymous: { 
        type: Boolean, 
        default: false 
    },
    seller: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    postedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    }
}, {
    timestamps: true
});

// Optional: Add a pre-save middleware to ensure formattedPrice is always set
ItemSchema.pre('save', function(next) {
    if (this.isModified('price') || this.isModified('currency') || !this.formattedPrice) {
        const symbol = currencySymbol[this.currency] || '₦';
        this.formattedPrice = `${symbol}${this.price.toLocaleString()}`;
    }
    next();
});

const Item = mongoose.model("Item", ItemSchema);

// Chat Message Schema
const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", MessageSchema);


// Middleware to Verify Token
const authenticate = (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch {
        res.status(401).json({ success: false, message: "Invalid token" });
    }
};

// Define the Post Schema
const postSchema = new mongoose.Schema({
  content: {
    type: String,
    required: false, // Not required if media is present
  },
  media: [
    {
      url: {
        type: String,
        required: true,
      },
      type: {
        type: String,
        enum: ["image", "video"],
        required: true,
      },
      publicId: {
        type: String,
        required: true,
      },
    },
  ],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const path = require('path');
const fs = require('fs');

// Make sure uploads directory exists
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
/** const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
**/
// File filter
/**const fileFilter = function(req, file, cb) {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'video/mp4'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF and MP4 are allowed.'), false);
  }
};
**/

// Multer configuration
const storage = multer.diskStorage({
    destination: async function(req, file, cb) {
        const uploadDir = './uploads';
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});



const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'video/mp4'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, GIF and MP4 are allowed.`));
    }
};
// Initialize Multer
const uploadMiddleware = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // Maximum number of files
  }
});
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 10
    }
});

// Cloudinary configuration validation
if (!process.env.CLOUDINARY_CLOUD_NAME || 
    !process.env.CLOUDINARY_API_KEY || 
    !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Missing required Cloudinary configuration');
}

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});




// Utility function to clean up uploaded files
async function cleanupFiles(files) {
    if (!files) return;
    
    for (const file of files) {
        try {
            await fs.unlink(file.path);
        } catch (error) {
            console.error(`Failed to delete temporary file ${file.path}:`, error);
        }
    }
}

// Utility function to clean up Cloudinary uploads
async function cleanupCloudinaryUploads(mediaUrls) {
    if (!mediaUrls || !mediaUrls.length) return;
    
    for (const media of mediaUrls) {
        try {
            await cloudinary.uploader.destroy(media.publicId);
        } catch (error) {
            console.error(`Failed to delete Cloudinary resource ${media.publicId}:`, error);
        }
    }
}

router.post('/posts', 
    authenticate, 
    upload.array('media', 10),
    async (req, res) => {
        const mediaUrls = [];
        const startTime = Date.now();
        
        try {
            // Log request details
            console.log(`[${startTime}] Post creation request received`);
            console.log('User ID:', req.userId);
            console.log('Content:', req.body.content);
            console.log('Files count:', req.files?.length || 0);

            // Input validation
            if (!req.body.content && (!req.files || req.files.length === 0)) {
                throw new Error('Post must contain either content or media files');
            }

            // Handle media uploads
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    try {
                        console.log(`Uploading file: ${file.originalname}`);
                        const result = await cloudinary.uploader.upload(file.path, {
                            folder: 'marketplace_posts',
                            resource_type: 'auto',
                            timeout: 60000 // 60 seconds timeout
                        });

                        mediaUrls.push({
                            url: result.secure_url,
                            type: result.resource_type === 'video' ? 'video' : 'image',
                            publicId: result.public_id
                        });
                    } catch (uploadError) {
                        console.error(`Failed to upload ${file.originalname}:`, uploadError);
                        await cleanupCloudinaryUploads(mediaUrls);
                        throw new Error(`Failed to upload ${file.originalname}: ${uploadError.message}`);
                    }
                }
            }

            // Create and save post
            const post = new Post({
                content: req.body.content,
                media: mediaUrls,
                user: req.userId
            });

            await post.save();

            // Clean up temporary files
            await cleanupFiles(req.files);

            const duration = Date.now() - startTime;
            console.log(`[${startTime}] Post creation completed in ${duration}ms`);

            return res.status(201).json({
                success: true,
                message: 'Post created successfully',
                post: await post.populate('user', 'username avatar')
            });

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[${startTime}] Post creation failed after ${duration}ms:`, error);

            // Clean up on failure
            await cleanupCloudinaryUploads(mediaUrls);
            await cleanupFiles(req.files);

            // Determine appropriate error status and message
            let statusCode = 500;
            let errorMessage = 'An unexpected error occurred while creating the post';

            if (error.message.includes('must contain either content or media')) {
                statusCode = 400;
                errorMessage = error.message;
            } else if (error.name === 'ValidationError') {
                statusCode = 400;
                errorMessage = 'Invalid post data provided';
            }

            return res.status(statusCode).json({
                success: false,
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
);

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Router error:', error);

    if (error instanceof multer.MulterError) {
        let message = 'File upload error';
        
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                message = 'File is too large. Maximum size is 10MB';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files. Maximum is 10 files';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Unexpected field name in file upload';
                break;
        }

        return res.status(400).json({
            success: false,
            message,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

module.exports = router;
// Fetch all posts endpoint
app.get("/api/posts", async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("user", "name avatar") // Populate user details
      .sort({ createdAt: -1 }); // Sort by latest posts first

    return res.status(200).json({
      success: true,
      message: "Posts fetched successfully",
      posts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch posts",
      error: error.message,
    });
  }
});

// User Registration
app.post("/api/register", async (req, res) => {
    try {
        const { username, email, password } = req.body;  // ✅ Expect "username", not "name"

        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Email already in use." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashedPassword });  // ✅ Change "name" to "username"

        await user.save();
        console.log("✅ New User Registered:", user);

        res.json({ success: true, message: "User registered successfully!" });

    } catch (error) {
        console.error("❌ Registration Error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
});
// User Login
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        return res.status(400).json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(400).json({ success: false, message: "Invalid password" });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "12h" });

    res.json({
        success: true,
        token,
        user: { _id: user._id, email: user.email, name: user.name }  // ✅ Ensure user._id is included
    });
});
/**
// POST route to create a new post
app.post("/api/posts", authenticate, upload.array("media", 10), async (req, res) => {
    try {
        const { content } = req.body; // Get content from the request body
        const mediaFiles = req.files; // Get uploaded media files
        const userId = req.userId; // Get user ID from authentication middleware

        // Validate input
        if (!content && (!mediaFiles || mediaFiles.length === 0)) {
            return res.status(400).json({ success: false, message: "Please provide content or upload media." });
        }

        // Upload media files to Cloudinary
        const mediaUrls = [];
        for (const file of mediaFiles) {
            const result = await cloudinary.uploader.upload(file.path, {
                folder: "marketplace_posts", // Folder in Cloudinary
                resource_type: "auto", // Automatically detect if it's an image or video
            });

            mediaUrls.push({
                url: result.secure_url, // Cloudinary URL
                type: result.resource_type, // "image" or "video"
            });
        }

        // Create a new post in MongoDB
        const newPost = new Post({
            content,
            media: mediaUrls,
            user: userId, // Associate the post with the user
        });

        await newPost.save();

        // Emit a Socket.io event to notify clients about the new post
        io.emit("newPost", newPost);

        // Return the created post
        res.status(201).json({ success: true, post: newPost });
    } catch (error) {
        console.error("Error creating post:", error);
        res.status(500).json({ success: false, message: "Failed to create post." });
    }
});

// GET route to fetch all posts
app.get("/api/posts", async (req, res) => {
    try {
        const posts = await Post.find().populate("user", "username email"); // Populate user details
        res.status(200).json({ success: true, posts });
    } catch (error) {
        console.error("Error fetching posts:", error);
        res.status(500).json({ success: false, message: "Failed to fetch posts." });
    }
});**/

// Import the currency constants
const { currencySymbol } = require('./constants');

/**app.post("/api/items/create", authenticate, upload.single("image"), async (req, res) => {
    try {
        console.log("🔍 Received Data:", req.body);
        console.log("🔍 Uploaded File:", req.file);

        const { name, price, category, location, anonymous, currency = 'NGN' } = req.body;

        // Validate currency
        if (!currencySymbol[currency]) {
            return res.status(400).json({
                success: false,
                message: "Invalid currency selected"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Image upload failed."
            });
        }

        const numericPrice = parseFloat(price);
        if (isNaN(numericPrice)) {
            return res.status(400).json({
                success: false,
                message: "Invalid price format"
            });
        }

        const imageUrl = req.file.path;

        // Generate formatted price before creating the item
        const formattedPrice = `${currencySymbol[currency]}${numericPrice.toLocaleString()}`;

        const newItem = new Item({
            name,
            price: numericPrice,
            currency,
            formattedPrice, // Add this field
            category,
            location,
            imageUrl,
            anonymous,
            seller: req.userId,
            postedBy: req.userId
        });

        await newItem.save();
        console.log("✅ Item Saved:", newItem);

        res.json({
            success: true,
            message: "Item created successfully!",
            item: newItem
        });

    } catch (error) {
        console.error("❌ Error creating item:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});
**/
// Fetch a Single Item by ID
app.get("/api/items/:id", async (req, res) => {
    try {
        const item = await Item.findById(req.params.id).populate("seller", "username email");
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        res.json({ success: true, item });
    } catch (error) {
        console.error("❌ Error fetching item:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Fetch Items with Filtering
app.get("/api/items", async (req, res) => {
    try {
        let { category, minPrice, maxPrice, keyword, location, limit } = req.query;
        let filter = {};

        if (category) filter.category = category;
        if (minPrice) filter.price = { $gte: parseFloat(minPrice) };
        if (maxPrice) filter.price = { ...filter.price, $lte: parseFloat(maxPrice) };
        if (keyword) filter.name = { $regex: keyword, $options: "i" };
        if (location) filter.location = { $regex: location, $options: "i" };

        const query = Item.find(filter).populate("seller", "username email");
        if (limit) query.limit(parseInt(limit));

        const items = await query;

        if (!items || items.length === 0) {
            return res.json({ success: true, items: [] });  // ✅ Always return an empty array if no items
        }

        res.json({ success: true, items });
    } catch (error) {
        console.error("❌ Error fetching filtered items:", error);
        res.status(500).json({ success: false, message: "Server error", items: [] });  // ✅ Always return `items`
    }
});

// Real-time Chat with Socket.io
io.on("connection", (socket) => {
    console.log("🟢 User connected:", socket.id);

    socket.on("joinRoom", ({ senderId, receiverId }) => {
        const roomId = [senderId, receiverId].sort().join("-");
        socket.join(roomId);
        console.log(`User ${senderId} joined room ${roomId}`);
    });

    socket.on("sendMessage", async ({ senderId, receiverId, text }) => {
        const roomId = [senderId, receiverId].sort().join("-");
        const message = new Message({ sender: senderId, receiver: receiverId, text });

        await message.save();
        io.to(roomId).emit("receiveMessage", message);
    });
    socket.on("typing", ({ senderId, receiverId }) => {
	io.to(receiverId).emit("showTyping", { senderId });
    });
    socket.on("receiveMessage", (message) => {
	const messageDiv = document.createElement("div");
messageDiv.className = `message ${message.sender === senderId ? "sent" : "received"}`;
    messageDiv.innerHTML = `${message.text} <span class="status">${message.read ? "Seen" : "Delivered"}</span>`;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Mark message as read
    if (message.sender !== senderId) {
        socket.emit("markAsRead", { messageId: message._id });
    }
});
    socket.on("markAsRead", async ({ messageId }) => {
    await Message.findByIdAndUpdate(messageId, { read: true });
    io.emit("messageRead", { messageId });
});

    socket.on("disconnect", () => {
        console.log("🔴 User disconnected:", socket.id);
    });
});

// Fetch Chat Messages
app.get("/api/chat/:userId", authenticate, async (req, res) => {
    const messages = await Message.find({
        $or: [
            { sender: req.userId, receiver: req.params.userId },
            { sender: req.params.userId, receiver: req.userId }
        ]
    }).sort({ timestamp: 1 });

    res.json({ success: true, messages });
});

app.post("/api/chat/start", async (req, res) => {
    try {
        const { userId, sellerId, anonymous } = req.body;

        if (!userId || !sellerId) {
            return res.status(400).json({ success: false, message: "Missing user or seller ID" });
        }

        const existingChat = await Chat.findOne({ participants: { $all: [userId, sellerId] } });
        if (existingChat) {
            return res.json({ success: true, chatId: existingChat._id });
        }

        const newChat = new Chat({
            participants: [userId, sellerId],
            anonymous,
        });

        await newChat.save();
        res.json({ success: true, chatId: newChat._id });

    } catch (error) {
        console.error("Error starting chat:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

async function sendEmailNotification(to, message) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: "New Message Notification",
        text: `You have a new message: "${message}"\n\nLogin to reply.`,
    };

    await transporter.sendMail(mailOptions);
}

// Handle socket connections
io.on("connection", (socket) => {
    console.log("A user connected");

    // Real-time chat event listener
    socket.on("sendMessage", async ({ senderId, receiverId, text }) => {
        const message = new Message({ sender: senderId, receiver: receiverId, text });
        await message.save();

        // Check if the user is online
        const receiverSocket = onlineUsers[receiverId]; // Assuming onlineUsers is a map of userId -> socket
        if (!receiverSocket) {
            // User is offline, send email
            const receiver = await User.findById(receiverId);
            if (receiver) {
                await sendEmailNotification(receiver.email, text);
            }
        }

        // Emit message to receiver if they're online
        if (receiverSocket) {
            io.to(receiverId).emit("receiveMessage", message);
        }
    });
    socket.on("typing", ({ senderId, receiverId }) => {
	io.to(receiverId).emit("showTyping", { senderId });
});
    socket.on("markAsRead", async ({ messageId }) => {
    await Message.findByIdAndUpdate(messageId, { read: true });
    io.emit("messageRead", { messageId });
});
    const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/messages/audio", upload.single("audio"), async (req, res) => {
    const { sender, receiver } = req.body;
    const audioBuffer = req.file.buffer;
    
    // Upload to Cloudinary or S3
    const audioUrl = await uploadToCloudStorage(audioBuffer);

    const message = new Message({ sender, receiver, audioUrl });
    await message.save();

    io.to(receiver).emit("receiveMessage", message);
    res.status(201).json({ success: true, audioUrl });
});

    // Handle disconnection
    socket.on("disconnect", () => {
        console.log("A user disconnected");
        // Handle user removal from onlineUsers if necessary
    });
});

// Start Server with Socket.io
const PORT = process.env.PORT || 5000;                      server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`)); 
