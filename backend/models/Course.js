const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
    maxlength: [100, 'Course title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Course description is required'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  tutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tutor is required']
  },
  department: {
    type: String,
    enum: ['CSE', 'EEE', 'BBA'],
    required: [true, 'Department is required']
  },
  category: {
    type: String,
    enum: [
      'Programming',
      'Data Structures',
      'Algorithms',
      'Database',
      'Web Development',
      'Mobile Development',
      'Electronics',
      'Circuit Design',
      'Signal Processing',
      'Power Systems',
      'Marketing',
      'Finance',
      'Management',
      'Accounting',
      'Business Strategy',
      'Economics'
    ],
    required: [true, 'Category is required']
  },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    required: [true, 'Course level is required']
  },
  price: {
    type: Number,
    required: [true, 'Course price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    default: 'BDT'
  },
  duration: {
    type: Number, // Duration in hours
    required: [true, 'Course duration is required'],
    min: [1, 'Duration must be at least 1 hour']
  },
  maxStudents: {
    type: Number,
    default: 10,
    min: [1, 'Maximum students must be at least 1'],
    max: [50, 'Maximum students cannot exceed 50']
  },
  enrolledStudents: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    enrolledAt: { type: Date, default: Date.now },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    completedSessions: { type: Number, default: 0 },
    lastAccessed: Date
  }],
  syllabus: [{
    topic: { type: String, required: true },
    description: String,
    estimatedHours: { type: Number, min: 0 },
    completed: { type: Boolean, default: false }
  }],
  schedule: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    startTime: String,
    endTime: String,
    recurring: { type: Boolean, default: true }
  }],
  resources: [{
    title: String,
    type: {
      type: String,
      enum: ['pdf', 'video', 'link', 'document']
    },
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  assignments: [{
    title: String,
    description: String,
    dueDate: Date,
    maxMarks: { type: Number, default: 100 },
    submissions: [{
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      fileUrl: String,
      submittedAt: { type: Date, default: Date.now },
      marks: Number,
      feedback: String,
      graded: { type: Boolean, default: false }
    }]
  }],
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  reviews: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    createdAt: { type: Date, default: Date.now }
  }],
  prerequisites: [String],
  learningOutcomes: [String],
  tags: [String],
  thumbnail: String, // Course thumbnail image URL
  status: {
    type: String,
    enum: ['active', 'inactive', 'completed', 'cancelled'],
    default: 'active'
  },
  startDate: Date,
  endDate: Date,
  meetingLink: String, // Google Meet or other video conferencing link
  isPublic: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for enrollment count
courseSchema.virtual('enrollmentCount').get(function() {
  return this.enrolledStudents.length;
});

// Virtual for available spots
courseSchema.virtual('availableSpots').get(function() {
  return this.maxStudents - this.enrolledStudents.length;
});

// Virtual for average progress
courseSchema.virtual('averageProgress').get(function() {
  if (this.enrolledStudents.length === 0) return 0;
  const totalProgress = this.enrolledStudents.reduce((sum, student) => sum + student.progress, 0);
  return Math.round(totalProgress / this.enrolledStudents.length);
});

// Pre-save middleware to update timestamp
courseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if student is enrolled
courseSchema.methods.isStudentEnrolled = function(studentId) {
  return this.enrolledStudents.some(enrollment => 
    enrollment.student.toString() === studentId.toString()
  );
};

// Method to enroll student
courseSchema.methods.enrollStudent = function(studentId) {
  if (this.isStudentEnrolled(studentId)) {
    throw new Error('Student is already enrolled in this course');
  }
  if (this.enrolledStudents.length >= this.maxStudents) {
    throw new Error('Course is full');
  }
  
  this.enrolledStudents.push({
    student: studentId,
    enrolledAt: new Date()
  });
  
  return this.save();
};

// Method to update student progress
courseSchema.methods.updateStudentProgress = function(studentId, progress) {
  const enrollment = this.enrolledStudents.find(e => 
    e.student.toString() === studentId.toString()
  );
  
  if (!enrollment) {
    throw new Error('Student is not enrolled in this course');
  }
  
  enrollment.progress = Math.max(0, Math.min(100, progress));
  enrollment.lastAccessed = new Date();
  
  return this.save();
};

// Method to add review
courseSchema.methods.addReview = function(studentId, rating, comment) {
  // Check if student already reviewed
  const existingReview = this.reviews.find(r => 
    r.student.toString() === studentId.toString()
  );
  
  if (existingReview) {
    existingReview.rating = rating;
    existingReview.comment = comment;
  } else {
    this.reviews.push({
      student: studentId,
      rating: rating,
      comment: comment
    });
  }
  
  // Recalculate average rating
  const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
  this.rating.average = totalRating / this.reviews.length;
  this.rating.count = this.reviews.length;
  
  return this.save();
};

// Static method to find courses by department
courseSchema.statics.findByDepartment = function(department, filters = {}) {
  return this.find({ 
    department, 
    status: 'active', 
    isPublic: true,
    ...filters 
  }).populate('tutor', 'firstName lastName rating');
};

// Static method to find popular courses
courseSchema.statics.findPopular = function(limit = 10) {
  return this.find({ 
    status: 'active', 
    isPublic: true 
  })
  .sort({ 'rating.average': -1, enrollmentCount: -1 })
  .limit(limit)
  .populate('tutor', 'firstName lastName rating');
};

// Index for better query performance
courseSchema.index({ tutor: 1, status: 1 });
courseSchema.index({ department: 1, category: 1 });
courseSchema.index({ 'rating.average': -1, enrollmentCount: -1 });
courseSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Course', courseSchema);
