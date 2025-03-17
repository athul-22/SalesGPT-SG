const express = require('express');
const router = express.Router();
const multer = require('multer');
const documentController = require('../controllers/documentController');

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Document routes
router.post('/upload', upload.single('document'), documentController.uploadDocument);
router.get('/:documentId', documentController.getDocumentById);
router.get('/list', documentController.listDocuments);
router.post('/query', documentController.queryDocuments);

// This route is likely causing the error - generateSalesStrategy is undefined
// Comment it out if you don't need it yet or define the function
// router.post('/generate-strategy', documentController.generateSalesStrategy);

module.exports = router;