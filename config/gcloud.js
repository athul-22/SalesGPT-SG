const { Storage } = require('@google-cloud/storage');

// Initialize storage with credentials
const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
});

const bucketName = process.env.GCS_BUCKET_NAME || 'salesgpt-documents';
const bucket = storage.bucket(bucketName);

module.exports = {
  storage,
  bucket,
  bucketName
};