const { v4: uuidv4 } = require('uuid');
const chromaService = require('../services/chromaService');
const documentService = require('../services/documentService');
const documentQueue = require('../services/queueService');

// Upload and process document
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing file: ${req.file.originalname} (${req.file.mimetype})`);

    // Generate document ID
    const documentId = uuidv4();

    // Extract text from the file
    let extractedText;
    try {
      extractedText = await documentService.extractTextFromFile(req.file);
      console.log(`Extracted ${extractedText.length} characters from ${req.file.originalname}`);
    } catch (extractError) {
      console.error('Error extracting text:', extractError);
      return res.status(500).json({ error: 'Failed to extract text from file' });
    }

    // Generate collection name
    const collectionName = `doc_${documentId}`;

    // Prepare metadata using truncated values (to meet ChromaDB limits)
    const originalName = req.file.originalname.length > 30
      ? req.file.originalname.substring(0, 27) + '...'
      : req.file.originalname;

    const metadata = {
      docId: documentId.substring(0, 8), // shortened ID
      name: originalName,
      date: new Date().toISOString().split('T')[0], // just the date
      size: req.file.size,
      mime: req.file.mimetype.split('/')[1] || req.file.mimetype.split('/')[0],
      len: extractedText.length,
      src: 'direct'
    };

    // Store the full metadata separately for retrieval if needed
    const fullMetadata = {
      documentId,
      originalName: req.file.originalname,
      uploadedAt: new Date().toISOString(),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      textLength: extractedText.length,
      source: 'upload'
    };

    try {
      const fs = require('fs');
      const path = require('path');
      const metadataDir = path.join(__dirname, '../data/metadata');
      if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(metadataDir, `${documentId}.json`),
        JSON.stringify(fullMetadata, null, 2)
      );
    } catch (metadataError) {
      console.warn('Could not save full metadata:', metadataError);
    }

    // Create small text chunks (200 characters per chunk)
    const chunks = [];
    const maxChunkSize = 200;
    for (let i = 0; i < extractedText.length; i += maxChunkSize) {
      const chunk = extractedText.substring(i, i + maxChunkSize);
      if (chunk.trim().length > 5) {
        chunks.push(chunk);
      }
    }

    // Respond immediately to the client
    res.status(202).json({
      success: true,
      message: 'Document uploaded and processing started',
      documentId,
      collectionName,
      textLength: extractedText.length,
      chunks: chunks.length
    });

    // Process document directly (no queuing) in background
    (async () => {
      try {
        // Use the ChatGPT/OpenAI embedding function
        const embeddingFunction = chromaService.createOpenAIEmbeddingFunction();

        console.log(`Creating collection: ${collectionName}`);
        const collection = await chromaService.chromaClient.createCollection({
          name: collectionName,
          metadata: { documentId },
          embeddingFunction
        });

        // Wait for collection initialization
        console.log('Waiting for collection initialization...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        console.log(`Processing ${chunks.length} chunks for document ${documentId}`);
        for (let i = 0; i < chunks.length; i++) {
          if (i > 0) {
            console.log(`Waiting between chunk ${i + 1} processing...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
          }

          console.log(`Processing chunk ${i + 1} for document ${documentId}`);
          await chromaService.retryWithBackoff(
            async () => {
              const chunkId = `${documentId}_${i}`;
              const chunkMetadata = {
                ...metadata,
                idx: i,
                tot: chunks.length
              };

              // Generate embedding for this chunk
              const embeddingArray = await embeddingFunction.generate([chunks[i]]);
              const embedding = embeddingArray[0];

              // Add chunk with its embedding to the collection
              await collection.add({
                ids: [chunkId],
                documents: [chunks[i]],
                metadatas: [chunkMetadata],
                embeddings: [embedding]
              });
            },
            5,      // maxRetries
            5000,   // initialDelay (ms)
            60000   // maxDelay (ms)
          );
          console.log(`Added chunk ${i + 1} of ${chunks.length}`);
        }

        console.log(`Completed processing document ${documentId}`);
      } catch (backgroundError) {
        console.error("Background processing error:", backgroundError);
      }
    })();
  } catch (error) {
    console.error('Error uploading document:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Failed to upload document',
        details: error.message
      });
    }
  }
};

// Simple upload with minimal processing for testing
const uploadSimpleDocument = async (req, res) => {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing simple file: ${req.file.originalname} (${req.file.mimetype})`);
    
    // Generate document ID
    const documentId = uuidv4();
    
    // Extract text
    let extractedText;
    try {
      extractedText = await documentService.extractTextFromFile(req.file);
      console.log(`Extracted ${extractedText.length} characters from ${req.file.originalname}`);
    } catch (extractError) {
      console.error('Error extracting text:', extractError);
      return res.status(500).json({ error: 'Failed to extract text from file' });
    }
    
    // Generate collection name
    const collectionName = `doc_${documentId}`;
    
    // Prepare metadata - use truncated values to stay within Chroma's 36-byte limit
    const originalName = req.file.originalname.length > 30 ? 
      req.file.originalname.substring(0, 27) + '...' : 
      req.file.originalname;

    // Truncated metadata for ChromaDB
    const metadata = {
      docId: documentId.substring(0, 8), // Shortened ID
      name: originalName,
      date: new Date().toISOString().split('T')[0], // Just the date
      size: req.file.size,
      mime: req.file.mimetype.split('/')[1] || req.file.mimetype.split('/')[0], // Just the subtype
      len: extractedText.length,
      src: 'simple'
    };

    // Store full metadata separately if needed
    const fullMetadata = {
      documentId,
      originalName: req.file.originalname,
      uploadedAt: new Date().toISOString(),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      textLength: extractedText.length,
      source: 'direct_upload'
    };

    // Save full metadata to file if needed (optional)
    try {
      const fs = require('fs');
      const path = require('path');
      const metadataDir = path.join(__dirname, '../data/metadata');
      
      if (!fs.existsSync(metadataDir)) {
        fs.mkdirSync(metadataDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(metadataDir, `${documentId}.json`), 
        JSON.stringify(fullMetadata, null, 2)
      );
    } catch (metadataError) {
      console.warn('Could not save full metadata:', metadataError);
    }

    // Create minimal chunks to avoid rate limits
    const chunks = [];
    const maxChunkSize = 200;
    
    for (let i = 0; i < extractedText.length; i += maxChunkSize) {
      const chunk = extractedText.substring(i, i + maxChunkSize);
      if (chunk.trim().length > 5) {
        chunks.push(chunk);
      }
    }
    
    // Respond immediately with success
    res.status(202).json({
      success: true,
      message: 'Document processing started',
      documentId,
      collectionName,
      textLength: extractedText.length,
      chunks: chunks.length
    });
    
    // Process in background
    (async () => {
      try {
        // Create simple embedding function
        const embeddingFunction = {
          generate: async (texts) => {
            const textArray = Array.isArray(texts) ? texts : [texts];
            return textArray.map(text => {
              // Create a deterministic vector
              const vector = new Array(1536).fill(0);
              if (text && typeof text === 'string') {
                for (let i = 0; Math.min(text.length, 1536); i++) {
                  vector[i] = (text.charCodeAt(i % text.length) % 100) / 100;
                }
              }
              return vector;
            });
          }
        };
        
        // Create collection
        console.log(`Creating collection: ${collectionName}`);
        const collection = await chromaService.chromaClient.createCollection({
          name: collectionName,
          metadata: { documentId },
          embeddingFunction
        });
        
        // Wait after creation
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Add just first chunk as a test
        if (chunks.length > 0) {
          console.log(`Adding first chunk for document ${documentId}`);
          
          // Pre-generate embeddings
          const embedding = await embeddingFunction.generate(chunks[0]);
          
          // Add document
          await collection.add({
            ids: [`${documentId}_0`],
            documents: [chunks[0]],
            metadatas: [metadata],
            embeddings: [embedding]
          });
          
          console.log(`Added first chunk for document ${documentId}`);
        }
        
      } catch (error) {
        console.error(`Error in background processing: ${error.message}`);
      }
    })();
    
  } catch (error) {
    console.error('Error in simple upload:', error);
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Failed to upload document',
        details: error.message 
      });
    }
  }
};

// Get document by ID
const getDocumentById = async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Check if document is still in queue
    const queueStatus = documentQueue.getDocumentStatus(documentId);
    if (queueStatus) {
      if (queueStatus.status === 'queued' || queueStatus.status === 'processing' || queueStatus.status === 'retrying') {
        return res.status(202).json({
          message: 'Document is still being processed',
          documentId,
          status: queueStatus.status,
          queueInfo: queueStatus
        });
      } else if (queueStatus.status === 'failed') {
        return res.status(500).json({
          error: 'Document processing failed',
          documentId,
          reason: queueStatus.error
        });
      }
      // If completed in queue, proceed to try to get from ChromaDB
    }
    
    // Try to get document from ChromaDB
    try {
      const collectionName = chromaService.createCollectionName(documentId);
      const document = await chromaService.getDocumentFromCollection(documentId, collectionName);
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      res.status(200).json(document);
    } catch (chromaError) {
      console.error('Error fetching document from ChromaDB:', chromaError);
      return res.status(500).json({ 
        error: 'Failed to fetch document from ChromaDB', 
        details: chromaError.message 
      });
    }
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document', details: error.message });
  }
};

// List all documents
const listDocuments = async (req, res) => {
  try {
    console.log("Listing all documents from ChromaDB...");
    
    // Get all collections from ChromaDB
    const collections = await chromaService.listAllCollections();
    console.log(`Retrieved ${collections ? collections.length : 0} total collections`);
    
    // Log all collection names for debugging
    if (collections && collections.length > 0) {
      console.log("All collection names:", collections.map(c => c.name).join(", "));
    }
    
    // Defensive coding to handle null/undefined collections
    if (!collections || !Array.isArray(collections)) {
      return res.status(200).json({
        success: true,
        documents: [],
        message: "No collections found in ChromaDB",
        collectionsCount: 0
      });
    }
    
    // Filter for document collections (with enhanced null checks)
    const docCollections = collections.filter(col => 
      col && col.name && typeof col.name === 'string' && col.name.startsWith('doc_')
    );
    
    console.log(`Found ${docCollections.length} document collections`);
    
    // If no document collections found, return empty array
    if (docCollections.length === 0) {
      return res.status(200).json({
        success: true,
        documents: [],
        message: "No document collections found",
        collectionsCount: collections.length
      });
    }
    
    // Fetch document information from each collection
    const documents = [];
    
    for (const collection of docCollections) {
      try {
        // Extract documentId from collection name
        const documentId = collection.name.replace('doc_', '');
        
        // Get collection info to extract metadata
        const collectionInfo = await chromaService.getCollectionInfo(collection.name);
        
        // Use first item's metadata as document metadata
        const metadata = collectionInfo && collectionInfo.metadatas && collectionInfo.metadatas.length > 0 
          ? collectionInfo.metadatas[0] 
          : {};
        
        // Build document object
        documents.push({
          documentId,
          collectionName: collection.name,
          metadata: {
            ...metadata,
            originalName: metadata.originalName || documentId,
            uploadedAt: metadata.uploadedAt || new Date().toISOString(),
            fileSize: metadata.fileSize || 0,
            textLength: metadata.textLength || 0
          }
        });
        
        console.log(`✅ Added document: ${documentId}`);
      } catch (error) {
        console.error(`Error retrieving document from collection ${collection.name}:`, error.message);
        // Continue to next collection rather than failing the whole request
      }
    }
    
    return res.status(200).json({
      success: true,
      documents,
      collectionsCount: collections.length,
      docCollectionsCount: docCollections.length
    });
  } catch (error) {
    console.error("Error listing documents:", error);
    return res.status(500).json({
      success: false,
      message: `Error listing documents: ${error.message}`,
      error: error.message
    });
  }
};

// Query documents
const queryDocuments = async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const results = await chromaService.queryAllDocumentCollections(query, limit);
    
    res.status(200).json({ results });
  } catch (error) {
    console.error('Error querying documents:', error);
    res.status(500).json({ error: 'Failed to query documents', details: error.message });
  }
};

// Get queue statistics
const getQueueStats = (req, res) => {
  const stats = documentQueue.getQueueStatus();
  res.status(200).json({
    stats,
    message: "Documents are processed sequentially to avoid rate limits."
  });
};

// List all collections
const listAllCollections = async (req, res) => {
  try {
    // Get all collections, with debugging
    console.log("Listing all ChromaDB collections...");
    const collections = await chromaService.listAllCollections();
    
    if (!collections || !Array.isArray(collections)) {
      console.log("No collections found or unexpected response format");
      return res.status(200).json({
        success: true,
        message: "No collections found or unexpected response format",
        collections: [],
        rawResponse: collections
      });
    }
    
    // Print out all collection names
    const collectionNames = collections.map(c => c && c.name ? c.name : 'unnamed').filter(Boolean);
    console.log(`Found ${collections.length} collections: ${collectionNames.join(', ')}`);
    
    // Return collection details
    return res.status(200).json({
      success: true,
      collections: collections.map(c => ({ 
        name: c.name,
        metadata: c.metadata || {}
      })),
      count: collections.length,
      docCollections: collections.filter(c => c && c.name && c.name.startsWith('doc_')).length
    });
  } catch (error) {
    console.error("Error listing collections:", error);
    return res.status(500).json({
      success: false,
      message: `Error listing collections: ${error.message}`,
      error: error.stack
    });
  }
};

module.exports = {
  uploadDocument,
  uploadSimpleDocument,
  getDocumentById,
  listDocuments,
  queryDocuments,
  getQueueStats,
  listAllCollections
};