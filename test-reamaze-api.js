// Save this to a file e.g., test-reamaze-api.js in your project root
require('dotenv').config();
const axios = require('axios');

// Replace with one of your actual brand URLs from your database
const brandUrl = 'julegenserbutikken'; // e.g., 'mycompany'

// Use the credentials from your .env file
const email = process.env.REAMAZE_EMAIL;
const apiToken = process.env.REAMAZE_API_TOKEN;

// Get date range for last 30 days
const endDate = new Date().toISOString().split('T')[0];
const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

// Test the API directly
async function testReamazeAPI() {
  try {
    console.log(`Testing Re:amaze API for brand: ${brandUrl}`);
    console.log(`Date range: ${startDate} to ${endDate}`);
    
    const url = `https://${brandUrl}.reamaze.io/api/v1/reports/channel_summary?start_date=${startDate}&end_date=${endDate}`;
    console.log(`URL: ${url}`);
    
    const response = await axios.get(url, {
      auth: {
        username: email,
        password: apiToken
      },
      headers: {
        'Accept': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    
    // Check if we have channels in the response
    if (response.data && response.data.channels) {
      console.log(`Found ${Object.keys(response.data.channels).length} channels`);
      
      // Look for satisfaction ratings
      let ratingsFound = 0;
      let totalRating = 0;
      
      Object.entries(response.data.channels).forEach(([channelId, data]) => {
        console.log(`\nChannel: ${data.channel?.name || channelId}`);
        console.log(`  Type: ${data.channel?.channel_type_name || 'Unknown'}`);
        console.log(`  Active conversations: ${data.active_conversations || 0}`);
        
        if (data.average_satisfaction_rating !== undefined) {
          console.log(`  Satisfaction rating: ${data.average_satisfaction_rating}`);
          ratingsFound++;
          totalRating += data.average_satisfaction_rating;
        } else {
          console.log(`  Satisfaction rating: Not available`);
        }
      });
      
      console.log(`\nSummary:`);
      console.log(`  Channels with satisfaction ratings: ${ratingsFound}/${Object.keys(response.data.channels).length}`);
      
      if (ratingsFound > 0) {
        console.log(`  Average satisfaction rating: ${(totalRating / ratingsFound).toFixed(2)}`);
      } else {
        console.log(`  No satisfaction ratings found`);
      }
    } else {
      console.log('No channels found in the response');
      console.log('Response data:', response.data);
    }
  } catch (error) {
    console.error('Error testing API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testReamazeAPI();