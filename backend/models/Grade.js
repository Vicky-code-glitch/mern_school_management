const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    level: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    subjects: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject'
    }],
    nextGrade: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Grade'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

gradeSchema.index({ level: 1 });         // Speed up sorting by level
gradeSchema.index({ isActive: 1 });      // Speed up active/inactive filters
gradeSchema.index({ name: 'text' });     // Allows searching for "tenth" to find "Grade 10" 

module.exports = mongoose.model('Grade', gradeSchema);
// 'Grade' becomes 'grades' collection in MongoDB
