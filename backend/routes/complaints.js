// ================================
// COMPLAINT ROUTES
// ================================
// Create, view, and manage garbage complaints

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { upload, uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
const { checkAutoBadges } = require('../utils/gamification');

/**
 * @route   POST /api/complaints
 * @desc    Report new complaint (citizen)
 * @access  Private
 */
router.post('/', protect, upload.single('photo'), [
  body('latitude').isFloat().withMessage('Valid latitude required'),
  body('longitude').isFloat().withMessage('Valid longitude required'),
  body('description').optional().trim(),
  body('category').optional().isIn(['garbage_pile', 'overflowing_bin', 'illegal_dumping', 'blocked_drain', 'other'])
], async (req, res) => {
  try {
    // Validate inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    // Check if photo was uploaded
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Photo is required' 
      });
    }
    
    const { latitude, longitude, description, category, address } = req.body;
    
    // Convert coordinates to numbers
    const coords = [parseFloat(longitude), parseFloat(latitude)];
    
    // Check for duplicate complaint (fraud prevention)
    const isDuplicate = await Complaint.isDuplicateComplaint(coords, req.user._id);
    
    if (isDuplicate) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already reported this location in the last 24 hours' 
      });
    }
    
    // Upload photo to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'complaints');
    
    // Create complaint
    const complaint = await Complaint.create({
      user: req.user._id,
      photo: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id
      },
      location: {
        type: 'Point',
        coordinates: coords,
        address: address || `${latitude}, ${longitude}`
      },
      description,
      category: category || 'other',
      status: 'pending'
    });
    
    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 
        'stats.totalComplaints': 1,
        'stats.pendingComplaints': 1
      }
    });
    
    // Populate user info before sending response
    await complaint.populate('user', 'name email');
    
    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully! Awaiting admin review.',
      data: complaint
    });
    
  } catch (error) {
    console.error('Complaint creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error submitting complaint' 
    });
  }
});

/**
 * @route   GET /api/complaints
 * @desc    Get all complaints (with filters)
 * @access  Private
 */
router.get('/', protect, async (req, res) => {
  try {
    const { 
      status, 
      category, 
      userId, 
      page = 1, 
      limit = 10,
      sortBy = '-createdAt'  // Default: newest first
    } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (userId) filter.user = userId;
    
    // If regular user, only show their complaints
    if (req.user.role !== 'admin') {
      filter.user = req.user._id;
    }
    
    // Pagination
    const skip = (page - 1) * limit;
    
    // Query complaints
    const complaints = await Complaint.find(filter)
      .populate('user', 'name email phone')
      .populate('reviewedBy', 'name')
      .sort(sortBy)
      .limit(parseInt(limit))
      .skip(skip);
    
    // Get total count
    const total = await Complaint.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        complaints,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit),
          limit: parseInt(limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Fetch complaints error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching complaints' 
    });
  }
});

/**
 * @route   GET /api/complaints/:id
 * @desc    Get single complaint by ID
 * @access  Private
 */
router.get('/:id', protect, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .populate('user', 'name email phone address')
      .populate('reviewedBy', 'name email')
      .populate('cleanupProof.uploadedBy', 'name');
    
    if (!complaint) {
      return res.status(404).json({ 
        success: false, 
        message: 'Complaint not found' 
      });
    }
    
    // Check access (users can only see their own, admins can see all)
    if (req.user.role !== 'admin' && complaint.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to view this complaint' 
      });
    }
    
    res.json({
      success: true,
      data: complaint
    });
    
  } catch (error) {
    console.error('Fetch complaint error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching complaint' 
    });
  }
});

/**
 * @route   PUT /api/complaints/:id/upvote
 * @desc    Upvote a complaint (community feature)
 * @access  Private
 */
router.put('/:id/upvote', protect, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({ 
        success: false, 
        message: 'Complaint not found' 
      });
    }
    
    // Check if user already upvoted
    const alreadyUpvoted = complaint.upvotedBy.includes(req.user._id);
    
    if (alreadyUpvoted) {
      // Remove upvote (toggle)
      complaint.upvotedBy = complaint.upvotedBy.filter(
        id => id.toString() !== req.user._id.toString()
      );
      complaint.upvotes -= 1;
    } else {
      // Add upvote
      complaint.upvotedBy.push(req.user._id);
      complaint.upvotes += 1;
    }
    
    await complaint.save();
    
    res.json({
      success: true,
      message: alreadyUpvoted ? 'Upvote removed' : 'Upvoted successfully',
      data: {
        upvotes: complaint.upvotes,
        userUpvoted: !alreadyUpvoted
      }
    });
    
  } catch (error) {
    console.error('Upvote error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error upvoting complaint' 
    });
  }
});

/**
 * @route   DELETE /api/complaints/:id
 * @desc    Delete complaint (only if pending)
 * @access  Private
 */
router.delete('/:id', protect, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    
    if (!complaint) {
      return res.status(404).json({ 
        success: false, 
        message: 'Complaint not found' 
      });
    }
    
    // Only owner can delete, and only if still pending
    if (complaint.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this complaint' 
      });
    }
    
    if (complaint.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete complaint after it has been reviewed' 
      });
    }
    
    // Delete image from Cloudinary
    if (complaint.photo.publicId) {
      await deleteFromCloudinary(complaint.photo.publicId);
    }
    
    // Delete complaint
    await complaint.deleteOne();
    
    // Update user stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 
        'stats.totalComplaints': -1,
        'stats.pendingComplaints': -1
      }
    });
    
    res.json({
      success: true,
      message: 'Complaint deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete complaint error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error deleting complaint' 
    });
  }
});

/**
 * @route   GET /api/complaints/nearby/:latitude/:longitude
 * @desc    Get complaints near a location
 * @access  Public
 */
router.get('/nearby/:latitude/:longitude', async (req, res) => {
  try {
    const { latitude, longitude } = req.params;
    const { radius = 5000 } = req.query; // Default 5km radius
    
    const complaints = await Complaint.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(radius)
        }
      },
      status: { $in: ['pending', 'approved'] }
    })
      .limit(50)
      .select('location photo category status createdAt upvotes');
    
    res.json({
      success: true,
      data: complaints
    });
    
  } catch (error) {
    console.error('Nearby complaints error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching nearby complaints' 
    });
  }
});

module.exports = router;

/**
 * BEGINNER EXPLANATION:
 * 
 * FILE UPLOAD:
 * - upload.single('photo') → multer middleware catches uploaded file
 * - req.file → contains file data
 * - req.file.buffer → raw image data
 * 
 * COORDINATES:
 * - MongoDB requires [longitude, latitude] order (not lat, lon!)
 * - Example: New Delhi = [77.2090, 28.6139]
 * 
 * DUPLICATE CHECK:
 * - Prevents spam complaints from same location
 * - Uses $near operator to find nearby complaints
 * - Within 50 meters in last 24 hours
 * 
 * PAGINATION:
 * - page=1, limit=10 → Get first 10 results
 * - skip = (1-1) * 10 = 0 → Start from 0
 * - page=2, limit=10 → skip=10 → Start from 11th result
 * 
 * POPULATE:
 * - Gets referenced user data
 * - Instead of just userId, gets full user object
 * - Like JOIN in SQL
 * 
 * UPVOTE SYSTEM:
 * - Community can upvote important issues
 * - Toggle: upvote → remove upvote → upvote
 * - Stored in upvotedBy array to track who upvoted
 * 
 * GEOSPATIAL QUERY ($near):
 * - Finds documents near a point
 * - Requires 2dsphere index
 * - Returns results sorted by distance
 * 
 * RESPONSE STRUCTURE:
 * {
 *   success: true,
 *   data: {
 *     complaints: [...],
 *     pagination: { total: 45, page: 1, pages: 5, limit: 10 }
 *   }
 * }
 */