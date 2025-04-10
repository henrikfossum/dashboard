const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken } = require('./auth');
const pool = require('../config/db');
require('dotenv').config();

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
    const { name, url } = req.body;
    const result = await pool.query(
      'INSERT INTO brands (name, url) VALUES ($1, $2) RETURNING *',
      [name, url]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a brand
router.delete('/brands/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM brands WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Aggregated Channel summary
router.get('/channel-summary', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get all brands
    const brandsResult = await pool.query('SELECT * FROM brands');
    const brands = brandsResult.rows;
    
    console.log(`[DEBUG] Found ${brands.length} brands`);
    
    if (brands.length === 0) {
      return res.json({ channels: {}, aggregated: { active_conversations: 0, average_satisfaction_rating: 0 } });
    }

    // Fetch channel summary for each brand
    const brandsData = await Promise.all(
      brands.map(async (brand) => {
        try {
          let url = `https://${brand.url}.reamaze.io/api/v1/reports/channel_summary`;
          if (start_date && end_date) {
            url += `?start_date=${start_date}&end_date=${end_date}`;
          }
          
          console.log(`[DEBUG] Fetching data for brand: ${brand.name} from: ${url}`);

          const response = await axios.get(url, {
            auth: {
              username: process.env.REAMAZE_EMAIL,
              password: process.env.REAMAZE_API_TOKEN
            },
            headers: {
              'Accept': 'application/json'
            }
          });
          
          // Log the first channel to see if it contains satisfaction data
          const firstChannelKey = Object.keys(response.data.channels || {})[0];
          if (firstChannelKey) {
            const firstChannel = response.data.channels[firstChannelKey];
            console.log(`[DEBUG] First channel for ${brand.name}:`, {
              name: firstChannel.channel?.name,
              hasSatisfactionRating: firstChannel.average_satisfaction_rating !== undefined,
              satisfactionRating: firstChannel.average_satisfaction_rating
            });
          } else {
            console.log(`[DEBUG] No channels found for ${brand.name}`);
          }
          
          return { brand: brand.name, data: response.data };
        } catch (error) {
          console.error(`[ERROR] Error fetching channel summary for ${brand.name}:`, error.message);
          return { brand: brand.name, error: error.message };
        }
      })
    );

    // Aggregate the data
    const aggregatedData = {
      channels: {},
      aggregated: {
        active_conversations: 0,
        average_satisfaction_rating: 0,
        total_satisfaction_ratings: 0
      },
      brands: brandsData
    };

    let validBrandsCount = 0;
    let satisfactionRatingsFound = 0;

    brandsData.forEach(brandData => {
      if (brandData.data && brandData.data.channels) {
        validBrandsCount++;
        
        console.log(`[DEBUG] Processing ${Object.keys(brandData.data.channels).length} channels for ${brandData.brand}`);
        
        Object.entries(brandData.data.channels).forEach(([channel, data]) => {
          if (!aggregatedData.channels[channel]) {
            aggregatedData.channels[channel] = {
              active_conversations: 0,
              average_satisfaction_rating: 0,
              total_satisfaction_ratings: 0
            };
          }
          
          aggregatedData.channels[channel].active_conversations += (data.active_conversations || 0);
          
          // Log each channel's satisfaction rating
          console.log(`[DEBUG] Channel ${channel} - satisfaction rating:`, {
            exists: data.average_satisfaction_rating !== undefined,
            value: data.average_satisfaction_rating
          });
          
          if (data.average_satisfaction_rating !== undefined && data.average_satisfaction_rating !== null) {
            satisfactionRatingsFound++;
            aggregatedData.channels[channel].total_satisfaction_ratings += 1;
            aggregatedData.channels[channel].average_satisfaction_rating += data.average_satisfaction_rating;
            
            aggregatedData.aggregated.total_satisfaction_ratings += 1;
            aggregatedData.aggregated.average_satisfaction_rating += data.average_satisfaction_rating;
          }
        });
        
        aggregatedData.aggregated.active_conversations += Object.values(brandData.data.channels)
          .reduce((sum, channel) => sum + (channel.active_conversations || 0), 0);
      }
    });

    // Calculate averages
    Object.values(aggregatedData.channels).forEach(channel => {
      if (channel.total_satisfaction_ratings > 0) {
        channel.average_satisfaction_rating = parseFloat((channel.average_satisfaction_rating / channel.total_satisfaction_ratings).toFixed(2));
      } else {
        channel.average_satisfaction_rating = 0;
      }
    });
    
    console.log(`[DEBUG] Total satisfaction ratings found: ${satisfactionRatingsFound}`);
    console.log(`[DEBUG] Aggregated total_satisfaction_ratings: ${aggregatedData.aggregated.total_satisfaction_ratings}`);
    console.log(`[DEBUG] Aggregated average_satisfaction_rating (before avg): ${aggregatedData.aggregated.average_satisfaction_rating}`);

    if (aggregatedData.aggregated.total_satisfaction_ratings > 0) {
      aggregatedData.aggregated.average_satisfaction_rating = parseFloat(
        (aggregatedData.aggregated.average_satisfaction_rating / aggregatedData.aggregated.total_satisfaction_ratings).toFixed(2)
      );
      console.log(`[DEBUG] Final average_satisfaction_rating: ${aggregatedData.aggregated.average_satisfaction_rating}`);
    } else {
      console.log(`[DEBUG] No satisfaction ratings found, setting average to 0`);
      aggregatedData.aggregated.average_satisfaction_rating = 0;
    }

    res.json(aggregatedData);
  } catch (err) {
    console.error(`[ERROR] Server error in channel-summary:`, err.message);
    res.status(500).json({ error: 'Server error', details: err.toString() });
  }
});

// Aggregated Tags report
router.get('/tags', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get all brands
    const brandsResult = await pool.query('SELECT * FROM brands');
    const brands = brandsResult.rows;
    
    if (brands.length === 0) {
      return res.json({ tags: {} });
    }

    // Fetch tags for each brand
    const brandsData = await Promise.all(
      brands.map(async (brand) => {
        try {
          let url = `https://${brand.url}.reamaze.io/api/v1/reports/tags`;
          if (start_date && end_date) {
            url += `?start_date=${start_date}&end_date=${end_date}`;
          }

          const response = await axios.get(url, {
            auth: {
              username: process.env.REAMAZE_EMAIL,
              password: process.env.REAMAZE_API_TOKEN
            },
            headers: {
              'Accept': 'application/json'
            }
          });
          return { brand: brand.name, data: response.data };
        } catch (error) {
          console.error(`Error fetching tags for ${brand.name}:`, error.message);
          return { brand: brand.name, error: error.message };
        }
      })
    );

    // Aggregate the data
    const aggregatedTags = {};

    brandsData.forEach(brandData => {
      if (brandData.data && brandData.data.tags) {
        Object.entries(brandData.data.tags).forEach(([tag, count]) => {
          if (!aggregatedTags[tag]) {
            aggregatedTags[tag] = 0;
          }
          aggregatedTags[tag] += count;
        });
      }
    });

    res.json({ 
      tags: aggregatedTags,
      brands: brandsData 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Aggregated Staff report
router.get('/staff', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get all brands
    const brandsResult = await pool.query('SELECT * FROM brands');
    const brands = brandsResult.rows;
    
    if (brands.length === 0) {
      return res.json({ report: {} });
    }

    // Fetch staff for each brand
    const brandsData = await Promise.all(
      brands.map(async (brand) => {
        try {
          let url = `https://${brand.url}.reamaze.io/api/v1/reports/staff`;
          if (start_date && end_date) {
            url += `?start_date=${start_date}&end_date=${end_date}`;
          }

          const response = await axios.get(url, {
            auth: {
              username: process.env.REAMAZE_EMAIL,
              password: process.env.REAMAZE_API_TOKEN
            },
            headers: {
              'Accept': 'application/json'
            }
          });
          return { brand: brand.name, data: response.data };
        } catch (error) {
          console.error(`Error fetching staff for ${brand.name}:`, error.message);
          return { brand: brand.name, error: error.message };
        }
      })
    );

    // Aggregate the data
    const aggregatedStaff = {};

    brandsData.forEach(brandData => {
      if (brandData.data && brandData.data.report) {
        Object.entries(brandData.data.report).forEach(([staff, data]) => {
          if (!aggregatedStaff[staff]) {
            aggregatedStaff[staff] = {
              response_count: 0,
              response_time_seconds: 0,
              total_response_time_entries: 0,
              appreciations_count: 0
            };
          }
          
          aggregatedStaff[staff].response_count += (data.response_count || 0);
          aggregatedStaff[staff].appreciations_count += (data.appreciations_count || 0);
          
          if (data.response_time_seconds) {
            aggregatedStaff[staff].response_time_seconds += data.response_time_seconds * (data.response_count || 1);
            aggregatedStaff[staff].total_response_time_entries += (data.response_count || 1);
          }
        });
      }
    });

    // Calculate average response times
    Object.values(aggregatedStaff).forEach(staff => {
      if (staff.total_response_time_entries > 0) {
        staff.response_time_seconds = parseInt(staff.response_time_seconds / staff.total_response_time_entries);
      }
      delete staff.total_response_time_entries;
    });

    res.json({ 
      report: aggregatedStaff,
      brands: brandsData 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Aggregated Response time
router.get('/response-time', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get all brands
    const brandsResult = await pool.query('SELECT * FROM brands');
    const brands = brandsResult.rows;
    
    if (brands.length === 0) {
      return res.json({ response_times: {}, summary: { averages: { in_range: 0 } } });
    }

    // Fetch response times for each brand
    const brandsData = await Promise.all(
      brands.map(async (brand) => {
        try {
          let url = `https://${brand.url}.reamaze.io/api/v1/reports/response_time`;
          if (start_date && end_date) {
            url += `?start_date=${start_date}&end_date=${end_date}`;
          }

          const response = await axios.get(url, {
            auth: {
              username: process.env.REAMAZE_EMAIL,
              password: process.env.REAMAZE_API_TOKEN
            },
            headers: {
              'Accept': 'application/json'
            }
          });
          return { brand: brand.name, data: response.data };
        } catch (error) {
          console.error(`Error fetching response times for ${brand.name}:`, error.message);
          return { brand: brand.name, error: error.message };
        }
      })
    );

    // Aggregate the data
    const aggregatedResponseTimes = {};
    let totalResponseTimeInRange = 0;
    let totalBrandsWithData = 0;

    brandsData.forEach(brandData => {
      if (brandData.data && brandData.data.response_times) {
        Object.entries(brandData.data.response_times).forEach(([date, seconds]) => {
          if (!aggregatedResponseTimes[date]) {
            aggregatedResponseTimes[date] = 0;
          }
          aggregatedResponseTimes[date] += seconds;
        });
        
        if (brandData.data.summary && brandData.data.summary.averages && brandData.data.summary.averages.in_range) {
          totalResponseTimeInRange += brandData.data.summary.averages.in_range;
          totalBrandsWithData++;
        }
      }
    });

    // Calculate average response time across all brands
    const averageResponseTimeInRange = totalBrandsWithData > 0 
      ? Math.round(totalResponseTimeInRange / totalBrandsWithData) 
      : 0;

    res.json({ 
      response_times: aggregatedResponseTimes,
      summary: {
        averages: {
          in_range: averageResponseTimeInRange
        }
      },
      brands: brandsData 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Aggregated Volume
router.get('/volume', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get all brands
    const brandsResult = await pool.query('SELECT * FROM brands');
    const brands = brandsResult.rows;
    
    if (brands.length === 0) {
      return res.json({ conversation_counts: {} });
    }

    // Fetch volume for each brand
    const brandsData = await Promise.all(
      brands.map(async (brand) => {
        try {
          let url = `https://${brand.url}.reamaze.io/api/v1/reports/volume`;
          if (start_date && end_date) {
            url += `?start_date=${start_date}&end_date=${end_date}`;
          }

          const response = await axios.get(url, {
            auth: {
              username: process.env.REAMAZE_EMAIL,
              password: process.env.REAMAZE_API_TOKEN
            },
            headers: {
              'Accept': 'application/json'
            }
          });
          return { brand: brand.name, data: response.data };
        } catch (error) {
          console.error(`Error fetching volume for ${brand.name}:`, error.message);
          return { brand: brand.name, error: error.message };
        }
      })
    );

    // Aggregate the data
    const aggregatedVolume = {};

    brandsData.forEach(brandData => {
      if (brandData.data && brandData.data.conversation_counts) {
        Object.entries(brandData.data.conversation_counts).forEach(([date, count]) => {
          if (!aggregatedVolume[date]) {
            aggregatedVolume[date] = 0;
          }
          aggregatedVolume[date] += count;
        });
      }
    });

    res.json({ 
      conversation_counts: aggregatedVolume,
      brands: brandsData 
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;