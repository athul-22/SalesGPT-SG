const express = require('express');
const router = express.Router();
const driveDocumentController = require('../controllers/driveDocumentController');

// List files from Google Drive
router.get('/list', driveDocumentController.listDriveFiles);

// Process a specific file by ID
router.post('/process/:fileId', driveDocumentController.processDriveFileById);

// Process multiple files
router.post('/process-batch', driveDocumentController.processDriveFiles);

module.exports = router;