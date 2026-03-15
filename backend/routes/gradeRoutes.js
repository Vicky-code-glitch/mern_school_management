const express = require('express');
const router = express.Router();
const Grade = require('../models/Grade');
const Class = require('../models/Class');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, async (req, res) => {
  try {
    const { isActive, page = 1, limit = 20 } = req.query;
    
    let filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const grades = await Grade.find(filter)
      .populate('subjects', 'name code')
      .populate('nextGrade', 'name level')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ level: 1 });
    
    const total = await Grade.countDocuments(filter);
    
    res.json({
      grades,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } 
  catch (error) {
    console.error('Get grades error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    const grade = await Grade.findById(id)
      .populate('subjects', 'name code credits')
      .populate('nextGrade', 'name level');
    
    if (!grade) {
      return res.status(404).json({ message: 'Grade not found' });
    }
    
    res.json({ grade });
  } 
  catch (error) {
    console.error('Get grade error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id/classes', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { academicYear } = req.query;
    
    let filter = { grade: id };
    if (academicYear) filter.academicYear = academicYear;
    
    const classes = await Class.find(filter)
      .populate('classTeacher', 'name email')
      .populate('subjects.subject', 'name code')
      .populate('subjects.teacher', 'name email');
    
    res.json({ 
      grade: await Grade.findById(id).select('name level'),
      classes 
    });
    
  } catch (error) {
    console.error('Get grade classes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id/subjects', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    const grade = await Grade.findById(id)
      .populate('subjects', 'name code credits department');
    
    if (!grade) {
      return res.status(404).json({ message: 'Grade not found' });
    }
    
    res.json({ 
      grade: { _id: grade._id, name: grade.name, level: grade.level },
      subjects: grade.subjects 
    });
  } 
  catch (error) {
    console.error('Get grade subjects error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== ADMIN ONLY ROUTES ====================

router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, level, description, subjects, nextGrade } = req.body;
    
    // Check if grade already exists
    const existingGrade = await Grade.findOne({ 
      $or: [{ name }, { level }] 
    });
    
    if (existingGrade) {
      return res.status(400).json({ 
        message: 'Grade with this name or level already exists' 
      });
    }
    
    const grade = new Grade({
      name,
      level,
      description: description || '',
      subjects: subjects || [],
      nextGrade: nextGrade || null
    });
    
    await grade.save();
    
    res.status(201).json({
      message: 'Grade created successfully',
      grade
    });
  } 
  catch (error) {
    console.error('Create grade error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const grade = await Grade.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('subjects', 'name code')
     .populate('nextGrade', 'name level');
    
    if (!grade) {
      return res.status(404).json({ message: 'Grade not found' });
    }
    
    res.json({
      message: 'Grade updated successfully',
      grade
    });
  } 
  catch (error) {
    console.error('Update grade error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if grade has classes
    const classesInGrade = await Class.findOne({ grade: id });
    
    if (classesInGrade) {
      return res.status(400).json({ 
        message: 'Cannot delete grade that has classes. Deactivate it instead.' 
      });
    }
    
    const grade = await Grade.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );
    
    if (!grade) {
      return res.status(404).json({ message: 'Grade not found' });
    }
    
    res.json({
      message: 'Grade deactivated successfully'
    });
  } 
  catch (error) {
    console.error('Delete grade error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/subjects', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectId } = req.body;
    
    const grade = await Grade.findById(id);
    
    if (!grade) {
      return res.status(404).json({ message: 'Grade not found' });
    }
    
    // Check if subject already added
    if (grade.subjects.includes(subjectId)) {
      return res.status(400).json({ 
        message: 'Subject already added to this grade' 
      });
    }
    
    grade.subjects.push(subjectId);
    await grade.save();
    
    const updatedGrade = await Grade.findById(id)
      .populate('subjects', 'name code');
    
    res.json({
      message: 'Subject added to grade successfully',
      grade: updatedGrade
    });
  } 
  catch (error) {
    console.error('Add subject to grade error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id/subjects/:subjectId', protect, authorize('admin'), async (req, res) => {
  try {
    const { id, subjectId } = req.params;
    
    const grade = await Grade.findById(id);
    
    if (!grade) {
      return res.status(404).json({ message: 'Grade not found' });
    }
    
    grade.subjects = grade.subjects.filter(
      s => s.toString() !== subjectId
    );
    
    await grade.save();
    
    const updatedGrade = await Grade.findById(id)
      .populate('subjects', 'name code');
    
    res.json({
      message: 'Subject removed from grade successfully',
      grade: updatedGrade
    });
  } 
  catch (error) {
    console.error('Remove subject from grade error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;