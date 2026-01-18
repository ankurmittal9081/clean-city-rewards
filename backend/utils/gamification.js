// ================================
// GAMIFICATION UTILITIES
// ================================
// Leaderboard, badges, and ranking logic

const User = require('../models/User');
const Complaint = require('../models/Complaint');

/**
 * GET MONTHLY LEADERBOARD
 * Top users based on approved complaints this month
 */
const getMonthlyLeaderboard = async (limit = 10) => {
  try {
    // Get start and end of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Aggregate complaints by user for this month
    const leaderboard = await Complaint.aggregate([
      {
        // Filter: Only approved complaints from this month
        $match: {
          status: 'approved',
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        // Group by user and count complaints
        $group: {
          _id: '$user',
          complaintsCount: { $sum: 1 },
          totalPoints: { $sum: '$pointsAwarded' }
        }
      },
      {
        // Sort by complaint count (highest first)
        $sort: { complaintsCount: -1 }
      },
      {
        // Limit to top N users
        $limit: limit
      },
      {
        // Join with User collection to get user details
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        // Unwind user info array
        $unwind: '$userInfo'
      },
      {
        // Shape the output
        $project: {
          _id: 1,
          name: '$userInfo.name',
          complaintsCount: 1,
          totalPoints: 1,
          badges: '$userInfo.badges',
          rank: { $literal: 0 } // Will be set below
        }
      }
    ]);
    
    // Add rank numbers (1, 2, 3, ...)
    leaderboard.forEach((user, index) => {
      user.rank = index + 1;
    });
    
    return leaderboard;
    
  } catch (error) {
    console.error('Leaderboard error:', error);
    throw error;
  }
};

/**
 * GET ALL-TIME LEADERBOARD
 * Top users based on total approved complaints
 */
const getAllTimeLeaderboard = async (limit = 10) => {
  try {
    const leaderboard = await User.find({ role: 'citizen' })
      .select('name rewardPoints totalPointsEarned stats badges')
      .sort({ 'stats.approvedComplaints': -1 })
      .limit(limit)
      .lean();
    
    // Add rank
    leaderboard.forEach((user, index) => {
      user.rank = index + 1;
    });
    
    return leaderboard;
    
  } catch (error) {
    console.error('All-time leaderboard error:', error);
    throw error;
  }
};

/**
 * GET AREA-WISE LEADERBOARD
 * Top contributors by city/area
 */
const getAreaLeaderboard = async (city, limit = 10) => {
  try {
    const leaderboard = await User.find({ 
      role: 'citizen',
      'address.city': city
    })
      .select('name address.city stats totalPointsEarned badges')
      .sort({ 'stats.approvedComplaints': -1 })
      .limit(limit)
      .lean();
    
    leaderboard.forEach((user, index) => {
      user.rank = index + 1;
    });
    
    return leaderboard;
    
  } catch (error) {
    console.error('Area leaderboard error:', error);
    throw error;
  }
};

/**
 * GET USER RANK
 * Find user's position in leaderboard
 */
const getUserRank = async (userId) => {
  try {
    // Get all users sorted by approved complaints
    const users = await User.find({ role: 'citizen' })
      .select('_id stats.approvedComplaints')
      .sort({ 'stats.approvedComplaints': -1 })
      .lean();
    
    // Find user's position
    const userIndex = users.findIndex(u => u._id.toString() === userId.toString());
    
    if (userIndex === -1) {
      return { rank: null, totalUsers: users.length };
    }
    
    return {
      rank: userIndex + 1,
      totalUsers: users.length,
      percentile: Math.round(((users.length - userIndex) / users.length) * 100)
    };
    
  } catch (error) {
    console.error('User rank error:', error);
    throw error;
  }
};

/**
 * AWARD BADGE TO USER
 * Give badge based on achievement
 */
const awardBadge = async (userId, badgeName) => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Check if user already has this badge
    const hasBadge = user.badges.some(badge => badge.name === badgeName);
    
    if (hasBadge) {
      return { awarded: false, message: 'Badge already owned' };
    }
    
    // Badge definitions
    const badgeDefinitions = {
      'First Step': { icon: '🌱', description: 'First approved complaint' },
      'Clean Hero': { icon: '🦸', description: '10 approved complaints' },
      'City Champion': { icon: '👑', description: '50 approved complaints' },
      'Eco Warrior': { icon: '🌍', description: '100 approved complaints' },
      'Top Contributor': { icon: '⭐', description: 'Top 10 this month' },
      'Consistency King': { icon: '🔥', description: '30 days streak' }
    };
    
    const badgeInfo = badgeDefinitions[badgeName];
    
    if (!badgeInfo) {
      return { awarded: false, message: 'Invalid badge name' };
    }
    
    // Add badge to user
    user.badges.push({
      name: badgeName,
      earnedAt: new Date(),
      icon: badgeInfo.icon
    });
    
    await user.save();
    
    return { 
      awarded: true, 
      badge: badgeInfo,
      message: `Congratulations! You earned the ${badgeName} badge!`
    };
    
  } catch (error) {
    console.error('Award badge error:', error);
    throw error;
  }
};

/**
 * CHECK AND AWARD AUTOMATIC BADGES
 * Called after complaint approval
 */
const checkAutoBadges = async (userId) => {
  try {
    const user = await User.findById(userId);
    
    if (!user) return;
    
    const newBadges = user.checkAndAwardBadges(); // From User model method
    
    if (newBadges.length > 0) {
      await user.save();
    }
    
    return newBadges;
    
  } catch (error) {
    console.error('Auto badge check error:', error);
    throw error;
  }
};

module.exports = {
  getMonthlyLeaderboard,
  getAllTimeLeaderboard,
  getAreaLeaderboard,
  getUserRank,
  awardBadge,
  checkAutoBadges
};

/**
 * BEGINNER EXPLANATION:
 * 
 * AGGREGATION:
 * - Like GROUP BY in SQL
 * - Combines multiple documents into summary
 * - Example: Count complaints per user
 * 
 * LEADERBOARD LOGIC:
 * 1. Find all approved complaints this month
 * 2. Group by user ID
 * 3. Count how many complaints each user has
 * 4. Sort from highest to lowest
 * 5. Take top 10
 * 
 * BADGES:
 * - Achievements users earn
 * - Motivates continued participation
 * - Automatically awarded based on milestones
 * 
 * PERCENTILE:
 * - If you're rank 5 out of 100 users
 * - You're in top 95th percentile (better than 95%)
 * 
 * AGGREGATION PIPELINE STAGES:
 * $match → Filter documents (like WHERE in SQL)
 * $group → Group by field (like GROUP BY)
 * $sort → Sort results (like ORDER BY)
 * $limit → Take only N results
 * $lookup → Join with another collection (like JOIN)
 * $project → Select which fields to return
 * 
 * EXAMPLE OUTPUT:
 * [
 *   { rank: 1, name: "Rahul", complaintsCount: 45, totalPoints: 450 },
 *   { rank: 2, name: "Priya", complaintsCount: 38, totalPoints: 380 },
 *   ...
 * ]
 */