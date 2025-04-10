const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('./auth');
const pool = require('../config/db');

// Get all configured brands from the database
router.get('/brands', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM brands');
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add a new Re:Amaze brand to the database
router.post('/brands', authenticateToken, async (req, res) => {
  try {
    const { name, url, email, api_token } = req.body;
    const result = await pool.query(
      'INSERT INTO brands (name, url, email, api_token) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, url, email, api_token]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Channel summary
router.get('/channel-summary/:brandId', authenticateToken, async (req, res) => {
  try {
    const { brandId } = req.params;
    const { start_date, end_date } = req.query;

    // Get brand info from database
    const brandResult = await pool.query('SELECT * FROM brands WHERE id = $1', [brandId]);
    if (brandResult.rows.length === 0) {
      return res.status(404).json({ error: 'Brand not found' });
    }
    const brand = brandResult.rows[0];

    // Call Re:Amaze API
    let url = `https://${brand.url}.reamaze.io/api/v1/reports/channel_summary`;
    if (start_date && end_date) {
      url += `?start_date=${start_date}&end_date=${end_date}`;
    }

    const response = await axios.get(url, {
      auth: {
        username: brand.email,
        password: brand.api_token
      },
      headers: {
        'Accept': 'application/json'
      }
    });

    res.json(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error', details: err.toString() });
  }
});

// Tags report
router.get('/tags/:brandId', authenticateToken, async (req, res) => {
  try {
    const { brandId } = req.params;
    const { start_date, end_date } = req.query;
    
    const brandResult = await pool.query('SELECT * FROM brands WHERE id = $1', [brandId]);
    if (brandResult.rows.length === 0) return res.status(404).json({ error: 'Brand not found' });
    
    const brand = brandResult.rows[0];
    let url = `https://${brand.url}.reamaze.io/api/v1/reports/tags`;
    if (start_date && end_date) url += `?start_date=${start_date}&end_date=${end_date}`;
    
    const response = await axios.get(url, {
      auth: { username: brand.email, password: brand.api_token },
      headers: { 'Accept': 'application/json' }
    });
    
    res.json(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Staff report
router.get('/staff/:brandId', authenticateToken, async (req, res) => {
  try {
    const { brandId } = req.params;
    const { start_date, end_date } = req.query;
    
    const brandResult = await pool.query('SELECT * FROM brands WHERE id = $1', [brandId]);
    if (brandResult.rows.length === 0) return res.status(404).json({ error: 'Brand not found' });
    
    const brand = brandResult.rows[0];
    let url = `https://${brand.url}.reamaze.io/api/v1/reports/staff`;
    if (start_date && end_date) url += `?start_date=${start_date}&end_date=${end_date}`;
    
    const response = await axios.get(url, {
      auth: { username: brand.email, password: brand.api_token },
      headers: { 'Accept': 'application/json' }
    });
    
    res.json(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Response time
router.get('/response-time/:brandId', authenticateToken, async (req, res) => {
  try {
    const { brandId } = req.params;
    const { start_date, end_date } = req.query;
    
    const brandResult = await pool.query('SELECT * FROM brands WHERE id = $1', [brandId]);
    if (brandResult.rows.length === 0) return res.status(404).json({ error: 'Brand not found' });
    
    const brand = brandResult.rows[0];
    let url = `https://${brand.url}.reamaze.io/api/v1/reports/response_time`;
    if (start_date && end_date) url += `?start_date=${start_date}&end_date=${end_date}`;
    
    const response = await axios.get(url, {
      auth: { username: brand.email, password: brand.api_token },
      headers: { 'Accept': 'application/json' }
    });
    
    res.json(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Volume
router.get('/volume/:brandId', authenticateToken, async (req, res) => {
  try {
    const { brandId } = req.params;
    const { start_date, end_date } = req.query;
    
    const brandResult = await pool.query('SELECT * FROM brands WHERE id = $1', [brandId]);
    if (brandResult.rows.length === 0) return res.status(404).json({ error: 'Brand not found' });
    
    const brand = brandResult.rows[0];
    let url = `https://${brand.url}.reamaze.io/api/v1/reports/volume`;
    if (start_date && end_date) url += `?start_date=${start_date}&end_date=${end_date}`;
    
    const response = await axios.get(url, {
      auth: { username: brand.email, password: brand.api_token },
      headers: { 'Accept': 'application/json' }
    });
    
    res.json(response.data);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;