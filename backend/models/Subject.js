const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    credits: {
        type: Number,
        default: 1,
        min: 0,
        max: 5
    },
    teachers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    department: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { 
    timestamps: true 
});

subjectSchema.index({ name: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Subject', subjectSchema);