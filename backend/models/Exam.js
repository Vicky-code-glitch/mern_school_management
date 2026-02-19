const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    title: {
        // Name of the exam (e.g., "Final Exam")
        type: String,
        required: true,
        trim: true
    },
    class: {
        // which class is taking this exam
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    subject: {
        // Whicj subject this exam is for (eg., Mathematics)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    date: {
        type: Date,
        required: true      // Exams need a scheduled date
    },
    duration: {
        type: Number,
        required: true,
        min: 45,
        max: 240
    },
    totalMarks: {
        // Maximum possible score (100)
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    passingMarks: {
        // Minimum marks required to pass
        type: Number,
        required: true,
        min: 0,
        validate: {
            // Custom validation: passing marks cannot exceed total marks
            validator: function(value) {
                return value <= this.totalMarks;
            },
            message: "Passing marks cannot exceed total marks"
        }
    },
    term: {
        // Which term/semester
        type: String,
        required: true,
        enum: ['Term 1', 'Term 2', 'Term 3', 'First Term', 'Second Term', 'Third Term']
    },
    status: {
        // Currents state of the exam
        type: String,
        enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    results: [{
        // Individual student results for this exam
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',         // References a student
            required: true
        },
        marksObtained: {
            type: Number,
            required: true,
            min: 0,
            validate: {
                // Marks cannot exceed totalMarks
                validator: function(value) {
                    return value <= this.totalMarks;
                },
                message: 'Marks obtained cannot exceed total marks'
            }
        },
        grade: {
            // Letter grade (A, B, C, etc.) - can be calculated or entered manually
            type: String,
            enum: ['A', 'B', 'C', 'D', 'E', 'F']
        },
        remarks: {
            type: String,
            default: ''
        }
    }],
    createdBy: {
        // Which teacher/admin created this exam
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',           // References a User (should be teacher/admin)
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
}, {
    timestamps: true
});

examSchema.index({ class: 1, date: -1 });   
examSchema.index({ subject: 1 });           
examSchema.index({ status: 1 });            
examSchema.index({ date: 1 });                  

module.exports = mongoose.model('Exam', examSchema);