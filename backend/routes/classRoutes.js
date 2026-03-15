const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const User = require('../models/User');
const Subject = require('../models/Subject');
const { protect, authorize } = require('../middleware/authMiddleware');

// ==================== HELPER FUNCTIONS ====================

// Check if user can access class data
const canAccessClass = async (user, classId) => {
  if (user.role === 'admin') return true;
  
  const classDoc = await Class.findById(classId);
  if (!classDoc) return false;
  
  // Teachers can access if they are class teacher or teach any subject
  if (user.role === 'teacher') {
    if (classDoc.classTeacher && classDoc.classTeacher.toString() === user._id.toString()) {
      return true;
    }
    
    // Check if teacher teaches any subject in this class
    const teachesSubject = classDoc.subjects.some(
      s => s.teacher && s.teacher.toString() === user._id.toString()
    );
    if (teachesSubject) return true;
  }
  
  // Students can access their own class
  if (user.role === 'student') {
    return classDoc.students.includes(user._id);
  }
  
  // Parents can access their children's class
  if (user.role === 'parent') {
    const studentInClass = await User.findOne({
      _id: { $in: classDoc.students },
      parent: user._id
    });
    return !!studentInClass;
  }
  
  return false;
};

// ==================== MAIN ROUTES ====================

// @desc    Get all classes with filters
// @route   GET /api/classes
// @access  Private (Teachers, Admin)
router.get('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { 
      grade, 
      academicYear, 
      classTeacher,
      search,
      isActive = true,
      page = 1, 
      limit = 20 
    } = req.query;
    
    // Build filter object
    let filter = { isActive: isActive === 'true' };
    
    if (grade) filter.grade = grade;
    if (academicYear) filter.academicYear = academicYear;
    if (classTeacher) filter.classTeacher = classTeacher;
    
    // If teacher (not admin), only show classes they're involved in
    if (req.user.role === 'teacher') {
      filter.$or = [
        { classTeacher: req.user._id },
        { 'subjects.teacher': req.user._id }
      ];
    }
    
    // Text search on class name
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query
    const classes = await Class.find(filter)
      .populate('grade', 'name level')
      .populate('classTeacher', 'name email')
      .populate('students', 'name email')
      .populate('subjects.subject', 'name code')
      .populate('subjects.teacher', 'name email')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ 'grade.level': 1, name: 1 });
    
    // Get total count for pagination
    const total = await Class.countDocuments(filter);
    
    // Add student count to each class
    const classesWithStats = classes.map(cls => ({
      ...cls.toObject(),
      studentCount: cls.students.length,
      subjectCount: cls.subjects.length
    }));
    
    res.json({
      classes: classesWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @desc    Get single class by ID
// @route   GET /api/classes/:id
// @access  Private (Teachers, Admin, Parents of students)
router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check access
    const hasAccess = await canAccessClass(req.user, id);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Not authorized to view this class' 
      });
    }
    
    const classDoc = await Class.findById(id)
      .populate('grade', 'name level description')
      .populate('classTeacher', 'name email phone')
      .populate('students', 'name email username')
      .populate('subjects.subject', 'name code credits')
      .populate('subjects.teacher', 'name email');
    
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Add statistics
    const classData = classDoc.toObject();
    classData.studentCount = classDoc.students.length;
    classData.subjectCount = classDoc.subjects.length;
    
    // Calculate capacity percentage
    classData.capacityPercentage = Math.round(
      (classDoc.students.length / classDoc.capacity) * 100
    );
    
    res.json({ class: classData });
    
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== ADMIN ONLY ROUTES ====================

// @desc    Create a new class
// @route   POST /api/classes
// @access  Private (Admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { 
      name, grade, section, academicYear, classTeacher,
      roomNumber, capacity, subjects, schedule 
    } = req.body;
    
    // Check if class already exists for this grade/section/year
    const existingClass = await Class.findOne({
      grade,
      section,
      academicYear
    });
    
    if (existingClass) {
      return res.status(400).json({ 
        message: `Class ${section} for this grade already exists in ${academicYear}` 
      });
    }
    
    // If classTeacher provided, verify they're a teacher
    if (classTeacher) {
      const teacher = await User.findOne({ 
        _id: classTeacher, 
        role: 'teacher' 
      });
      if (!teacher) {
        return res.status(400).json({ 
          message: 'Invalid class teacher ID or user is not a teacher' 
        });
      }
    }
    
    // Create new class
    const newClass = new Class({
      name: name || `Grade ${grade} Section ${section}`,
      grade,
      section: section || 'A',
      academicYear,
      classTeacher: classTeacher || null,
      roomNumber: roomNumber || '',
      capacity: capacity || 30,
      subjects: subjects || [],
      schedule: schedule || []
    });
    
    await newClass.save();
    
    // Populate for response
    const populatedClass = await Class.findById(newClass._id)
      .populate('grade', 'name level')
      .populate('classTeacher', 'name email')
      .populate('subjects.subject', 'name code')
      .populate('subjects.teacher', 'name email');
    
    res.status(201).json({
      message: 'Class created successfully',
      class: populatedClass
    });
    
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @desc    Update a class
// @route   PUT /api/classes/:id
// @access  Private (Admin only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // If changing class teacher, verify they're a teacher
    if (updates.classTeacher) {
      const teacher = await User.findOne({ 
        _id: updates.classTeacher, 
        role: 'teacher' 
      });
      if (!teacher) {
        return res.status(400).json({ 
          message: 'Invalid class teacher ID or user is not a teacher' 
        });
      }
    }
    
    const classDoc = await Class.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('grade', 'name level')
      .populate('classTeacher', 'name email')
      .populate('subjects.subject', 'name code')
      .populate('subjects.teacher', 'name email');
    
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    res.json({
      message: 'Class updated successfully',
      class: classDoc
    });
    
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @desc    Soft delete class
// @route   DELETE /api/classes/:id
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if class has students
    const classDoc = await Class.findById(id);
    if (classDoc.students.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete class with students. Remove students first or deactivate class.' 
      });
    }
    
    // Soft delete
    classDoc.isActive = false;
    await classDoc.save();
    
    res.json({
      message: 'Class deactivated successfully'
    });
    
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== STUDENT MANAGEMENT ====================

// @desc    Get students in a class
// @route   GET /api/classes/:id/students
// @access  Private (Teachers, Admin)
router.get('/:id/students', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const classDoc = await Class.findById(id)
      .populate({
        path: 'students',
        select: 'name email username phone address parent',
        populate: {
          path: 'parent',
          select: 'name email phone'
        }
      });
    
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    res.json({
      className: classDoc.name,
      totalStudents: classDoc.students.length,
      students: classDoc.students
    });
    
  } catch (error) {
    console.error('Get class students error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @desc    Add student to class
// @route   POST /api/classes/:id/students
// @access  Private (Admin only)
router.post('/:id/students', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;
    
    // Verify student exists and is a student
    const student = await User.findOne({ 
      _id: studentId, 
      role: 'student',
      isActive: true 
    });
    
    if (!student) {
      return res.status(404).json({ 
        message: 'Student not found or not active' 
      });
    }
    
    const classDoc = await Class.findById(id);
    
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Check if class has capacity
    if (classDoc.students.length >= classDoc.capacity) {
      return res.status(400).json({ 
        message: 'Class has reached maximum capacity' 
      });
    }
    
    // Check if student already in class
    if (classDoc.students.includes(studentId)) {
      return res.status(400).json({ 
        message: 'Student already in this class' 
      });
    }
    
    // Add student to class
    classDoc.students.push(studentId);
    await classDoc.save();
    
    // Update student's class reference
    student.class = id;
    student.grade = classDoc.grade;
    await student.save();
    
    res.json({
      message: 'Student added to class successfully',
      class: {
        id: classDoc._id,
        name: classDoc.name,
        studentCount: classDoc.students.length
      }
    });
    
  } catch (error) {
    console.error('Add student to class error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @desc    Remove student from class
// @route   DELETE /api/classes/:id/students/:studentId
// @access  Private (Admin only)
router.delete('/:id/students/:studentId', protect, authorize('admin'), async (req, res) => {
  try {
    const { id, studentId } = req.params;
    
    const classDoc = await Class.findById(id);
    
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Remove student from class
    classDoc.students = classDoc.students.filter(
      s => s.toString() !== studentId
    );
    
    await classDoc.save();
    
    // Update student's class reference
    await User.findByIdAndUpdate(studentId, {
      $unset: { class: 1, grade: 1 }
    });
    
    res.json({
      message: 'Student removed from class successfully',
      class: {
        id: classDoc._id,
        name: classDoc.name,
        studentCount: classDoc.students.length
      }
    });
    
  } catch (error) {
    console.error('Remove student from class error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== SUBJECT & TEACHER MANAGEMENT ====================

// @desc    Get subjects with teachers for a class
// @route   GET /api/classes/:id/subjects
// @access  Private (Teachers, Admin)
router.get('/:id/subjects', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const classDoc = await Class.findById(id)
      .populate('subjects.subject', 'name code credits')
      .populate('subjects.teacher', 'name email');
    
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Group subjects by those with/without teachers
    const withTeachers = classDoc.subjects.filter(s => s.teacher);
    const withoutTeachers = classDoc.subjects.filter(s => !s.teacher);
    
    res.json({
      className: classDoc.name,
      totalSubjects: classDoc.subjects.length,
      subjectsWithTeachers: withTeachers,
      subjectsWithoutTeachers: withoutTeachers
    });
    
  } catch (error) {
    console.error('Get class subjects error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @desc    Assign teacher to subject in class
// @route   POST /api/classes/:id/subjects/:subjectId/teacher
// @access  Private (Admin only)
router.post('/:id/subjects/:subjectId/teacher', protect, authorize('admin'), async (req, res) => {
  try {
    const { id, subjectId } = req.params;
    const { teacherId } = req.body;
    
    // Verify teacher exists
    const teacher = await User.findOne({ 
      _id: teacherId, 
      role: 'teacher',
      isActive: true 
    });
    
    if (!teacher) {
      return res.status(404).json({ 
        message: 'Teacher not found or not active' 
      });
    }
    
    const classDoc = await Class.findById(id);
    
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Find the subject in class
    const subjectIndex = classDoc.subjects.findIndex(
      s => s.subject.toString() === subjectId
    );
    
    if (subjectIndex === -1) {
      return res.status(404).json({ 
        message: 'Subject not found in this class' 
      });
    }
    
    // Assign teacher
    classDoc.subjects[subjectIndex].teacher = teacherId;
    await classDoc.save();
    
    // Add this class to teacher's teachingClasses
    if (!teacher.teachingClasses) teacher.teachingClasses = [];
    if (!teacher.teachingClasses.includes(id)) {
      teacher.teachingClasses.push(id);
      await teacher.save();
    }
    
    const updatedClass = await Class.findById(id)
      .populate('subjects.subject', 'name code')
      .populate('subjects.teacher', 'name email');
    
    res.json({
      message: 'Teacher assigned to subject successfully',
      class: updatedClass
    });
    
  } catch (error) {
    console.error('Assign teacher error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== TIMETABLE MANAGEMENT ====================

// @desc    Get class timetable
// @route   GET /api/classes/:id/timetable
// @access  Private (Anyone with access)
router.get('/:id/timetable', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check access
    const hasAccess = await canAccessClass(req.user, id);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Not authorized to view this class timetable' 
      });
    }
    
    const classDoc = await Class.findById(id)
      .populate('schedule.subject', 'name code');
    
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Organize schedule by day
    const timetable = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: []
    };
    
    classDoc.schedule.forEach(item => {
      if (timetable[item.day]) {
        timetable[item.day].push({
          startTime: item.startTime,
          endTime: item.endTime,
          subject: item.subject
        });
      }
    });
    
    // Sort each day by start time
    Object.keys(timetable).forEach(day => {
      timetable[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    
    res.json({
      className: classDoc.name,
      timetable
    });
    
  } catch (error) {
    console.error('Get timetable error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @desc    Update class timetable
// @route   PUT /api/classes/:id/timetable
// @access  Private (Admin only)
router.put('/:id/timetable', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { schedule } = req.body;
    
    const classDoc = await Class.findByIdAndUpdate(
      id,
      { $set: { schedule } },
      { new: true, runValidators: true }
    ).populate('schedule.subject', 'name code');
    
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    res.json({
      message: 'Timetable updated successfully',
      schedule: classDoc.schedule
    });
    
  } catch (error) {
    console.error('Update timetable error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== CLASS TEACHER ASSIGNMENT ====================

// @desc    Assign class teacher
// @route   POST /api/classes/:id/assign-teacher
// @access  Private (Admin only)
router.post('/:id/assign-teacher', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { teacherId } = req.body;
    
    // Verify teacher exists
    const teacher = await User.findOne({ 
      _id: teacherId, 
      role: 'teacher',
      isActive: true 
    });
    
    if (!teacher) {
      return res.status(404).json({ 
        message: 'Teacher not found or not active' 
      });
    }
    
    const classDoc = await Class.findByIdAndUpdate(
      id,
      { $set: { classTeacher: teacherId } },
      { new: true }
    ).populate('classTeacher', 'name email');
    
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    res.json({
      message: 'Class teacher assigned successfully',
      class: {
        id: classDoc._id,
        name: classDoc.name,
        classTeacher: classDoc.classTeacher
      }
    });
    
  } catch (error) {
    console.error('Assign class teacher error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;