const mongoose = require('mongoose');

const marketplaceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Item title is required'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Item description is required'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Seller is required']
  },
  category: {
    type: String,
    enum: [
      'Study Notes',
      'Textbooks',
      'Lab Reports',
      'Assignments',
      'Project Files',
      'Circuit Diagrams',
      'Software Tools',
      'Past Papers',
      'Research Papers',
      'Presentations',
      'Other'
    ],
    required: [true, 'Category is required']
  },
  department: {
    type: String,
    enum: ['CSE', 'EEE', 'BBA', 'All'],
    required: [true, 'Department is required']
  },
  course: String, // Course code or name
  semester: String,
  itemType: {
    type: String,
    enum: ['digital', 'physical'],
    required: [true, 'Item type is required']
  },
  fileFormat: String, // For digital items: pdf, docx, pptx, zip, etc.
  fileSize: Number, // In bytes for digital items
  files: [{
    name: String,
    url: String,
    size: Number,
    format: String
  }],
  images: [String], // URLs of item images
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    default: 'BDT'
  },
  condition: {
    type: String,
    enum: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
    required: function() {
      return this.itemType === 'physical';
    }
  },
  availability: {
    type: String,
    enum: ['available', 'sold', 'reserved', 'inactive'],
    default: 'available'
  },
  tags: [String], // Search tags
  views: { type: Number, default: 0 },
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    likedAt: { type: Date, default: Date.now }
  }],
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  reviews: [{
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    createdAt: { type: Date, default: Date.now }
  }],
  purchases: [{
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    purchaseDate: { type: Date, default: Date.now },
    amount: Number,
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bkash', 'nagad', 'rocket', 'bank_transfer']
    },
    deliveryStatus: {
      type: String,
      enum: ['pending', 'delivered', 'failed'],
      default: 'pending'
    },
    deliveryMethod: {
      type: String,
      enum: ['digital_download', 'email', 'meet_in_person', 'courier'],
      default: function() {
        return this.parent().itemType === 'digital' ? 'digital_download' : 'meet_in_person';
      }
    }
  }],
  location: {
    type: String,
    required: function() {
      return this.itemType === 'physical';
    }
  },
  contactInfo: {
    phone: String,
    email: String,
    preferredContact: {
      type: String,
      enum: ['phone', 'email', 'message'],
      default: 'message'
    }
  },
  reports: [{
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['inappropriate_content', 'spam', 'fake_item', 'copyright_violation', 'other']
    },
    description: String,
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
      default: 'pending'
    },
    createdAt: { type: Date, default: Date.now }
  }],
  isPromoted: { type: Boolean, default: false },
  promotedUntil: Date,
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for like count
marketplaceSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for purchase count
marketplaceSchema.virtual('purchaseCount').get(function() {
  return this.purchases.length;
});

// Virtual for seller name
marketplaceSchema.virtual('sellerName').get(function() {
  if (this.seller && this.seller.firstName && this.seller.lastName) {
    return `${this.seller.firstName} ${this.seller.lastName}`;
  }
  return 'Unknown Seller';
});

// Virtual for is digital item
marketplaceSchema.virtual('isDigital').get(function() {
  return this.itemType === 'digital';
});

// Pre-save middleware to update timestamp
marketplaceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to increment view count
marketplaceSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to toggle like
marketplaceSchema.methods.toggleLike = function(userId) {
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

// Method to check if user has liked the item
marketplaceSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Method to add purchase
marketplaceSchema.methods.addPurchase = function(buyerId, amount, paymentMethod) {
  this.purchases.push({
    buyer: buyerId,
    amount: amount,
    paymentMethod: paymentMethod
  });
  
  // Mark as sold if it's a physical item or single-use digital item
  if (this.itemType === 'physical') {
    this.availability = 'sold';
  }
  
  return this.save();
};

// Method to add review
marketplaceSchema.methods.addReview = function(buyerId, rating, comment) {
  // Check if buyer already reviewed
  const existingReview = this.reviews.find(r => 
    r.buyer.toString() === buyerId.toString()
  );
  
  if (existingReview) {
    existingReview.rating = rating;
    existingReview.comment = comment;
  } else {
    this.reviews.push({
      buyer: buyerId,
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

// Method to report item
marketplaceSchema.methods.reportItem = function(userId, reason, description) {
  this.reports.push({
    reportedBy: userId,
    reason: reason,
    description: description
  });
  
  return this.save();
};

// Static method to find items by category
marketplaceSchema.statics.findByCategory = function(category, filters = {}) {
  return this.find({ 
    category, 
    availability: 'available',
    isActive: true,
    ...filters 
  })
  .populate('seller', 'firstName lastName rating profilePicture')
  .sort({ createdAt: -1 });
};

// Static method to find items by department
marketplaceSchema.statics.findByDepartment = function(department, filters = {}) {
  return this.find({ 
    $or: [{ department }, { department: 'All' }],
    availability: 'available',
    isActive: true,
    ...filters 
  })
  .populate('seller', 'firstName lastName rating profilePicture')
  .sort({ createdAt: -1 });
};

// Static method to search items
marketplaceSchema.statics.searchItems = function(searchTerm, filters = {}) {
  const searchRegex = new RegExp(searchTerm, 'i');
  
  return this.find({
    $and: [
      {
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { tags: { $in: [searchRegex] } },
          { course: searchRegex }
        ]
      },
      { availability: 'available' },
      { isActive: true },
      filters
    ]
  })
  .populate('seller', 'firstName lastName rating profilePicture')
  .sort({ createdAt: -1 });
};

// Static method to find popular items
marketplaceSchema.statics.findPopular = function(limit = 10) {
  return this.find({ 
    availability: 'available',
    isActive: true 
  })
  .sort({ views: -1, likeCount: -1 })
  .limit(limit)
  .populate('seller', 'firstName lastName rating profilePicture');
};

// Static method to find featured items
marketplaceSchema.statics.findFeatured = function(limit = 5) {
  return this.find({ 
    isFeatured: true,
    availability: 'available',
    isActive: true 
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('seller', 'firstName lastName rating profilePicture');
};

// Index for better query performance
marketplaceSchema.index({ seller: 1, availability: 1 });
marketplaceSchema.index({ category: 1, department: 1 });
marketplaceSchema.index({ title: 'text', description: 'text', tags: 'text' });
marketplaceSchema.index({ views: -1, likeCount: -1 });
marketplaceSchema.index({ createdAt: -1 });
marketplaceSchema.index({ price: 1 });

module.exports = mongoose.model('Marketplace', marketplaceSchema);
