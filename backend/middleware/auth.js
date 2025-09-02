const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    let token = req.header('Authorization');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }
    
    // Remove Bearer from string
    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Token is not valid' });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Check if user has required role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Role ${req.user.role} is not authorized to access this resource` 
      });
    }
    
    next();
  };
};

// Check if tutor is approved
const requireApprovedTutor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  if (req.user.role !== 'tutor') {
    return res.status(403).json({ message: 'Only tutors can access this resource' });
  }
  
  if (!req.user.isApproved) {
    return res.status(403).json({ 
      message: 'Your tutor account is pending approval. Please wait for admin approval.' 
    });
  }
  
  next();
};

// Check if user owns resource or is admin
const authorizeOwnership = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  // Admin can access everything
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Check if user owns the resource
  const resourceUserId = req.params.userId || req.params.id || req.body.userId;
  
  if (req.user._id.toString() !== resourceUserId) {
    return res.status(403).json({ 
      message: 'Not authorized to access this resource' 
    });
  }
  
  next();
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.header('Authorization');
    
    if (!token) {
      return next();
    }
    
    // Remove Bearer from string
    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (user && user.isActive) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Don't fail - just continue without user
    next();
  }
};

// Rate limiting middleware for sensitive operations
const rateLimitMap = new Map();

const rateLimit = (maxRequests = 5, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const key = req.ip + (req.user ? req.user._id : '');
    const now = Date.now();
    
    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    const limit = rateLimitMap.get(key);
    
    if (now > limit.resetTime) {
      limit.count = 1;
      limit.resetTime = now + windowMs;
      return next();
    }
    
    if (limit.count >= maxRequests) {
      return res.status(429).json({ 
        message: 'Too many requests, please try again later' 
      });
    }
    
    limit.count++;
    next();
  };
};

// Clean up rate limit map periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute

module.exports = {
  authenticate,
  authorize,
  requireApprovedTutor,
  authorizeOwnership,
  optionalAuth,
  rateLimit
};
