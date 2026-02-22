const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
    title: {
        // Name of the assignment (e.g., "Essay on Climate Change")
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    points: {
        type: Number,
        required: true,
        min: 1,
        max: 1000
    },
    attachments: [{
        filename: String,
        fileUrl: String,
        fileType: String,
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }],
    submissions: [{
        // Student submissions for this assignment
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        submittedAt: {
            type: Date,
            default: Date.now     // When they submitted
        },
        files: [{
            // Submitted files (essay, worksheet, etc.)
            filename: String,
            fileUrl: String,
            fileType: String
        }],
        comments: {
            type: String,        // Optional student note
            default: ''
        },
        status: {
            type: String,
            enum: ['submitted', 'late', 'graded', 'returned'],
            default: 'submitted'
        },
        grade: {
            // Points awarded (optional - assignment might not be graded yet)
            pointsAwarded: {
                type: Number,
                min: 0,
                validate: {
                    validator: function(value) {
                        // If pointsAwarded exists, it can't exceed total points
                        return !value || value <= this.points;
                    },
                    message: 'Points awarded cannot exceed total points'
                }
            },
            feedback: {
                type: String,      // Teacher's comments
                default: ''
            },
            gradedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'        // Which teacher graded it
            },
            gradedAt: Date
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    status: {
        // Current state of the assignment
        type: String,
        enum: ['draft', 'published', 'closed', 'archived'],
        default: 'draft'       // Teachers create as draft first
    },
    allowLateSubmissions: {
        // Can students submit after due date?
        type: Boolean,
        default: false         // Default: no late submissions
    },
    latePenalty: {
        // How much penalty for late submissions (percentage)
        type: Number,
        min: 0,
        max: 100,
        default: 0,
        // Only relevant if allowLateSubmissions is true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
})

assignmentSchema.index({ class: 1, dueDate: -1 });     // Find class assignments by due date
assignmentSchema.index({ teacher: 1 });                 // Find all assignments by a teacher
assignmentSchema.index({ status: 1 });                   // Filter by status
assignmentSchema.index({ dueDate: 1 });                   // Find assignments by due date
assignmentSchema.index({ 'submissions.student': 1 });    // Find assignments a student submitted to

module.exports = mongoose.model('Assignment', assignmentSchema);