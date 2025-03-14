const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const documentController = require('../controllers/documentController');

// Route for uploading documents
router.post('/upload', upload.single('document'), documentController.uploadDocument);

// Route for getting document details
router.get('/:documentId', documentController.getDocumentById);

// Route for querying documents
router.post('/query', documentController.queryDocuments);

// Route for generating sales strategy from document
router.post('/generateSalesStrategy', documentController.generateSalesStrategy);

module.exports = router;