const express = require('express');
const router = express.Router();
const { generateSalesStrategy } = require('../controllers/salesStrategy');
const { generateExaSalesStrategy } = require('../controllers/exaSalesStrategy');
const { 
  salesCoPilot, 
  clearConversationHistory, 
  getCompanyInfo, 
  getStrategicSalesInsights 
} = require('../controllers/salesCoPilotController');
const documentsRouter = require('./documents');
const driveDocumentsRouter = require('./driveDocuments');
const linkedinController = require('../controllers/linkedinProfiles');
const path = require('path');
const fs = require('fs').promises;
const chromaService = require('../services/chromaService');

// Original Sales Strategy endpoint
router.post('/generateSalesStrategy', generateSalesStrategy);

// New Exa.ai-powered Sales Strategy endpoint
router.post('/generateExaSalesStrategy', generateExaSalesStrategy);

// Sales Co-Pilot endpoints
router.post('/salesCoPilot', salesCoPilot);
router.post('/salesCoPilot/clearHistory', clearConversationHistory);
router.post('/salesCoPilot/companyInfo', getCompanyInfo);
router.post('/salesCoPilot/strategicInsights', getStrategicSalesInsights);

// Other routes
router.use('/documents', documentsRouter);
router.use('/drive', driveDocumentsRouter);
router.post('/linkedinProfiles/search', linkedinController.searchLinkedInProfiles);

// System status route
router.get('/system/status', async (req, res) => {
  const status = {
    server: {
      status: 'online',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    },
    components: {
      documentStorage: 'unknown',
      gcsStorage: 'unknown'
    }
  };
  
  // Check ChromaDB connection
  try {
    const collections = await chromaService.listAllCollections();
    status.components.documentStorage = 'operational';
    status.components.documentStorageDetail = {
      collections: collections.length,
      names: collections.map(c => c.name)
    };
  } catch (error) {
    console.error('ChromaDB connection error:', error.message);
    status.components.documentStorage = 'degraded';
    status.components.documentStorageMessage = `ChromaDB error: ${error.message}`;
  }
  
  return res.status(200).json(status);
});

module.exports = router;