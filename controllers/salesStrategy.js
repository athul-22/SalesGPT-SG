const https = require('https');

const options = {
    method: 'GET',
    hostname: 'apollo-io-no-cookies-required.p.rapidapi.com',
    port: 443,
    // Modified path to ensure we get the main Google company
    path: '/search_organization?q_organization_name=Google&page=1&exact_name_match=true&organization_revenue_min=100000000000',
    headers: {
        'x-rapidapi-key': 'e2941bfeeamshf10306bfb50c2b7p1895c3jsn364eb99e3308',
        'x-rapidapi-host': 'apollo-io-no-cookies-required.p.rapidapi.com'
    }
};

const req = https.request(options, function (res) {
    const chunks = [];

    res.on('data', function (chunk) {
        chunks.push(chunk);
    });

    res.on('end', function () {
        const body = Buffer.concat(chunks);
        try {
            const response = JSON.parse(body.toString());
            
            if (response.data && response.data.organizations) {
                const mainGoogle = response.data.organizations.find(org => {
                    const name = org.name.toLowerCase();
                    return (name === 'google' || name === 'alphabet inc.') && 
                           org.organization_revenue >= 100000000000;
                });

                if (mainGoogle) {
                    console.log('\nComplete Google Company Details:');
                    console.log('================================');
                    // Print all available properties
                    Object.entries(mainGoogle).forEach(([key, value]) => {
                        // Format the output for better readability
                        const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        if (value !== null && value !== undefined) {
                            if (typeof value === 'object') {
                                console.log(`\n${formattedKey}:`);
                                console.log(JSON.stringify(value, null, 2));
                            } else {
                                console.log(`${formattedKey}: ${value}`);
                            }
                        }
                    });
                    console.log('\n================================');
                } else {
                    console.log('Original Google company information not found');
                }
            }
        } catch (error) {
            console.error('Error parsing response:', error);
            console.log('Raw response:', body.toString());
        }
    });
});

req.on('error', (error) => {
    console.error('Request failed:', error);
});

req.end();

console.log('Fetching complete Google company information...');
