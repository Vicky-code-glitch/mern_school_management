const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  name: {
    // The display name of the class (e.g., "Grade 10A", "JSS 3B")
    type: String,  // Must be text
    required: true, // Every class MUST have a name
    trim: true  // Remove spaces from start/end automatically
  },
  grade: {
    type: mongoose.Schema.Types.ObjectId,
    // This stores an ID that points to a document in the Grade collection
    ref: 'Grade',
    required: true
  },
  section: {
    // The section/stream of the class (e.g., "A", "B", etc.)
    type: String,
    trim: true,
    default: 'A'   // If not specified, default to "A"
  },
  academicYear: {
    // Which school year this class runs (e.g, "2025-2026")
    type: String,
    required: true
  },
  classTeacher: {
    // The teacher responsibe for this class
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  students: [{
    // All students enrolled in this class
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'   // Each is a reference to a User document (should be a student)
  }],
  subjects: [{
    // Subjects taught in this class, WITH the specific teacher for each
    subject: {
      // Which subject (e.g., "Mathematics", "English")
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    teacher: {
      // Which teacher teaches THIS subject to this class
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'   // References a User (should be a teacher)
    }
  }],
  roomNumber: {
    // Physical location where the class is held (e.g., "Room 101")
    type: String,
    default: ''
  },
  capacity: {
    // Maximum number of students allowed in this class
    type: Number,
    default: 30,  // Default capacity if not specified
    min: 1,       // Can't have negative or zero 
    max: 100      // Reasonable upper limit for class size
  },
  schedule: [{
    // Weekly timetable for this class
    day: {
      // Which day of the week this class meets (e.g., "Monday", "Tuesday")
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        // enum restricts to ONLY these values, ensuring data consistency
    },
    // startTime: String,  // Time when the class starts (e.g., "08:00")
    endTime: String,       // Time when the class ends (e.g., "09:00")
    subject: {
      // Which subject is being taught during this time slot
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject'
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure no duplicate classes
classSchema.index({ grade: 1, section: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);