require('dotenv').config();
const { Storage } = require('@google-cloud/storage');

// Initialize storage with credentials path from .env
const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
});

// Test connection by listing files in your bucket
async function testConnection() {
  try {
    const bucketName = process.env.GCS_BUCKET_NAME;
    const [files] = await storage.bucket(bucketName).getFiles();
    
    console.log(`Files in bucket ${bucketName}:`);
    if (files.length === 0) {
      console.log('No files found. Bucket exists but is empty.');
    } else {
      files.forEach(file => {
        console.log(file.name);
      });
    }
    console.log('Google Cloud Storage connection successful!');
  } catch (error) {
    console.error('Error connecting to Google Cloud Storage:', error);
  }
}

testConnection();