const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { deleteFile } = require('../middleware/upload');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// Register user
const register = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up uploaded CV file if validation fails
      if (req.file && req.file.fieldname === 'cv') {
        deleteFile(req.file.path);
      }
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      firstName,
      lastName,
      email,
      password,
      role,
      department,
      cgpa,
      phone,
      yearOfStudy,
      workExperience,
      skillSet,
      hourlyRate,
      availableHours
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      // Clean up uploaded CV file
      if (req.file && req.file.fieldname === 'cv') {
        deleteFile(req.file.path);
      }
      return res.status(400).json({
        message: 'User already exists with this email'
      });
    }

    // Prepare user data
    const userData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase(),
      password,
      role: role || 'student',
      phone: phone ? phone.trim() : undefined
    };

    // Add role-specific fields
    if (role === 'student') {
      userData.department = department;
      userData.cgpa = parseFloat(cgpa);
      userData.yearOfStudy = parseInt(yearOfStudy);
    } else if (role === 'tutor') {
      userData.department = department;
      userData.cgpa = parseFloat(cgpa);
      userData.workExperience = workExperience;
      userData.skillSet = Array.isArray(skillSet) ? skillSet : skillSet.split(',').map(s => s.trim());
      userData.hourlyRate = parseFloat(hourlyRate);
      
      // Parse available hours if provided
      if (availableHours) {
        try {
          userData.availableHours = typeof availableHours === 'string' 
            ? JSON.parse(availableHours) 
            : availableHours;
        } catch (error) {
          return res.status(400).json({
            message: 'Invalid available hours format'
          });
        }
      }

      // Handle CV upload for tutors
      if (req.file && req.file.fieldname === 'cv') {
        userData.cv = req.file.path;
      } else {
        return res.status(400).json({
          message: 'CV is required for tutor registration'
        });
      }
    }

    // Create user
    const user = new User(userData);
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Prepare response (exclude sensitive data)
    const userResponse = user.getPublicProfile();

    res.status(201).json({
      message: role === 'tutor' 
        ? 'Registration successful! Your account is pending approval.' 
        : 'Registration successful!',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Clean up uploaded CV file on error
    if (req.file && req.file.fieldname === 'cv') {
      deleteFile(req.file.path);
    }

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        message: 'Account has been deactivated. Please contact support.'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Check if tutor is approved
    if (user.role === 'tutor' && !user.isApproved) {
      return res.status(403).json({
        message: 'Your tutor account is pending approval. Please wait for admin approval.'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Prepare response
    const userResponse = user.getPublicProfile();

    res.json({
      message: 'Login successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('enrolledCourses', 'title description')
      .populate('coursesTaught', 'title description enrollmentCount');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const userResponse = user.getPublicProfile();
    
    res.json({
      user: userResponse
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      message: 'Failed to get profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up uploaded file if validation fails
      if (req.file) {
        deleteFile(req.file.path);
      }
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const userId = req.user._id;
    const updateData = { ...req.body };

    // Handle profile picture upload
    if (req.file && req.file.fieldname === 'profilePicture') {
      updateData.profilePicture = req.file.path;
    }

    // Remove sensitive fields that shouldn't be updated through this endpoint
    delete updateData.password;
    delete updateData.role;
    delete updateData.isApproved;
    delete updateData.isActive;
    delete updateData.email; // Email updates should be handled separately

    // Parse JSON fields if they're strings
    if (updateData.skillSet && typeof updateData.skillSet === 'string') {
      updateData.skillSet = updateData.skillSet.split(',').map(s => s.trim());
    }

    if (updateData.availableHours && typeof updateData.availableHours === 'string') {
      try {
        updateData.availableHours = JSON.parse(updateData.availableHours);
      } catch (error) {
        return res.status(400).json({
          message: 'Invalid available hours format'
        });
      }
    }

    if (updateData.learningGoals && typeof updateData.learningGoals === 'string') {
      updateData.learningGoals = updateData.learningGoals.split(',').map(s => s.trim());
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).populate('enrolledCourses', 'title description')
     .populate('coursesTaught', 'title description enrollmentCount');

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const userResponse = user.getPublicProfile();

    res.json({
      message: 'Profile updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    // Clean up uploaded file on error
    if (req.file) {
      deleteFile(req.file.path);
    }

    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      message: 'Failed to change password',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        message: 'Invalid token'
      });
    }

    // Generate new token
    const token = generateToken(user._id);

    res.json({
      token,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      message: 'Failed to refresh token',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Admin login (fixed credentials)
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check admin credentials
    if (email !== 'admin@coursetutor.com' || password !== 'admin123') {
      return res.status(401).json({
        message: 'Invalid admin credentials'
      });
    }

    // Check if admin user exists, create if not
    let adminUser = await User.findOne({ email: 'admin@coursetutor.com', role: 'admin' });
    
    if (!adminUser) {
      adminUser = new User({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@coursetutor.com',
        password: 'admin123',
        role: 'admin'
      });
      await adminUser.save();
    }

    // Update last login
    adminUser.lastLogin = new Date();
    await adminUser.save();

    // Generate token
    const token = generateToken(adminUser._id);

    res.json({
      message: 'Admin login successful',
      token,
      user: adminUser.getPublicProfile()
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      message: 'Admin login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  refreshToken,
  adminLogin
};
