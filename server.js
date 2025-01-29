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

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server for Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
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
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary Image Upload Setup
const storage = new CloudinaryStorage({
    cloudinary,
    params: { folder: "marketplace_items", allowed_formats: ["jpg", "png", "jpeg"] },
});
const upload = multer({ storage });

// Test route
app.get("/api/test", (req, res) => {
    res.json({ message: "API is working!" });
});


// User Schema
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});

const User = mongoose.model("User", UserSchema);

// Item Schema
const ItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    location: { type: String, required: true },
    imageUrl: { type: String, required: true },
    anonymous: { type: Boolean, default: false },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
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
// Create an Item (with Location & Image Upload)
app.post("/api/items/create", authenticate, upload.single("image"), async (req, res) => {
    const { name, price, category, location, anonymous } = req.body;
    const imageUrl = req.file.path;

    const newItem = new Item({
        name,
        price,
        category,
        location,
        imageUrl,
        anonymous,
        postedBy: req.userId
    });

    await newItem.save();
    res.json({ success: true, message: "Item created successfully!" });
});

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
        let { category, minPrice, maxPrice, keyword, location } = req.query;
        let filter = {};

        if (category) filter.category = category;
        if (minPrice) filter.price = { $gte: parseFloat(minPrice) };
        if (maxPrice) filter.price = { ...filter.price, $lte: parseFloat(maxPrice) };
        if (keyword) filter.name = { $regex: keyword, $options: "i" };
        if (location) filter.location = { $regex: location, $options: "i" };

        const items = await Item.find(filter).populate("seller", "username email");

        res.json({ success: true, items });
    } catch (error) {
        console.error("❌ Error fetching filtered items:", error);
        res.status(500).json({ success: false, message: "Server error" });
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
