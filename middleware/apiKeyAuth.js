require('dotenv').config();

/**
 * API Key Authentication Middleware
 * This middleware validates that all incoming requests contain a valid API key
 */
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  // Use environment variable
  const VALID_API_KEY = process.env.API_KEY || 'salesgpt-secure-key-2024';
  
  if (!apiKey) {
    console.log('⛔️ API key missing in request');
    return res.status(401).json({
      success: false,
      message: 'API key is required. Please include x-api-key header.'
    });
  }
  
  if (apiKey !== VALID_API_KEY) {
    console.log('⛔️ Invalid API key provided');
    return res.status(403).json({
      success: false,
      message: 'Invalid API key provided.'
    });
  }
  
  // If API key is valid, proceed to next middleware or route handler
  console.log('✅ API key validation successful');
  next();
};

module.exports = apiKeyAuth;