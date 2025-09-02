const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student is required']
  },
  tutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tutor is required']
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course is required']
  },
  sessionDate: {
    type: Date,
    required: [true, 'Session date is required']
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required']
  },
  endTime: {
    type: String,
    required: [true, 'End time is required']
  },
  duration: {
    type: Number, // Duration in minutes
    required: [true, 'Duration is required'],
    min: [30, 'Minimum session duration is 30 minutes']
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    default: 'BDT'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bkash', 'nagad', 'rocket', 'bank_transfer'],
    default: 'cash'
  },
  paymentReference: String,
  meetingLink: String, // Google Meet or other video conferencing link
  meetingId: String,
  notes: String, // Special instructions or notes from student
  tutorNotes: String, // Notes from tutor about the session
  sessionObjectives: [String], // What the student wants to learn
  sessionMaterials: [String], // Materials/resources used in the session
  homework: [{
    task: String,
    dueDate: Date,
    completed: { type: Boolean, default: false }
  }],
  feedback: {
    studentFeedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      submittedAt: Date
    },
    tutorFeedback: {
      studentRating: { type: Number, min: 1, max: 5 },
      comment: String,
      submittedAt: Date
    }
  },
  attendance: {
    studentJoined: { type: Boolean, default: false },
    tutorJoined: { type: Boolean, default: false },
    studentJoinTime: Date,
    tutorJoinTime: Date,
    sessionEndTime: Date
  },
  rescheduleHistory: [{
    oldDate: Date,
    newDate: Date,
    oldStartTime: String,
    newStartTime: String,
    reason: String,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    requestedAt: { type: Date, default: Date.now }
  }],
  cancellationReason: String,
  refundAmount: { type: Number, default: 0 },
  refundReason: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for session duration in hours
bookingSchema.virtual('durationHours').get(function() {
  return this.duration / 60;
});

// Virtual for is session upcoming
bookingSchema.virtual('isUpcoming').get(function() {
  const now = new Date();
  const sessionDateTime = new Date(this.sessionDate);
  const [hours, minutes] = this.startTime.split(':');
  sessionDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  return sessionDateTime > now && this.status !== 'cancelled' && this.status !== 'completed';
});

// Virtual for is session overdue
bookingSchema.virtual('isOverdue').get(function() {
  const now = new Date();
  const sessionDateTime = new Date(this.sessionDate);
  const [hours, minutes] = this.endTime.split(':');
  sessionDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  return sessionDateTime < now && this.status === 'confirmed';
});

// Pre-save middleware to update timestamp
bookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to calculate total amount based on duration and tutor's hourly rate
bookingSchema.methods.calculateAmount = async function() {
  await this.populate('tutor');
  const hourlyRate = this.tutor.hourlyRate;
  const hours = this.duration / 60;
  this.totalAmount = Math.round(hourlyRate * hours);
  return this.totalAmount;
};

// Method to confirm booking
bookingSchema.methods.confirm = function() {
  if (this.status !== 'pending') {
    throw new Error('Only pending bookings can be confirmed');
  }
  this.status = 'confirmed';
  return this.save();
};

// Method to cancel booking
bookingSchema.methods.cancel = function(reason, refundAmount = 0) {
  if (this.status === 'completed' || this.status === 'cancelled') {
    throw new Error('Cannot cancel completed or already cancelled bookings');
  }
  
  this.status = 'cancelled';
  this.cancellationReason = reason;
  
  if (refundAmount > 0) {
    this.refundAmount = refundAmount;
    this.paymentStatus = 'refunded';
  }
  
  return this.save();
};

// Method to reschedule booking
bookingSchema.methods.reschedule = function(newDate, newStartTime, newEndTime, reason, requestedBy) {
  if (this.status === 'completed' || this.status === 'cancelled') {
    throw new Error('Cannot reschedule completed or cancelled bookings');
  }
  
  // Add to reschedule history
  this.rescheduleHistory.push({
    oldDate: this.sessionDate,
    newDate: newDate,
    oldStartTime: this.startTime,
    newStartTime: newStartTime,
    reason: reason,
    requestedBy: requestedBy
  });
  
  // Update booking details
  this.sessionDate = newDate;
  this.startTime = newStartTime;
  this.endTime = newEndTime;
  
  return this.save();
};

// Method to mark session as completed
bookingSchema.methods.complete = function() {
  if (this.status !== 'confirmed' && this.status !== 'in-progress') {
    throw new Error('Only confirmed or in-progress sessions can be completed');
  }
  
  this.status = 'completed';
  this.attendance.sessionEndTime = new Date();
  
  return this.save();
};

// Method to add feedback
bookingSchema.methods.addFeedback = function(userId, userRole, rating, comment) {
  if (this.status !== 'completed') {
    throw new Error('Feedback can only be added after session completion');
  }
  
  if (userRole === 'student') {
    this.feedback.studentFeedback = {
      rating: rating,
      comment: comment,
      submittedAt: new Date()
    };
  } else if (userRole === 'tutor') {
    this.feedback.tutorFeedback = {
      studentRating: rating,
      comment: comment,
      submittedAt: new Date()
    };
  }
  
  return this.save();
};

// Static method to find upcoming bookings
bookingSchema.statics.findUpcoming = function(userId, userRole) {
  const filter = {
    [userRole]: userId,
    status: { $in: ['confirmed', 'in-progress'] },
    sessionDate: { $gte: new Date() }
  };
  
  return this.find(filter)
    .populate('student', 'firstName lastName email profilePicture')
    .populate('tutor', 'firstName lastName email profilePicture')
    .populate('course', 'title')
    .sort({ sessionDate: 1, startTime: 1 });
};

// Static method to find booking history
bookingSchema.statics.findHistory = function(userId, userRole, limit = 50) {
  const filter = { [userRole]: userId };
  
  return this.find(filter)
    .populate('student', 'firstName lastName email profilePicture')
    .populate('tutor', 'firstName lastName email profilePicture')
    .populate('course', 'title')
    .sort({ sessionDate: -1, startTime: -1 })
    .limit(limit);
};

// Index for better query performance
bookingSchema.index({ student: 1, sessionDate: 1 });
bookingSchema.index({ tutor: 1, sessionDate: 1 });
bookingSchema.index({ status: 1, sessionDate: 1 });
bookingSchema.index({ course: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
