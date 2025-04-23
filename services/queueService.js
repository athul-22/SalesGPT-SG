const fs = require('fs');
const path = require('path');
const chromaService = require('./chromaService');
const { v4: uuidv4 } = require('uuid');

class DocumentQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.maxRetries = 10; 
    this.batchSize = 1; 
    this.delayBetweenBatches = 15000; 
    this.delayBetweenDocuments = 120000; 
    this.maxChunkSize = 250;
    
    this.queuePath = path.join(__dirname, '../data/document-queue.json');
    this.queueFile = path.join(__dirname, '../data/queue.json');
    this.ensureQueueDirectory();
    this.loadQueue();
    
    // Start processor after server init
    setTimeout(() => this.startProcessor(), 5000);
  }
  
  ensureQueueDirectory() {
    const dir = path.dirname(this.queuePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  loadQueue() {
    try {
      if (fs.existsSync(this.queueFile)) {
        const data = JSON.parse(fs.readFileSync(this.queueFile, 'utf8'));
        this.queue = data.queue || [];
        this.processing = data.processing || {};
        this.completed = data.completed || {};
        this.failed = data.failed || {};
      } else if (fs.existsSync(this.queuePath)) {
        const data = fs.readFileSync(this.queuePath, 'utf8');
        this.queue = JSON.parse(data).map(item => ({
          ...item,
          addedAt: new Date(item.addedAt)
        }));
        console.log(`Loaded ${this.queue.length} documents from queue`);
      }
    } catch (error) {
      console.error('Error loading document queue:', error);
      this.queue = [];
    }
  }
  
  saveQueue() {
    try {
      fs.writeFileSync(this.queueFile, JSON.stringify({
        queue: this.queue,
        processing: this.processing,
        completed: this.completed,
        failed: this.failed
      }, null, 2));
    } catch (error) {
      console.error('Error saving queue:', error);
    }
  }
  
  addDocument({documentId, text, metadata, collectionName}) {
    // Generate a unique ID if not provided
    if (!documentId) {
      documentId = uuidv4();
    }
    
    // Validate the input
    if (!text || typeof text !== 'string' || text.length < 10) {
      console.warn(`Document ${documentId} has no valid text content`);
      text = "Empty or invalid document content";
    }
    
    // Ensure we have valid metadata
    if (!metadata) metadata = {};
    if (!collectionName) collectionName = `doc_${documentId}`;
    
    const queueItem = {
      documentId,
      text,
      metadata: {
        ...metadata,
        documentId // Ensure documentId is in metadata for ChromaDB
      },
      collectionName,
      addedAt: new Date(),
      status: 'queued',
      retries: 0
    };
    
    // Add to the queue
    this.queue.push(queueItem);
    this.saveQueue();
    console.log(`Added document ${documentId} to processing queue. Queue length: ${this.queue.length}`);
    
    // Try to start processing if not already running
    if (!this.processing) {
      this.startProcessor();
    }
    
    // Return queue info
    return {
      queuePosition: this.queue.length,
      estimatedTimeMinutes: Math.max(5, this.queue.length * 3) // More realistic estimate
    };
  }
  
  async startProcessor() {
    if (this.processing) return;
    
    this.processing = true;
    console.log('🔄 Starting document queue processor');
    
    while (this.processing) {
      try {
        // Get next document to process
        const nextDoc = this.queue.find(doc => 
          doc.status === 'queued' || doc.status === 'retrying');
        
        if (!nextDoc) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          continue;
        }
        
        console.log(`🔄 Processing queued document: ${nextDoc.documentId} (try ${nextDoc.retries + 1})`);
        nextDoc.status = 'processing';
        this.saveQueue();
        
        try {
          // Get required data
          const text = nextDoc.text;
          const metadata = nextDoc.metadata;
          const documentId = nextDoc.documentId;
          const collectionName = nextDoc.collectionName;
          
          // First create an isolated embedding function that doesn't depend on APIs
          const embeddingFunction = {
            generate: async (texts) => {
              const textArray = Array.isArray(texts) ? texts : [texts];
              return textArray.map(text => {
                // Generate a consistent vector of 1536 dimensions
                const vector = new Array(1536).fill(0);
                if (text && typeof text === 'string') {
                  // Use simple hash-based approach
                  for (let i = 0; i < Math.min(text.length, 1536); i++) {
                    vector[i] = (text.charCodeAt(i % text.length) % 100) / 100;
                  }
                }
                return vector;
              });
            }
          };
          
          console.log(`Creating/getting collection: ${collectionName}`);
          
          // First try to get the collection
          let collection;
          try {
            collection = await chromaService.chromaClient.getCollection({
              name: collectionName,
              embeddingFunction
            });
            console.log(`Retrieved existing collection: ${collectionName}`);
          } catch (getError) {
            // If collection doesn't exist, create it
            if (getError.message && (getError.message.includes('not found') || getError.name === 'ChromaNotFoundError')) {
              console.log(`Creating new collection: ${collectionName}`);
              try {
                collection = await chromaService.chromaClient.createCollection({
                  name: collectionName,
                  metadata: { documentId },
                  embeddingFunction
                });
                console.log(`Collection created: ${collectionName}`);
                
                // Added logging
                console.log(`About to process document chunks: ${documentId}`);
                // Wait after creation to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 10000));
              } catch (createError) {
                console.error(`Error creating collection: ${createError.message}`);
                throw createError;
              }
            } else {
              console.error(`Error getting collection: ${getError.message}`);
              throw getError;
            }
          }
          
          // Split the document into very small chunks to avoid rate limits
          const maxChunkSize = 200; // Even smaller chunks
          const chunks = [];
          const chunkMetadatas = [];
          const ids = [];
          
          // Create chunks with proper IDs
          for (let i = 0; i < text.length; i += maxChunkSize) {
            const chunk = text.substring(i, i + maxChunkSize);
            if (chunk.trim().length < 10) continue; // Skip tiny chunks
            
            chunks.push(chunk);
            chunkMetadatas.push({
              ...metadata,
              chunkIndex: Math.floor(i / maxChunkSize),
              totalChunks: Math.ceil(text.length / maxChunkSize)
            });
            ids.push(`${documentId}_${Math.floor(i / maxChunkSize)}`);
          }
          
          console.log(`Processing ${chunks.length} chunks for document ${documentId}`);
          
          // Process chunks one by one with long delays
          for (let i = 0; i < chunks.length; i++) {
            let retries = 0;
            let success = false;
            
            while (!success && retries < this.maxRetries) {
              try {
                // Pre-generate embeddings
                const embeddingVector = await embeddingFunction.generate(chunks[i]);
                
                // Add to collection
                await collection.add({
                  ids: [ids[i]],
                  documents: [chunks[i]],
                  metadatas: [chunkMetadatas[i]],
                  embeddings: [embeddingVector]
                });
                
                success = true;
                console.log(`Added chunk ${i+1}/${chunks.length} for document ${documentId}`);
              } catch (error) {
                retries++;
                const isRateLimit = error.message && (
                  error.message.includes('429') || 
                  error.message.includes('Too Many Requests')
                );
                
                if (isRateLimit) {
                  console.log(`⚠️ Rate limit hit (retry ${retries}/${this.maxRetries})`);
                } else {
                  console.log(`⚠️ Error adding chunk (retry ${retries}/${this.maxRetries}): ${error.message}`);
                }
                
                // Exponential backoff with longer delays
                const delay = Math.min(10000 * Math.pow(2, retries), 300000);
                console.log(`Waiting ${delay/1000} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }
            
            if (!success) {
              throw new Error(`Failed to add chunk ${i+1} after ${this.maxRetries} retries`);
            }
            
            // Add a delay between chunks
            if (i < chunks.length - 1) {
              console.log(`Waiting 15 seconds between chunks...`);
              await new Promise(resolve => setTimeout(resolve, 15000));
            }
          }
          
          // Mark document as completed
          nextDoc.status = 'completed';
          nextDoc.completedAt = new Date();
          console.log(`✅ Document ${documentId} processing completed successfully`);
          
        } catch (processingError) {
          console.error(`❌ Error processing document ${nextDoc.documentId}:`, processingError);
          
          nextDoc.retries++;
          if (nextDoc.retries >= this.maxRetries) {
            nextDoc.status = 'failed';
            nextDoc.error = processingError.message;
            console.error(`❌ Document ${nextDoc.documentId} failed after ${this.maxRetries} attempts`);
          } else {
            nextDoc.status = 'retrying';
            console.log(`⚠️ Document ${nextDoc.documentId} will be retried later (attempt ${nextDoc.retries}/${this.maxRetries})`);
          }
        }
        
        // Save queue state
        this.saveQueue();
        
        // Wait between documents
        console.log(`Waiting 2 minutes before next document...`);
        await new Promise(resolve => setTimeout(resolve, 120000));
      } catch (error) {
        console.error('Error in document processor:', error);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }
  
  getQueueStatus() {
    const queued = this.queue.filter(doc => doc.status === 'queued').length;
    const processing = this.queue.filter(doc => doc.status === 'processing').length;
    const completed = this.queue.filter(doc => doc.status === 'completed').length;
    const failed = this.queue.filter(doc => doc.status === 'failed').length;
    const retrying = this.queue.filter(doc => doc.status === 'retrying').length;
    
    return {
      total: this.queue.length,
      queued,
      processing,
      completed,
      failed,
      retrying
    };
  }
  
  getDocumentStatus(documentId) {
    const doc = this.queue.find(d => d.documentId === documentId);
    if (!doc) return null;
    
    return {
      documentId: doc.documentId,
      status: doc.status,
      addedAt: doc.addedAt,
      completedAt: doc.completedAt,
      retries: doc.retries,
      error: doc.error
    };
  }
}

// Create singleton
const documentQueue = new DocumentQueue();

module.exports = documentQueue;