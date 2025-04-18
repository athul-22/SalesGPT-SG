const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    // Use the API key directly
    const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBcvqcXZ-Hevsa6etTGK-r-_WpXZ9tdLbA';
    
    // Configure with a timeout and proper proxy settings
    this.genAI = new GoogleGenerativeAI(API_KEY);
    
    // Use the updated model name
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.95
      }
    });
  }

  /**
   * Generate content using Gemini AI with retry logic
   * @param {String} prompt - The prompt to generate content from
   * @returns {Promise<String>} - Generated text content
   */
  async generateContent(prompt) {
    // Add retry logic for network issues
    const MAX_RETRIES = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`Gemini attempt ${attempt}/${MAX_RETRIES}...`);
        
        // Make sure we're passing the prompt correctly
        const result = await this.model.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        
        const response = await result.response;
        return response.text();
      } catch (error) {
        console.warn(`Gemini attempt ${attempt} failed: ${error.message}`);
        lastError = error;
        
        if (attempt < MAX_RETRIES) {
          // Wait before retrying (exponential backoff)
          const delay = 2000 * Math.pow(2, attempt - 1);
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('All Gemini API attempts failed');
  }
}

module.exports = new GeminiService();