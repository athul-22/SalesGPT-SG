const { v4: uuidv4 } = require('uuid');
const storageService = require('../services/storageService');
const pdfService = require('../services/pdfService');
const chromaService = require('../services/chromaService');
const geminiService = require('../services/geminiService');

// Upload and process document
const uploadDocument = async (req, res) => {
  try {
    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get user ID from request (you may use authentication middleware)
    const userId = req.user?.id || 'anonymous';
    
    // Generate a unique document ID
    const documentId = uuidv4();
    
    // Upload file to Google Cloud Storage
    const fileData = await storageService.uploadFile(req.file, userId);
    
    // Return initial response to client
    res.status(202).json({
      message: 'Document uploaded successfully and processing started',
      documentId,
      fileData
    });
    
    // Process file in background (after response is sent)
    try {
      const result = await pdfService.processFile(fileData.fileName, documentId, userId);
      
      console.log('Document processed successfully:', documentId);
      // Could store processing result in database if needed
    } catch (processingError) {
      console.error('Error processing document:', processingError);
      // Could update document status in database
    }
  } catch (error) {
    console.error('Error uploading document:', error);
    
    // If response hasn't been sent yet
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to upload document' });
    }
  }
};

// Get document processing status and details
const getDocumentById = async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Query ChromaDB for document chunks
    const collection = await chromaService.getOrCreateCollection();
    const filter = { documentId };
    
    // Get document metadata from first chunk
    const result = await collection.get({
      where: filter,
      limit: 1
    });
    
    if (!result || !result.metadatas || result.metadatas.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const metadata = result.metadatas[0];
    
    // Return document information
    return res.status(200).json({
      documentId,
      metadata
    });
  } catch (error) {
    console.error('Error getting document:', error);
    return res.status(500).json({ error: 'Failed to get document' });
  }
};

// Query documents by text
const queryDocuments = async (req, res) => {
  try {
    const { query, limit } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query text is required' });
    }
    
    const results = await chromaService.queryCollection(query, limit || 5);
    
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

module.exports = {
  uploadDocument,
  getDocumentById,
  queryDocuments,
  generateSalesStrategy
};