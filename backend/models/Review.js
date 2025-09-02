const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Reviewer is required']
  },
  reviewType: {
    type: String,
    enum: ['tutor', 'course', 'marketplace'],
    required: [true, 'Review type is required']
  },
  tutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.reviewType === 'tutor';
    }
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: function() {
      return this.reviewType === 'course';
    }
  },
  marketplaceItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Marketplace',
    required: function() {
      return this.reviewType === 'marketplace';
    }
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking' // Optional: link review to a specific booking
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot be more than 5']
  },
  title: {
    type: String,
    maxlength: [100, 'Review title cannot be more than 100 characters']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    maxlength: [1000, 'Review comment cannot be more than 1000 characters']
  },
  
  // Detailed ratings for tutors
  teachingQuality: {
    type: Number,
    min: 1,
    max: 5,
    required: function() {
      return this.reviewType === 'tutor';
    }
  },
  communication: {
    type: Number,
    min: 1,
    max: 5,
    required: function() {
      return this.reviewType === 'tutor';
    }
  },
  punctuality: {
    type: Number,
    min: 1,
    max: 5,
    required: function() {
      return this.reviewType === 'tutor';
    }
  },
  helpfulness: {
    type: Number,
    min: 1,
    max: 5,
    required: function() {
      return this.reviewType === 'tutor';
    }
  },
  
  // Detailed ratings for courses
  contentQuality: {
    type: Number,
    min: 1,
    max: 5,
    required: function() {
      return this.reviewType === 'course';
    }
  },
  difficulty: {
    type: Number,
    min: 1,
    max: 5,
    required: function() {
      return this.reviewType === 'course';
    }
  },
  valueForMoney: {
    type: Number,
    min: 1,
    max: 5,
    required: function() {
      return this.reviewType === 'course' || this.reviewType === 'marketplace';
    }
  },
  
  // For marketplace items
  itemCondition: {
    type: Number,
    min: 1,
    max: 5,
    required: function() {
      return this.reviewType === 'marketplace';
    }
  },
  sellerCommunication: {
    type: Number,
    min: 1,
    max: 5,
    required: function() {
      return this.reviewType === 'marketplace';
    }
  },
  deliverySpeed: {
    type: Number,
    min: 1,
    max: 5,
    required: function() {
      return this.reviewType === 'marketplace';
    }
  },
  
  pros: [String], // Array of positive aspects
  cons: [String], // Array of negative aspects
  
  wouldRecommend: {
    type: Boolean,
    required: true
  },
  
  isAnonymous: {
    type: Boolean,
    default: false
  },
  
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    likedAt: { type: Date, default: Date.now }
  }],
  
  replies: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: {
      type: String,
      maxlength: [500, 'Reply cannot be more than 500 characters']
    },
    createdAt: { type: Date, default: Date.now }
  }],
  
  isVerified: {
    type: Boolean,
    default: false // True if the reviewer actually used the service/bought the item
  },
  
  reports: [{
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['inappropriate_content', 'spam', 'fake_review', 'offensive_language', 'other']
    },
    description: String,
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending'
    },
    createdAt: { type: Date, default: Date.now }
  }],
  
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'approved'
  },
  
  moderationNotes: String,
  
  isHelpful: { type: Number, default: 0 }, // Count of helpful votes
  isNotHelpful: { type: Number, default: 0 }, // Count of not helpful votes
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for like count
reviewSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for helpfulness score
reviewSchema.virtual('helpfulnessScore').get(function() {
  const total = this.isHelpful + this.isNotHelpful;
  if (total === 0) return 0;
  return (this.isHelpful / total) * 100;
});

// Virtual for reviewer display name
reviewSchema.virtual('reviewerDisplayName').get(function() {
  if (this.isAnonymous) return 'Anonymous';
  if (this.reviewer && this.reviewer.firstName && this.reviewer.lastName) {
    return `${this.reviewer.firstName} ${this.reviewer.lastName}`;
  }
  return 'Unknown User';
});

// Pre-save middleware to update timestamp and calculate overall rating
reviewSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Calculate overall rating based on detailed ratings
  if (this.reviewType === 'tutor') {
    const ratings = [this.teachingQuality, this.communication, this.punctuality, this.helpfulness];
    this.rating = Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length);
  } else if (this.reviewType === 'course') {
    const ratings = [this.contentQuality, this.difficulty, this.valueForMoney];
    this.rating = Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length);
  } else if (this.reviewType === 'marketplace') {
    const ratings = [this.itemCondition, this.sellerCommunication, this.deliverySpeed, this.valueForMoney];
    this.rating = Math.round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length);
  }
  
  next();
});

// Method to toggle like
reviewSchema.methods.toggleLike = function(userId) {
  const existingLikeIndex = this.likes.findIndex(like => 
    like.user.toString() === userId.toString()
  );
  
  if (existingLikeIndex > -1) {
    this.likes.splice(existingLikeIndex, 1);
  } else {
    this.likes.push({ user: userId });
  }
  
  return this.save();
};

// Method to add reply
reviewSchema.methods.addReply = function(userId, message) {
  this.replies.push({
    user: userId,
    message: message
  });
  
  return this.save();
};

// Method to mark as helpful/not helpful
reviewSchema.methods.markHelpful = function(isHelpful = true) {
  if (isHelpful) {
    this.isHelpful += 1;
  } else {
    this.isNotHelpful += 1;
  }
  
  return this.save();
};

// Method to report review
reviewSchema.methods.reportReview = function(userId, reason, description) {
  this.reports.push({
    reportedBy: userId,
    reason: reason,
    description: description
  });
  
  return this.save();
};

// Static method to find reviews for a tutor
reviewSchema.statics.findForTutor = function(tutorId, limit = 20) {
  return this.find({ 
    tutor: tutorId,
    reviewType: 'tutor',
    moderationStatus: 'approved'
  })
  .populate('reviewer', 'firstName lastName profilePicture')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Static method to find reviews for a course
reviewSchema.statics.findForCourse = function(courseId, limit = 20) {
  return this.find({ 
    course: courseId,
    reviewType: 'course',
    moderationStatus: 'approved'
  })
  .populate('reviewer', 'firstName lastName profilePicture')
  .sort({ createdAt: -1 })
  .limit(limit);
};

// Static method to calculate average ratings
reviewSchema.statics.calculateAverageRatings = function(targetId, reviewType) {
  const matchQuery = { moderationStatus: 'approved' };
  matchQuery[reviewType === 'tutor' ? 'tutor' : reviewType === 'course' ? 'course' : 'marketplaceItem'] = targetId;
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ...(reviewType === 'tutor' && {
          avgTeachingQuality: { $avg: '$teachingQuality' },
          avgCommunication: { $avg: '$communication' },
          avgPunctuality: { $avg: '$punctuality' },
          avgHelpfulness: { $avg: '$helpfulness' }
        }),
        ...(reviewType === 'course' && {
          avgContentQuality: { $avg: '$contentQuality' },
          avgDifficulty: { $avg: '$difficulty' },
          avgValueForMoney: { $avg: '$valueForMoney' }
        }),
        ...(reviewType === 'marketplace' && {
          avgItemCondition: { $avg: '$itemCondition' },
          avgSellerCommunication: { $avg: '$sellerCommunication' },
          avgDeliverySpeed: { $avg: '$deliverySpeed' },
          avgValueForMoney: { $avg: '$valueForMoney' }
        })
      }
    }
  ]);
};

// Index for better query performance
reviewSchema.index({ tutor: 1, reviewType: 1, moderationStatus: 1 });
reviewSchema.index({ course: 1, reviewType: 1, moderationStatus: 1 });
reviewSchema.index({ marketplaceItem: 1, reviewType: 1, moderationStatus: 1 });
reviewSchema.index({ reviewer: 1 });
reviewSchema.index({ createdAt: -1 });
reviewSchema.index({ rating: -1 });

module.exports = mongoose.model('Review', reviewSchema);
