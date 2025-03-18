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
   * @param {String} expertise - Area of expertise (optional)
   * @param {String} team - Team name (optional)
   * @returns {Promise<Array>} - Enhanced LinkedIn profile data
   */
  async searchLinkedInProfiles(company, position, location, limit = 5, expertise = '', team = '') {
    try {
      console.log(`Searching for ${position} at ${company} in ${location}...`);
      
      // Select the appropriate prompt based on the parameters provided
      const prompt = this.selectPrompt(company, position, location, limit, expertise, team);
      
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
          mode: "comprehensive", // Changed from "concise" to get more detailed data
          type: "keyword",
          includeDomains: ["linkedin.com"]
        }
      });

      // Process the results to extract profile information
      const results = response.data.results || [];
      const profiles = results.map(result => {
        // Extract name from the title (typically "Name - Position at Company | LinkedIn")
        const titleParts = result.title ? result.title.split(' - ') : [''];
        const name = titleParts[0].trim();
        
        // Extract other information from snippet
        const snippet = result.snippet || '';
        
        // Try to extract designation, location from snippet
        let designation = position; // Default to the searched position
        let extractedLocation = location; // Default to the searched location
        
        // Try to extract more accurate designation and location from snippet if available
        if (snippet) {
          // Look for common patterns in LinkedIn snippets
          const designationMatch = snippet.match(/(?:is|as|works as|at)(.*?)(?:at|in|,|\.)/i);
          if (designationMatch && designationMatch[1]) {
            designation = designationMatch[1].trim();
          }
          
          const locationMatch = snippet.match(/(?:in|at|from|located in)(.*?)(?:,|\.|\s-|\s\|)/i);
          if (locationMatch && locationMatch[1]) {
            extractedLocation = locationMatch[1].trim();
          }
        }
        
        return {
          name,
          url: result.url,
          designation,
          title: result.title || '',
          location: extractedLocation,
          snippet: snippet
        };
      });
      
      return profiles;
    } catch (error) {
      console.error('Error searching LinkedIn profiles:', error.message);
      throw error;
    }
  }

  /**
   * Select the appropriate prompt based on the parameters provided
   * @param {Object} params - Search parameters
   * @returns {String} - The selected prompt
   */
  selectPrompt(company, position, location, limit, expertise = '', team = '') {
    // Determine which prompt to use based on the parameters provided
    // Using all parameters = prompt 3, with expertise = prompt 2, basic = prompt 1
    
    if (expertise && team) {
      // Prompt 3 - most comprehensive
      return `Provide ${limit} LinkedIn profiles of employees working at ${company} as ${position} (multiple designations possible), specializing in ${expertise}, part of the ${team} team, and working at the ${location} office.`;
    } else if (expertise) {
      // Prompt 2 - with expertise
      return `Find ${limit} LinkedIn profiles of professionals employed at ${company} holding the role of ${position} (can be more than one role), with expertise in ${expertise}, who work in the ${team || 'their'} team, located at ${location}.`;
    } else {
      // Prompt 1 - basic
      return `Retrieve ${limit} LinkedIn profiles of employees who work at ${company} in the designation of ${position} (multiple options allowed) ${expertise ? `and specialize in ${expertise}` : ''}. ${team ? `They are part of the ${team} team` : ''} and are based in ${location}.`;
    }
  }
}

module.exports = new ExaService();