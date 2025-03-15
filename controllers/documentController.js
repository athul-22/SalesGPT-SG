const { v4: uuidv4 } = require('uuid');
const chromaService = require('../services/chromaService');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');

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
    
    // Create collection name from original filename (sanitized)
    const baseFileName = req.file.originalname.replace(/\.[^/.]+$/, ""); // Remove extension
    const safeCollectionName = baseFileName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().substring(0, 30);
    const collectionName = `doc_${safeCollectionName}_${documentId.substring(0, 8)}`;
    
    // Prepare metadata
    const metadata = {
      documentId,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      uploadedAt: new Date().toISOString(),
      textLength: extractedText.length,
      collectionName
    };
    
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
      // Add document content to ChromaDB in a document-specific collection
      await chromaService.addDocumentToCollection(extractedText, metadata, documentId, collectionName);
      console.log(`Document added to ChromaDB collection "${collectionName}": ${documentId}`);
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
          documentId: collection.name,
          collectionName: collection.name,
          error: 'Failed to load collection details'
        };
      }
    }));
    
    return res.status(200).json({
      documents
    });
  } catch (error) {
    console.error('Error listing documents:', error);
    return res.status(500).json({ error: 'Failed to list documents' });
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
      // First, find the collection for this document
      const collections = await chromaService.listAllCollections();
      const docCollections = collections.filter(col => col.name.startsWith('doc_'));
      
      // Try to find matching collection with this document ID
      let docCollection = null;
      
      for (const collection of docCollections) {
        try {
          const collectionInfo = await chromaService.getCollectionInfo(collection.name);
          if (collectionInfo && collectionInfo.metadatas && collectionInfo.metadatas.length > 0) {
            if (collectionInfo.metadatas[0].documentId === documentId) {
              docCollection = collection.name;
              break;
            }
          }
        } catch (err) {
          console.error(`Error checking collection ${collection.name}:`, err);
        }
      }
      
      if (!docCollection) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      // Get full document info from the collection
      const documentData = await chromaService.getDocumentFromCollection(documentId, docCollection);
      
      return res.status(200).json({
        documentId,
        collectionName: docCollection,
        metadata: documentData.metadata,
        textPreview: documentData.text.substring(0, 300) + '...'
      });
    } catch (chromaError) {
      console.error("Error accessing ChromaDB:", chromaError);
      
      // Return a meaningful error response to the client
      return res.status(503).json({
        error: 'ChromaDB service unavailable',
        message: 'Document retrieval service is currently unavailable',
        status: 'unavailable', 
        documentId,
        metadata: {
          originalName: "Document unavailable",
          uploadedAt: new Date().toISOString(),
          status: "Error accessing document store"
        }
      });
    }
  } catch (error) {
    console.error("Error getting document:", error);
    return res.status(500).json({ error: 'Failed to get document details' });
  }
};

// Query documents by text
const queryDocuments = async (req, res) => {
  try {
    const { query, limit, collectionName } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query text is required' });
    }
    
    let results;
    if (collectionName) {
      // Query specific collection if provided
      results = await chromaService.queryCollection(query, limit || 5, collectionName);
    } else {
      // Query all document collections
      results = await chromaService.queryAllDocumentCollections(query, limit || 5);
    }
    
    return res.status(200).json({
      results
    });
  } catch (error) {
    console.error('Error querying documents:', error);
    return res.status(500).json({ error: 'Failed to query documents' });
  }
};

// Generate sales strategy based on document and company
const generateSalesStrategy = async (req, res) => {
  try {
    const { documentId, companyName, companyInfo } = req.body;
    
    if (!documentId) {
      return res.status(400).json({ error: 'Document ID is required' });
    }
    
    // Get document insights
    const collection = await chromaService.getOrCreateCollection();
    const filter = { documentId };
    
    // Get document metadata and content
    const result = await collection.get({
      where: filter,
      limit: 10
    });
    
    if (!result || !result.documents || result.documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Get company information if not provided
    let targetCompany = companyInfo;
    if (!targetCompany && companyName) {
      // Here you could implement logic to fetch company info
      // For now, use placeholder
      targetCompany = {
        name: companyName,
        industry: "Technology",
        size: "Enterprise"
      };
    }
    
    if (!targetCompany) {
      return res.status(400).json({ error: 'Company information is required' });
    }
    
    // Generate sales strategy using document content and company info
    const salesStrategy = await geminiService.generateSalesStrategy(
      { documentContent: result.documents.join("\n"), metadata: result.metadatas[0] },
      targetCompany
    );
    
    return res.status(200).json({
      documentId,
      companyInfo: targetCompany,
      salesStrategy
    });
  } catch (error) {
    console.error('Error generating sales strategy:', error);
    return res.status(500).json({ error: 'Failed to generate sales strategy' });
  }
};

// Export the controllers
module.exports = {
  uploadDocument,
  getDocumentById,
  queryDocuments,
  generateSalesStrategy,
  listDocuments
};