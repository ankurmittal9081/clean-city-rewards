const express = require('express');
const router = express.Router();
const Redeem = require('../models/Redeem');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const { getMonthlyLeaderboard, getAllTimeLeaderboard } = require('../utils/gamification');

// Request Redemption
router.post('/redeem', protect, async (req, res) => {
  try {
    const { pointsToRedeem, rewardType, contactDetails, userNotes } = req.body;
    
    // Check minimum points
    if (pointsToRedeem < Redeem.getMinimumPoints()) {
      return res.status(400).json({ 
        success: false, 
        message: `Minimum ${Redeem.getMinimumPoints()} points required` 
      });
    }
    
    // Check user has enough points
    const user = await User.findById(req.user._id);
    if (user.rewardPoints < pointsToRedeem) {
      return res.status(400).json({ 
        success: false, 
        message: 'Insufficient points' 
      });
    }
    
    const redeem = await Redeem.create({
      user: req.user._id,
      pointsRedeemed: pointsToRedeem,
      rewardType,
      contactDetails: {
        email: contactDetails.email || req.user.email,
        phone: contactDetails.phone,
        address: contactDetails.address
      },
      userNotes,
      status: 'pending'
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'Redemption request submitted!',
      data: redeem 
    });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get User Redemptions
router.get('/my-redemptions', protect, async (req, res) => {
  try {
    const redemptions = await Redeem.find({ user: req.user._id })
      .sort('-createdAt');
    
    res.json({ success: true, data: redemptions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve Redemption (Admin)
router.put('/redeem/:id/approve', protect, admin, async (req, res) => {
  try {
    const { voucherCode, expiryDate, instructions } = req.body;
    
    const redeem = await Redeem.findById(req.params.id);
    
    // Deduct points from user
    await User.findByIdAndUpdate(redeem.user, {
      $inc: { rewardPoints: -redeem.pointsRedeemed }
    });
    
    redeem.status = 'fulfilled';
    redeem.reviewedBy = req.user._id;
    redeem.reviewedAt = new Date();
    redeem.deliveryDetails = {
      voucherCode,
      expiryDate,
      instructions,
      deliveredAt: new Date()
    };
    await redeem.save();
    
    res.json({ success: true, message: 'Redemption approved', data: redeem });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'monthly', limit = 10 } = req.query;
    
    let leaderboard;
    if (type === 'monthly') {
      leaderboard = await getMonthlyLeaderboard(parseInt(limit));
    } else {
      leaderboard = await getAllTimeLeaderboard(parseInt(limit));
    }
    
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;