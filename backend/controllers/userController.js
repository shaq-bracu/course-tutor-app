const { validationResult } = require('express-validator');
const User = require('../models/User');
const Course = require('../models/Course');
const Review = require('../models/Review');

// Get all approved tutors (public)
const getApprovedTutors = async (req, res) => {
  try {
    const { 
      department, 
      minRating, 
      maxHourlyRate, 
      skillSet,
      search,
      page = 1, 
      limit = 12 
    } = req.query;

    // Build filter object
    const filter = {
      role: 'tutor',
      isApproved: true,
      isActive: true
    };

    // Department filter
    if (department && ['CSE', 'EEE', 'BBA'].includes(department)) {
      filter.department = department;
    }

    // Rating filter
    if (minRating) {
      filter['rating.average'] = { $gte: parseFloat(minRating) };
    }

    // Hourly rate filter
    if (maxHourlyRate) {
      filter.hourlyRate = { $lte: parseFloat(maxHourlyRate) };
    }

    // Skill set filter
    if (skillSet) {
      const skills = skillSet.split(',').map(skill => skill.trim());
      filter.skillSet = { $in: skills };
    }

    // Search filter (name, skills, or work experience)
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { skillSet: { $in: [searchRegex] } },
        { workExperience: searchRegex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tutors = await User.find(filter)
      .select('-password -reports -cv') // Exclude sensitive fields
      .populate('coursesTaught', 'title description enrollmentCount rating')
      .sort({ 'rating.average': -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const totalTutors = await User.countDocuments(filter);

    res.json({
      tutors: tutors.map(tutor => tutor.getPublicProfile()),
      totalTutors,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalTutors / parseInt(limit)),
      hasMore: skip + parseInt(limit) < totalTutors
    });

  } catch (error) {
    console.error('Get approved tutors error:', error);
    res.status(500).json({
      message: 'Failed to get tutors',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get tutor details by ID (public)
const getTutorById = async (req, res) => {
  try {
    const { tutorId } = req.params;

    const tutor = await User.findOne({
      _id: tutorId,
      role: 'tutor',
      isApproved: true,
      isActive: true
    })
    .select('-password -reports -cv')
    .populate('coursesTaught', 'title description price enrollmentCount rating reviews')
    .lean();

    if (!tutor) {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    // Get tutor reviews
    const reviews = await Review.findForTutor(tutorId, 10);
    
    // Calculate detailed ratings
    const ratingStats = await Review.calculateAverageRatings(tutorId, 'tutor');

    res.json({
      tutor,
      reviews,
      ratingStats: ratingStats[0] || {
        averageRating: 0,
        totalReviews: 0,
        avgTeachingQuality: 0,
        avgCommunication: 0,
        avgPunctuality: 0,
        avgHelpfulness: 0
      }
    });

  } catch (error) {
    console.error('Get tutor by ID error:', error);
    res.status(500).json({
      message: 'Failed to get tutor details',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get user profile by ID (protected)
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Only allow users to view their own profile or admins to view any profile
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to view this profile' });
    }

    const user = await User.findById(userId)
      .populate('enrolledCourses', 'title description tutor')
      .populate('coursesTaught', 'title description enrollmentCount');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: user.getPublicProfile() });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      message: 'Failed to get user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Admin: Get all users with filters
const getAllUsers = async (req, res) => {
  try {
    const { 
      role, 
      department, 
      isApproved, 
      isActive,
      search,
      page = 1, 
      limit = 20 
    } = req.query;

    const filter = {};

    if (role) filter.role = role;
    if (department) filter.department = department;
    if (isApproved !== undefined) filter.isApproved = isApproved === 'true';
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const totalUsers = await User.countDocuments(filter);

    res.json({
      users: users.map(user => ({
        ...user.toObject(),
        password: undefined // Extra safety
      })),
      totalUsers,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalUsers / parseInt(limit)),
      hasMore: skip + parseInt(limit) < totalUsers
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      message: 'Failed to get users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Admin: Approve tutor
const approveTutor = async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { approved } = req.body;

    const tutor = await User.findOne({ _id: tutorId, role: 'tutor' });
    if (!tutor) {
      return res.status(404).json({ message: 'Tutor not found' });
    }

    tutor.isApproved = approved;
    await tutor.save();

    res.json({
      message: `Tutor ${approved ? 'approved' : 'rejected'} successfully`,
      tutor: tutor.getPublicProfile()
    });

  } catch (error) {
    console.error('Approve tutor error:', error);
    res.status(500).json({
      message: 'Failed to approve tutor',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Admin: Get pending tutor approvals
const getPendingTutors = async (req, res) => {
  try {
    const pendingTutors = await User.find({
      role: 'tutor',
      isApproved: false,
      isActive: true
    })
    .select('-password')
    .sort({ createdAt: -1 });

    res.json({ 
      pendingTutors: pendingTutors.map(tutor => ({
        ...tutor.toObject(),
        password: undefined
      }))
    });

  } catch (error) {
    console.error('Get pending tutors error:', error);
    res.status(500).json({
      message: 'Failed to get pending tutors',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Report user
const reportUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { reason, description } = req.body;
    const reporterId = req.user._id;

    // Can't report yourself
    if (userId === reporterId.toString()) {
      return res.status(400).json({ message: 'Cannot report yourself' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has already reported this person
    const existingReport = user.reports.find(
      report => report.reportedBy.toString() === reporterId.toString()
    );

    if (existingReport) {
      return res.status(400).json({ message: 'You have already reported this user' });
    }

    user.reports.push({
      reportedBy: reporterId,
      reason,
      description
    });

    await user.save();

    res.json({ message: 'User reported successfully' });

  } catch (error) {
    console.error('Report user error:', error);
    res.status(500).json({
      message: 'Failed to report user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Admin: Get user statistics
const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalStudents = await User.countDocuments({ role: 'student', isActive: true });
    const totalTutors = await User.countDocuments({ role: 'tutor', isApproved: true, isActive: true });
    const pendingTutors = await User.countDocuments({ role: 'tutor', isApproved: false, isActive: true });
    const totalReports = await User.aggregate([
      { $unwind: '$reports' },
      { $count: 'totalReports' }
    ]);

    const departmentStats = await User.aggregate([
      { $match: { role: { $in: ['student', 'tutor'] }, isActive: true } },
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);

    res.json({
      totalUsers,
      totalStudents,
      totalTutors,
      pendingTutors,
      totalReports: totalReports[0]?.totalReports || 0,
      departmentStats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      message: 'Failed to get user statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Admin: Toggle user active status
const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Can't deactivate admin accounts
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot modify admin account status' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      message: 'Failed to toggle user status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  getApprovedTutors,
  getTutorById,
  getUserById,
  getAllUsers,
  approveTutor,
  getPendingTutors,
  reportUser,
  getUserStats,
  toggleUserStatus
};
