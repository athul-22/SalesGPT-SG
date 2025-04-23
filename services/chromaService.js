const { ChromaClient } = require('chromadb');
const openaiService = require('./openaiService');
const dotenv = require('dotenv');

dotenv.config();

const chromaClient = new ChromaClient({
  path: "https://api.trychroma.com:8000",
  auth: { 
    provider: "token", 
    credentials: process.env.CHROMA_API_TOKEN,
    tokenHeaderType: "X_CHROMA_TOKEN" 
  },
  tenant: process.env.CHROMA_TENANT,
  database: process.env.CHROMA_DATABASE || 'KnowledgeBase'
});

async function retryWithBackoff(operation, maxRetries = 5, initialDelay = 2000, maxDelay = 30000) {
  let retries = 0;
  let delay = initialDelay;
  
  while (retries < maxRetries) {
    try {
      return await operation();
    } catch (error) {
      retries++;
      
      if (retries >= maxRetries) {
        throw new Error(`Operation failed after ${maxRetries} retries: ${error.message}`);
      }
      
      // For rate limit errors, use longer delays
      if ((error.message && error.message.includes('429')) || 
          (error.status === 429) || 
          (error.message && error.message.includes('Too Many Requests'))) {
        
        // Apply jitter to prevent all clients retrying at the same time
        const jitter = Math.random() * 1000;
        const actualDelay = Math.min(delay + jitter, maxDelay);
        
        console.log(`Rate limit hit, retrying in ${Math.floor(actualDelay)}ms (attempt ${retries}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, actualDelay));
        
        // Exponential backoff - double the delay for next retry
        delay = Math.min(delay * 2, maxDelay);
        continue;
      }
      
      // For other errors, use shorter retries or rethrow based on type
      if (error.message && (
          error.message.includes('timeout') || 
          error.message.includes('connection') ||
          error.message.includes('network'))) {
        
        console.log(`Network error, retrying in ${delay}ms (attempt ${retries}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * 1.5, maxDelay);
        continue;
      }
      
      // For all other errors, rethrow
      throw error;
    }
  }
}

// Add document to ChromaDB with smaller chunk size and more aggressive batching
async function addDocument(text, metadata, documentId) {
  try {
    console.log(`Adding document to ChromaDB: ${documentId}`);
    
    // Generate collection name
    const collectionName = createCollectionName(documentId);
    
    // Create collection first (separate from adding data)
    const collection = await retryWithBackoff(() => getOrCreateCollection(collectionName));
    console.log(`Successfully got/created collection for ${documentId}`);
    
    // Split text into even smaller chunks
    const MAX_CHUNK_SIZE = 500; // Smaller chunks 
    const chunks = [];
    const metadatas = [];
    const ids = [];
    
    // Simple text chunking by size
    for (let i = 0; i < text.length; i += MAX_CHUNK_SIZE) {
      const chunk = text.substring(i, i + MAX_CHUNK_SIZE);
      // Skip empty chunks
      if (chunk.trim().length === 0) continue;
      
      chunks.push(chunk);
      // Add the chunk index to metadata
      metadatas.push({
        ...metadata,
        chunkIndex: Math.floor(i / MAX_CHUNK_SIZE),
        chunkTotal: Math.ceil(text.length / MAX_CHUNK_SIZE)
      });
      ids.push(`${documentId}_${Math.floor(i / MAX_CHUNK_SIZE)}`);
    }
    
    // If no valid chunks, create one with minimal content
    if (chunks.length === 0) {
      chunks.push("Empty document");
      metadatas.push(metadata);
      ids.push(`${documentId}_0`);
    }
    
    // Process data in very small batches with longer delays
    const BATCH_SIZE = 2; // Even smaller batches
    
    console.log(`Adding ${chunks.length} chunks in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchMetadatas = metadatas.slice(i, i + BATCH_SIZE);
      
      // Add each batch with retry logic and longer timeouts
      await retryWithBackoff(
        () => collection.add({
          ids: batchIds,
          documents: batchChunks,
          metadatas: batchMetadatas
        }),
        5, // More retries
        3000, // Start with longer delay
        60000 // Up to 60 seconds between retries
      );
      
      console.log(`Added batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(chunks.length/BATCH_SIZE)}`);
      
      // Add a much longer delay between batches
      if (i + BATCH_SIZE < chunks.length) {
        console.log("Waiting between batches to avoid rate limits...");
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      }
    }
    
    console.log(`Successfully added ${chunks.length} chunks to collection ${collectionName}`);
    return { 
      documentId, 
      collectionName, 
      chunkCount: chunks.length 
    };
  } catch (error) {
    console.error(`Error adding document to ChromaDB: ${error.message}`);
    console.error(`Error stack: ${error.stack}`);
    throw error;
  }
}

// Simplified embedding function that doesn't require OpenAI API
function createEmbeddingFunction() {
  return {
    generate: async (texts) => {
      try {
        const textArray = Array.isArray(texts) ? texts : [texts];
        // Generate simple deterministic embeddings without using the API
        const embeddings = textArray.map(text => {
          // This is just a placeholder embedding generator
          const embedding = new Array(1536).fill(0);
          if (text && typeof text === 'string') {
            // Simple hash function to generate consistent vectors
            let hash = 0;
            for (let i = 0; i < text.length; i++) {
              hash = ((hash << 5) - hash) + text.charCodeAt(i);
              hash = hash & hash; // Convert to 32bit integer
            }
            
            // Use the hash as a seed to generate vector values
            const seed = Math.abs(hash);
            for (let i = 0; i < 1536; i++) {
              // Generate a value between 0 and 1 based on the position and seed
              embedding[i] = ((seed * (i + 1)) % 1000) / 1000;
            }
          }
          return embedding;
        });
        
        return embeddings;
      } catch (err) {
        console.error('Error generating embeddings:', err);
        return Array.isArray(texts) ? 
          texts.map(() => new Array(1536).fill(0)) : 
          [new Array(1536).fill(0)];
      }
    }
  };
}

function createOpenAIEmbeddingFunction() {
  return {
    generate: async (texts) => {
      // Make sure texts is an array
      const textArray = Array.isArray(texts) ? texts : [texts];
      // Filter out any null/undefined/empty texts
      const validTexts = textArray.filter(text => text && typeof text === 'string' && text.trim().length > 0);
      
      if (validTexts.length === 0) {
        return []; // Return empty array if no valid texts
      }
      
      try {
        // Use OpenAI service to get embeddings
        const embeddings = await openaiService.createEmbeddings(validTexts);
        return embeddings;
      } catch (error) {
        console.error('Error generating embeddings:', error);
        throw error;
      }
    }
  };
}

function createSimpleEmbeddings(texts) {
  // Ensure texts is an array
  const textArray = Array.isArray(texts) ? texts : [texts];
  
  // For each text, create a deterministic embedding
  return textArray.map(text => {
    const embedding = new Array(1536).fill(0);
    
    if (!text || typeof text !== 'string' || text.length < 3) {
      // For empty or tiny texts, return zero embedding
      return embedding;
    }
    
    // Simple deterministic embedding based on character codes
    // This creates vectors that are consistent for the same text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    
    // Use hash as seed for pseudorandom but deterministic values
    const seed = Math.abs(hash);
    for (let i = 0; i < 1536; i++) {
      // Generate values between -1 and 1
      embedding[i] = (((seed * (i + 1)) % 1000) / 500) - 1;
    }
    
    // Normalize the vector to unit length
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (magnitude || 1));
  });
}

function createCollectionName(documentId) {
  return `doc_${documentId}`;
}

async function listAllCollections() {
  try {
    const collections = await chromaClient.listCollections();
    return collections;
  } catch (error) {
    console.error('Error listing collections:', error);
    throw error;
  }
}

async function getOrCreateCollection(collectionName = 'pdf_documents') {
  try {
    try {
      const collection = await chromaClient.getCollection({
        name: collectionName,
        embeddingFunction: createEmbeddingFunction()
      });
      console.log(`Retrieved collection: ${collectionName}`);
      return collection;
    } catch (error) {
      if (error.message && (error.message.includes('not found') || 
                          error.name === 'ChromaNotFoundError')) {
        console.log(`Creating new collection: ${collectionName}`);
        return await chromaClient.createCollection({
          name: collectionName,
          embeddingFunction: createEmbeddingFunction()
        });
      }
      throw error;
    }
  } catch (error) {
    console.error(`Error with collection "${collectionName}":`, error.message);
    throw error;
  }
}

async function verifyChromaConnection() {
  try {
    const heartbeat = await chromaClient.heartbeat();
    console.log(`✅ ChromaDB connection successful! Heartbeat: ${heartbeat}`);
    return true;
  } catch (error) {
    console.error('❌ ChromaDB connection failed:', error.message);
    return false;
  }
}

// Improve the getDocumentFromCollection function
async function getDocumentFromCollection(documentId, collectionName) {
  try {
    // First check if the collection exists
    const collections = await chromaClient.listCollections();
    const collectionExists = collections.some(col => col.name === collectionName);
    
    if (!collectionExists) {
      console.log(`Collection ${collectionName} does not exist`);
      return null;
    }
    
    // Get the collection
    const collection = await chromaClient.getCollection({
      name: collectionName
    });
    
    // Get all items in the collection
    const result = await collection.get();
    
    if (!result || !result.ids || result.ids.length === 0) {
      return null;
    }
    
    // Compile document from chunks
    const chunks = result.documents;
    const metadatas = result.metadatas;
    
    // Use the first metadata as the document metadata
    const metadata = metadatas[0];
    
    // Join all chunks into a single document
    const text = chunks.join("\n");
    
    return {
      documentId,
      collectionName,
      metadata,
      text,
      chunks: chunks.length
    };
  } catch (error) {
    console.error(`Error getting document from collection: ${error.message}`);
    // Return null instead of throwing, so the controller can handle it gracefully
    return null;
  }
}

async function getCollectionInfo(collectionName) {
  try {
    const collection = await chromaClient.getCollection({
      name: collectionName,
      embeddingFunction: createEmbeddingFunction()
    });
    
    return await collection.get();
  } catch (error) {
    console.error(`Error getting collection info: ${error.message}`);
    throw error;
  }
}

// Fix for chromaService.js - queryAllDocumentCollections function
async function queryAllDocumentCollections(queryText, limit = 5) {
  try {
    // First verify we can access ChromaDB
    await verifyChromaConnection();
    
    const collections = await listAllCollections();
    console.log(`Retrieved ${collections ? collections.length : 0} collections from ChromaDB`);
    
    // Add null check and debugging to see what's being returned
    if (!collections || !Array.isArray(collections)) {
      console.log(`ChromaDB collections not available or not in expected format:`, collections);
      return { 
        documents: [],
        query: queryText,
        totalCollections: 0,
        searchedCollections: 0,
        totalResults: 0,
        error: "No collections available" 
      };
    }
    
    // Add more defensive coding with optional chaining and null checks
    const docCollections = collections.filter(col => col && col.name && col.name.startsWith('doc_'));
    
    console.log(`Found ${docCollections.length} document collections`);
    
    if (docCollections.length === 0) {
      return { 
        documents: [],
        query: queryText,
        totalCollections: collections.length,
        searchedCollections: 0,
        totalResults: 0,
        error: "No document collections found" 
      };
    }
    
    const results = [];
    
    // Query each collection with error handling
    for (const colInfo of docCollections) {
      try {
        console.log(`Querying collection: ${colInfo.name}`);
        
        const collection = await chromaClient.getCollection({
          name: colInfo.name,
          embeddingFunction: createEmbeddingFunction()
        });
        
        const queryResult = await collection.query({
          queryTexts: [queryText],
          nResults: Math.min(3, limit) // Use fewer results per collection
        });
        
        if (queryResult && queryResult.documents && queryResult.documents[0]) {
          for (let i = 0; i < queryResult.documents[0].length; i++) {
            results.push({
              collectionName: colInfo.name,
              documentId: queryResult.metadatas[0][i]?.documentId || colInfo.name.replace('doc_', ''),
              originalName: queryResult.metadatas[0][i]?.originalName || 'Unknown document',
              text: queryResult.documents[0][i],
              metadata: queryResult.metadatas[0][i] || {},
              score: queryResult.distances ? queryResult.distances[0][i] : null
            });
          }
        }
      } catch (error) {
        console.error(`Error querying collection ${colInfo.name}:`, error.message);
        // Continue to next collection
      }
      
      // Add a delay between collection queries to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Sort by relevance (if scores are available)
    results.sort((a, b) => (a.score || 1) - (b.score || 1));
    
    return {
      documents: results.slice(0, limit),
      query: queryText,
      totalCollections: docCollections.length,
      searchedCollections: docCollections.length,
      totalResults: results.length
    };
  } catch (error) {
    console.error(`Error querying all collections: ${error.message}`);
    throw error;
  }
}

const testChromaSearch = async (req, res) => {
  try {
    const { query = "test query" } = req.query;
    
    console.log(`Testing ChromaDB search with query: "${query}"`);
    
    // First check ChromaDB connection
    const connected = await chromaService.verifyChromaConnection();
    if (!connected) {
      return res.status(500).json({
        success: false,
        message: 'ChromaDB connection failed',
        error: 'Failed to connect to ChromaDB'
      });
    }
    
    // List collections
    let collections;
    try {
      collections = await chromaService.listAllCollections();
      console.log(`Found ${collections ? collections.length : 0} collections`);
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to list ChromaDB collections',
        error: error.message,
        stack: error.stack
      });
    }
    
    // Try to query documents
    try {
      const results = await chromaService.queryAllDocumentCollections(query, 5);
      
      return res.status(200).json({
        success: true,
        query,
        resultsFound: !!results && !!results.documents && results.documents.length > 0,
        summary: {
          collections: collections,
          totalCollections: collections?.length || 0,
          docCollections: collections?.filter(col => col && col.name && col.name.startsWith('doc_')).length || 0,
          searchedCollections: results?.searchedCollections || 0,
          totalResults: results?.totalResults || 0,
          documentsReturned: results?.documents?.length || 0
        },
        results
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'ChromaDB search failed',
        collections: collections,
        error: error.message,
        stack: error.stack
      });
    }
  } catch (error) {
    console.error('Error testing ChromaDB search:', error);
    return res.status(500).json({
      success: false,
      message: 'Error testing ChromaDB search',
      error: error.message,
      stack: error.stack
    });
  }
};

// Add to your exports
module.exports = { 
  chromaClient, 
  verifyChromaConnection,
  getOrCreateCollection,
  createEmbeddingFunction,
  createOpenAIEmbeddingFunction,
  createSimpleEmbeddings,
  listAllCollections,
  createCollectionName,
  addDocument,
  getDocumentFromCollection,
  getCollectionInfo,
  queryAllDocumentCollections,
  retryWithBackoff,
  testChromaSearch
};