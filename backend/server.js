const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables
dotenv.config();

// Import models
const User = require('./models/User');
const Subject = require('./models/Subject');
const Class = require('./models/Class');
const Grade = require('./models/Grade');
const Exam = require('./models/Exam');
const Assignment = require('./models/Assignment');

const app = express();

// Middleware
app.use(cors());              
app.use(express.json());       

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend working!' });
});

// Test class route 
app.get('/api/test-class', async (req, res) => {
  try {
    const classCount = await Class.countDocuments();
    res.json({ 
      message: 'Class model is working!', 
      totalClasses: classCount,
      modelLoaded: true 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/test-grade', async (req, res) => {
  try {
    const gradeCount = await Grade.countDocuments();
    res.json({ 
      message: 'Grade model is working!', 
      totalGrades: gradeCount,
      modelLoaded: true 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/test-exam', async (req, res) => {
  try {
    const examCount = await Exam.countDocuments();
    res.json({ 
      message: 'Exam model is working!', 
      totalExams: examCount,
      modelLoaded: true 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/test-assignment', async (req, res) => {
  try {
    const assignmentCount = await Assignment.countDocuments();
    res.json({ 
      message: 'Assignment model is working!', 
      totalAssignments: assignmentCount,
      modelLoaded: true 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    console.log('✅ Models loaded:', { 
      User: !!User, 
      Subject: !!Subject, 
      Class: !!Class,
      Grade: !!Grade,
      Exam: !!Exam,
      Assignment: !!Assignment
    });
  })
  .catch(err => {
    console.log('MongoDB error:', err);
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

