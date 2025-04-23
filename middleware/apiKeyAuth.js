require('dotenv').config();

/**
 * API Key Authentication Middleware
 * This middleware validates that all incoming requests contain a valid API key
 */
const apiKeyAuth = (req, res, next) => {
  const providedApiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY || 'salesgpt-secure-key-xhsjdjwn2849wbfewdsknsk';
  
  if (!providedApiKey) {
    console.log('⛔️ API key missing in request');
    return res.status(401).json({
      success: false,
      message: 'API key is required. Please include x-api-key header.'
    });
  }

  console.log(`Request received for: ${req.path}`);
  console.log(`API Key provided: ${providedApiKey ? 'YES' : 'NO'}`);
  console.log(`Expected API Key exists: ${validApiKey ? 'YES' : 'NO'}`);
  
  if (!providedApiKey || providedApiKey !== validApiKey) {
    console.log('API Key authentication failed');
    return res.status(403).send('Forbidden: Invalid API Key');
  }
  
  console.log('API Key authentication successful');
  next();
};

module.exports = apiKeyAuth;