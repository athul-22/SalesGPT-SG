const geminiService = require('./geminiService');

/**
 * AI Service using only Gemini
 */
class AIService {
  /**
   * Generate content using Gemini AI (no fallback)
   * @param {String} prompt - The prompt to generate content from
   * @returns {Promise<String>} - Generated text content
   */
  async generateContent(prompt) {
    try {
      console.log("Generating content with Gemini...");
      return await geminiService.generateContent(prompt);
    } catch (error) {
      console.error("Error generating content with Gemini:", error.message);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }
}

module.exports = new AIService();