const express = require('express');
const router = express.Router();
const multer = require('multer');
const documentController = require('../controllers/documentController');
const documentQueue = require('../services/queueService');
const path = require('path');
 
// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Queue status routes - need to be placed before the /:documentId route
// to avoid being interpreted as a document ID
router.get('/queue/status', (req, res) => {
  const status = documentQueue.getQueueStatus();
  res.status(200).json(status);
});

// Get specific document status
router.get('/queue/:documentId', (req, res) => {
  const { documentId } = req.params;
  const status = documentQueue.getDocumentStatus(documentId);
  
  if (!status) {
    return res.status(404).json({ 
      success: false, 
      message: 'Document not found in queue' 
    });
  }
  
  res.status(200).json({
    success: true,
    status
  });
});

// Add queue stats endpoint 
router.get('/queue-stats', documentController.getQueueStats);

// Add list endpoint BEFORE the /:documentId route
router.get('/list', documentController.listDocuments);

// Document routes
router.post('/upload', upload.single('document'), documentController.uploadDocument);
router.post('/query', documentController.queryDocuments);

// This should be the LAST route
router.get('/:documentId', documentController.getDocumentById);

// Mock data endpoint for testing
router.get('/mock/list', (req, res) => {
  const mockDocuments = [
    {
      documentId: "mock-doc-1",
      collectionName: "doc_sample_document_123",
      metadata: {
        originalName: "Sample Document.pdf",
        uploadedAt: new Date().toISOString(),
        fileSize: 1024000,
        textLength: 5000,
        source: "upload"
      },
      processed: true,
      count: 5
    },
    {
      documentId: "mock-doc-2",
      collectionName: "doc_sales_guide_456",
      metadata: {
        originalName: "Sales Guide.docx",
        uploadedAt: new Date().toISOString(),
        fileSize: 540000,
        textLength: 2500,
        source: "google_drive"
      },
      processed: true,
      count: 3
    }
  ];
  
  res.status(200).json({ documents: mockDocuments });
});

module.exports = router;