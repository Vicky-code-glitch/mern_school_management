const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'teacher', 'student', 'parent'],
    required: true
  },
  image: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  // Teacher-specific fields
  subjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  }],
  // For teacher: which classes they teach
  teachingClasses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  }],
  
  // Student-specific fields
  grade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Grade'
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class'
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // For tracking student's attendance
  attendance: [{
    date: Date,
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused']
    }
  }],
  // Parent-specific fields
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // Common for all
  isActive: {
    type: Boolean,
    default: true
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', '']
  },
  dateOfBirth: Date,
  joinDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add index for better query performance
userSchema.index({ role: 1 });
userSchema.index({ class: 1 });
userSchema.index({ parent: 1 });

module.exports = mongoose.model('User', userSchema);