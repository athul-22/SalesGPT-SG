const geminiService = require('./geminiService');
const openaiService = require('./openaiService');

/**
 * AI Service with automatic fallback
 */
class AIService {
  /**
   * Generate content using available AI services with fallback
   * @param {String} prompt - The prompt to generate content from
   * @returns {Promise<String>} - Generated text content
   */
  async generateContent(prompt) {
    try {
      // Try Gemini first
      console.log("Attempting to generate content with Gemini...");
      return await geminiService.generateContent(prompt);
    } catch (error) {
      console.log("Gemini service failed, falling back to OpenAI:", error.message);
      
      // Fall back to OpenAI
      console.log("Attempting to generate content with OpenAI...");
      return await openaiService.generateContent(prompt);
    }
  }
}

module.exports = new AIService();