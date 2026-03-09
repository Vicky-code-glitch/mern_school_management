const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', protect, authorize('admin'), async (req, res) => {
    try {
        const { role, isActive, search, page = 1, limit = 10 } = req.query;
    
        // Build filter object
        let filter = {};
    
        if (role) filter.role = role;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
    
        // Text search if provided
        if (search) {
            filter.$or = [
                { 
                    name: { 
                        $regex: search, $options: 'i' 
                    } 
                },
                { 
                    email: { 
                        $regex: search, $options: 'i' 
                    } 
                },
                { 
                    username: { 
                        $regex: search, $options: 'i' 
                    } 
                }
            ];
        }
    
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
    
        // Execute query
        const users = await User.find(filter)
            .select('-password')
            .populate('subjects', 'name code')
            .populate('class', 'name section')
            .populate('grade', 'name level')
            .populate('students', 'name email')
            .populate('parent', 'name email')
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 });
    
        // Get total count for pagination
        const total = await User.countDocuments(filter);
    
        res.json({
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

router.get('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
    
        // Check if user is authorized (admin or same user)
        if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
            return res.status(403).json({ 
                message: 'Not authorized to view this user' 
            });
        }
    
        const user = await User.findById(id)
            .select('-password')
            .populate('subjects')
            .populate('class')
            .populate('grade')
            .populate('students')
            .populate('parent');
    
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
    
        res.json({ user });
    
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create a new user (by admin)
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const { username, email, password, name, role, ...otherFields } = req.body;
    
        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [
                { 
                    email 
                }, 
                { 
                    username 
                }
            ] 
        });
    
        if (existingUser) {
            return res.status(400).json({ 
                message: 'User with this email or username already exists' 
            });
        }
    
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
    
        // Create new user
        const user = new User({
            username,
            email,
            password: hashedPassword,
            name,
            role,
            ...otherFields
        });
    
        await user.save();
    
        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;
    
        res.status(201).json({
            message: 'User created successfully',
            user: userResponse
        });
    
    } 
    catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update user
router.put('/:id', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
    
        // Check if user is authorized (admin or same user)
        if (req.user.role !== 'admin' && req.user._id.toString() !== id) {
            return res.status(403).json({ 
                message: 'Not authorized to update this user' 
            });
        }
    
        // Non-admins cannot change role
        if (req.user.role !== 'admin' && updates.role) {
            delete updates.role;
        }
    
        // If password is being updated, hash it
        if (updates.password) {
            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(updates.password, salt);
        }
    
        // Find and update user
        const user = await User.findByIdAndUpdate(
            id,
            { 
                $set: updates 
            },
            { 
                new: true, runValidators: true 
            }
        ).select('-password');
    
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
    
        res.json({
            message: 'User updated successfully',
            user
        });
    
    } 
    catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @desc    Delete user (soft delete)
// @route   DELETE /api/users/:id
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete - set isActive to false
    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      message: 'User deactivated successfully',
      user
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Hard delete (permanent) - Admin only
router.delete('/:id/hard', protect, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
    
        const user = await User.findByIdAndDelete(id);
    
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
    
        res.json({
            message: 'User permanently deleted'
        });
    
    } 
    catch (error) {
        console.error('Hard delete user error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all teachers
router.get('/teachers', protect, async (req, res) => {
    try {
        const teachers = await User.find({ role: 'teacher', isActive: true })
            .select('-password')
            .populate('subjects', 'name code');
    
        res.json({ teachers });
    
    } 
    catch (error) {
        console.error('Get teachers error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all students
router.get('/students', protect, async (req, res) => {
    try {
        const students = await User.find({ role: 'student', isActive: true })
            .select('-password')
            .populate('class', 'name section')
            .populate('grade', 'name level')
            .populate('parent', 'name email');
    
        res.json({ students });
    
    } 
    catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all parents
router.get('/parents', protect, async (req, res) => {
    try {
        const parents = await User.find({ role: 'parent', isActive: true })
            .select('-password')
            .populate('students', 'name email class grade');
    
        res.json({ parents });
    
    } 
    catch (error) {
        console.error('Get parents error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get students by class
router.get('/class/:classId', protect, async (req, res) => {
    try {
        const { classId } = req.params;
    
        // Check if user is authorized (teacher of this class or admin)
        if (req.user.role !== 'admin') {
            // Check if teacher teaches this class
            const classDoc = await Class.findById(classId);
            if (!classDoc.classTeacher || classDoc.classTeacher.toString() !== req.user._id.toString()) {
                return res.status(403).json({ 
                    message: 'Not authorized to view students of this class' 
                });
            }
        }
    
        const students = await User.find({ 
            role: 'student', 
            class: classId,
            isActive: true 
        }).select('-password');
    
        res.json({ students });
    
    } 
    catch (error) {
        console.error('Get class students error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;