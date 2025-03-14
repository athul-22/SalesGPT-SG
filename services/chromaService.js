const { ChromaClient } = require("chromadb");
const embeddingService = require('./embeddingService');

class ChromaService {
  constructor() {
    this.client = new ChromaClient({
      path: "https://api.trychroma.com:8000",
      auth: { 
        provider: "token", 
        credentials: process.env.CHROMA_API_TOKEN || 'ck-GyhaX24ME9HEdaJr26jFi2NmxvSRiUVGdaB96UrKVYVd', 
        tokenHeaderType: "X_CHROMA_TOKEN" 
      },
      tenant: process.env.CHROMA_TENANT || 'b5ba23cc-d04e-4a55-a175-e3ace27792c9',
      database: process.env.CHROMA_DATABASE || 'KnowledgeBase'
    });
    
    this.collectionName = process.env.CHROMA_COLLECTION || 'pdf_documents';
  }

  /**
   * Get or create a collection in ChromaDB
   * @returns {Promise<Object>} - ChromaDB collection
   */
  async getOrCreateCollection() {
    try {
      const collections = await this.client.listCollections();
      
      if (!collections.find(c => c.name === this.collectionName)) {
        return await this.client.createCollection({
          name: this.collectionName
        });
      }
      
      return await this.client.getCollection({
        name: this.collectionName
      });
    } catch (error) {
      console.error('Error accessing ChromaDB collection:', error);
      throw error;
    }
  }

  /**
   * Add document to ChromaDB with externally generated embeddings
   * @param {String} documentId - Unique document identifier
   * @param {Array<String>} textChunks - Array of text chunks
   * @param {Object} metadata - Document metadata
   * @returns {Promise<Array>} - Array of chunk IDs
   */
  async addDocument(documentId, textChunks, metadata) {
    try {
      const collection = await this.getOrCreateCollection();
      
      // Generate embeddings for all chunks using OpenAI
      const embeddings = await embeddingService.generateEmbeddings(textChunks);
      
      // Create IDs for each chunk
      const ids = textChunks.map((_, index) => `${documentId}-chunk-${index}`);
      
      // Add metadata to each chunk
      const metadatas = textChunks.map((chunk, index) => ({
        ...metadata,
        chunkIndex: index,
        totalChunks: textChunks.length,
        documentId
      }));
      
      await collection.add({
        ids,
        embeddings,
        documents: textChunks,
        metadatas
      });
      
      return ids;
    } catch (error) {
      console.error('Error adding document to ChromaDB:', error);
      throw error;
    }
  }

  /**
   * Query ChromaDB collection
   * @param {String} query - Query text
   * @param {Number} limit - Maximum number of results
   * @returns {Promise<Object>} - Query results
   */
  async queryCollection(query, limit = 5) {
    try {
      const collection = await this.getOrCreateCollection();
      
      // Generate embedding for the query
      const embedding = await embeddingService.generateEmbedding(query);
      
      const results = await collection.query({
        queryEmbeddings: [embedding],
        nResults: limit
      });
      
      return results;
    } catch (error) {
      console.error('Error querying ChromaDB:', error);
      throw error;
    }
  }
}

module.exports = new ChromaService();