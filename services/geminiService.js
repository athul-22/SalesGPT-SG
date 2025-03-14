const { VertexAI } = require('@google-cloud/vertexai');

class GeminiService {
  constructor() {
    // Initialize Vertex AI with project and location
    this.vertexAI = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: process.env.GOOGLE_LOCATION || 'us-central1',
    });
    
    // Access the model
    this.generativeModel = this.vertexAI.getGenerativeModel({
      model: 'gemini-pro', // Use appropriate Gemini model
    });
  }

  /**
   * Generate content using Google Gemini API
   * @param {String} prompt - The prompt for generation
   * @returns {Promise<String>} - Generated content
   */
  async generateContent(prompt) {
    try {
      const result = await this.generativeModel.generateContent(prompt);
      const response = await result.response;
      return response.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('Error generating content with Gemini:', error);
      throw error;
    }
  }

  /**
   * Analyze PDF content and generate insights
   * @param {String} pdfText - Extracted text from PDF
   * @param {Object} metadata - PDF metadata
   * @returns {Promise<Object>} - Analysis results
   */
  async analyzePdfContent(pdfText, metadata) {
    try {
      const prompt = `
      Analyze the following PDF content and provide key insights:
      
      PDF Title: ${metadata.originalName}
      
      Content:
      ${pdfText.substring(0, 10000)}... [truncated]
      
      Please provide:
      1. A summary of the document (max 150 words)
      2. Key topics covered
      3. Main arguments or points
      4. Potential business applications
      5. Recommended actions based on this content
      
      Format the response as JSON with the following structure:
      {
        "summary": "...",
        "keyTopics": ["...", "..."],
        "mainPoints": ["...", "..."],
        "businessApplications": ["...", "..."],
        "recommendedActions": ["...", "..."]
      }`;

      const analysisText = await this.generateContent(prompt);
      
      try {
        // Parse JSON response
        return JSON.parse(analysisText);
      } catch (parseError) {
        console.error('Error parsing Gemini JSON response:', parseError);
        // Return as text if JSON parsing fails
        return { rawAnalysis: analysisText };
      }
    } catch (error) {
      console.error('Error analyzing PDF content:', error);
      throw error;
    }
  }

  /**
   * Generate sales strategy insights based on document context
   * @param {String} documentContent - Document content or insights
   * @param {Object} companyInfo - Information about the target company
   * @returns {Promise<String>} - Generated sales strategy
   */
  async generateSalesStrategy(documentContent, companyInfo) {
    try {
      const prompt = `
      You are an expert sales strategist. Based on the following document insights and company information,
      develop a comprehensive sales strategy.

      DOCUMENT INSIGHTS:
      ${JSON.stringify(documentContent, null, 2)}

      COMPANY INFORMATION:
      ${JSON.stringify(companyInfo, null, 2)}

      Please provide:
      1. Value proposition aligned with company needs
      2. Key decision makers to target
      3. Potential pain points and solutions
      4. Recommended approach strategy
      5. Messaging framework
      6. Next steps and timeline

      Format your response in a professional, strategic document.`;

      return await this.generateContent(prompt);
    } catch (error) {
      console.error('Error generating sales strategy:', error);
      throw error;
    }
  }
}

module.exports = new GeminiService();