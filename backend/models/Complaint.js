// ================================
// COMPLAINT MODEL (Garbage Report Structure)
// ================================

const mongoose = require('mongoose');

/**
 * Complaint Schema
 * Stores all garbage/cleanliness complaint information
 */
const complaintSchema = new mongoose.Schema({
  
  // Who reported this complaint?
  user: {
    type: mongoose.Schema.Types.ObjectId,  // Reference to User ID
    ref: 'User',                            // Links to User model
    required: true
  },
  
  // Photo of garbage (mandatory)
  photo: {
    url: {
      type: String,
      required: true                        // Photo is mandatory
    },
    publicId: String                        // Cloudinary public ID (for deletion)
  },
  
  // GPS Location (automatically captured)
  location: {
    type: {
      type: String,
      enum: ['Point'],                      // GeoJSON type
      default: 'Point'
    },
    coordinates: {
      type: [Number],                       // [longitude, latitude]
      required: true
    },
    address: String                         // Human-readable address
  },
  
  // Optional description
  description: {
    type: String,
    maxlength: 500,                         // Max 500 characters
    trim: true
  },
  
  // Category of issue
  category: {
    type: String,
    enum: [
      'garbage_pile',
      'overflowing_bin',
      'illegal_dumping',
      'blocked_drain',
      'other'
    ],
    default: 'other'
  },
  
  // Complaint Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cleaned'],
    default: 'pending'
  },
  
  // Points awarded for this complaint
  pointsAwarded: {
    type: Number,
    default: 0
  },
  
  // Admin Review
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'                             // Admin who reviewed
  },
  
  reviewedAt: Date,
  
  rejectionReason: String,                  // Why rejected (if applicable)
  
  // Cleanup Proof (Municipality uploads after cleaning)
  cleanupProof: {
    photo: {
      url: String,
      publicId: String
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: Date,
    notes: String
  },
  
  // Priority Level
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Visibility (for community challenges)
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // Upvotes (community can upvote important issues)
  upvotes: {
    type: Number,
    default: 0
  },
  
  upvotedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Timestamps
}, {
  timestamps: true
});

/**
 * INDEX: For faster location-based queries
 * Allows us to find complaints near a location efficiently
 */
complaintSchema.index({ location: '2dsphere' });

/**
 * INDEX: For faster user queries
 */
complaintSchema.index({ user: 1, createdAt: -1 });

/**
 * STATIC METHOD: Check if duplicate complaint exists
 * Prevents spam - one complaint per location in 24 hours
 */
complaintSchema.statics.isDuplicateComplaint = async function(coordinates, userId) {
  // Calculate time 24 hours ago
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  
  // Find complaints near this location (within 50 meters) in last 24 hours
  const duplicate = await this.findOne({
    user: userId,
    createdAt: { $gte: oneDayAgo },
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: 50  // 50 meters radius
      }
    }
  });
  
  return duplicate !== null;
};

/**
 * METHOD: Calculate points for this complaint
 * Different categories earn different points
 */
complaintSchema.methods.calculatePoints = function() {
  const pointsMap = {
    'illegal_dumping': 20,     // Serious issue
    'blocked_drain': 15,       // Medium priority
    'overflowing_bin': 10,     // Standard
    'garbage_pile': 10,        // Standard
    'other': 5                 // Low priority
  };
  
  // Get base points from category
  let points = pointsMap[this.category] || 10;
  
  // Bonus for high priority complaints
  if (this.priority === 'urgent') {
    points += 10;
  } else if (this.priority === 'high') {
    points += 5;
  }
  
  // Bonus for community upvotes (popular issues)
  if (this.upvotes > 10) {
    points += 5;
  }
  
  return points;
};

/**
 * VIRTUAL FIELD: Get formatted address
 * (Not stored in DB, calculated on the fly)
 */
complaintSchema.virtual('formattedLocation').get(function() {
  return this.location.address || 
         `${this.location.coordinates[1]}, ${this.location.coordinates[0]}`;
});

// Create and export model
const Complaint = mongoose.model('Complaint', complaintSchema);
module.exports = Complaint;

/**
 * BEGINNER EXPLANATION:
 * 
 * 1. ObjectId - Unique identifier (like Aadhaar number for database records)
 * 2. ref: 'User' - Links to User model (relationship)
 * 3. enum - Only specific values allowed (like dropdown options)
 * 4. 2dsphere index - Makes location searches super fast
 * 5. $near - MongoDB operator to find nearby locations
 * 6. Virtual field - Calculated field, not stored in database
 * 
 * COORDINATES FORMAT:
 * - Always [longitude, latitude] (lon first!)
 * - Example: [77.2090, 28.6139] (New Delhi)
 * 
 * FRAUD PREVENTION:
 * - isDuplicateComplaint checks if same user reported same location in 24hrs
 * - Prevents spamming for points
 */