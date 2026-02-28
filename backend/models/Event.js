const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    eventType: {
        type: String,
        required: true,
        enum: ['holiday', 'meeting', 'sports', 'cultural', 'academic', 'other'],
        default: 'other'
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true,
        validate: {
        validator: function(value) {
            return value >= this.startDate;
        },
        message: 'End date must be after or equal to start date'
        }
    },
    allDay: {
        type: Boolean,
        default: false
    },
    startTime: {
        type: String,
        required: function() {
            return !this.allDay;
        }
    },
    endTime: {
        type: String,
        required: function() {
            return !this.allDay;
        }
    },
    location: {
        type: String,
        default: ''
    },
    targetAudience: [{
        type: String,
        enum: ['all', 'students', 'teachers', 'parents', 'admin', 'specific-class']
    }],
    targetClasses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    color: {
        type: String,
        default: '#3788d8'
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurrencePattern: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
        required: function() {
            return this.isRecurring;
        }
    },
    recurrenceEndDate: {
        type: Date,
        required: function() {
            return this.isRecurring;
        }
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes for performance
eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ eventType: 1 });
eventSchema.index({ targetAudience: 1 });

module.exports = mongoose.model('Event', eventSchema);