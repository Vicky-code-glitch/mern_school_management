const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify token and attach user to request
const protect = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ 
            message: 'No token, authorization denied' 
        });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user and attach to request
    const user = await User.findById(decoded.userId)
      .select('-password');

    if (!user) {
        return res.status(401).json({ 
            message: 'User not found' 
        });
    }

    if (!user.isActive) {
        return res.status(401).json({ 
            message: 'Account deactivated' 
        });
    }

    req.user = user;
    next();

  } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ 
            message: 'Token is not valid' 
        });
  }
};

// Role-based authorization
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
            message: 'Not authorized' 
        });
    }

    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ 
            message: `Role ${req.user.role} is not authorized to access this route` 
        });
    }

    next();
  };
};

module.exports = { protect, authorize };