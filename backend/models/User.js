const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot be more than 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['student', 'tutor', 'admin'],
    default: 'student'
  },
  profilePicture: {
    type: String,
    default: null
  },
  department: {
    type: String,
    enum: ['CSE', 'EEE', 'BBA'],
    required: function() {
      return this.role === 'student' || this.role === 'tutor';
    }
  },
  cgpa: {
    type: Number,
    min: [0, 'CGPA cannot be negative'],
    max: [4, 'CGPA cannot be more than 4'],
    required: function() {
      return this.role === 'student' || this.role === 'tutor';
    }
  },
  phone: {
    type: String,
    match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number']
  },
  address: {
    street: String,
    city: String,
    country: { type: String, default: 'Bangladesh' }
  },
  
  // Student specific fields
  yearOfStudy: {
    type: Number,
    min: 1,
    max: 4,
    required: function() {
      return this.role === 'student';
    }
  },
  learningGoals: [String],
  enrolledCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  
  // Tutor specific fields
  workExperience: {
    type: String,
    required: function() {
      return this.role === 'tutor';
    }
  },
  skillSet: [String],
  hourlyRate: {
    type: Number,
    min: [0, 'Hourly rate cannot be negative'],
    required: function() {
      return this.role === 'tutor';
    }
  },
  availableHours: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    startTime: String,
    endTime: String
  }],
  cv: {
    type: String, // File path
    required: function() {
      return this.role === 'tutor';
    }
  },
  isApproved: {
    type: Boolean,
    default: function() {
      return this.role !== 'tutor';
    }
  },
  googleMeetLink: {
    type: String,
    default: function() {
      if (this.role === 'tutor') {
        // Generate a unique Google Meet room ID
        return `https://meet.google.com/${this._id.toString().substring(0, 12)}`;
      }
      return null;
    }
  },
  
  // Common rating system
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  
  // Reports and moderation
  reports: [{
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    description: String,
    createdAt: { type: Date, default: Date.now }
  }],
  
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for courses taught (for tutors)
userSchema.virtual('coursesTaught', {
  ref: 'Course',
  localField: '_id',
  foreignField: 'tutor',
  justOne: false
});

// Virtual for bookings
userSchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: this.role === 'tutor' ? 'tutor' : 'student',
  justOne: false
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update timestamp
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.reports;
  if (this.role === 'tutor' && !this.isApproved) {
    delete userObject.cv;
    delete userObject.workExperience;
  }
  return userObject;
};

// Static method to find tutors
userSchema.statics.findApprovedTutors = function(filters = {}) {
  return this.find({ 
    role: 'tutor', 
    isApproved: true, 
    isActive: true,
    ...filters 
  }).populate('coursesTaught');
};

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1, isApproved: 1, isActive: 1 });
userSchema.index({ department: 1, role: 1 });

module.exports = mongoose.model('User', userSchema);
