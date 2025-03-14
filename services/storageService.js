const { bucket } = require('../config/gcloud');
const { format } = require('util');

class StorageService {
  /**
   * Upload file to Google Cloud Storage
   * @param {Object} file - The file object from multer
   * @param {String} userId - User identifier
   * @returns {Promise<Object>} - File metadata
   */
  async uploadFile(file, userId) {
    return new Promise((resolve, reject) => {
      const fileName = `${userId}/${Date.now()}-${file.originalname}`;
      const blob = bucket.file(fileName);
      const blobStream = blob.createWriteStream({
        resumable: false,
        gzip: true,
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            userId
          }
        }
      });

      blobStream.on('error', (err) => {
        reject(err);
      });

      blobStream.on('finish', async () => {
        // Make the file publicly accessible
        await blob.makePublic();
        
        // Get public URL
        const publicUrl = format(
          `https://storage.googleapis.com/${bucket.name}/${blob.name}`
        );
        
        resolve({
          fileName,
          fileUrl: publicUrl,
          originalName: file.originalname,
          size: file.size
        });
      });

      blobStream.end(file.buffer);
    });
  }

  /**
   * Download file from Google Cloud Storage
   * @param {String} fileName - File path in GCS
   * @returns {Promise<Buffer>} - File contents as Buffer
   */
  async downloadFile(fileName) {
    try {
      const [fileContents] = await bucket.file(fileName).download();
      return fileContents;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  /**
   * Get file metadata from Google Cloud Storage
   * @param {String} fileName - File path in GCS
   * @returns {Promise<Object>} - File metadata
   */
  async getFileMetadata(fileName) {
    try {
      const [metadata] = await bucket.file(fileName).getMetadata();
      return metadata;
    } catch (error) {
      console.error('Error fetching file metadata:', error);
      throw error;
    }
  }

  /**
   * Delete file from Google Cloud Storage
   * @param {String} fileName - File path in GCS
   * @returns {Promise<Boolean>} - True if file is deleted
   */
  async deleteFile(fileName) {
    try {
      await bucket.file(fileName).delete();
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
}

module.exports = new StorageService();