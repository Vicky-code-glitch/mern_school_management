const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ['general', 'academic', 'administrative', 'emergency', 'event-reminder', 'achievement', 'other'],
        default: 'general'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    targetAudience: [{
        type: String,
        enum: ['all', 'students', 'teachers', 'parents', 'admin', 'specific-class', 'specific-student']
    }],
    targetClasses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    }],
    targetStudents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    publishDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    expiryDate: {
        type: Date,
        validate: {
        validator: function(value) {
            return !value || value >= this.publishDate;
        },
        message: 'Expiry date must be after publish date'
        }
    },
    isPinned: {
        type: Boolean,
        default: false
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
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    views: {
        type: Number,
        default: 0
    },
    acknowledgments: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        acknowledgedAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for performance
announcementSchema.index({ publishDate: -1 });
announcementSchema.index({ targetAudience: 1 });
announcementSchema.index({ priority: 1 });
announcementSchema.index({ status: 1 });
announcementSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);