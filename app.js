require('dotenv').config({ path: '/data/data/com.termux/files/home/storage/shared/thrift2.env' });
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const cookieParser = require('cookie-parser');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Database Connection (MongoDB Atlas)
dotenv.config();
console.log('MongoDB URI:', process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB connected successfully');
})
.catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

// Routes
app.use('/api/auth', authRoutes);  // Authentication routes
app.use('/api/items', itemRoutes);  // Item routes

// Default route
app.get('/', (req, res) => {
  res.send('Welcome to the Thrift_Marketplace E-commerce API');
});

module.exports = app;
