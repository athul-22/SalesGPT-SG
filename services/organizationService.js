const axios = require('axios');
require('dotenv').config(); // Make sure dotenv is loaded

class OrganizationService {
  constructor() {
    this.baseUrl = process.env.ORGANIZATION_API_URL || 'http://13.235.243.0:3001';
    
    // Use token from environment variable
    this.token = process.env.ORGANIZATION_API_TOKEN;
    if (!this.token) {
      console.error('❌ API token is missing in .env file');
    } else {
      // Log the first and last 5 characters of the token for debugging
      const tokenPreview = this.token.length > 15 ? 
                          `${this.token.substring(0, 5)}...${this.token.substring(this.token.length - 5)}` : 
                          'token too short';
      console.log(`🔑 Using API token: ${tokenPreview}`);
    }
    
    // Add token refresh mechanism
    this.tokenExpiryTime = this.getTokenExpiryTime(this.token);
    console.log(`⏰ API Token will expire at: ${new Date(this.tokenExpiryTime * 1000).toLocaleString()}`);
  }

  // Helper to extract expiry time from JWT
  getTokenExpiryTime(token) {
    try {
      console.log('🔍 Decoding JWT token expiry time...');
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('⚠️ Invalid JWT format - token does not have 3 parts');
        return Date.now() / 1000 + 3600;
      }
      
      const payload = parts[1];
      console.log(`📦 JWT payload length: ${payload.length} characters`);
      
      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
      console.log(`📅 JWT contains exp: ${decoded.exp ? 'Yes' : 'No'}`);
      
      if (decoded.exp) {
        const expiryDate = new Date(decoded.exp * 1000);
        console.log(`📆 Token expiry decoded as: ${expiryDate.toLocaleString()}`);
        return decoded.exp;
      } else {
        console.warn('⚠️ JWT does not contain expiry time');
        return Date.now() / 1000 + 3600;
      }
    } catch (error) {
      console.warn(`⚠️ Error decoding token expiry time: ${error.message}`);
      return Date.now() / 1000 + 3600; // Assume 1 hour from now
    }
  }

  /**
   * Check if the token is expired or about to expire
   * @returns {Boolean} - True if token is expired or will expire soon
   */
  isTokenExpired() {
    const currentTime = Math.floor(Date.now() / 1000);
    const timeToExpiry = this.tokenExpiryTime - currentTime;
    
    console.log(`⏱️ Time to token expiry: ${timeToExpiry} seconds (${Math.floor(timeToExpiry / 60)} minutes)`);
    
    // Consider token expired if less than 5 minutes remaining
    return timeToExpiry < 300;
  }

  /**
   * Search for organizations by company name and other criteria
   * @param {String} companyName - Name of the company to search for
   * @param {Object} options - Additional search options (targetGeography, businessType, industry, role)
   * @returns {Promise<Array>} - List of matching organizations
   */
  async searchOrganizations(companyName, options = {}) {
    try {
      console.log(`🔍 Searching for organizations with company name: "${companyName}"`);
      console.log(`🔍 Additional search options: ${JSON.stringify(options)}`);
      
      // Check if token is expired
      if (this.isTokenExpired()) {
        console.warn('⚠️ API token is expired or about to expire. Please update the token in .env file');
      }
      
      const params = {
        companyName,
        ...options
      };

      console.log(`🌐 Making request to: ${this.baseUrl}/v1/organizations`);
      console.log(`🔍 Query parameters: ${JSON.stringify(params)}`);
      
      // Log trimmed auth header for debugging
      const authHeaderPreview = `Bearer ${this.token.substring(0, 10)}...${this.token.substring(this.token.length - 5)}`;
      console.log(`🔑 Using auth header: ${authHeaderPreview}`);

      const response = await axios({
        method: 'GET',
        url: `${this.baseUrl}/v1/organizations`,
        params,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      console.log(`✅ Search successful. Found ${response.data.length} organizations.`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error searching organizations: ${error.message}`);
      
      // Log detailed error information
      if (error.response) {
        console.error(`🔴 Response status: ${error.response.status}`);
        console.error(`🔴 Response data: ${JSON.stringify(error.response.data)}`);
        console.error(`🔴 Response headers: ${JSON.stringify(error.response.headers)}`);
        
        // Handle 401 explicitly
        if (error.response.status === 401) {
          console.error('🔐 Authentication error: JWT token is expired or invalid. Please update the token in .env file.');
        }
      } else if (error.request) {
        console.error(`🔴 No response received: ${error.request}`);
      }
      
      // If the API request fails, return a standardized error object
      return {
        error: true,
        message: error.message,
        status: error.response?.status || 500
      };
    }
  }

  /**
   * Get detailed information about a specific organization
   * @param {String} companyId - The ID of the company
   * @returns {Promise<Object>} - Organization details
   */
  async getOrganizationDetails(companyId) {
    try {
      console.log(`🔍 Getting details for organization with ID: ${companyId}`);
      
      const response = await axios({
        method: 'GET',
        url: `${this.baseUrl}/v1/organization`,
        params: { companyId },
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      console.log(`✅ Successfully retrieved organization details`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error getting organization details: ${error.message}`);
      
      // Log detailed error information
      if (error.response) {
        console.error(`🔴 Response status: ${error.response.status}`);
        console.error(`🔴 Response data: ${JSON.stringify(error.response.data)}`);
      }
      
      return {
        error: true,
        message: error.message,
        status: error.response?.status || 500
      };
    }
  }

  /**
   * Get news related to a specific organization
   * @param {String} companyId - The ID of the company
   * @returns {Promise<Array>} - Organization news
   */
  async getOrganizationNews(companyId) {
    try {
      console.log(`📰 Getting news for organization with ID: ${companyId}`);
      
      const response = await axios({
        method: 'GET',
        url: `${this.baseUrl}/v1/organizationNews`,
        params: { companyId },
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      console.log(`✅ Successfully retrieved ${response.data.length} news items`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error getting organization news: ${error.message}`);
      
      // Log detailed error information
      if (error.response) {
        console.error(`🔴 Response status: ${error.response.status}`);
        console.error(`🔴 Response data: ${JSON.stringify(error.response.data)}`);
        
        if (error.response.status === 404) {
          console.log(`ℹ️ No news found for this organization - this is not an error`);
          // No news is not an error, just return empty array
          return [];
        }
      }
      
      return {
        error: true,
        message: error.message,
        status: error.response?.status || 500
      };
    }
  }
}

module.exports = new OrganizationService();