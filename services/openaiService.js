const { OpenAI } = require('openai');
const dotenv = require('dotenv');
dotenv.config();


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Create embeddings using OpenAI API
 * @param {string|string[]} texts - Text or array of texts to embed
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
async function createEmbeddings(texts) {
  const textArray = Array.isArray(texts) ? texts : [texts];
  
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: textArray
    });
    
    // Extract embedding vectors from response
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('OpenAI embedding error:', error);
    throw error;
  }
}

module.exports = {
  createEmbeddings
};