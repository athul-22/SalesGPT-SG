const http = require('https');

const options = {
    method: 'GET',
    hostname: 'apollo-io-no-cookies-required.p.rapidapi.com',
    port: null,
    path: '/search_organization?q_organization_name=Facebook&page=1',
    headers: {
		'x-rapidapi-key': 'e2941bfeeamshf10306bfb50c2b7p1895c3jsn364eb99e3308',
		'x-rapidapi-host': 'apollo-io-no-cookies-required.p.rapidapi.com'
	}
};

const req = http.request(options, function (res) {
    const chunks = [];

    res.on('data', function (chunk) {
        chunks.push(chunk);
    });

    res.on('end', function () {
        const body = Buffer.concat(chunks);
        console.log('Status Code:', res.statusCode);
        console.log('Response Headers:', res.headers);
        console.log('Response Body:', body.toString());
    });
});

// Add error handling
req.on('error', (error) => {
    console.error('Error making request:', error);
});

req.end();

// Let user know request is in progress
console.log('Making request to Apollo.io API...');