const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Login route - simple hardcoded auth for this basic project
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (username === process.env.ADMIN_USERNAME) {
      // Compare with hashed password stored in env
      const isMatch = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
      
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      // Generate tokene
      const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '24h' });
      res.json({ token });
    } else {
      res.status(400).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify token validity
router.get('/verify', authenticateToken, (req, res) => {
  res.json({ valid: true });
});

module.exports = { router, authenticateToken };