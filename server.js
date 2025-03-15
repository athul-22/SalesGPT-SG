const express = require('express');
const dotenv = require('dotenv');
const mainRouter = require('./routes/main');

// Load environment variables
dotenv.config();

const app = express();
const defaultPort = process.env.PORT || 3000;
const alternativePorts = [3001, 3002, 3003, 4000];

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', mainRouter);

// Try to start the server on the default port, fall back to alternatives if needed
function startServer(ports) {
  const port = ports.shift();
  
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    // Update the Streamlit app's BASE_URL if needed
    console.log(`For Streamlit app, set BASE_URL="http://localhost:${port}/api"`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE' && ports.length > 0) {
      console.log(`Port ${port} is busy, trying port ${ports[0]}...`);
      server.close();
      startServer(ports);
    } else {
      console.error('Error starting server:', err);
      process.exit(1);
    }
  });
}

// Start with the default port, then try alternatives
startServer([defaultPort, ...alternativePorts]);


