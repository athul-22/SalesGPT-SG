const axios = require('axios');

class LinkedinApiService {
  constructor() {
    this.apiKey = process.env.LINKEDIN_RAPID_API_KEY || 'your_api_key_here';
    this.apiHost = 'linkedin-api8.p.rapidapi.com';
    this.baseUrl = 'https://linkedin-api8.p.rapidapi.com/get-profile-data-by-url';
  }

  /**
   * Extract profile data from LinkedIn URL
   * @param {String} linkedinUrl - LinkedIn profile URL
   * @returns {Promise<Object>} - Profile data
   */
  async getProfileData(linkedinUrl) {
    try {
      if (!linkedinUrl || !linkedinUrl.includes('linkedin.com/in/')) {
        console.log(`Invalid LinkedIn URL: ${linkedinUrl}`);
        return null;
      }

      console.log(`Fetching LinkedIn data for: ${linkedinUrl}`);
      
      const response = await axios.get(this.baseUrl, {
        params: { url: linkedinUrl },
        headers: {
          'X-RapidAPI-Key': this.apiKey,
          'X-RapidAPI-Host': this.apiHost
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data && response.data.status === 'success') {
        return this.parseProfileData(response.data.data);
      } else {
        console.log(`API returned unsuccessful status for ${linkedinUrl}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching LinkedIn profile data: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Parse and extract relevant information from LinkedIn profile data
   */
  parseProfileData(profileData) {
    if (!profileData) return null;
    
    try {
      const education = (profileData.education || []).map(edu => ({
        school: edu.school?.name || '',
        degree: edu.degree?.name || '',
        field: edu.degree?.field || '',
        dateRange: edu.dateRange || {}
      }));
      
      const experience = (profileData.experience || []).map(exp => ({
        company: exp.company?.name || '',
        title: exp.title || '',
        dateRange: exp.dateRange || {},
        location: exp.location || ''
      }));
      
      return {
        fullName: profileData.fullName || '',
        headline: profileData.headline || '',
        location: profileData.location || '',
        summary: profileData.summary || '',
        education,
        experience
      };
    } catch (error) {
      console.error(`Error parsing LinkedIn profile data: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Process a list of profiles and enrich them with LinkedIn data
   */
  async enrichProfilesWithLinkedInData(profiles) {
    const enrichedProfiles = [];
    
    for (const profile of profiles) {
      if (profile.linkedin_url) {
        const linkedinData = await this.getProfileData(profile.linkedin_url);
        
        if (linkedinData) {
          enrichedProfiles.push({
            ...profile,
            education: linkedinData.education || [],
            experience: linkedinData.experience || [],
            headline: linkedinData.headline,
            summary: linkedinData.summary
          });
        } else {
          enrichedProfiles.push(profile); // Keep original if API call failed
        }
      } else {
        enrichedProfiles.push(profile); // Keep original if no LinkedIn URL
      }
    }
    
    return enrichedProfiles;
  }
}

module.exports = new LinkedinApiService();