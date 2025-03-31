const { v4: uuidv4 } = require('uuid');
const driveService = require('../services/driveService');
const documentService = require('../services/documentService');
const chromaService = require('../services/chromaService');
const documentQueue = require('../services/queueService');

// List files from Google Drive
async function listDriveFiles(req, res) {
  try {
    const files = await driveService.listFiles();
    res.status(200).json({ files });
  } catch (error) {
    console.error('Error listing Drive files:', error);
    res.status(500).json({ error: 'Failed to list Drive files', details: error.message });
  }
}

// Process a single Google Drive file
async function processDriveFile(file) {
  try {
    console.log(`Processing Drive file ${file.name} (${file.id})`);
    
    // Handle Google Docs formats differently
    let downloadResult;
    if (file.mimeType.includes('application/vnd.google-apps')) {
      // Export Google Docs as docx/xlsx/etc
      const exportMimeType = getExportMimeType(file.mimeType);
      console.log(`Exporting Google ${file.mimeType} as ${exportMimeType}`);
      downloadResult = await driveService.exportFile(file.id, exportMimeType);
    } else {
      // Download regular binary files
      downloadResult = await driveService.downloadFile(file.id);
    }
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of downloadResult.stream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    
    // Create a file object similar to what multer would provide
    const fileObj = {
      buffer,
      originalname: file.name,
      mimetype: downloadResult.mimeType || file.mimeType,
      size: buffer.length
    };
    
    // Extract text from file
    const extractedText = await documentService.extractTextFromFile(fileObj);
    console.log(`Extracted ${extractedText.length} characters from ${file.name}`);
    
    // Generate document ID and collection name
    const documentId = uuidv4();
    const collectionName = chromaService.createCollectionName(documentId);
    
    // Prepare metadata
    const metadata = {
      documentId,
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      fileSize: buffer.length,
      mimeType: downloadResult.mimeType || file.mimeType,
      textLength: extractedText.length,
      driveFileId: file.id,
      source: 'google_drive'
    };
    
    // Add to document queue
    const queueInfo = documentQueue.addDocument({
      documentId,
      text: extractedText,
      metadata,
      collectionName
    });
    
    return {
      success: true,
      documentId,
      file: file.name,
      queuePosition: queueInfo.queuePosition,
      estimatedTimeMinutes: queueInfo.estimatedTimeMinutes
    };
  } catch (error) {
    console.error(`Error processing Drive file ${file.name} (${file.id}):`, error);
    return {
      success: false,
      error: error.message,
      file: file.name
    };
  }
}

// Helper function to determine export MIME type for Google Docs
function getExportMimeType(googleMimeType) {
  const exportFormats = {
    'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.google-apps.presentation': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
    'application/vnd.google-apps.drawing': 'application/pdf',
    'application/vnd.google-apps.script': 'application/vnd.google-apps.script+json'
  };
  
  return exportFormats[googleMimeType] || 'application/pdf'; // Default to PDF
}

// Process a file from Drive and add to ChromaDB
async function processDriveFileById(req, res) {
  try {
    const { fileId } = req.params;
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }
    
    // Get file metadata
    const fileInfo = await driveService.getFileInfo(fileId);
    
    if (!fileInfo) {
      return res.status(404).json({ error: 'File not found in Google Drive' });
    }
    
    // Process the file asynchronously and respond immediately
    const result = await processDriveFile(fileInfo);
    
    if (result.success) {
      res.status(202).json({
        success: true,
        message: 'Drive file processing started',
        documentId: result.documentId,
        file: result.file,
        queuePosition: result.queuePosition,
        estimatedTimeMinutes: result.estimatedTimeMinutes
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Drive file processing failed',
        error: result.error,
        file: result.file
      });
    }
  } catch (error) {
    console.error('Error processing Drive file:', error);
    res.status(500).json({ error: 'Failed to process Drive file', details: error.message });
  }
}

// Process multiple Drive files
async function processDriveFiles(req, res) {
  try {
    const { fileIds } = req.body;
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return res.status(400).json({ error: 'File IDs array is required' });
    }
    
    // Start processing and respond immediately
    res.status(202).json({
      success: true,
      message: `Started processing ${fileIds.length} Drive files`,
      fileCount: fileIds.length
    });
    
    // Process files in background
    const results = [];
    for (const fileId of fileIds) {
      try {
        const fileInfo = await driveService.getFileInfo(fileId);
        if (fileInfo) {
          const result = await processDriveFile(fileInfo);
          results.push(result);
          
          // Add a delay between files to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          results.push({
            success: false,
            error: 'File not found',
            fileId
          });
        }
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          fileId
        });
      }
    }
    
    console.log(`Completed processing ${fileIds.length} Drive files:`, 
      results.filter(r => r.success).length, 'succeeded,', 
      results.filter(r => !r.success).length, 'failed');
  } catch (error) {
    console.error('Error processing Drive files:', error);
    // Response already sent, so just log the error
  }
}

module.exports = {
  listDriveFiles,
  processDriveFileById,
  processDriveFiles
};