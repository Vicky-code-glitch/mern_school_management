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

const app = express();

// Middleware
app.use(cors());              // Allow cross-origin requests
app.use(express.json());       // Parse JSON request bodies

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend working!' });
});

// Test class route (optional)
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

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    console.log('✅ Models loaded:', { 
      User: !!User, 
      Subject: !!Subject, 
      Class: !!Class,
      Grade: !!Grade
    });
  })
  .catch(err => {
    console.log('MongoDB error:', err);
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});