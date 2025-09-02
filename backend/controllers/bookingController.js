const { validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Course = require('../models/Course');

// Get available time slots for a tutor
const getTutorAvailability = async (req, res) => {
  try {
    const { tutorId } = req.params;
    const { date } = req.query; // Format: YYYY-MM-DD

    // Find the tutor and their available hours
    const tutor = await User.findById(tutorId);
    if (!tutor || tutor.role !== 'tutor' || !tutor.isApproved) {
      return res.status(404).json({ message: 'Tutor not found or not approved' });
    }

    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });

    // Get tutor's available hours for this day
    const dayAvailability = tutor.availableHours.find(ah => ah.day === dayOfWeek);
    if (!dayAvailability) {
      return res.json({
        tutorId,
        date,
        dayOfWeek,
        availableSlots: [],
        message: 'Tutor is not available on this day'
      });
    }

    // Get existing bookings for this date
    const existingBookings = await Booking.find({
      tutor: tutorId,
      sessionDate: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      },
      status: { $in: ['confirmed', 'in-progress'] }
    });

    // Generate time slots (30-minute intervals)
    const availableSlots = generateTimeSlots(
      dayAvailability.startTime,
      dayAvailability.endTime,
      existingBookings,
      30 // 30-minute slots
    );

    res.json({
      tutorId,
      tutorName: `${tutor.firstName} ${tutor.lastName}`,
      hourlyRate: tutor.hourlyRate,
      date,
      dayOfWeek,
      availableSlots,
      totalSlots: availableSlots.length
    });

  } catch (error) {
    console.error('Get tutor availability error:', error);
    res.status(500).json({
      message: 'Failed to get tutor availability',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Helper function to generate time slots
const generateTimeSlots = (startTime, endTime, existingBookings, intervalMinutes) => {
  const slots = [];
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  
  let current = start;
  
  while (current < end) {
    const slotStart = formatTime(current);
    const slotEnd = formatTime(current + intervalMinutes);
    
    // Check if this slot conflicts with existing bookings
    const isBooked = existingBookings.some(booking => {
      const bookingStart = parseTime(booking.startTime);
      const bookingEnd = parseTime(booking.endTime);
      return current < bookingEnd && (current + intervalMinutes) > bookingStart;
    });
    
    if (!isBooked && (current + intervalMinutes) <= end) {
      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        duration: intervalMinutes,
        available: true
      });
    }
    
    current += intervalMinutes;
  }
  
  return slots;
};

// Helper functions for time parsing
const parseTime = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

const formatTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Create a booking
const createBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      tutorId,
      courseId,
      sessionDate,
      startTime,
      endTime,
      duration, // in minutes
      paymentMethod,
      notes,
      sessionObjectives
    } = req.body;

    const studentId = req.user._id;

    // Verify tutor exists and is approved
    const tutor = await User.findById(tutorId);
    if (!tutor || tutor.role !== 'tutor' || !tutor.isApproved) {
      return res.status(404).json({ message: 'Tutor not found or not approved' });
    }

    // Verify course exists and belongs to the tutor
    const course = await Course.findById(courseId);
    if (!course || course.tutor.toString() !== tutorId) {
      return res.status(404).json({ message: 'Course not found or does not belong to this tutor' });
    }

    // Check if the time slot is still available
    const requestedDate = new Date(sessionDate);
    const dayOfWeek = requestedDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Verify tutor availability for this day
    const dayAvailability = tutor.availableHours.find(ah => ah.day === dayOfWeek);
    if (!dayAvailability) {
      return res.status(400).json({ message: 'Tutor is not available on this day' });
    }

    // Check if requested time is within tutor's available hours
    const requestedStartMinutes = parseTime(startTime);
    const requestedEndMinutes = parseTime(endTime);
    const availableStartMinutes = parseTime(dayAvailability.startTime);
    const availableEndMinutes = parseTime(dayAvailability.endTime);

    if (requestedStartMinutes < availableStartMinutes || requestedEndMinutes > availableEndMinutes) {
      return res.status(400).json({ 
        message: 'Requested time is outside tutor\'s available hours' 
      });
    }

    // Check for conflicting bookings
    const conflictingBooking = await Booking.findOne({
      tutor: tutorId,
      sessionDate: {
        $gte: new Date(sessionDate + 'T00:00:00.000Z'),
        $lt: new Date(sessionDate + 'T23:59:59.999Z')
      },
      status: { $in: ['confirmed', 'in-progress'] },
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime }
        }
      ]
    });

    if (conflictingBooking) {
      return res.status(409).json({ 
        message: 'This time slot is already booked. Please choose another time.' 
      });
    }

    // Calculate total amount
    const durationHours = duration / 60;
    const totalAmount = Math.round(tutor.hourlyRate * durationHours);

    // Create the booking
    const booking = new Booking({
      student: studentId,
      tutor: tutorId,
      course: courseId,
      sessionDate: new Date(sessionDate),
      startTime,
      endTime,
      duration,
      totalAmount,
      paymentMethod: paymentMethod || 'cash',
      notes,
      sessionObjectives: Array.isArray(sessionObjectives) ? sessionObjectives : [],
      meetingLink: tutor.googleMeetLink || `https://meet.google.com/${tutor._id.toString().substring(0, 12)}`,
      status: 'pending'
    });

    await booking.save();

    // Populate the booking with user and course details
    await booking.populate([
      { path: 'student', select: 'firstName lastName email profilePicture' },
      { path: 'tutor', select: 'firstName lastName email profilePicture hourlyRate' },
      { path: 'course', select: 'title description' }
    ]);

    res.status(201).json({
      message: 'Booking created successfully! Waiting for tutor confirmation.',
      booking: booking
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      message: 'Failed to create booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get user's bookings (student or tutor)
const getUserBookings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, limit = 10, skip = 0 } = req.query;
    
    const filter = {};
    if (req.user.role === 'student') {
      filter.student = userId;
    } else if (req.user.role === 'tutor') {
      filter.tutor = userId;
    }
    
    if (status) {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .populate('student', 'firstName lastName email profilePicture')
      .populate('tutor', 'firstName lastName email profilePicture hourlyRate')
      .populate('course', 'title description')
      .sort({ sessionDate: -1, startTime: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const totalBookings = await Booking.countDocuments(filter);

    res.json({
      bookings,
      totalBookings,
      hasMore: (parseInt(skip) + parseInt(limit)) < totalBookings
    });

  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({
      message: 'Failed to get bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get upcoming bookings
const getUpcomingBookings = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    
    const bookings = await Booking.findUpcoming(userId, userRole);
    
    res.json({ bookings });

  } catch (error) {
    console.error('Get upcoming bookings error:', error);
    res.status(500).json({
      message: 'Failed to get upcoming bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Confirm booking (tutor only)
const confirmBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const tutorId = req.user._id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Verify this booking belongs to the tutor
    if (booking.tutor.toString() !== tutorId.toString()) {
      return res.status(403).json({ message: 'Not authorized to confirm this booking' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending bookings can be confirmed' });
    }

    await booking.confirm();
    await booking.populate([
      { path: 'student', select: 'firstName lastName email' },
      { path: 'course', select: 'title' }
    ]);

    res.json({
      message: 'Booking confirmed successfully',
      booking
    });

  } catch (error) {
    console.error('Confirm booking error:', error);
    res.status(500).json({
      message: 'Failed to confirm booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Verify user can cancel this booking
    const canCancel = booking.student.toString() === userId.toString() || 
                     booking.tutor.toString() === userId.toString();
    
    if (!canCancel) {
      return res.status(403).json({ message: 'Not authorized to cancel this booking' });
    }

    // Calculate refund amount based on cancellation time
    const now = new Date();
    const sessionDateTime = new Date(booking.sessionDate);
    const hoursUntilSession = (sessionDateTime - now) / (1000 * 60 * 60);
    
    let refundAmount = 0;
    if (hoursUntilSession > 24) {
      refundAmount = booking.totalAmount; // Full refund if cancelled 24+ hours before
    } else if (hoursUntilSession > 2) {
      refundAmount = booking.totalAmount * 0.5; // 50% refund if cancelled 2-24 hours before
    }
    // No refund if cancelled less than 2 hours before

    await booking.cancel(reason, refundAmount);

    res.json({
      message: 'Booking cancelled successfully',
      refundAmount,
      booking
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      message: 'Failed to cancel booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Complete booking session
const completeBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const tutorId = req.user._id;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Only tutor can mark session as complete
    if (booking.tutor.toString() !== tutorId.toString()) {
      return res.status(403).json({ message: 'Only tutor can mark session as complete' });
    }

    await booking.complete();

    res.json({
      message: 'Booking marked as completed',
      booking
    });

  } catch (error) {
    console.error('Complete booking error:', error);
    res.status(500).json({
      message: 'Failed to complete booking',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Add feedback to booking
const addBookingFeedback = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Verify user is part of this booking
    const isParticipant = booking.student.toString() === userId.toString() || 
                         booking.tutor.toString() === userId.toString();
    
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to add feedback to this booking' });
    }

    await booking.addFeedback(userId, userRole, rating, comment);

    res.json({
      message: 'Feedback added successfully',
      booking
    });

  } catch (error) {
    console.error('Add booking feedback error:', error);
    res.status(500).json({
      message: 'Failed to add feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  getTutorAvailability,
  createBooking,
  getUserBookings,
  getUpcomingBookings,
  confirmBooking,
  cancelBooking,
  completeBooking,
  addBookingFeedback
};
