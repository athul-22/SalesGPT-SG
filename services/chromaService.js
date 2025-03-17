const { ChromaClient } = require('chromadb');
const openaiService = require('./openaiService');
const path = require('path');

class ChromaService {
  constructor() {
    // Initialize ChromaDB client
    this.initClient();
  }
  
  initClient() {
    try {
      // Try cloud connection first
      this.client = new ChromaClient({
        path: "https://api.trychroma.com:8000",
        auth: { 
          provider: "token", 
          credentials: process.env.CHROMA_API_TOKEN || 'ck-EAZozmhtW1dT5YonuwLwTYhqkYZkjG1f3LBkKZW3YZZr',
          tokenHeaderType: "X-Chroma-Token"
        },
        tenant: process.env.CHROMA_TENANT || 'b5ba23cc-d04e-4a55-a175-e3ace27792c9',
        database: process.env.CHROMA_DATABASE || 'KnowledgeBase'
      });
      console.log('Initialized ChromaDB cloud client');
    } catch (err) {
      console.log("Falling back to in-memory ChromaDB");
      // Fallback to in-memory storage
      this.client = new ChromaClient({
        path: "chromadb",
        fetchOptions: { useInMemory: true }
      });
    }
  }

  // Create a sanitized collection name from a file name
  createCollectionName(originalName, documentId) {
    // Remove file extension and sanitize name
    const baseName = originalName.replace(/\.[^/.]+$/, "");
    const sanitized = baseName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    // Truncate if needed and add prefix & document ID for uniqueness
    const truncated = sanitized.substring(0, 25);
    return `doc_${truncated}_${documentId.substring(0, 8)}`;
  }

  /**
   * Create embedding function
   */
  createEmbeddingFunction() {
    return {
      generate: async (texts) => {
        try {
          // Convert single string to array if needed
          const textArray = Array.isArray(texts) ? texts : [texts];
          
          // Generate embeddings
          const embeddings = await Promise.all(
            textArray.map(async (text) => {
              // Use a safer approach for empty/invalid texts
              if (!text || typeof text !== 'string' || text.length < 5) {
                return new Array(1536).fill(0); // Return zero vector for empty text
              }
              try {
                return await openaiService.generateEmbedding(text);
              } catch (err) {
                console.error('Error generating embedding:', err);
                return new Array(1536).fill(0); // Return zero vector on error
              }
            })
          );
          return embeddings;
        } catch (err) {
          console.error('Error in embedding function:', err);
          // Return dummy embeddings (1536 dimensions for OpenAI)
          return Array.isArray(texts) ? 
            texts.map(() => new Array(1536).fill(0)) : 
            [new Array(1536).fill(0)];
        }
      }
    };
  }

  /**
   * Get or create a collection with the specified name
   */
  async getOrCreateCollection(collectionName = 'default_collection') {
    try {
      const embeddingFunction = this.createEmbeddingFunction();
      
      // Try to get the existing collection
      try {
        const collection = await this.client.getCollection({
          name: collectionName,
          embeddingFunction: embeddingFunction
        });
        console.log(`Retrieved existing collection: ${collectionName}`);
        return collection;
      } catch (error) {
        if (error.message && error.message.includes('not found')) {
          console.log(`Creating new collection: ${collectionName}`);
          const collection = await this.client.createCollection({
            name: collectionName,
            embeddingFunction: embeddingFunction
          });
          return collection;
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error(`Error accessing ChromaDB collection "${collectionName}":`, error);
      throw error;
    }
  }

  /**
   * List all collections
   */
  async listAllCollections() {
    try {
      const collections = await this.client.listCollections();
      return collections;
    } catch (error) {
      console.error('Error listing ChromaDB collections:', error);
      throw error;
    }
  }

  /**
   * Get basic information about a collection
   */
  async getCollectionInfo(collectionName) {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      return await collection.get();
    } catch (error) {
      console.error(`Error getting info for collection "${collectionName}":`, error);
      throw error;
    }
  }

  /**
   * Add document to a specific collection
   */
  async addDocumentToCollection(text, metadata, id, collectionName) {
    try {
      // Get or create the collection
      const collection = await this.getOrCreateCollection(collectionName);
      
      // Split text into chunks if it's too long
      const chunks = this.splitTextIntoChunks(text, 1000);
      
      // Add each chunk with the same document ID but different chunk IDs
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `${id}-chunk-${i}`;
        const chunkMetadata = { 
          ...metadata, 
          chunkId: chunkId,
          documentId: id,
          chunkIndex: i,
          totalChunks: chunks.length
        };
        
        await collection.add({
          ids: [chunkId],
          documents: [chunks[i]],
          metadatas: [chunkMetadata]
        });
      }
      
      console.log(`Added document (${chunks.length} chunks) to collection "${collectionName}"`);
      return { success: true, id, collectionName };
    } catch (error) {
      console.error(`Error adding document to collection "${collectionName}":`, error);
      throw error;
    }
  }

  /**
   * Add document with per-document collections
   */
  async addDocument(text, metadata, id) {
    try {
      // Create a collection name based on the document name
      const collectionName = this.createCollectionName(
        metadata.originalName || 'document', 
        id
      );
      
      // Create metadata with collection reference
      const updatedMetadata = {
        ...metadata,
        collectionName
      };
      
      // Add to collection
      return await this.addDocumentToCollection(text, updatedMetadata, id, collectionName);
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  /**
   * Get document from a specific collection
   */
  async getDocumentFromCollection(documentId, collectionName) {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      
      // Get all chunks for this document
      const result = await collection.get({
        where: { documentId: documentId }
      });
      
      if (!result || !result.ids || result.ids.length === 0) {
        throw new Error(`Document ${documentId} not found in collection ${collectionName}`);
      }
      
      // Reconstruct the document from chunks
      const chunks = result.ids.map((id, index) => ({
        id,
        text: result.documents[index],
        metadata: result.metadatas[index],
        chunkIndex: result.metadatas[index].chunkIndex || 0
      })).sort((a, b) => a.chunkIndex - b.chunkIndex);
      
      const fullText = chunks.map(chunk => chunk.text).join('');
      const metadata = chunks[0].metadata;
      
      return {
        id: documentId,
        text: fullText,
        metadata,
        source: 'chromadb',
        collectionName
      };
    } catch (error) {
      console.error(`Error getting document from collection "${collectionName}":`, error);
      throw error;
    }
  }

  /**
   * Query a specific collection
   */
  async queryCollection(queryText, limit = 5, collectionName) {
    try {
      const collection = await this.getOrCreateCollection(collectionName);
      
      const results = await collection.query({
        queryTexts: [queryText],
        nResults: limit
      });
      
      // Add collection name to results
      return {
        ...results,
        collectionName
      };
    } catch (error) {
      console.error(`Error querying collection "${collectionName}":`, error);
      throw error;
    }
  }

  /**
   * Query all document collections (collections that start with "doc_")
   */
  async queryAllDocumentCollections(queryText, limit = 5) {
    try {
      // List all collections
      const collections = await this.listAllCollections();
      
      // Filter for document collections
      const docCollections = collections.filter(col => col.name.startsWith('doc_'));
      
      if (docCollections.length === 0) {
        return {
          ids: [[]],
          documents: [[]],
          metadatas: [[]],
          distances: [[]]
        };
      }
      
      // Query each collection
      const allResults = await Promise.all(
        docCollections.map(col => this.queryCollection(queryText, limit, col.name))
      );
      
      // Merge results from all collections
      const merged = {
        ids: [[]],
        documents: [[]],
        metadatas: [[]],
        distances: [[]],
        collections: []
      };
      
      allResults.forEach(result => {
        if (result && result.ids && result.ids[0] && result.ids[0].length > 0) {
          merged.ids[0] = merged.ids[0].concat(result.ids[0]);
          merged.documents[0] = merged.documents[0].concat(result.documents[0]);
          merged.metadatas[0] = merged.metadatas[0].concat(result.metadatas[0]);
          merged.distances[0] = merged.distances[0].concat(result.distances[0]);
          
          // Add collection info to each metadata item
          const collectionName = result.collectionName;
          merged.collections.push(collectionName);
          
          // Add collection name to metadata
          for (let i = merged.metadatas[0].length - result.metadatas[0].length; i < merged.metadatas[0].length; i++) {
            merged.metadatas[0][i].collectionName = collectionName;
          }
        }
      });
      
      // Sort by distance (lower is better)
      const sortIndices = merged.distances[0]
        .map((dist, idx) => ({ dist, idx }))
        .sort((a, b) => a.dist - b.dist)
        .map(item => item.idx);
      
      // Re-sort all arrays based on distance
      merged.ids[0] = sortIndices.map(idx => merged.ids[0][idx]);
      merged.documents[0] = sortIndices.map(idx => merged.documents[0][idx]);
      merged.metadatas[0] = sortIndices.map(idx => merged.metadatas[0][idx]);
      merged.distances[0] = sortIndices.map(idx => merged.distances[0][idx]);
      
      // Limit results if needed
      if (merged.ids[0].length > limit) {
        merged.ids[0] = merged.ids[0].slice(0, limit);
        merged.documents[0] = merged.documents[0].slice(0, limit);
        merged.metadatas[0] = merged.metadatas[0].slice(0, limit);
        merged.distances[0] = merged.distances[0].slice(0, limit);
      }
      
      return merged;
    } catch (error) {
      console.error('Error querying all document collections:', error);
      throw error;
    }
  }

  /**
   * Split text into chunks of roughly equal size
   */
  splitTextIntoChunks(text, chunkSize = 1000) {
    if (!text) return [];
    
    // Simple chunk splitting by length
    const chunks = [];
    
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    
    return chunks;
  }
}

module.exports = new ChromaService();