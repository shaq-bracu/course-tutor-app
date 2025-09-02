const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate, rateLimit } = require('../middleware/auth');
const { uploadConfig, handleUploadError, cleanupOnError } = require('../middleware/upload');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('role')
    .optional()
    .isIn(['student', 'tutor'])
    .withMessage('Role must be either student or tutor'),
  
  body('department')
    .if(body('role').isIn(['student', 'tutor']))
    .isIn(['CSE', 'EEE', 'BBA'])
    .withMessage('Department must be CSE, EEE, or BBA'),
  
  body('cgpa')
    .if(body('role').isIn(['student', 'tutor']))
    .isFloat({ min: 0, max: 4 })
    .withMessage('CGPA must be between 0 and 4'),
  
  body('yearOfStudy')
    .if(body('role').equals('student'))
    .isInt({ min: 1, max: 4 })
    .withMessage('Year of study must be between 1 and 4'),
  
  body('workExperience')
    .if(body('role').equals('tutor'))
    .notEmpty()
    .withMessage('Work experience is required for tutors'),
  
  body('hourlyRate')
    .if(body('role').equals('tutor'))
    .isFloat({ min: 100 })
    .withMessage('Hourly rate must be at least 100 BDT'),
  
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please enter a valid phone number')
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please enter a valid phone number'),
  
  body('cgpa')
    .optional()
    .isFloat({ min: 0, max: 4 })
    .withMessage('CGPA must be between 0 and 4'),
  
  body('hourlyRate')
    .optional()
    .isFloat({ min: 100 })
    .withMessage('Hourly rate must be at least 100 BDT')
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    })
];

// Routes
router.post(
  '/register',
  rateLimit(3, 10 * 60 * 1000), // 3 attempts per 10 minutes
  uploadConfig.cv,
  cleanupOnError,
  registerValidation,
  handleUploadError,
  authController.register
);

router.post(
  '/login',
  rateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  loginValidation,
  authController.login
);

router.post(
  '/admin-login',
  rateLimit(3, 10 * 60 * 1000), // 3 attempts per 10 minutes
  authController.adminLogin
);

router.get('/profile', authenticate, authController.getProfile);

router.put(
  '/profile',
  authenticate,
  uploadConfig.profilePicture,
  cleanupOnError,
  updateProfileValidation,
  handleUploadError,
  authController.updateProfile
);

router.put(
  '/change-password',
  authenticate,
  rateLimit(3, 60 * 60 * 1000), // 3 attempts per hour
  changePasswordValidation,
  authController.changePassword
);

router.post('/refresh-token', authenticate, authController.refreshToken);

module.exports = router;
