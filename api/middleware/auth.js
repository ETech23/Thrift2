const jwt = require('jsonwebtoken');
const env = require('../config/env');

const auth = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { error: 'Authentication required', status: 401 };
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);
    
    return { user: decoded };
  } catch (error) {
    return { error: 'Invalid or expired token', status: 403 };
  }
};

module.exports = auth;
