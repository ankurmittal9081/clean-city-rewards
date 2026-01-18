// ================================
// REDEEM MODEL (Points Redemption Structure)
// ================================

const mongoose = require('mongoose');

/**
 * Redeem Schema
 * Stores requests to redeem points for rewards
 */
const redeemSchema = new mongoose.Schema({
  
  // Who is redeeming points?
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // How many points are being redeemed?
  pointsRedeemed: {
    type: Number,
    required: true,
    min: 1                              // At least 1 point
  },
  
  // What reward are they requesting?
  rewardType: {
    type: String,
    enum: [
      'amazon_voucher',                 // Amazon gift card
      'flipkart_voucher',               // Flipkart gift card
      'paytm_cash',                     // Paytm cashback
      'google_play',                    // Google Play credit
      'local_shop_coupon',              // Local business coupon
      'swiggy_voucher',                 // Food delivery voucher
      'other'
    ],
    required: true
  },
  
  // Reward value in rupees
  rewardValue: {
    type: Number,
    required: true
  },
  
  // Redemption Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'fulfilled'],
    default: 'pending'
  },
  
  // User contact details for reward delivery
  contactDetails: {
    email: {
      type: String,
      required: true
    },
    phone: String,
    address: String                     // For physical rewards
  },
  
  // Admin Review
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  reviewedAt: Date,
  
  rejectionReason: String,
  
  // Reward Delivery Info
  deliveryDetails: {
    voucherCode: String,                // Gift card code
    expiryDate: Date,                   // Voucher expiry
    instructions: String,               // How to use
    deliveredAt: Date
  },
  
  // Notes
  userNotes: String,                    // User's request notes
  adminNotes: String,                   // Admin's private notes
  
  // Timestamps
}, {
  timestamps: true
});

/**
 * INDEX: For faster queries by user and status
 */
redeemSchema.index({ user: 1, status: 1 });
redeemSchema.index({ createdAt: -1 });

/**
 * STATIC METHOD: Get redemption rate (points to rupees)
 * Example: 100 points = ₹10
 */
redeemSchema.statics.getConversionRate = function() {
  return 10; // 10 points = 1 rupee
};

/**
 * STATIC METHOD: Calculate reward value from points
 */
redeemSchema.statics.calculateRewardValue = function(points) {
  const rate = this.getConversionRate();
  return points / rate;
};

/**
 * STATIC METHOD: Get minimum points required for redemption
 */
redeemSchema.statics.getMinimumPoints = function() {
  return 100; // Minimum 100 points to redeem
};

/**
 * METHOD: Validate if user has enough points
 */
redeemSchema.methods.validatePoints = async function() {
  const User = mongoose.model('User');
  const user = await User.findById(this.user);
  
  if (!user) {
    return { valid: false, message: 'User not found' };
  }
  
  if (user.rewardPoints < this.pointsRedeemed) {
    return { 
      valid: false, 
      message: `Insufficient points. You have ${user.rewardPoints}, need ${this.pointsRedeemed}` 
    };
  }
  
  const minPoints = this.constructor.getMinimumPoints();
  if (this.pointsRedeemed < minPoints) {
    return { 
      valid: false, 
      message: `Minimum ${minPoints} points required for redemption` 
    };
  }
  
  return { valid: true, message: 'Valid redemption request' };
};

/**
 * PRE-SAVE HOOK: Calculate reward value automatically
 */
redeemSchema.pre('save', function(next) {
  if (this.isNew) {
    // Calculate reward value based on points
    this.rewardValue = this.constructor.calculateRewardValue(this.pointsRedeemed);
  }
  next();
});

// Create and export model
const Redeem = mongoose.model('Redeem', redeemSchema);
module.exports = Redeem;

/**
 * BEGINNER EXPLANATION:
 * 
 * REDEMPTION FLOW:
 * 1. User requests to redeem 100 points
 * 2. System checks if user has 100 points
 * 3. System calculates: 100 points = ₹10 voucher
 * 4. Request goes to admin (status: pending)
 * 5. Admin approves → sends voucher code
 * 6. User's points deducted
 * 
 * CONVERSION RATE:
 * - 10 points = ₹1
 * - 100 points = ₹10 voucher
 * - 500 points = ₹50 voucher
 * 
 * MINIMUM POINTS:
 * - Set to 100 points (₹10 minimum)
 * - Prevents users from redeeming tiny amounts
 * 
 * STATUS FLOW:
 * pending → approved → fulfilled
 *    ↓
 * rejected
 */