const mongoose = require('mongoose');

const examResultSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    exam: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    marksObtained: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: function(value) {
                return value >= 0;
        },
            message: 'Marks cannot be negative'
        }
    },
    totalMarks: {
        type: Number,
        required: true,
        min: 1
    },
    percentage: {
        type: Number,
        min: 0,
        max: 100
    },
    grade: {
        type: String,
        enum: ['A', 'B', 'C', 'D', 'E', 'F']
    },
    gradePoints: {
        type: Number,
        min: 0,
        max: 4
    },
    status: {
        type: String,
        enum: ['pass', 'fail', 'absent', 'malpractice'],
        required: true
    },
    remarks: {
        type: String,
        default: ''
    },
    gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    gradedAt: {
        type: Date,
        default: Date.now
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    term: {
        type: String,
        required: true,
        enum: ['Term 1', 'Term 2', 'Term 3', 'First Term', 'Second Term', 'Third Term']
    },
    academicYear: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Unique index to prevent duplicate results
examResultSchema.index({ student: 1, exam: 1 }, { unique: true });

// Indexes for performance
examResultSchema.index({ student: 1, term: 1, academicYear: 1 });
examResultSchema.index({ exam: 1 });
examResultSchema.index({ subject: 1 });
examResultSchema.index({ status: 1 });

// Pre-save middleware to calculate derived fields
examResultSchema.pre('save', function(next) {
  if (this.marksObtained && this.totalMarks) {
    this.percentage = (this.marksObtained / this.totalMarks) * 100;
    
    if (this.percentage >= 80) {
      this.grade = 'A';
      this.gradePoints = 4;
    } else if (this.percentage >= 70) {
      this.grade = 'B';
      this.gradePoints = 3;
    } else if (this.percentage >= 60) {
      this.grade = 'C';
      this.gradePoints = 2;
    } else if (this.percentage >= 50) {
      this.grade = 'D';
      this.gradePoints = 1;
    } else if (this.percentage >= 40) {
      this.grade = 'E';
      this.gradePoints = 0;
    } else {
      this.grade = 'F';
      this.gradePoints = 0;
    }
    
    if (this.status !== 'absent' && this.status !== 'malpractice') {
      this.status = this.percentage >= 40 ? 'pass' : 'fail';
    }
  }
  next();
});

module.exports = mongoose.model('ExamResult', examResultSchema);