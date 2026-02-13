const express = require('express');  // This brings in Express, a tool to handle web requests easily.
const cors = require('cors');  // This lets your React frontend (running on a different port) talk to this backend without security issues.
const dotenv = require('dotenv');  // This loads the secrets from your .env file.
const mongoose = require('mongoose');  // This is for connecting to MongoDB database.

dotenv.config();  // This line activates the .env file so we can use PORT, MONGO_URI, etc.

const app = express();  // Creates the actual server app.
app.use(cors());  // Turns on CORS protection.
app.use(express.json());  // Allows the server to understand JSON data sent from the frontend (like form submissions).

// This connects to your MongoDB database using the MONGO_URI from .env.
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))  // If successful, prints this in your terminal.
  .catch(err => console.log('MongoDB error:', err));  // If there's a problem, shows the error.

// This is a simple test route: When you visit /api/test, it sends back a message.
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend working!' });
});

// This starts the server on the PORT from .env (or 5000 if not set).
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));