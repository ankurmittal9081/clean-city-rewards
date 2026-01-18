// ================================
// USER MODEL (Database Structure)
// ================================
// Defines how user data is stored in MongoDB

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema - Blueprint of user data
 * Think of this like a form template
 */
const userSchema = new mongoose.Schema({
  
  // Basic Information
  name: {
    type: String,           // Data type: text
    required: true,         // This field is mandatory
    trim: true              // Remove extra spaces
  },
  
  email: {
    type: String,
    required: true,
    unique: true,           // No two users can have same email
    lowercase: true,        // Convert to lowercase automatically
    trim: true
  },
  
  password: {
    type: String,
    required: true,
    minlength: 6            // Minimum 6 characters
  },
  
  phone: {
    type: String,
    trim: true
  },
  
  // User Role (citizen or admin)
  role: {
    type: String,
    enum: ['citizen', 'admin'],  // Only these two values allowed
    default: 'citizen'            // If not specified, use 'citizen'
  },
  
  // Address Information
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String
  },
  
  // Reward Points System
  rewardPoints: {
    type: Number,
    default: 0              // Start with 0 points
  },
  
  totalPointsEarned: {
    type: Number,
    default: 0              // Track lifetime points (even after redemption)
  },
  
  // Gamification - Badges
  badges: [{
    name: String,           // Badge name (e.g., "Clean Hero")
    earnedAt: Date,         // When they earned it
    icon: String            // Badge icon URL
  }],
  
  // Statistics
  stats: {
    totalComplaints: {
      type: Number,
      default: 0
    },
    approvedComplaints: {
      type: Number,
      default: 0
    },
    rejectedComplaints: {
      type: Number,
      default: 0
    },
    pendingComplaints: {
      type: Number,
      default: 0
    }
  },
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true           // Account active by default
  },
  
  // Timestamps (createdAt, updatedAt added automatically)
}, {
  timestamps: true          // Automatically add createdAt and updatedAt fields
});

/**
 * MIDDLEWARE: Hash password before saving to database
 * This runs automatically before user.save()
 */
userSchema.pre('save', async function(next) {
  // Only hash password if it's new or modified
  if (!this.isModified('password')) {
    return next();
  }
  
  // Generate salt (random data for extra security)
  const salt = await bcrypt.genSalt(10);
  
  // Hash the password with salt
  this.password = await bcrypt.hash(this.password, salt);
  
  next(); // Continue with save operation
});

/**
 * METHOD: Compare entered password with hashed password
 * Used during login
 */
userSchema.methods.comparePassword = async function(enteredPassword) {
  // bcrypt.compare returns true if passwords match
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * METHOD: Check if user qualifies for new badges
 */
userSchema.methods.checkAndAwardBadges = function() {
  const newBadges = [];
  
  // Badge 1: First Complaint (1+ approved complaints)
  if (this.stats.approvedComplaints === 1) {
    newBadges.push({
      name: 'First Step',
      earnedAt: new Date(),
      icon: '🌱'
    });
  }
  
  // Badge 2: Clean Hero (10+ approved complaints)
  if (this.stats.approvedComplaints === 10) {
    newBadges.push({
      name: 'Clean Hero',
      earnedAt: new Date(),
      icon: '🦸'
    });
  }
  
  // Badge 3: City Champion (50+ approved complaints)
  if (this.stats.approvedComplaints === 50) {
    newBadges.push({
      name: 'City Champion',
      earnedAt: new Date(),
      icon: '👑'
    });
  }
  
  // Badge 4: Eco Warrior (100+ approved complaints)
  if (this.stats.approvedComplaints === 100) {
    newBadges.push({
      name: 'Eco Warrior',
      earnedAt: new Date(),
      icon: '🌍'
    });
  }
  
  // Add new badges to user's badge collection
  if (newBadges.length > 0) {
    this.badges.push(...newBadges);
  }
  
  return newBadges;
};

// Create and export User model
const User = mongoose.model('User', userSchema);
module.exports = User;

/**
 * BEGINNER EXPLANATION:
 * 
 * 1. Schema = Blueprint (defines structure)
 * 2. Model = Factory (creates actual users from blueprint)
 * 3. pre('save') = Runs before saving (we use it to hash passwords)
 * 4. methods = Custom functions we can call on user objects
 * 5. timestamps: true = MongoDB automatically adds createdAt and updatedAt
 * 
 * EXAMPLE USAGE:
 * const newUser = new User({ name: 'Rahul', email: 'rahul@gmail.com' });
 * await newUser.save(); // Password automatically hashed before saving
 */