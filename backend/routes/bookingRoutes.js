const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

// Validation rules
const createBookingValidation = [
  body('tutorId')
    .isMongoId()
    .withMessage('Valid tutor ID is required'),
  
  body('courseId')
    .isMongoId()
    .withMessage('Valid course ID is required'),
  
  body('sessionDate')
    .isISO8601()
    .withMessage('Valid session date is required (YYYY-MM-DD format)'),
  
  body('startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid start time is required (HH:MM format)'),
  
  body('endTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid end time is required (HH:MM format)'),
  
  body('duration')
    .isInt({ min: 30 })
    .withMessage('Duration must be at least 30 minutes'),
  
  body('paymentMethod')
    .optional()
    .isIn(['cash', 'bkash', 'nagad', 'rocket', 'bank_transfer'])
    .withMessage('Invalid payment method'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Notes cannot be more than 500 characters'),
  
  body('sessionObjectives')
    .optional()
    .isArray()
    .withMessage('Session objectives must be an array')
];

const feedbackValidation = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('comment')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Comment cannot be more than 1000 characters')
];

// Public route to check tutor availability
router.get('/availability/:tutorId', bookingController.getTutorAvailability);

// All other routes require authentication
router.use(authenticate);

// Get user's bookings (student or tutor)
router.get('/', bookingController.getUserBookings);

// Get upcoming bookings
router.get('/upcoming', bookingController.getUpcomingBookings);

// Create a booking (students only)
router.post(
  '/', 
  authorize('student'),
  createBookingValidation,
  bookingController.createBooking
);

// Confirm booking (tutors only)
router.put(
  '/:bookingId/confirm',
  authorize('tutor'),
  bookingController.confirmBooking
);

// Cancel booking (student or tutor)
router.put(
  '/:bookingId/cancel',
  body('reason').optional().isLength({ max: 500 }).withMessage('Reason cannot be more than 500 characters'),
  bookingController.cancelBooking
);

// Complete booking (tutors only)
router.put(
  '/:bookingId/complete',
  authorize('tutor'),
  bookingController.completeBooking
);

// Add feedback to booking
router.post(
  '/:bookingId/feedback',
  feedbackValidation,
  bookingController.addBookingFeedback
);

module.exports = router;
