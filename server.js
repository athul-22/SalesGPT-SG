const express = require('express');
const dotenv = require('dotenv');
const mainRouter = require('./routes/main');
const cors = require('cors');  // Add this import

// Load environment variables
dotenv.config();

const app = express();
const defaultPort = process.env.PORT || 3000;
const alternativePorts = [3001, 3002, 3003, 4000];

// Apply CORS middleware before other middleware
app.use(cors({
  origin: '*',  // For development. In production, specify allowed domains
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Other middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', mainRouter);

// Try to start the server on the default port, fall back to alternatives if needed
function startServer(ports) {
  const port = ports.shift();
  
  const server = app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
    // Update the Streamlit app's BASE_URL if needed
    console.log(`✅ For Streamlit app, set BASE_URL="http://localhost:${port}/api"`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE' && ports.length > 0) {
      // console.log(`Port ${port} is busy, trying port ${ports[0]}...`);
      server.close();
      startServer(ports);
    } else {
      console.error('Error starting server:', err);
      process.exit(1);
    }
  });
}

const { ChromaClient } = require('chromadb');
require('dotenv').config();

// Update the testChromaConnection function

async function testChromaConnection() {
  try {
    console.log('Testing ChromaDB cloud connection...');
    
    const client = new ChromaClient({
      path: "https://api.trychroma.com:8000",
      auth: { 
        provider: "token", 
        credentials: process.env.CHROMA_API_TOKEN || 'ck-EAZozmhtW1dT5YonuwLwTYhqkYZkjG1f3LBkKZW3YZZr',
        tokenHeaderType: "X-Chroma-Token" // Corrected header capitalization
      },
      tenant: process.env.CHROMA_TENANT || 'b5ba23cc-d04e-4a55-a175-e3ace27792c9',
      database: process.env.CHROMA_DATABASE || 'KnowledgeBase'
    });
    
    // Try to get user identity first to validate authentication
    try {
      const userIdentity = await client.heartbeat();
      console.log(`✅ ChromaDB connection authenticated: ${userIdentity}`);
      
      // If that works, list collections
      const collections = await client.listCollections();
      console.log(`✅ ChromaDB found ${collections.length} collections`);
    } catch (authError) {
      console.error('ChromaDB authentication failed:', authError.message);
      console.log('Please check your CHROMA_API_TOKEN in .env file');
    }
  } catch (error) {
    console.error('Error testing ChromaDB cloud connection:', error);
  }
}

testChromaConnection();

// Add this after your startServer function

// Test storage system on startup but don't block server
async function testStorage() {
  try {
    console.log('Testing document storage system...');
    
    // Test ChromaDB connection by creating a test document
    const testId = 'server-startup-test-' + Date.now();
    const testResult = await chromaService.addDocument(
      "This is a server startup test document.", 
      {documentId: testId, testData: true},
      testId
    );
    
    console.log('✅ Document storage system is working:', testResult);
  } catch (error) {
    console.warn('⚠️ Document storage system has issues:', error.message);
    console.log('The application will continue running with degraded functionality');
  }
}

// Start the server
const preferredPorts = [3003, 3002, 3001, 3000];
startServer(preferredPorts);

// Test storage after server starts, but don't block startup
setTimeout(testStorage, 1000);

// Start with the default port, then try alternatives
startServer([defaultPort, ...alternativePorts]);


