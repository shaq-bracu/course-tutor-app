const express = require('express');
const { authenticate, requireApprovedTutor } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', (req, res) => {
  res.json({ message: 'Get all courses endpoint - to be implemented' });
});

router.get('/:id', (req, res) => {
  res.json({ message: 'Get course by ID endpoint - to be implemented' });
});

// Protected routes
router.post('/', authenticate, requireApprovedTutor, (req, res) => {
  res.json({ message: 'Create course endpoint - to be implemented' });
});

router.put('/:id', authenticate, (req, res) => {
  res.json({ message: 'Update course endpoint - to be implemented' });
});

router.delete('/:id', authenticate, (req, res) => {
  res.json({ message: 'Delete course endpoint - to be implemented' });
});

router.post('/:id/enroll', authenticate, (req, res) => {
  res.json({ message: 'Enroll in course endpoint - to be implemented' });
});

router.post('/:id/review', authenticate, (req, res) => {
  res.json({ message: 'Add course review endpoint - to be implemented' });
});

module.exports = router;
