// ================================
// AUTHENTICATION MIDDLEWARE
// ================================
// Protects routes - only logged-in users can access

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * PROTECT MIDDLEWARE
 * Verifies JWT token and attaches user to request
 */
const protect = async (req, res, next) => {
  let token;
  
  // Check if token exists in Authorization header
  // Format: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Extract token (remove "Bearer " prefix)
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token using secret key
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database (exclude password)
      req.user = await User.findById(decoded.id).select('-password');
      
      // If user not found
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      
      // If account is inactive
      if (!req.user.isActive) {
        return res.status(403).json({ 
          success: false, 
          message: 'Account is deactivated' 
        });
      }
      
      // User verified, proceed to next middleware/route
      next();
      
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, token failed' 
      });
    }
  }
  
  // No token provided
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Not authorized, no token' 
    });
  }
};

/**
 * ADMIN MIDDLEWARE
 * Checks if logged-in user is admin
 * Must be used after protect middleware
 */
const admin = (req, res, next) => {
  // Check if user exists and is admin
  if (req.user && req.user.role === 'admin') {
    next(); // User is admin, proceed
  } else {
    return res.status(403).json({ 
      success: false, 
      message: 'Not authorized as admin' 
    });
  }
};

/**
 * GENERATE JWT TOKEN
 * Creates a token when user logs in
 */
const generateToken = (id) => {
  return jwt.sign(
    { id },                           // Payload (user ID)
    process.env.JWT_SECRET,           // Secret key
    { expiresIn: '30d' }              // Token expires in 30 days
  );
};

module.exports = { protect, admin, generateToken };

/**
 * BEGINNER EXPLANATION:
 * 
 * JWT (JSON Web Token):
 * - Like a temporary ID card for logged-in users
 * - Contains encrypted user information
 * - Sent with every request to prove identity
 * 
 * HOW IT WORKS:
 * 1. User logs in with email/password
 * 2. Server creates JWT token
 * 3. Frontend saves token (localStorage)
 * 4. Every API request includes token in header
 * 5. Middleware checks token validity
 * 6. If valid → allow access
 * 7. If invalid → reject request
 * 
 * PROTECT MIDDLEWARE:
 * - Checks if user is logged in
 * - Verifies token
 * - Attaches user object to req.user
 * 
 * ADMIN MIDDLEWARE:
 * - Checks if user.role === 'admin'
 * - Only admins can access certain routes
 * 
 * USAGE EXAMPLE:
 * app.get('/api/profile', protect, getProfile);           // Only logged-in users
 * app.get('/api/admin/users', protect, admin, getUsers);  // Only admins
 * 
 * TOKEN FORMAT IN HEADER:
 * Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 */