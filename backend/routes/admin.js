const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');
const { checkAutoBadges } = require('../utils/gamification');
const { upload, uploadToCloudinary } = require('../utils/cloudinary');

// Approve Complaint
router.put('/complaints/:id/approve', protect, admin, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    
    // Calculate points
    const points = complaint.calculatePoints();
    
    // Update complaint
    complaint.status = 'approved';
    complaint.pointsAwarded = points;
    complaint.reviewedBy = req.user._id;
    complaint.reviewedAt = new Date();
    await complaint.save();
    
    // Award points to user
    const user = await User.findById(complaint.user);
    user.rewardPoints += points;
    user.totalPointsEarned += points;
    user.stats.approvedComplaints += 1;
    user.stats.pendingComplaints -= 1;
    await user.save();
    
    // Check for badges
    await checkAutoBadges(user._id);
    
    res.json({ success: true, message: 'Complaint approved', data: complaint });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reject Complaint
router.put('/complaints/:id/reject', protect, admin, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }
    
    complaint.status = 'rejected';
    complaint.rejectionReason = reason;
    complaint.reviewedBy = req.user._id;
    complaint.reviewedAt = new Date();
    await complaint.save();
    
    // Update user stats
    await User.findByIdAndUpdate(complaint.user, {
      $inc: { 
        'stats.rejectedComplaints': 1,
        'stats.pendingComplaints': -1
      }
    });
    
    res.json({ success: true, message: 'Complaint rejected', data: complaint });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Upload Cleanup Proof
router.put('/complaints/:id/cleanup-proof', protect, admin, 
  upload.single('photo'), async (req, res) => {
    try {
      const complaint = await Complaint.findById(req.params.id);
      
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Photo required' });
      }
      
      const result = await uploadToCloudinary(req.file.buffer, 'cleanup-proof');
      
      complaint.cleanupProof = {
        photo: {
          url: result.secure_url,
          publicId: result.public_id
        },
        uploadedBy: req.user._id,
        uploadedAt: new Date(),
        notes: req.body.notes
      };
      complaint.status = 'cleaned';
      await complaint.save();
      
      res.json({ success: true, message: 'Cleanup proof uploaded', data: complaint });
      
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
});

// Dashboard Stats
router.get('/dashboard/stats', protect, admin, async (req, res) => {
  try {
    const totalComplaints = await Complaint.countDocuments();
    const pending = await Complaint.countDocuments({ status: 'pending' });
    const approved = await Complaint.countDocuments({ status: 'approved' });
    const rejected = await Complaint.countDocuments({ status: 'rejected' });
    const cleaned = await Complaint.countDocuments({ status: 'cleaned' });
    
    const totalUsers = await User.countDocuments({ role: 'citizen' });
    const activeUsers = await User.countDocuments({ 
      role: 'citizen',
      'stats.totalComplaints': { $gt: 0 }
    });
    
    res.json({
      success: true,
      data: {
        complaints: { total: totalComplaints, pending, approved, rejected, cleaned },
        users: { total: totalUsers, active: activeUsers }
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;