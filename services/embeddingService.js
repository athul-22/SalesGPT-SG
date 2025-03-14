const OpenAI = require('openai');

class EmbeddingService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Generate embeddings from text using OpenAI's model
   * @param {String} text - Text to generate embeddings for
   * @returns {Promise<Array>} - Vector embedding
   */
  async generateEmbedding(text) {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-large",
        input: text
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple chunks of text
   * @param {Array<String>} textChunks - Array of text chunks
   * @returns {Promise<Array<Array<number>>>} - Array of vector embeddings
   */
  async generateEmbeddings(textChunks) {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-large",
        input: textChunks
      });
      
      return response.data.map(item => item.embedding);
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw error;
    }
  }
}

module.exports = new EmbeddingService();