const { OpenAI } = require('openai');

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate embeddings for text using OpenAI's API
   * @param {String} text - Text to generate embeddings for
   * @returns {Promise<Array<number>>} - Vector embedding
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-large",
        input: text,
        encoding_format: "float"
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating OpenAI embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for batch of texts
   * @param {Array<String>} texts - Array of texts to embed
   * @returns {Promise<Array<Array<number>>>} - Array of embeddings
   */
  async generateBatchEmbeddings(texts) {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-large",
        input: texts,
        encoding_format: "float"
      });
      
      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('Error generating batch OpenAI embeddings:', error);
      throw error;
    }
  }
}

module.exports = new OpenAIService();