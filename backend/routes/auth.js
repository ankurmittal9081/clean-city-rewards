// ================================
// AUTHENTICATION ROUTES
// ================================
// Handles user registration, login, profile

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect, generateToken } = require('../middleware/auth');

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post('/register', [
  // Validation rules
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional().trim()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { name, email, password, phone, address } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email' 
      });
    }
    
    // Create new user
    const user = await User.create({
      name,
      email,
      password,  // Will be hashed automatically by pre-save hook
      phone,
      address,
      role: 'citizen'  // Default role
    });
    
    // Generate JWT token
    const token = generateToken(user._id);
    
    // Send response (exclude password)
    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          rewardPoints: user.rewardPoints
        },
        token
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration' 
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { email, password } = req.body;
    
    // Find user by email (include password for comparison)
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    // Check password using comparePassword method
    const isPasswordMatch = await user.comparePassword(password);
    
    if (!isPasswordMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
    
    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is deactivated. Contact admin.' 
      });
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    // Send response
    res.json({
      success: true,
      message: 'Login successful!',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          rewardPoints: user.rewardPoints,
          totalPointsEarned: user.totalPointsEarned,
          badges: user.badges
        },
        token
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Get logged-in user profile
 * @access  Private
 */
router.get('/profile', protect, async (req, res) => {
  try {
    // req.user is set by protect middleware
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      data: user
    });
    
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching profile' 
    });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', protect, [
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim(),
  body('address').optional()
], async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    
    // Find and update user
    const user = await User.findById(req.user._id);
    
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = { ...user.address, ...address };
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error updating profile' 
    });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }
    
    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    await user.save();
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error changing password' 
    });
  }
});

module.exports = router;

/**
 * BEGINNER EXPLANATION:
 * 
 * ROUTE STRUCTURE:
 * router.post('/register', [...validation], async (req, res) => { ... })
 *           ↓           ↓                    ↓
 *        Method    Validation         Route Handler Function
 * 
 * VALIDATION:
 * - Checks if email is valid format
 * - Checks if password is at least 6 characters
 * - Runs BEFORE the main function
 * 
 * REGISTRATION FLOW:
 * 1. User sends: { name, email, password }
 * 2. Validate data
 * 3. Check if email already exists
 * 4. Create new user (password auto-hashed)
 * 5. Generate JWT token
 * 6. Send back user data + token
 * 
 * LOGIN FLOW:
 * 1. User sends: { email, password }
 * 2. Find user by email
 * 3. Compare password (hashed vs entered)
 * 4. If match → generate token
 * 5. Send back user data + token
 * 
 * JWT TOKEN:
 * - Frontend saves this token
 * - Includes in every future request
 * - Like a session ID
 * 
 * PROTECT MIDDLEWARE:
 * - Checks token validity
 * - Adds req.user with user data
 * - Only then allows access to route
 * 
 * HTTP STATUS CODES:
 * 200 - OK (success)
 * 201 - Created (new resource created)
 * 400 - Bad Request (validation error)
 * 401 - Unauthorized (wrong password)
 * 403 - Forbidden (account deactivated)
 * 500 - Server Error (something broke)
 * 
 * RESPONSE FORMAT:
 * {
 *   success: true/false,
 *   message: "Human-readable message",
 *   data: { ... actual data ... }
 * }
 */