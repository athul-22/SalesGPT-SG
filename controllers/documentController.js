const { v4: uuidv4 } = require('uuid');
const chromaService = require('../services/chromaService');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Upload and process document
const uploadDocument = async (req, res) => {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing file: ${req.file.originalname} (${req.file.mimetype})`);
    
    const fileBuffer = req.file.buffer;
    const fileType = req.file.mimetype;
    let extractedText = '';
    
    // Extract text based on file type
    try {
      if (fileType === 'application/pdf' || req.file.originalname.toLowerCase().endsWith('.pdf')) {
        console.log('Extracting text from PDF...');
        const pdfData = await pdfParse(fileBuffer);
        extractedText = pdfData.text;
        console.log(`Extracted ${extractedText.length} characters from PDF`);
      } 
      else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        fileType === 'application/msword' ||
        req.file.originalname.toLowerCase().endsWith('.docx') ||
        req.file.originalname.toLowerCase().endsWith('.doc')
      ) {
        console.log('Extracting text from DOCX/DOC...');
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value;
        console.log(`Extracted ${extractedText.length} characters from DOCX/DOC`);
      } 
      else {
        return res.status(400).json({ 
          error: 'Unsupported file type', 
          details: `File type ${fileType} is not supported. Please upload PDF or DOCX files.`
        });
      }
    } catch (extractionError) {
      console.error('Text extraction error:', extractionError);
      return res.status(422).json({ 
        error: 'Failed to extract text from document', 
        details: extractionError.message
      });
    }

    if (!extractedText || extractedText.length < 10) {
      return res.status(422).json({ 
        error: 'Document contains no extractable text or is too short',
        extracted: extractedText.length 
      });
    }
    
    // Generate a unique document ID
    const documentId = uuidv4();
    
    // Prepare metadata
    const metadata = {
      documentId,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedAt: new Date().toISOString(),
      textLength: extractedText.length
    };
    
    // Create collection name
    const collectionName = chromaService.createCollectionName(
      req.file.originalname, 
      documentId
    );
    
    // Return initial response to client to show upload was successful
    res.status(202).json({
      message: 'Document uploaded successfully and processing started',
      documentId,
      collectionName,
      fileData: {
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      }
    });
    
    // Continue processing in background (after response is sent)
    try {
      // Add document content to ChromaDB
      await chromaService.addDocument(extractedText, metadata, documentId);
      console.log('Document added to ChromaDB:', documentId);
    } catch (chromaError) {
      console.error('Error adding document to ChromaDB:', chromaError.message);
      // Nothing we can do at this point since response is already sent
    }
  } catch (error) {
    console.error('Error uploading document:', error);
    
    // If response hasn't been sent yet
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
    
    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }
    
    try {
      // First, find which collection has this document
      const collections = await chromaService.listAllCollections();
      let document = null;
      
      // Search through all document collections
      for (const collection of collections) {
        try {
          if (collection.name.startsWith('doc_')) {
            // Try to get document from this collection
            try {
              document = await chromaService.getDocumentFromCollection(documentId, collection.name);
              if (document) {
                break; // Found it
              }
            } catch (e) {
              // Document not in this collection, continue searching
            }
          }
        } catch (collectionError) {
          console.error(`Error checking collection ${collection.name}:`, collectionError);
        }
      }
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      return res.status(200).json({
        documentId: document.id,
        collectionName: document.collectionName,
        metadata: document.metadata,
        textPreview: document.text.substring(0, 300) + '...'
      });
    } catch (storageError) {
      console.error('Error retrieving document:', storageError);
      return res.status(500).json({ 
        error: 'Failed to retrieve document', 
        details: storageError.message 
      });
    }
  } catch (error) {
    console.error('Error getting document:', error);
    return res.status(500).json({ 
      error: 'Error processing request', 
      details: error.message 
    });
  }
};

// List all document collections
const listDocuments = async (req, res) => {
  try {
    // Get all collections
    const collections = await chromaService.listAllCollections();
    
    // Filter for document collections (they start with 'doc_')
    const docCollections = collections.filter(col => col.name.startsWith('doc_'));
    
    if (!docCollections || docCollections.length === 0) {
      return res.status(200).json({ documents: [] });
    }
    
    // Get summary info for each collection
    const documents = await Promise.all(docCollections.map(async (collection) => {
      try {
        const collectionInfo = await chromaService.getCollectionInfo(collection.name);
        
        // Extract document metadata from first chunk
        if (collectionInfo && collectionInfo.metadatas && collectionInfo.metadatas.length > 0) {
          const metadata = collectionInfo.metadatas[0];
          return {
            documentId: metadata.documentId,
            collectionName: collection.name,
            metadata: {
              originalName: metadata.originalName,
              uploadedAt: metadata.uploadedAt,
              fileSize: metadata.fileSize,
              textLength: metadata.textLength
            },
            count: collectionInfo.ids.length
          };
        }
        
        // Fallback if no metadata available
        return {
          documentId: collection.name,
          collectionName: collection.name,
          metadata: {
            originalName: collection.name,
            uploadedAt: new Date().toISOString()
          },
          count: 0
        };
      } catch (err) {
        console.error(`Error getting info for collection ${collection.name}:`, err);
        return {
          documentId: 'error',
          collectionName: collection.name,
          error: err.message
        };
      }
    }));
    
    // Filter out error entries
    const validDocuments = documents.filter(doc => doc.documentId !== 'error');
    
    return res.status(200).json({
      documents: validDocuments
    });
  } catch (error) {
    console.error('Error listing documents:', error);
    return res.status(500).json({ 
      error: 'Failed to list documents', 
      details: error.message 
    });
  }
};

// Query documents across all collections
const queryDocuments = async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query text is required' });
    }
    
    // Query across all document collections
    const results = await chromaService.queryAllDocumentCollections(query, parseInt(limit));
    
    return res.status(200).json({
      results
    });
  } catch (error) {
    console.error('Error querying documents:', error);
    return res.status(500).json({ 
      error: 'Failed to query documents', 
      details: error.message 
    });
  }
};

module.exports = {
  uploadDocument,
  getDocumentById,
  queryDocuments,
  listDocuments
};