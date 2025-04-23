const axios = require('axios');

async function testApi() {
  try {
    const response = await axios.post(
      'https://salesgpt-prod-3lu6lw5c5q-as.a.run.app/api/generateSalesStrategy',
      {
        companyName: 'Example Corp',
        industry: 'Technology',
        targetMarket: 'Enterprise'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': 'salesgpt-secure-key-xhsjdjwn2849wbfewdsknsk'
        }
      }
    );
    console.log('API Response:', response.data);
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

testApi();
