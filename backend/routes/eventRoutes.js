const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Class = require('../models/Class');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

// Filter events based on user role
const filterEventsForUser = (events, user) => {
  return events.filter(event => {
    // Admin sees all
    if (user.role === 'admin') return true;
    
    // If no target audience, assume all
    if (!event.targetAudience || event.targetAudience.length === 0) return true;
    
    // Check if event is for 'all'
    if (event.targetAudience.includes('all')) return true;
    
    // Check direct role match
    if (event.targetAudience.includes(user.role)) return true;
    
    // Check specific class
    if (event.targetAudience.includes('specific-class') && user.class) {
      if (event.targetClasses && event.targetClasses.includes(user.class.toString())) {
        return true;
      }
    }
    
    // For teachers, check if they teach any target class
    if (user.role === 'teacher' && event.targetClasses) {
      // This would need more complex logic - simplified for now
      return false;
    }
    
    return false;
  });
};

// ==================== PUBLIC/PRIVATE ROUTES (All logged in users) ====================

router.get('/', protect, async (req, res) => {
  try {
    const { 
      eventType,
      fromDate,
      toDate,
      search,
      page = 1, 
      limit = 50 
    } = req.query;
    
    // Build filter object
    let filter = { isActive: true };
    
    if (eventType) filter.eventType = eventType;
    
    // Date range filter
    if (fromDate || toDate) {
      filter.$or = [
        {
          startDate: { $gte: fromDate ? new Date(fromDate) : new Date(0) },
          endDate: { $lte: toDate ? new Date(toDate) : new Date('2099-12-31') }
        }
      ];
    }
    
    // Text search
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const events = await Event.find(filter)
      .populate('createdBy', 'name')
      .populate('targetClasses', 'name section')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ startDate: 1 });
    
    // Filter events based on user role
    const filteredEvents = filterEventsForUser(events, req.user);
    
    const total = await Event.countDocuments(filter);
    
    res.json({
      events: filteredEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/calendar', protect, async (req, res) => {
  try {
    const { month, year } = req.query;
    
    let startDate, endDate;
    
    if (month && year) {
      // Get specific month
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0); // Last day of month
    } else {
      // Default to current month
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    
    const events = await Event.find({
      isActive: true,
      $or: [
        {
          startDate: { $gte: startDate, $lte: endDate }
        },
        {
          // Recurring events that might span across months
          isRecurring: true,
          recurrenceEndDate: { $gte: startDate }
        }
      ]
    }).populate('createdBy', 'name');
    
    // Filter for user
    const filteredEvents = filterEventsForUser(events, req.user);
    
    // Format for calendar display
    const calendarEvents = filteredEvents.map(event => ({
      id: event._id,
      title: event.title,
      start: event.allDay ? event.startDate : new Date(`${event.startDate.toISOString().split('T')[0]}T${event.startTime}`),
      end: event.allDay ? event.endDate : new Date(`${event.endDate.toISOString().split('T')[0]}T${event.endTime}`),
      allDay: event.allDay,
      color: event.color,
      type: event.eventType,
      location: event.location
    }));
    
    res.json({
      month: parseInt(month) || startDate.getMonth() + 1,
      year: parseInt(year) || startDate.getFullYear(),
      events: calendarEvents
    });
    
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/upcoming', protect, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const now = new Date();
    
    const events = await Event.find({
      isActive: true,
      endDate: { $gte: now }
    })
      .populate('createdBy', 'name')
      .sort({ startDate: 1 })
      .limit(parseInt(limit));
    
    const filteredEvents = filterEventsForUser(events, req.user);
    
    res.json({
      count: filteredEvents.length,
      events: filteredEvents
    });
    
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/today', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const events = await Event.find({
      isActive: true,
      startDate: { $gte: today, $lt: tomorrow }
    }).populate('createdBy', 'name');
    
    const filteredEvents = filterEventsForUser(events, req.user);
    
    res.json({
      date: today.toDateString(),
      count: filteredEvents.length,
      events: filteredEvents
    });
    
  } catch (error) {
    console.error('Get today events error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findById(id)
      .populate('createdBy', 'name email')
      .populate('targetClasses', 'name section grade');
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Check if user can see this event
    const filtered = filterEventsForUser([event], req.user);
    if (filtered.length === 0) {
      return res.status(403).json({ 
        message: 'Not authorized to view this event' 
      });
    }
    
    res.json({ event });
    
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== ADMIN ONLY ROUTES ====================

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { 
      title, description, eventType,
      startDate, endDate, allDay, startTime, endTime,
      location, targetAudience, targetClasses,
      color, isRecurring, recurrencePattern, recurrenceEndDate
    } = req.body;
    
    // Validate dates
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ 
        message: 'End date must be after start date' 
      });
    }
    
    // Validate times for non-allDay events
    if (!allDay && (!startTime || !endTime)) {
      return res.status(400).json({ 
        message: 'Start time and end time are required for timed events' 
      });
    }
    
    // Validate recurring events
    if (isRecurring && (!recurrencePattern || !recurrenceEndDate)) {
      return res.status(400).json({ 
        message: 'Recurring events require pattern and end date' 
      });
    }
    
    // Create event
    const event = new Event({
      title,
      description,
      eventType: eventType || 'other',
      startDate,
      endDate,
      allDay: allDay || false,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : endTime,
      location,
      targetAudience: targetAudience || ['all'],
      targetClasses,
      createdBy: req.user._id,
      color: color || '#3788d8',
      isRecurring: isRecurring || false,
      recurrencePattern: isRecurring ? recurrencePattern : undefined,
      recurrenceEndDate: isRecurring ? recurrenceEndDate : undefined
    });
    
    await event.save();
    
    const populatedEvent = await Event.findById(event._id)
      .populate('createdBy', 'name')
      .populate('targetClasses', 'name section');
    
    res.status(201).json({
      message: 'Event created successfully',
      event: populatedEvent
    });
    
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const event = await Event.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name')
      .populate('targetClasses', 'name section');
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json({
      message: 'Event updated successfully',
      event
    });
    
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json({
      message: 'Event deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/duplicate', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newStartDate, newEndDate } = req.body;
    
    const sourceEvent = await Event.findById(id);
    
    if (!sourceEvent) {
      return res.status(404).json({ message: 'Source event not found' });
    }
    
    // Create duplicate
    const newEvent = new Event({
      ...sourceEvent.toObject(),
      _id: undefined, // Remove original ID
      createdAt: undefined,
      updatedAt: undefined,
      startDate: newStartDate || sourceEvent.startDate,
      endDate: newEndDate || sourceEvent.endDate,
      isRecurring: false, // Duplicates are not recurring by default
      createdBy: req.user._id
    });
    
    await newEvent.save();
    
    res.status(201).json({
      message: 'Event duplicated successfully',
      event: newEvent
    });
    
  } catch (error) {
    console.error('Duplicate event error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;