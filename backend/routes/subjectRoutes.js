const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');


router.get('/', protect, async (req, res) => {
    try {
        const { search, department, isActive, page = 1, limit = 20 } = req.query;
    
        // Build filter object
        let filter = {};
        if (department) filter.department = department;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
    
        // Text search if provided
        if (search) {
            filter.$text = { $search: search };
        }
    
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
    
        // Execute query
        const subjects = await Subject.find(filter)
            .populate('teachers', 'name email')
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ name: 1 });
    
        // Get total count for pagination
        const total = await Subject.countDocuments(filter);
    
        res.json({
            subjects,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    
    } 
    catch (error) {
        console.error('Get subjects error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
    
        const subject = await Subject.findById(id)
            .populate('teachers', 'name email');
    
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }
    
        res.json({ subject });
    
    } 
    catch (error) {
        console.error('Get subject error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/:id/teachers', protect, async (req, res) => {
    try {
        const { id } = req.params;
    
        const subject = await Subject.findById(id)
            .populate('teachers', 'name email');
    
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }
    
        res.json({ 
            subject: subject.name,
            teachers: subject.teachers 
        });
    
    } 
    catch (error) {
        console.error('Get subject teachers error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const { name, code, description, credits, department, teachers } = req.body;
    
        // Check if subject already exists
        const existingSubject = await Subject.findOne({ 
            $or: [{ name }, { code }] 
        });
    
        if (existingSubject) {
            return res.status(400).json({ 
                message: 'Subject with this name or code already exists' 
            });
        }
    
        // Create new subject
        const subject = new Subject({
            name,
            code: code.toUpperCase(), // Ensure uppercase
            description,
            credits: credits || 1,
            department: department || 'General',
            teachers: teachers || []
        });
    
        await subject.save();
    
        res.status(201).json({
            message: 'Subject created successfully',
            subject
        });
    
    } 
    catch (error) {
        console.error('Create subject error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
    
        // If code is being updated, ensure uppercase
        if (updates.code) {
            updates.code = updates.code.toUpperCase();
        }
    
        const subject = await Subject.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        ).populate('teachers', 'name email');
    
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }
    
        res.json({
            message: 'Subject updated successfully',
            subject
        });
    
    } 
    catch (error) {
        console.error('Update subject error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
    
        // Check if subject is being used in any class
        const Class = require('../models/Class');
        const classesUsingSubject = await Class.findOne({ 
            'subjects.subject': id 
        });
    
        if (classesUsingSubject) {
            return res.status(400).json({ 
                message: 'Cannot delete subject that is assigned to classes. Deactivate it instead.' 
            });
        }
    
        // Soft delete
        const subject = await Subject.findByIdAndUpdate(
            id,
            { $set: { isActive: false } },
            { new: true }
        );
    
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }
    
        res.json({
            message: 'Subject deactivated successfully'
        });
    } 
    catch (error) {
        console.error('Delete subject error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.delete('/:id/hard', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
    
        // Check if subject is being used
        const Class = require('../models/Class');
        const classesUsingSubject = await Class.findOne({ 
            'subjects.subject': id 
        });
    
        if (classesUsingSubject) {
            return res.status(400).json({ 
                message: 'Cannot delete subject that is assigned to classes' 
            });
        }
    
        const subject = await Subject.findByIdAndDelete(id);
    
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }
    
        res.json({
            message: 'Subject permanently deleted'
        });
    } 
    catch (error) {
        console.error('Hard delete subject error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.post('/:id/teachers', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { teacherId } = req.body;
    
        // Check if teacher exists and is actually a teacher
        const teacher = await User.findOne({ 
            _id: teacherId, 
            role: 'teacher',
            isActive: true 
        });
    
        if (!teacher) {
            return res.status(404).json({ 
                message: 'Teacher not found or not active' 
            });
        }
    
        const subject = await Subject.findById(id);
    
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }
    
        // Check if teacher already assigned
        if (subject.teachers.includes(teacherId)) {
            return res.status(400).json({ 
                message: 'Teacher already assigned to this subject' 
            });
        }
    
        subject.teachers.push(teacherId);
        await subject.save();
    
        res.json({
            message: 'Teacher added to subject successfully',
            subject
        });
    } 
    catch (error) {
        console.error('Add teacher to subject error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.delete('/:id/teachers/:teacherId', protect, authorize('admin'), async (req, res) => {
    try {
        const { id, teacherId } = req.params;
    
        const subject = await Subject.findById(id);
    
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }
    
        subject.teachers = subject.teachers.filter(
            t => t.toString() !== teacherId
        );
    
        await subject.save();
    
        res.json({
            message: 'Teacher removed from subject successfully',
            subject
        });
    } 
    catch (error) {
        console.error('Remove teacher from subject error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;