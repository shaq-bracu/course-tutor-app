const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required']
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Receiver is required']
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [1000, 'Message cannot be more than 1000 characters']
  },
  messageType: {
    type: String,
    enum: ['text', 'file', 'image', 'voice', 'video'],
    default: 'text'
  },
  fileUrl: String, // For file, image, voice, video messages
  fileName: String,
  fileSize: Number,
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking' // Optional: link message to a specific booking
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message' // For reply functionality
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  originalContent: String, // Store original content if edited
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for conversation ID (used for grouping messages)
messageSchema.virtual('conversationId').get(function() {
  const participants = [this.sender.toString(), this.receiver.toString()].sort();
  return participants.join('_');
});

// Pre-save middleware to update timestamp
messageSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to mark message as read
messageSchema.methods.markAsRead = function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to edit message
messageSchema.methods.editMessage = function(newContent) {
  if (this.isDeleted) {
    throw new Error('Cannot edit deleted message');
  }
  
  this.originalContent = this.content;
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  
  return this.save();
};

// Method to delete message
messageSchema.methods.deleteMessage = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.content = 'This message has been deleted';
  
  return this.save();
};

// Static method to find conversation between two users
messageSchema.statics.findConversation = function(userId1, userId2, limit = 50, skip = 0) {
  return this.find({
    $or: [
      { sender: userId1, receiver: userId2 },
      { sender: userId2, receiver: userId1 }
    ]
  })
  .populate('sender', 'firstName lastName profilePicture')
  .populate('receiver', 'firstName lastName profilePicture')
  .populate('replyTo')
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(skip);
};

// Static method to find all conversations for a user
messageSchema.statics.findUserConversations = function(userId) {
  return this.aggregate([
    {
      $match: {
        $or: [
          { sender: new mongoose.Types.ObjectId(userId) },
          { receiver: new mongoose.Types.ObjectId(userId) }
        ],
        isDeleted: false
      }
    },
    {
      $addFields: {
        otherParticipant: {
          $cond: {
            if: { $eq: ['$sender', new mongoose.Types.ObjectId(userId)] },
            then: '$receiver',
            else: '$sender'
          }
        }
      }
    },
    {
      $sort: { createdAt: -1 }
    },
    {
      $group: {
        _id: '$otherParticipant',
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$receiver', new mongoose.Types.ObjectId(userId)] },
                  { $eq: ['$isRead', false] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'participant'
      }
    },
    {
      $unwind: '$participant'
    },
    {
      $project: {
        _id: 1,
        participant: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          profilePicture: 1,
          role: 1
        },
        lastMessage: {
          _id: 1,
          content: 1,
          messageType: 1,
          createdAt: 1,
          isRead: 1,
          sender: 1
        },
        unreadCount: 1
      }
    },
    {
      $sort: { 'lastMessage.createdAt': -1 }
    }
  ]);
};

// Static method to get unread message count for a user
messageSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    receiver: userId,
    isRead: false,
    isDeleted: false
  });
};

// Static method to mark all messages as read in a conversation
messageSchema.statics.markConversationAsRead = function(userId, otherUserId) {
  return this.updateMany(
    {
      sender: otherUserId,
      receiver: userId,
      isRead: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

// Index for better query performance
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ booking: 1 });

module.exports = mongoose.model('Message', messageSchema);
