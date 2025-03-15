const request = require('request');  // Changed from import to require

const options = {
  method: 'GET',
  url: 'https://apollo-io-no-cookies-required.p.rapidapi.com/search_organization',
  qs: {
    q_organization_name: 'Google',
    page: '1',
    per_page: '5',  // Get more results
    exact_name_match: 'true' // Try to get exact matches
  },
  headers: {
    'x-rapidapi-key': 'e2941bfeeamshf10306bfb50c2b7p1895c3jsn364eb99e3308', // Use your key from .env
    'x-rapidapi-host': 'apollo-io-no-cookies-required.p.rapidapi.com'
  }
};

request(options, function (error, response, body) {
  if (error) throw new Error(error);
  
  try {
    // Parse and prettify the JSON response
    const data = JSON.parse(body);
    console.log('API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Extract and display companies found
    if (data.data && data.data.organizations) {
      console.log('\n-------------------------------------');
      console.log(`Found ${data.data.organizations.length} organizations:`);
      
      data.data.organizations.forEach((org, index) => {
        console.log(`\n${index + 1}. ${org.name}`);
        console.log(`   Website: ${org.website_url || 'N/A'}`);
        console.log(`   Industry: ${org.industry || 'N/A'}`);
        console.log(`   Revenue: ${org.organization_revenue_printed || 'N/A'}`);
        console.log(`   Employees: ${org.employees_count || 'N/A'}`);
      });
    }
  } catch (parseError) {
    console.error('Error parsing response:', parseError);
    console.log('Raw response:', body);
  }
});

// Add a test for organization details
function getCompanyDetails(companyId) {
  const detailOptions = {
    method: 'GET',
    url: 'https://apollo-io-no-cookies-required.p.rapidapi.com/organization_details',
    qs: {
      id: companyId
    },
    headers: {
      'x-rapidapi-key': 'e2941bfeeamshf10306bfb50c2b7p1895c3jsn364eb99e3308',
      'x-rapidapi-host': 'apollo-io-no-cookies-required.p.rapidapi.com'
    }
  };

  request(detailOptions, function (error, response, body) {
    if (error) throw new Error(error);
    
    try {
      const data = JSON.parse(body);
      console.log('\n-------------------------------------');
      console.log('DETAILED ORGANIZATION INFO:');
      console.log(JSON.stringify(data.data.organization, null, 2));
    } catch (parseError) {
      console.error('Error parsing detail response:', parseError);
    }
  });
}

// Get details for Google after initial search (will execute after the first API call returns)
request(options, function (error, response, body) {
  if (!error) {
    try {
      const data = JSON.parse(body);
      if (data.data && data.data.organizations && data.data.organizations.length > 0) {
        // Find the Google entry
        const google = data.data.organizations.find(org => 
          org.name === 'Google' || (org.website_url && org.website_url.includes('google.com')));
        
        if (google) {
          console.log(`\nFetching details for ${google.name} (ID: ${google.id})...`);
          getCompanyDetails(google.id);
        }
      }
    } catch (e) {
      console.error('Error in second request handler:', e);
    }
  }
});