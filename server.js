const express = require('express');
const dotenv = require('dotenv');
const mainRouter = require('./routes/main');
const cors = require('cors');
const { chromaClient, verifyChromaConnection } = require('./services/chromaService');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

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

// Simplified server start function that only uses port 3000
function startServer() {
  app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
    console.log(`✅ For Streamlit app, set BASE_URL="http://localhost:${port}/api"`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE' && ports.length > 0) {
      server.close();
      startServer(ports);
    } else {
      console.error('Error starting server:', err);
      process.exit(1);
    }
  });
}

// Test ChromaDB connection - use the imported function from chromaService
async function testChromaConnection() {
  try {
    const connected = await verifyChromaConnection();
    
    if (connected) {
      try {
        // If connection is verified, try to list collections
        const collections = await chromaClient.listCollections();
        console.log(`✅ ChromaDB found ${collections.length} collections`);
      } catch (operationError) {
        console.error('ChromaDB operation failed:', operationError.message);
      }
    }
  } catch (error) {
    console.error('Error testing ChromaDB connection:', error);
  }
}

// Call the test function
testChromaConnection();

// Start the server - ONLY ONCE
const preferredPorts = [3003, 3002, 3001, 3000];
startServer(preferredPorts);


