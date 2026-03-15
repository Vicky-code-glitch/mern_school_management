const express = require('express');
const router = express.Router();
const ExamResult = require('../models/ExamResult');
const Exam = require('../models/Exam');
const User = require('../models/User');
const Class = require('../models/Class');
const { protect, authorize } = require('../middleware/authMiddleware');

// Check if user can access student results
const canAccessStudentResults = (user, studentId) => {
  if (user.role === 'admin') return true;
  
  if (user.role === 'teacher') return true; 
  
  if (user.role === 'student' && user._id.toString() === studentId) return true;
  
  if (user.role === 'parent') {
    // Check if student is child of this parent
    return User.findOne({ _id: studentId, parent: user._id });
  }
  
  return false;
};

// ==================== RESULT ROUTES ====================

router.get('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { 
      student, exam, subject, class: classId,
      term, academicYear, status,
      page = 1, limit = 50 
    } = req.query;
    
    // Build filter object
    let filter = {};
    
    if (student) filter.student = student;
    if (exam) filter.exam = exam;
    if (subject) filter.subject = subject;
    if (classId) filter.class = classId;
    if (term) filter.term = term;
    if (academicYear) filter.academicYear = academicYear;
    if (status) filter.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const results = await ExamResult.find(filter)
      .populate('student', 'name email rollNumber')
      .populate('exam', 'title date totalMarks')
      .populate('subject', 'name code')
      .populate('class', 'name section')
      .populate('gradedBy', 'name')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ createdAt: -1 });
    
    const total = await ExamResult.countDocuments(filter);
    
    res.json({
      results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/student/:studentId', protect, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { term, academicYear } = req.query;
    
    // Check access
    const hasAccess = await canAccessStudentResults(req.user, studentId);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Not authorized to view these results' 
      });
    }
    
    // Build filter
    let filter = { student: studentId };
    if (term) filter.term = term;
    if (academicYear) filter.academicYear = academicYear;
    
    const results = await ExamResult.find(filter)
      .populate('exam', 'title date totalMarks')
      .populate('subject', 'name code')
      .populate('class', 'name section')
      .sort({ createdAt: -1 });
    
    // Get student info
    const student = await User.findById(studentId)
      .select('name email rollNumber class grade');
    
    // Calculate statistics
    const stats = {
      totalExams: results.length,
      average: 0,
      highest: 0,
      lowest: 100,
      passed: 0,
      failed: 0
    };
    
    if (results.length > 0) {
      const marks = results.map(r => r.marksObtained);
      stats.average = (marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2);
      stats.highest = Math.max(...marks);
      stats.lowest = Math.min(...marks);
      stats.passed = results.filter(r => r.status === 'pass').length;
      stats.failed = results.filter(r => r.status === 'fail').length;
    }
    
    res.json({
      student,
      stats,
      results
    });
    
  } catch (error) {
    console.error('Get student results error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/student/:studentId/transcript', protect, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { academicYear } = req.query;
    
    // Check access
    const hasAccess = await canAccessStudentResults(req.user, studentId);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Not authorized to view this transcript' 
      });
    }
    
    // Build filter
    let filter = { student: studentId };
    if (academicYear) filter.academicYear = academicYear;
    
    const results = await ExamResult.find(filter)
      .populate('exam', 'title date totalMarks term')
      .populate('subject', 'name code credits')
      .sort({ term: 1, 'exam.date': 1 });
    
    if (results.length === 0) {
      return res.status(404).json({ 
        message: 'No results found for this student' 
      });
    }
    
    // Get student info
    const student = await User.findById(studentId)
      .select('name email rollNumber class grade');
    
    // Group results by term
    const byTerm = {};
    results.forEach(result => {
      const term = result.term;
      if (!byTerm[term]) {
        byTerm[term] = {
          term,
          subjects: [],
          totalMarks: 0,
          obtainedMarks: 0,
          percentage: 0
        };
      }
      
      byTerm[term].subjects.push({
        subject: result.subject,
        marksObtained: result.marksObtained,
        totalMarks: result.totalMarks,
        percentage: result.percentage,
        grade: result.grade,
        gradePoints: result.gradePoints,
        status: result.status
      });
      
      byTerm[term].totalMarks += result.totalMarks;
      byTerm[term].obtainedMarks += result.marksObtained;
    });
    
    // Calculate term percentages and GPA
    Object.keys(byTerm).forEach(term => {
      const t = byTerm[term];
      t.percentage = ((t.obtainedMarks / t.totalMarks) * 100).toFixed(2);
      
      // Calculate GPA (simplified - assuming 4.0 scale)
      const totalPoints = t.subjects.reduce((sum, s) => sum + (s.gradePoints || 0), 0);
      t.gpa = (totalPoints / t.subjects.length).toFixed(2);
    });
    
    // Overall statistics
    const overall = {
      totalSubjects: results.length,
      totalMarks: results.reduce((sum, r) => sum + r.totalMarks, 0),
      obtainedMarks: results.reduce((sum, r) => sum + r.marksObtained, 0),
      percentage: 0,
      gpa: 0
    };
    
    overall.percentage = ((overall.obtainedMarks / overall.totalMarks) * 100).toFixed(2);
    
    const totalGradePoints = results.reduce((sum, r) => sum + (r.gradePoints || 0), 0);
    overall.gpa = (totalGradePoints / results.length).toFixed(2);
    
    res.json({
      student,
      academicYear: academicYear || 'All Years',
      byTerm,
      overall
    });
    
  } catch (error) {
    console.error('Generate transcript error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/class/:classId', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { classId } = req.params;
    const { examId, term, academicYear } = req.query;
    
    // Build filter
    let filter = { class: classId };
    if (examId) filter.exam = examId;
    if (term) filter.term = term;
    if (academicYear) filter.academicYear = academicYear;
    
    const results = await ExamResult.find(filter)
      .populate('student', 'name rollNumber')
      .populate('exam', 'title date totalMarks')
      .populate('subject', 'name code')
      .sort({ 'student.rollNumber': 1 });
    
    // Get class info
    const classInfo = await Class.findById(classId)
      .select('name section grade academicYear');
    
    // Group results by exam if no specific exam requested
    let grouped = {};
    
    if (!examId) {
      results.forEach(result => {
        const examTitle = result.exam.title;
        if (!grouped[examTitle]) {
          grouped[examTitle] = {
            exam: result.exam,
            results: []
          };
        }
        grouped[examTitle].results.push(result);
      });
    } else {
      grouped = { results };
    }
    
    res.json({
      class: classInfo,
      results: grouped
    });
    
  } catch (error) {
    console.error('Get class results error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/exam/:examId/student/:studentId', protect, async (req, res) => {
  try {
    const { examId, studentId } = req.params;
    
    // Check access
    const hasAccess = await canAccessStudentResults(req.user, studentId);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Not authorized to view this result' 
      });
    }
    
    const result = await ExamResult.findOne({ 
      exam: examId, 
      student: studentId 
    })
      .populate('exam', 'title date totalMarks passingMarks term')
      .populate('subject', 'name code')
      .populate('student', 'name email rollNumber')
      .populate('gradedBy', 'name');
    
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }
    
    res.json({ result });
    
  } catch (error) {
    console.error('Get exam result error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const { marksObtained, remarks, isPublished } = req.body;
    
    const result = await ExamResult.findById(id);
    
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }
    
    // Update fields
    if (marksObtained !== undefined) {
      if (marksObtained < 0 || marksObtained > result.totalMarks) {
        return res.status(400).json({ 
          message: `Marks must be between 0 and ${result.totalMarks}` 
        });
      }
      result.marksObtained = marksObtained;
      
      // Recalculate percentage and grade
      result.percentage = (marksObtained / result.totalMarks) * 100;
      
      // Grade calculation
      if (result.percentage >= 80) {
        result.grade = 'A';
        result.gradePoints = 4;
      } else if (result.percentage >= 70) {
        result.grade = 'B';
        result.gradePoints = 3;
      } else if (result.percentage >= 60) {
        result.grade = 'C';
        result.gradePoints = 2;
      } else if (result.percentage >= 50) {
        result.grade = 'D';
        result.gradePoints = 1;
      } else {
        result.grade = 'F';
        result.gradePoints = 0;
      }
      
      result.status = result.percentage >= 40 ? 'pass' : 'fail';
    }
    
    if (remarks !== undefined) result.remarks = remarks;
    if (isPublished !== undefined) result.isPublished = isPublished;
    
    result.gradedBy = req.user._id;
    result.gradedAt = new Date();
    
    await result.save();
    
    // Also update the corresponding entry in Exam model
    const exam = await Exam.findById(result.exam);
    if (exam) {
      const examResult = exam.results.find(
        r => r.student.toString() === result.student.toString()
      );
      if (examResult) {
        examResult.marksObtained = result.marksObtained;
        examResult.grade = result.grade;
        examResult.remarks = result.remarks;
        await exam.save();
      }
    }
    
    res.json({
      message: 'Result updated successfully',
      result
    });
    
  } catch (error) {
    console.error('Update result error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/:id/publish', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const { publish } = req.body;
    
    const result = await ExamResult.findByIdAndUpdate(
      id,
      { $set: { isPublished: publish } },
      { new: true }
    );
    
    if (!result) {
      return res.status(404).json({ message: 'Result not found' });
    }
    
    res.json({
      message: `Result ${publish ? 'published' : 'unpublished'} successfully`,
      result
    });
    
  } catch (error) {
    console.error('Publish result error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/statistics/:examId', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { examId } = req.params;
    
    const exam = await Exam.findById(examId)
      .populate('class', 'name section')
      .populate('subject', 'name code');
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    
    const results = await ExamResult.find({ exam: examId });
    
    if (results.length === 0) {
      return res.json({
        exam,
        message: 'No results recorded yet',
        statistics: null
      });
    }
    
    const marks = results.map(r => r.marksObtained);
    const passes = results.filter(r => r.status === 'pass').length;
    
    // Grade distribution
    const gradeDistribution = {
      A: results.filter(r => r.grade === 'A').length,
      B: results.filter(r => r.grade === 'B').length,
      C: results.filter(r => r.grade === 'C').length,
      D: results.filter(r => r.grade === 'D').length,
      F: results.filter(r => r.grade === 'F').length
    };
    
    const statistics = {
      totalStudents: results.length,
      average: (marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2),
      highest: Math.max(...marks),
      lowest: Math.min(...marks),
      median: marks.sort((a, b) => a - b)[Math.floor(marks.length / 2)],
      passCount: passes,
      passPercentage: ((passes / results.length) * 100).toFixed(2),
      gradeDistribution,
      topPerformers: await ExamResult.find({ exam: examId })
        .sort({ marksObtained: -1 })
        .limit(5)
        .populate('student', 'name rollNumber')
    };
    
    res.json({
      exam,
      statistics
    });
    
  } catch (error) {
    console.error('Get exam statistics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;