const express = require('express');
const router = express.Router();
const Assignment = require('../models/Assignment');
const Class = require('../models/Class');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

// Check if user can access assignment
const canAccessAssignment = async (user, assignmentId) => {
  if (user.role === 'admin') return true;
  
  const assignment = await Assignment.findById(assignmentId).populate('class');
  if (!assignment) return false;
  
  // Teachers can access if they created it or teach the class
  if (user.role === 'teacher') {
    if (assignment.teacher.toString() === user._id.toString()) return true;
    
    // Check if teacher teaches this class
    const classDoc = await Class.findById(assignment.class._id);
    if (classDoc.classTeacher && classDoc.classTeacher.toString() === user._id.toString()) return true;
    
    // Check if teacher teaches any subject in this class
    const teachesSubject = classDoc.subjects.some(
      s => s.teacher && s.teacher.toString() === user._id.toString()
    );
    return teachesSubject;
  }
  
  // Students can access if they are in the class
  if (user.role === 'student') {
    const classDoc = await Class.findById(assignment.class._id);
    return classDoc.students.includes(user._id);
  }
  
  // Parents can access if their children are in the class
  if (user.role === 'parent') {
    const classDoc = await Class.findById(assignment.class._id);
    const children = await User.find({ 
      parent: user._id,
      role: 'student',
      _id: { $in: classDoc.students }
    });
    return children.length > 0;
  }
  
  return false;
};

// Check if student can submit (not late, assignment published, etc.)
const canSubmit = (assignment, studentId) => {
  if (assignment.status !== 'published') return false;
  
  const now = new Date();
  if (now > assignment.dueDate && !assignment.allowLateSubmissions) return false;
  
  // Check if already submitted
  const alreadySubmitted = assignment.submissions.some(
    s => s.student.toString() === studentId
  );
  
  return !alreadySubmitted;
};

// ==================== ASSIGNMENT ROUTES ====================

router.get('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { 
      class: classId,
      subject,
      teacher,
      status,
      dueFrom,
      dueTo,
      page = 1, 
      limit = 20 
    } = req.query;
    
    // Build filter object
    let filter = {};
    
    if (classId) filter.class = classId;
    if (subject) filter.subject = subject;
    if (teacher) filter.teacher = teacher;
    if (status) filter.status = status;
    
    // Due date range
    if (dueFrom || dueTo) {
      filter.dueDate = {};
      if (dueFrom) filter.dueDate.$gte = new Date(dueFrom);
      if (dueTo) filter.dueDate.$lte = new Date(dueTo);
    }
    
    // If teacher (not admin), only show their assignments
    if (req.user.role === 'teacher') {
      filter.teacher = req.user._id;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const assignments = await Assignment.find(filter)
      .populate('class', 'name section grade')
      .populate('subject', 'name code')
      .populate('teacher', 'name email')
      .populate('submissions.student', 'name')
      .limit(parseInt(limit))
      .skip(skip)
      .sort({ dueDate: 1 });
    
    const total = await Assignment.countDocuments(filter);
    
    // Add submission stats
    const assignmentsWithStats = assignments.map(assignment => {
      const obj = assignment.toObject();
      obj.totalStudents = assignment.submissions.length;
      obj.submittedCount = assignment.submissions.filter(s => s.status !== 'submitted' ? s.status : true).length;
      obj.gradedCount = assignment.submissions.filter(s => s.grade && s.grade.pointsAwarded).length;
      return obj;
    });
    
    res.json({
      assignments: assignmentsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/teacher/:teacherId', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { teacherId } = req.params;
    
    // Verify teacher exists
    const teacher = await User.findOne({ _id: teacherId, role: 'teacher' });
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    
    const assignments = await Assignment.find({ teacher: teacherId })
      .populate('class', 'name section grade')
      .populate('subject', 'name code')
      .sort({ dueDate: -1 });
    
    res.json({
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email
      },
      total: assignments.length,
      assignments
    });
    
  } catch (error) {
    console.error('Get teacher assignments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/class/:classId', protect, async (req, res) => {
  try {
    const { classId } = req.params;
    const { status } = req.query;
    
    // Check if user can access this class
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    
    let hasAccess = false;
    
    if (req.user.role === 'admin') hasAccess = true;
    else if (req.user.role === 'teacher') {
      hasAccess = classDoc.classTeacher?.toString() === req.user._id.toString() ||
                  classDoc.subjects.some(s => s.teacher?.toString() === req.user._id.toString());
    }
    else if (req.user.role === 'student') {
      hasAccess = classDoc.students.includes(req.user._id);
    }
    else if (req.user.role === 'parent') {
      const children = await User.find({ 
        parent: req.user._id,
        role: 'student',
        _id: { $in: classDoc.students }
      });
      hasAccess = children.length > 0;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Not authorized to view assignments for this class' 
      });
    }
    
    // Build filter
    let filter = { class: classId };
    if (status) filter.status = status;
    
    const assignments = await Assignment.find(filter)
      .populate('subject', 'name code')
      .populate('teacher', 'name email')
      .populate('submissions.student', 'name')
      .sort({ dueDate: 1 });
    
    // For students, add submission status
    if (req.user.role === 'student') {
      const assignmentsWithStatus = assignments.map(assignment => {
        const obj = assignment.toObject();
        const submission = assignment.submissions.find(
          s => s.student._id.toString() === req.user._id.toString()
        );
        obj.mySubmission = submission || null;
        obj.canSubmit = canSubmit(assignment, req.user._id.toString());
        return obj;
      });
      
      res.json({
        class: {
          id: classDoc._id,
          name: classDoc.name,
          section: classDoc.section
        },
        total: assignments.length,
        assignments: assignmentsWithStatus
      });
    } else {
      res.json({
        class: {
          id: classDoc._id,
          name: classDoc.name,
          section: classDoc.section
        },
        total: assignments.length,
        assignments
      });
    }
    
  } catch (error) {
    console.error('Get class assignments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/student/:studentId', protect, async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Check access
    let hasAccess = false;
    if (req.user.role === 'admin') hasAccess = true;
    else if (req.user.role === 'teacher') hasAccess = true;
    else if (req.user.role === 'student' && req.user._id.toString() === studentId) hasAccess = true;
    else if (req.user.role === 'parent') {
      const student = await User.findOne({ _id: studentId, parent: req.user._id });
      hasAccess = !!student;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Not authorized to view these assignments' 
      });
    }
    
    // Get student's class
    const student = await User.findById(studentId).populate('class');
    if (!student || !student.class) {
      return res.status(404).json({ 
        message: 'Student not found or not assigned to a class' 
      });
    }
    
    const assignments = await Assignment.find({ 
      class: student.class._id,
      status: 'published'
    })
      .populate('subject', 'name code')
      .populate('teacher', 'name email')
      .sort({ dueDate: 1 });
    
    // Add submission status for each assignment
    const assignmentsWithStatus = assignments.map(assignment => {
      const obj = assignment.toObject();
      const submission = assignment.submissions.find(
        s => s.student.toString() === studentId
      );
      
      obj.submissionStatus = submission ? {
        submitted: true,
        status: submission.status,
        submittedAt: submission.submittedAt,
        hasFiles: submission.files && submission.files.length > 0,
        graded: !!(submission.grade && submission.grade.pointsAwarded),
        pointsAwarded: submission.grade?.pointsAwarded,
        feedback: submission.grade?.feedback
      } : {
        submitted: false,
        canSubmit: canSubmit(assignment, studentId)
      };
      
      return obj;
    });
    
    // Separate into categories
    const pending = assignmentsWithStatus.filter(
      a => !a.submissionStatus.submitted && a.submissionStatus.canSubmit
    );
    const submitted = assignmentsWithStatus.filter(
      a => a.submissionStatus.submitted && !a.submissionStatus.graded
    );
    const graded = assignmentsWithStatus.filter(
      a => a.submissionStatus.graded
    );
    const overdue = assignmentsWithStatus.filter(
      a => !a.submissionStatus.submitted && new Date(a.dueDate) < new Date()
    );
    
    res.json({
      student: {
        id: student._id,
        name: student.name,
        class: student.class.name
      },
      counts: {
        total: assignments.length,
        pending: pending.length,
        submitted: submitted.length,
        graded: graded.length,
        overdue: overdue.length
      },
      assignments: {
        pending,
        submitted,
        graded,
        overdue
      }
    });
    
  } catch (error) {
    console.error('Get student assignments error:', error);
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
      dueDate: { $gte: today, $lte: futureDate },
      status: 'published'
    };
    
    // For students, only show their class assignments
    if (req.user.role === 'student' && req.user.class) {
      filter.class = req.user.class;
    }
    
    // For teachers, show assignments they created
    if (req.user.role === 'teacher') {
      filter.teacher = req.user._id;
    }
    
    const assignments = await Assignment.find(filter)
      .populate('class', 'name section')
      .populate('subject', 'name code')
      .populate('teacher', 'name')
      .sort({ dueDate: 1 });
    
    res.json({
      count: assignments.length,
      assignments
    });
    
  } catch (error) {
    console.error('Get upcoming assignments error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check access
    const hasAccess = await canAccessAssignment(req.user, id);
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Not authorized to view this assignment' 
      });
    }
    
    const assignment = await Assignment.findById(id)
      .populate('class', 'name section grade')
      .populate('subject', 'name code')
      .populate('teacher', 'name email')
      .populate('submissions.student', 'name email');
    
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    const response = assignment.toObject();
    
    // If student, add their submission info
    if (req.user.role === 'student') {
      const mySubmission = assignment.submissions.find(
        s => s.student._id.toString() === req.user._id.toString()
      );
      response.mySubmission = mySubmission || null;
      response.canSubmit = canSubmit(assignment, req.user._id.toString());
    }
    
    // If teacher, add submission statistics
    if (req.user.role === 'teacher' || req.user.role === 'admin') {
      const total = assignment.submissions.length;
      const submitted = assignment.submissions.length;
      const graded = assignment.submissions.filter(s => s.grade && s.grade.pointsAwarded).length;
      const late = assignment.submissions.filter(s => s.status === 'late').length;
      
      response.statistics = {
        total,
        submitted,
        graded,
        late,
        pending: submitted - graded
      };
    }
    
    res.json({ assignment: response });
    
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== TEACHER/ADMIN ROUTES ====================

router.post('/', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const { 
      title, description, class: classId, subject,
      dueDate, points, attachments, allowLateSubmissions, latePenalty
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
    
    // Create assignment
    const assignment = new Assignment({
      title,
      description,
      class: classId,
      subject,
      teacher: req.user._id,
      dueDate,
      points: points || 100,
      attachments: attachments || [],
      allowLateSubmissions: allowLateSubmissions || false,
      latePenalty: latePenalty || 0,
      status: 'draft',
      submissions: []
    });
    
    await assignment.save();
    
    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate('class', 'name section')
      .populate('subject', 'name code')
      .populate('teacher', 'name email');
    
    res.status(201).json({
      message: 'Assignment created successfully',
      assignment: populatedAssignment
    });
    
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check access
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Only creator or admin can update
    if (req.user.role !== 'admin' && assignment.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Not authorized to update this assignment' 
      });
    }
    
    const updates = req.body;
    
    // Don't allow updating submissions through this route
    delete updates.submissions;
    
    const updatedAssignment = await Assignment.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('class', 'name section')
      .populate('subject', 'name code')
      .populate('teacher', 'name email');
    
    res.json({
      message: 'Assignment updated successfully',
      assignment: updatedAssignment
    });
    
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.patch('/:id/publish', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { publish } = req.body;
    
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Only creator or admin can publish
    if (req.user.role !== 'admin' && assignment.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Not authorized to publish this assignment' 
      });
    }
    
    assignment.status = publish ? 'published' : 'draft';
    await assignment.save();
    
    res.json({
      message: `Assignment ${publish ? 'published' : 'unpublished'} successfully`,
      status: assignment.status
    });
    
  } catch (error) {
    console.error('Publish assignment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const assignment = await Assignment.findById(id);
    
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Check if there are submissions
    if (assignment.submissions.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete assignment with submissions. Archive it instead.' 
      });
    }
    
    await Assignment.findByIdAndDelete(id);
    
    res.json({
      message: 'Assignment deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id/submissions', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    const assignment = await Assignment.findById(id)
      .populate('class', 'name section')
      .populate('subject', 'name code')
      .populate('submissions.student', 'name email')
      .populate('submissions.grade.gradedBy', 'name');
    
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Check access
    if (req.user.role !== 'admin' && assignment.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Not authorized to view these submissions' 
      });
    }
    
    // Separate submissions by status
    const submissions = {
      all: assignment.submissions,
      submitted: assignment.submissions.filter(s => s.status === 'submitted' || s.status === 'late'),
      graded: assignment.submissions.filter(s => s.grade && s.grade.pointsAwarded),
      late: assignment.submissions.filter(s => s.status === 'late'),
      notSubmitted: []
    };
    
    // Get class students to find who hasn't submitted
    const classDoc = await Class.findById(assignment.class._id).populate('students');
    const studentIds = classDoc.students.map(s => s._id.toString());
    const submittedStudentIds = assignment.submissions.map(s => s.student._id.toString());
    
    const notSubmitted = studentIds.filter(id => !submittedStudentIds.includes(id));
    
    submissions.notSubmitted = await User.find({ 
      _id: { $in: notSubmitted },
      role: 'student'
    }).select('name email');
    
    res.json({
      assignment: {
        id: assignment._id,
        title: assignment.title,
        totalPoints: assignment.points
      },
      statistics: {
        total: classDoc.students.length,
        submitted: submissions.submitted.length,
        graded: submissions.graded.length,
        late: submissions.late.length,
        notSubmitted: notSubmitted.length
      },
      submissions
    });
    
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.put('/:id/submissions/:submissionId/grade', protect, async (req, res) => {
  try {
    const { id, submissionId } = req.params;
    const { pointsAwarded, feedback } = req.body;
    
    const assignment = await Assignment.findById(id);
    
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Check access
    if (req.user.role !== 'admin' && assignment.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Not authorized to grade this assignment' 
      });
    }
    
    // Find the submission
    const submission = assignment.submissions.id(submissionId);
    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }
    
    // Validate points
    if (pointsAwarded < 0 || pointsAwarded > assignment.points) {
      return res.status(400).json({ 
        message: `Points must be between 0 and ${assignment.points}` 
      });
    }
    
    // Update grade
    submission.grade = {
      pointsAwarded,
      feedback: feedback || '',
      gradedBy: req.user._id,
      gradedAt: new Date()
    };
    
    submission.status = 'graded';
    
    await assignment.save();
    
    res.json({
      message: 'Submission graded successfully',
      submission: {
        student: submission.student,
        status: submission.status,
        submittedAt: submission.submittedAt,
        grade: submission.grade
      }
    });
    
  } catch (error) {
    console.error('Grade submission error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ==================== STUDENT ROUTES ====================

router.post('/:id/submit', protect, authorize('student'), async (req, res) => {
  try {
    const { id } = req.params;
    const { files, comments } = req.body;
    
    const assignment = await Assignment.findById(id);
    
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    // Check if student is in the class
    const classDoc = await Class.findById(assignment.class);
    if (!classDoc.students.includes(req.user._id)) {
      return res.status(403).json({ 
        message: 'You are not enrolled in this class' 
      });
    }
    
    // Check if can submit
    if (!canSubmit(assignment, req.user._id.toString())) {
      if (assignment.status !== 'published') {
        return res.status(400).json({ 
          message: 'This assignment is not accepting submissions' 
        });
      }
      if (new Date() > assignment.dueDate && !assignment.allowLateSubmissions) {
        return res.status(400).json({ 
          message: 'The due date has passed and late submissions are not allowed' 
        });
      }
    }
    
    // Check if already submitted
    const existingSubmission = assignment.submissions.find(
      s => s.student.toString() === req.user._id.toString()
    );
    
    if (existingSubmission) {
      return res.status(400).json({ 
        message: 'You have already submitted this assignment' 
      });
    }
    
    // Determine if late
    const now = new Date();
    const isLate = now > assignment.dueDate;
    
    // Create submission
    assignment.submissions.push({
      student: req.user._id,
      submittedAt: now,
      files: files || [],
      comments: comments || '',
      status: isLate ? 'late' : 'submitted',
      grade: null
    });
    
    await assignment.save();
    
    res.status(201).json({
      message: isLate ? 'Assignment submitted late' : 'Assignment submitted successfully',
      submittedAt: now,
      status: isLate ? 'late' : 'submitted'
    });
    
  } catch (error) {
    console.error('Submit assignment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/:id/submissions/student/:studentId', protect, async (req, res) => {
  try {
    const { id, studentId } = req.params;
    
    // Check access
    let hasAccess = false;
    if (req.user.role === 'admin') hasAccess = true;
    else if (req.user.role === 'teacher') hasAccess = true;
    else if (req.user.role === 'student' && req.user._id.toString() === studentId) hasAccess = true;
    else if (req.user.role === 'parent') {
      const student = await User.findOne({ _id: studentId, parent: req.user._id });
      hasAccess = !!student;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ 
        message: 'Not authorized to view this submission' 
      });
    }
    
    const assignment = await Assignment.findById(id)
      .populate('class', 'name section')
      .populate('subject', 'name code')
      .populate('teacher', 'name email');
    
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }
    
    const submission = assignment.submissions.find(
      s => s.student.toString() === studentId
    );
    
    if (!submission) {
      return res.status(404).json({ 
        message: 'No submission found for this student' 
      });
    }
    
    // Get student info
    const student = await User.findById(studentId).select('name email');
    
    res.json({
      assignment: {
        id: assignment._id,
        title: assignment.title,
        points: assignment.points,
        dueDate: assignment.dueDate
      },
      student,
      submission
    });
    
  } catch (error) {
    console.error('Get student submission error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;