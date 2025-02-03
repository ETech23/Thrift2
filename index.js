import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import dbConnect from "./utils/dbConnect.js";
import itemRoutes from "./api/items.js";  // Use import here
import authRoutes from './routes/authRoutes.js'; 
dotenv.config(); // Load environment variables

const app = express();

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cors({ origin: process.env.FRONTEND_URL })); // Enable CORS for frontend
app.use(morgan("dev")); // Logging requests

// Connect to Database
dbConnect();

// Routes
app.use("/api/items", itemRoutes);  // Use the route handler here
app.use("/api/auth", authRoutes);

// Default Route
app.get("/", (req, res) => {
    res.send("Welcome to Thrift2 API!");
});

// Handle 404 Errors
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Page not found" });
});

// Export for Vercel
export default app;
