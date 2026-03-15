const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const Class = require('../models/Class');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

// Filter announcements for user
const filterAnnouncementsForUser = (announcements, user) => {
  const now = new Date();
  
  return announcements.filter(announcement => {
    // Check if published
    if (announcement.status !== 'published') return false;
    
    // Check publish date
    if (announcement.publishDate > now) return false;
    
    // Check expiry
    if (announcement.expiryDate && announcement.expiryDate < now) return false;
    
    // Admin sees all
    if (user.role === 'admin') return true;
    
    // If no target audience, assume all
    if (!announcement.targetAudience || announcement.targetAudience.length === 0) return true;
    
    // Check if for 'all'
    if (announcement.targetAudience.includes('all')) return true;
    
    // Check direct role match
    if (announcement.targetAudience.includes(user.role)) return true;
    
    // Check specific class
    if (announcement.targetAudience.includes('specific-class') && user.class) {
      if (announcement.targetClasses && 
          announcement.targetClasses.some(c => c.toString() === user.class.toString())) {
        return true;
      }
    }
    
    // Check specific student
    if (announcement.targetAudience.includes('specific-student')) {
      if (announcement.targetStudents && 
          announcement.targetStudents.some(s => s.toString() === user._id.toString())) {
        return true;
      }
    }
    
    return false;
  });
};

// ==================== PUBLIC/PRIVATE ROUTES (All logged in users) ====================

router.get('/', protect, async (req, res) => {
  try {
    const { 
      category,
      priority,
      search,
      page = 1, 
      limit = 20 
    } = req.query;
    
    // Build filter
    let filter = { 
      status: 'published',
      publishDate: { $lte: new Date() }
    };
    
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    
    // Don't show expired
    filter.$or = [
      { expiryDate: { $exists: false } },
      { expiryDate: null },
      { expiryDate: { $gte: new Date() } }
    ];
    
    // Text search
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const announcements = await Announcement.find(filter)
      .populate('createdBy', 'name')
      .populate('targetClasses', 'name section')
      .populate('targetStudents', 'name')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ isPinned: -1, publishDate: -1 });
    
    // Filter based on user role
    const filteredAnnouncements = filterAnnouncementsForUser(announcements, req.user);
    
    // Check if user has acknowledged
    const withAckStatus = filteredAnnouncements.map(announcement => {
      const obj = announcement.toObject();
      obj.acknowledged = announcement.acknowledgments.some(
        a => a.user.toString() === req.user._id.toString()
      );
      return obj;
    });
    
    const total = await Announcement.countDocuments(filter);
    
    res.json({
      announcements: withAckStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/pinned', protect, async (req, res) => {
  try {
    const announcements = await Announcement.find({
      status: 'published',
      isPinned: true,
      publishDate: { $lte: new Date() },
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gte: new Date() } }
      ]
    })
      .populate('createdBy', 'name')
      .sort({ publishDate: -1 });
    
    const filteredAnnouncements = filterAnnouncementsForUser(announcements, req.user);
    
    res.json({
      count: filteredAnnouncements.length,
      announcements: filteredAnnouncements
    });
    
  } catch (error) {
    console.error('Get pinned announcements error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/recent', protect, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const announcements = await Announcement.find({
      status: 'published',
      publishDate: { $lte: new Date() },
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gte: new Date() } }
      ]
    })
      .populate('createdBy', 'name')
      .sort({ isPinned: -1, publishDate: -1 })
      .limit(parseInt(limit));
    
    const filteredAnnouncements = filterAnnouncementsForUser(announcements, req.user);
    
    // Add acknowledgment status
    const withAckStatus = filteredAnnouncements.map(announcement => {
      const obj = announcement.toObject();
      obj.acknowledged = announcement.acknowledgments.some(
        a => a.user.toString() === req.user._id.toString()
      );
      return obj;
    });
    
    res.json({
      count: withAckStatus.length,
      announcements: withAckStatus
    });
    
  } catch (error) {
    console.error('Get recent announcements error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id)
      .populate('createdBy', 'name email')
      .populate('targetClasses', 'name section')
      .populate('targetStudents', 'name');
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Check if user can see this announcement
    const filtered = filterAnnouncementsForUser([announcement], req.user);
    if (filtered.length === 0) {
      return res.status(403).json({ 
        message: 'Not authorized to view this announcement' 
      });
    }
    
    // Increment view count
    announcement.views += 1;
    await announcement.save();
    
    // Check if user has acknowledged
    const acknowledged = announcement.acknowledgments.some(
      a => a.user.toString() === req.user._id.toString()
    );
    
    res.json({
      announcement,
      acknowledged
    });
    
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/acknowledge', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Check if already acknowledged
    const alreadyAcknowledged = announcement.acknowledgments.some(
      a => a.user.toString() === req.user._id.toString()
    );
    
    if (alreadyAcknowledged) {
      return res.status(400).json({ 
        message: 'Already acknowledged this announcement' 
      });
    }
    
    // Add acknowledgment
    announcement.acknowledgments.push({
      user: req.user._id,
      acknowledgedAt: new Date()
    });
    
    await announcement.save();
    
    res.json({
      message: 'Announcement acknowledged successfully',
      acknowledgedAt: new Date()
    });
    
  } catch (error) {
    console.error('Acknowledge announcement error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== TEACHER/ADMIN ROUTES ====================

router.post('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { 
      title, content, category, priority,
      targetAudience, targetClasses, targetStudents,
      publishDate, expiryDate, isPinned,
      attachments
    } = req.body;
    
    // Validate dates
    if (expiryDate && new Date(expiryDate) < new Date(publishDate || Date.now())) {
      return res.status(400).json({ 
        message: 'Expiry date must be after publish date' 
      });
    }
    
    // Create announcement
    const announcement = new Announcement({
      title,
      content,
      category: category || 'general',
      priority: priority || 'normal',
      targetAudience: targetAudience || ['all'],
      targetClasses,
      targetStudents,
      publishDate: publishDate || new Date(),
      expiryDate,
      isPinned: isPinned || false,
      attachments: attachments || [],
      createdBy: req.user._id,
      status: 'draft', // Start as draft
      views: 0,
      acknowledgments: []
    });
    
    await announcement.save();
    
    const populatedAnnouncement = await Announcement.findById(announcement._id)
      .populate('createdBy', 'name')
      .populate('targetClasses', 'name section')
      .populate('targetStudents', 'name');
    
    res.status(201).json({
      message: 'Announcement created successfully',
      announcement: populatedAnnouncement
    });
    
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Check if user can update (creator or admin)
    if (req.user.role !== 'admin' && 
        announcement.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Not authorized to update this announcement' 
      });
    }
    
    // Don't allow updating certain fields
    delete updates.views;
    delete updates.acknowledgments;
    
    const updatedAnnouncement = await Announcement.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name')
      .populate('targetClasses', 'name section')
      .populate('targetStudents', 'name');
    
    res.json({
      message: 'Announcement updated successfully',
      announcement: updatedAnnouncement
    });
    
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Check if user can delete (creator or admin)
    if (req.user.role !== 'admin' && 
        announcement.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Not authorized to delete this announcement' 
      });
    }
    
    // Soft delete
    announcement.isActive = false;
    announcement.status = 'archived';
    await announcement.save();
    
    res.json({
      message: 'Announcement deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/:id/pin', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { pin } = req.body;
    
    const announcement = await Announcement.findByIdAndUpdate(
      id,
      { $set: { isPinned: pin } },
      { new: true }
    );
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    res.json({
      message: `Announcement ${pin ? 'pinned' : 'unpinned'} successfully`,
      isPinned: announcement.isPinned
    });
    
  } catch (error) {
    console.error('Pin announcement error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/:id/publish', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { publish } = req.body;
    
    const announcement = await Announcement.findById(id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Check if user can publish (creator or admin)
    if (req.user.role !== 'admin' && 
        announcement.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Not authorized to publish this announcement' 
      });
    }
    
    announcement.status = publish ? 'published' : 'draft';
    if (publish && !announcement.publishDate) {
      announcement.publishDate = new Date();
    }
    
    await announcement.save();
    
    res.json({
      message: `Announcement ${publish ? 'published' : 'unpublished'} successfully`,
      status: announcement.status
    });
    
  } catch (error) {
    console.error('Publish announcement error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== ADMIN ONLY ROUTES ====================

router.get('/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const total = await Announcement.countDocuments();
    const published = await Announcement.countDocuments({ status: 'published' });
    const draft = await Announcement.countDocuments({ status: 'draft' });
    const pinned = await Announcement.countDocuments({ isPinned: true });
    
    // Views stats
    const announcements = await Announcement.find({ status: 'published' });
    const totalViews = announcements.reduce((sum, a) => sum + a.views, 0);
    const avgViews = announcements.length > 0 ? totalViews / announcements.length : 0;
    
    // Acknowledgment stats
    const totalAcks = announcements.reduce(
      (sum, a) => sum + a.acknowledgments.length, 0
    );
    
    // Recent activity
    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);
    
    const recentAnnouncements = await Announcement.find({
      publishDate: { $gte: last7Days }
    }).countDocuments();
    
    res.json({
      counts: {
        total,
        published,
        draft,
        pinned
      },
      engagement: {
        totalViews,
        averageViews: avgViews.toFixed(2),
        totalAcknowledgments: totalAcks
      },
      recent: {
        last7Days: recentAnnouncements
      }
    });
    
  } catch (error) {
    console.error('Get announcement stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;