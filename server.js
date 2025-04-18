const express = require('express');
const dotenv = require('dotenv');
const mainRouter = require('./routes/main');
const cors = require('cors');
const { chromaClient, verifyChromaConnection } = require('./services/chromaService');
const apiKeyAuth = require('./middleware/apiKeyAuth');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: '*',  // For development. In production, specify allowed domains
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Other middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply the API key middleware to all routes
app.use('/api', apiKeyAuth);

// Routes
app.use('/api', mainRouter);

// Fix the startServer function
function startServer() {
  app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
    console.log(`✅ For Streamlit app, set BASE_URL="http://localhost:${port}/api"`);
  }).on('error', (err) => {
    console.error('Error starting server:', err);
    process.exit(1);
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
startServer();


