const express = require('express');
const router = express.Router();
const { generateSalesStrategy } = require('../controllers/salesStrategy');
const documentsRouter = require('./documents');

router.post('/generateSalesStrategy', generateSalesStrategy);
router.use('/documents', documentsRouter);

module.exports = router;