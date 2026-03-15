const express = require('express');
const router = express.Router();
const Exam = require('../models/Exam');
const ExamResult = require('../models/ExamResult');
const Class = require('../models/Class');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

// Check if user can access exam
const canAccessExam = async (user, examId) => {
  if (user.role === 'admin') return true;
  
  const exam = await Exam.findById(examId).populate('class');
  if (!exam) return false;
  
  // Teachers can access if they teach the class or subject
  if (user.role === 'teacher') {
    // Check if teacher is class teacher
    if (exam.class.classTeacher && exam.class.classTeacher.toString() === user._id.toString()) {
      return true;
    }
    
    // Check if teacher teaches this subject
    const teachesSubject = exam.class.subjects.some(
      s => s.teacher && s.teacher.toString() === user._id.toString() && 
           s.subject.toString() === exam.subject.toString()
    );
    return teachesSubject;
  }
  
  return false;
};

// ==================== EXAM ROUTES ====================

router.get('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { 
      class: classId,
      subject,
      status,
      term,
      academicYear,
      fromDate,
      toDate,
      page = 1, 
      limit = 20 
    } = req.query;
    
    // Build filter object
    let filter = {};
    
    if (classId) filter.class = classId;
    if (subject) filter.subject = subject;
    if (status) filter.status = status;
    if (term) filter.term = term;
    if (academicYear) filter.academicYear = academicYear;
    
    // Date range filter
    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) filter.date.$lte = new Date(toDate);
    }
    
    // If teacher (not admin), only show exams for classes they're involved in
    if (req.user.role === 'teacher') {
      const teacherClasses = await Class.find({
        $or: [
          { classTeacher: req.user._id },
          { 'subjects.teacher': req.user._id }
        ]
      }).select('_id');
      
      const classIds = teacherClasses.map(c => c._id);
      filter.class = { $in: classIds };
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query
    const exams = await Exam.find(filter)
      .populate('class', 'name section grade')
      .populate('subject', 'name code')
      .populate('createdBy', 'name')
      .populate('results.student', 'name')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ date: -1 });
    
    // Get total count for pagination
    const total = await Exam.countDocuments(filter);
    
    // Add result statistics to each exam
    const examsWithStats = exams.map(exam => {
      const examObj = exam.toObject();
      examObj.totalStudents = exam.results.length;
      examObj.gradedCount = exam.results.filter(r => r.marksObtained !== undefined).length;
      return examObj;
    });
    
    res.json({
      exams: examsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get exams error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/upcoming', protect, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + parseInt(days));
    
    let filter = {
      date: { $gte: today, $lte: futureDate },
      status: 'scheduled'
    };
    
    // For students, only show their class exams
    if (req.user.role === 'student' && req.user.class) {
      filter.class = req.user.class;
    }
    
    // For parents, show exams for their children's classes
    if (req.user.role === 'parent') {
      const children = await User.find({ 
        parent: req.user._id,
        role: 'student'
      }).select('class');
      
      const classIds = children.map(c => c.class).filter(c => c);
      filter.class = { $in: classIds };
    }
    
    // For teachers, show exams they're involved in
    if (req.user.role === 'teacher') {
      const teacherClasses = await Class.find({
        $or: [
          { classTeacher: req.user._id },
          { 'subjects.teacher': req.user._id }
        ]
      }).select('_id');
      
      const classIds = teacherClasses.map(c => c._id);
      filter.class = { $in: classIds };
    }
    
    const exams = await Exam.find(filter)
      .populate('class', 'name section')
      .populate('subject', 'name code')
      .sort({ date: 1 });
    
    res.json({ 
      count: exams.length,
      exams 
    });
    
  } catch (error) {
    console.error('Get upcoming exams error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/class/:classId', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { classId } = req.params;
    const { term, academicYear } = req.query;
    
    let filter = { class: classId };
    if (term) filter.term = term;
    if (academicYear) filter.academicYear = academicYear;
    
    const exams = await Exam.find(filter)
      .populate('subject', 'name code')
      .populate('createdBy', 'name')
      .sort({ date: -1 });
    
    // Get class info
    const classInfo = await Class.findById(classId)
      .select('name section grade academicYear');
    
    res.json({
      class: classInfo,
      totalExams: exams.length,
      exams
    });
    
  } catch (error) {
    console.error('Get class exams error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check access
    const hasAccess = await canAccessExam(req.user, id);
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Not authorized to view this exam' 
      });
    }
    
    const exam = await Exam.findById(id)
      .populate('class', 'name section grade classTeacher')
      .populate('subject', 'name code credits')
      .populate('createdBy', 'name email')
      .populate('results.student', 'name email');
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    
    // Calculate statistics
    const examObj = exam.toObject();
    const totalStudents = exam.results.length;
    const gradedResults = exam.results.filter(r => r.marksObtained !== undefined);
    
    if (gradedResults.length > 0) {
      const marks = gradedResults.map(r => r.marksObtained);
      examObj.statistics = {
        totalStudents,
        gradedCount: gradedResults.length,
        average: (marks.reduce((a, b) => a + b, 0) / gradedResults.length).toFixed(2),
        highest: Math.max(...marks),
        lowest: Math.min(...marks),
        passCount: gradedResults.filter(r => r.marksObtained >= exam.passingMarks).length,
        passPercentage: ((gradedResults.filter(r => r.marksObtained >= exam.passingMarks).length / gradedResults.length) * 100).toFixed(2)
      };
    }
    
    res.json({ exam: examObj });
    
  } catch (error) {
    console.error('Get exam error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { 
      title, class: classId, subject, date, duration,
      totalMarks, passingMarks, term, description
    } = req.body;
    
    // Verify class exists
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    // Verify subject is taught in this class
    const subjectInClass = classDoc.subjects.find(
      s => s.subject.toString() === subject
    );
    
    if (!subjectInClass) {
      return res.status(400).json({ 
        message: 'This subject is not taught in the selected class' 
      });
    }
    
    // Check if exam already exists for this class/subject/term
    const existingExam = await Exam.findOne({
      class: classId,
      subject,
      term,
      academicYear: classDoc.academicYear
    });
    
    if (existingExam) {
      return res.status(400).json({ 
        message: `An exam for this subject already exists in ${term}` 
      });
    }
    
    // Create exam
    const exam = new Exam({
      title,
      class: classId,
      subject,
      date,
      duration,
      totalMarks,
      passingMarks,
      term,
      academicYear: classDoc.academicYear,
      description: description || '',
      createdBy: req.user._id,
      status: 'scheduled',
      results: []
    });
    
    await exam.save();
    
    // Get all students in the class and create empty result entries
    const students = classDoc.students || [];
    students.forEach(studentId => {
      exam.results.push({
        student: studentId,
        marksObtained: undefined,
        grade: undefined,
        remarks: ''
      });
    });
    
    await exam.save();
    
    const populatedExam = await Exam.findById(exam._id)
      .populate('class', 'name section')
      .populate('subject', 'name code')
      .populate('createdBy', 'name');
    
    res.status(201).json({
      message: 'Exam created successfully',
      exam: populatedExam
    });
    
  } catch (error) {
    console.error('Create exam error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check access
    const hasAccess = await canAccessExam(req.user, id);
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Not authorized to update this exam' 
      });
    }
    
    const updates = req.body;
    
    // Don't allow updating results through this route
    delete updates.results;
    
    const exam = await Exam.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('class', 'name section')
      .populate('subject', 'name code')
      .populate('createdBy', 'name');
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    
    res.json({
      message: 'Exam updated successfully',
      exam
    });
    
  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if results exist
    const exam = await Exam.findById(id);
    if (exam.results.some(r => r.marksObtained !== undefined)) {
      return res.status(400).json({ 
        message: 'Cannot delete exam with graded results. Archive it instead.' 
      });
    }
    
    await Exam.findByIdAndDelete(id);
    
    // Also delete all ExamResult documents for this exam
    await ExamResult.deleteMany({ exam: id });
    
    res.json({
      message: 'Exam deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete exam error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id/results', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check access
    const hasAccess = await canAccessExam(req.user, id);
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Not authorized to view these results' 
      });
    }
    
    const exam = await Exam.findById(id)
      .populate('class', 'name section')
      .populate('subject', 'name code')
      .populate('results.student', 'name email rollNumber');
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    
    // Separate graded and ungraded
    const graded = exam.results.filter(r => r.marksObtained !== undefined);
    const ungraded = exam.results.filter(r => r.marksObtained === undefined);
    
    res.json({
      exam: {
        id: exam._id,
        title: exam.title,
        class: exam.class,
        subject: exam.subject,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks
      },
      statistics: {
        total: exam.results.length,
        graded: graded.length,
        ungraded: ungraded.length
      },
      results: {
        graded,
        ungraded
      }
    });
    
  } catch (error) {
    console.error('Get exam results error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/:id/results/bulk', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { results } = req.body;
    
    // Check access
    const hasAccess = await canAccessExam(req.user, id);
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({ 
        message: 'Not authorized to update these results' 
      });
    }
    
    const exam = await Exam.findById(id);
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    
    // Update each result
    const updatedResults = [];
    const errors = [];
    
    for (const newResult of results) {
      const { studentId, marksObtained, remarks } = newResult;
      
      // Find the result in exam
      const resultIndex = exam.results.findIndex(
        r => r.student.toString() === studentId
      );
      
      if (resultIndex === -1) {
        errors.push({ studentId, message: 'Student not found in this exam' });
        continue;
      }
      
      // Validate marks
      if (marksObtained !== undefined) {
        if (marksObtained < 0 || marksObtained > exam.totalMarks) {
          errors.push({ 
            studentId, 
            message: `Marks must be between 0 and ${exam.totalMarks}` 
          });
          continue;
        }
      }
      
      // Update result
      exam.results[resultIndex].marksObtained = marksObtained;
      exam.results[resultIndex].remarks = remarks || exam.results[resultIndex].remarks;
      
      // Calculate grade (simplified - adjust based on your grading system)
      if (marksObtained !== undefined) {
        const percentage = (marksObtained / exam.totalMarks) * 100;
        if (percentage >= 80) exam.results[resultIndex].grade = 'A';
        else if (percentage >= 70) exam.results[resultIndex].grade = 'B';
        else if (percentage >= 60) exam.results[resultIndex].grade = 'C';
        else if (percentage >= 50) exam.results[resultIndex].grade = 'D';
        else exam.results[resultIndex].grade = 'F';
      }
      
      // Also update or create ExamResult document
      await ExamResult.findOneAndUpdate(
        { student: studentId, exam: id },
        {
          student: studentId,
          exam: id,
          subject: exam.subject,
          class: exam.class,
          marksObtained,
          totalMarks: exam.totalMarks,
          grade: exam.results[resultIndex].grade,
          remarks: remarks || '',
          status: marksObtained >= exam.passingMarks ? 'pass' : 'fail',
          gradedBy: req.user._id,
          gradedAt: new Date(),
          term: exam.term,
          academicYear: exam.academicYear
        },
        { upsert: true, new: true }
      );
      
      updatedResults.push({
        studentId,
        marksObtained,
        grade: exam.results[resultIndex].grade
      });
    }
    
    await exam.save();
    
    // Check if all results are graded
    const allGraded = exam.results.every(r => r.marksObtained !== undefined);
    if (allGraded) {
      exam.status = 'completed';
      await exam.save();
    }
    
    res.json({
      message: 'Results updated successfully',
      successCount: updatedResults.length,
      errorCount: errors.length,
      updatedResults,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('Bulk update results error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;