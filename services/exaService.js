const axios = require('axios');

class ExaService {
  constructor() {
    this.apiKey = process.env.EXA_API_KEY || '590c495e-f18d-497a-b025-91165f0d99c1';
    this.baseUrl = 'https://api.exa.ai/search';
  }

  /**
   * Search for LinkedIn profiles based on company, position, and location
   * @param {String} company - Company name
   * @param {String} position - Job position
   * @param {String} location - Location
   * @param {Number} limit - Number of profiles to return (default: 5)
   * @returns {Promise<Array>} - LinkedIn profile URLs
   */
  async searchLinkedInProfiles(company, position, location, limit = 5) {
    try {
      console.log(`Searching for ${position} at ${company} in ${location}...`);
      
      const prompt = `Find ${limit} LinkedIn profiles of people who work as ${position} at ${company} in ${location}. Return only the LinkedIn profile URLs.`;
      
      const response = await axios({
        method: 'post',
        url: this.baseUrl,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        data: {
          query: prompt,
          numResults: limit,
          mode: "concise",
          type: "keyword",
          includeDomains: ["linkedin.com"]
        }
      });

      // Process the results to extract just the LinkedIn URLs
      const results = response.data.results || [];
      const profiles = results.map(result => ({
        url: result.url,
        title: result.title || '',
        snippet: result.snippet || ''
      }));
      
      return profiles;
    } catch (error) {
      console.error('Error searching LinkedIn profiles:', error.message);
      throw error;
    }
  }
}

module.exports = new ExaService();