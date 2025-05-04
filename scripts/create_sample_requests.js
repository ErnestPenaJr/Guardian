// Script to create sample requests for testing
const axios = require('axios');

async function createSampleRequests() {
  try {
    // Get the token from localStorage (you need to be logged in first)
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.error('You must be logged in to run this script. Please log in to the application first.');
      return;
    }
    
    const response = await axios.post(
      'http://localhost:3001/api/requests/create-samples', 
      { count: 10 }, // Create 10 sample requests
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Sample requests created:', response.data);
  } catch (error) {
    console.error('Error creating sample requests:', error.response?.data || error.message);
  }
}

// Execute the function
createSampleRequests();
