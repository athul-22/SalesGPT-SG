const express = require('express');
const router = express.Router();
const { generateSalesStrategy } = require('../controllers/salesStrategy');
const documentsRouter = require('./documents');
const linkedinController = require('../controllers/linkedinProfiles');
const path = require('path');
const fs = require('fs').promises;

router.post('/generateSalesStrategy', generateSalesStrategy);
router.use('/documents', documentsRouter);
router.post('/linkedinProfiles/search', linkedinController.searchLinkedInProfiles);

router.get('/system/status', async (req, res) => {
  try {
    // Test different components
    const status = {
      server: 'operational',
      timestamp: new Date().toISOString(),
      components: {}
    };
    
    // Check local storage
    try {
      const dataPath = path.join(__dirname, '../data');
      await fs.access(dataPath);
      status.components.localStorage = 'operational';
    } catch (err) {
      status.components.localStorage = 'degraded';
      status.components.localStorageMessage = 'Storage directories not accessible';
    }
    
    // Check ChromaDB
    try {
      const chromaService = require('../services/chromaService');
      await chromaService.getOrCreateCollection();
      status.components.documentStorage = 'operational';
    } catch (err) {
      status.components.documentStorage = 'degraded';
      status.components.documentStorageMessage = err.message;
    }
    
    // Add memory usage
    const memoryUsage = process.memoryUsage();
    status.resources = {
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
      }
    };
    
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({ 
      error: 'Error checking system status',
      message: error.message
    });
  }
});

module.exports = router;