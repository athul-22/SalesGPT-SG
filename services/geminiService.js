const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    // Use the API key directly
    const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBcvqcXZ-Hevsa6etTGK-r-_WpXZ9tdLbA';
    this.genAI = new GoogleGenerativeAI(API_KEY);
    // Updated model name to match the current API
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
  }

  /**
   * Generate content using Gemini AI
   * @param {String} prompt - The prompt to generate content from
   * @returns {Promise<String>} - Generated text content
   */
  async generateContent(prompt) {
    try {
      console.log('Generating content with Gemini...');
      // Updated generation call to match current API structure
      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      });
      
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating content with Gemini:', error);
      throw error;
    }
  }
}

module.exports = new GeminiService();