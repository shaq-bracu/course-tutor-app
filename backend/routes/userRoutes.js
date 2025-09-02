const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

// Validation rules
const reportUserValidation = [
  body('reason')
    .isIn(['inappropriate_behavior', 'scam', 'harassment', 'fake_profile', 'other'])
    .withMessage('Invalid report reason'),
  
  body('description')
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters')
];

// Public routes
router.get('/tutors', userController.getApprovedTutors);
router.get('/tutors/:tutorId', userController.getTutorById);

// Protected routes
router.use(authenticate);

// Get user by ID (self or admin only)
router.get('/:userId', userController.getUserById);

// Report user
router.post(
  '/:userId/report', 
  reportUserValidation,
  userController.reportUser
);

// Admin only routes
router.get('/', authenticate, authorize('admin'), userController.getAllUsers);
router.get('/pending/tutors', authenticate, authorize('admin'), userController.getPendingTutors);
router.get('/stats/overview', authenticate, authorize('admin'), userController.getUserStats);

router.put(
  '/:tutorId/approve', 
  authenticate, 
  authorize('admin'),
  body('approved').isBoolean().withMessage('Approved must be a boolean'),
  userController.approveTutor
);

router.put(
  '/:userId/toggle-status', 
  authenticate, 
  authorize('admin'),
  userController.toggleUserStatus
);

module.exports = router;
