const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

class DriveService {
  constructor() {
    this.auth = null;
    this.drive = null;
    this.initialized = false;
    this.tempDir = path.join(os.tmpdir(), 'salesgpt-drive-files');
    this.ensureTempDir();
    this.initialize();
  }

  async ensureTempDir() {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
    } catch (error) {
      console.error('Error creating temp directory:', error);
    }
  }

  async initialize() {
    try {
      // Add verbose logging to help debug
      console.log('📄 Initializing Google Drive service...');
      
      // Get credentials path from env or use default path
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      console.log(`Looking for credentials at: ${credentialsPath}`);
      
      if (!credentialsPath) {
        console.error('❌ GOOGLE_APPLICATION_CREDENTIALS environment variable not set');
        console.log('Add GOOGLE_APPLICATION_CREDENTIALS=/path/to/your-credentials.json to your .env file');
        this.initialized = false;
        return;
      }
      
      // Check if file exists
      if (!fs.existsSync(credentialsPath)) {
        console.error(`❌ Credentials file not found at: ${credentialsPath}`);
        this.initialized = false;
        return;
      }
      
      // Fallback to using API key if service account fails
      try {
        this.auth = new google.auth.GoogleAuth({
          keyFile: credentialsPath,
          scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        
        // Validate auth by getting client
        const authClient = await this.auth.getClient();
        this.drive = google.drive({ version: 'v3', auth: authClient });
        
        // Test the connection
        await this.drive.about.get({ fields: 'user' });
        
        this.initialized = true;
        console.log('✅ Google Drive API initialized successfully with service account');
      } catch (authError) {
        console.error('❌ Service account authentication failed:', authError.message);
        
        // Try fallback to API key if available
        const apiKey = process.env.GOOGLE_API_KEY;
        if (apiKey) {
          try {
            console.log('⚠️ Falling back to API key authentication');
            this.drive = google.drive({ 
              version: 'v3', 
              auth: apiKey 
            });
            this.initialized = true;
            console.log('✅ Google Drive API initialized with API key');
          } catch (apiKeyError) {
            console.error('❌ API key authentication also failed:', apiKeyError.message);
            this.initialized = false;
          }
        } else {
          console.error('❌ No API key available for fallback authentication');
          this.initialized = false;
        }
      }
    } catch (error) {
      console.error('❌ Unexpected error initializing Drive service:', error);
      this.initialized = false;
    }
  }

  /**
   * List files from a Google Drive folder
   * @param {string} folderId - The Google Drive folder ID
   * @returns {Promise<Array>} - List of files in the folder
   */
  async listFiles(folderId) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized) {
      throw new Error('Drive service not initialized');
    }

    try {
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType, createdTime, modifiedTime, size)',
        orderBy: 'modifiedTime desc'
      });

      return response.data.files;
    } catch (error) {
      console.error('Error listing Drive files:', error);
      throw error;
    }
  }

  /**
   * Download a file from Google Drive
   * @param {string} fileId - The Google Drive file ID
   * @param {string} fileName - The name to save the file as
   * @returns {Promise<string>} - Path to the downloaded file
   */
  async downloadFile(fileId, fileName) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.initialized) {
      throw new Error('Drive service not initialized');
    }

    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const destPath = path.join(this.tempDir, sanitizedFileName);

    try {
      const response = await this.drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      return new Promise((resolve, reject) => {
        const dest = fs.createWriteStream(destPath);
        response.data
          .pipe(dest)
          .on('finish', () => {
            console.log(`✅ File downloaded: ${destPath}`);
            resolve(destPath);
          })
          .on('error', (err) => {
            console.error('Error downloading file:', err);
            reject(err);
          });
      });
    } catch (error) {
      console.error(`Error downloading file ${fileId}:`, error);
      throw error;
    }
  }

  // Add this method to handle Google Docs export
  async downloadGoogleDocument(fileId, mimeType) {
    try {
      // For Google Docs, Sheets, etc., use export instead of direct download
      if (mimeType.includes('application/vnd.google-apps')) {
        // Map Google Docs formats to export formats
        const exportFormats = {
          'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.google-apps.presentation': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };

        const exportMimeType = exportFormats[mimeType] || 'application/pdf';
        
        console.log(`Exporting Google ${mimeType} as ${exportMimeType}`);
        
        // Use the export endpoint
        const res = await this.drive.files.export({
          fileId,
          mimeType: exportMimeType
        }, {
          responseType: 'stream'
        });
        
        return {
          stream: res.data,
          mimeType: exportMimeType
        };
      } else {
        // For normal files, use the regular download
        const res = await this.drive.files.get(
          {
            fileId,
            alt: 'media'
          },
          {
            responseType: 'stream'
          }
        );
        
        return {
          stream: res.data,
          mimeType
        };
      }
    } catch (error) {
      console.error(`Error downloading file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Extract text from a downloaded file
   * @param {string} filePath - Path to the downloaded file
   * @returns {Promise<string>} - Extracted text
   */
  async extractTextFromFile(filePath) {
    const fileExtension = path.extname(filePath).toLowerCase();
    
    try {
      if (fileExtension === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        return pdfData.text;
      } else if (fileExtension === '.docx' || fileExtension === '.doc') {
        const dataBuffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer: dataBuffer });
        return result.value;
      } else {
        throw new Error(`Unsupported file type: ${fileExtension}`);
      }
    } catch (error) {
      console.error(`Error extracting text from ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Clean up temporary files
   * @param {string} filePath - Path to the file to delete
   */
  async cleanupTempFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`✅ Cleaned up temporary file: ${filePath}`);
      }
    } catch (error) {
      console.error(`Error cleaning up file ${filePath}:`, error);
    }
  }

  // Get file information by ID
  async getFileInfo(fileId) {
    try {
      const response = await this.drive.files.get({
        fileId,
        fields: 'id, name, mimeType, size, createdTime, modifiedTime'
      });
      
      return response.data;
    } catch (error) {
      console.error(`Error getting info for file ${fileId}:`, error);
      throw error;
    }
  }

  // Download regular file from Drive
  async downloadFile(fileId) {
    try {
      const res = await this.drive.files.get(
        {
          fileId,
          alt: 'media'
        },
        {
          responseType: 'stream'
        }
      );
      
      return {
        stream: res.data,
        mimeType: res.headers['content-type']
      };
    } catch (error) {
      console.error(`Error downloading file ${fileId}:`, error);
      throw error;
    }
  }

  // Export Google Docs file to a different format
  async exportFile(fileId, mimeType = 'application/pdf') {
    try {
      const res = await this.drive.files.export(
        {
          fileId,
          mimeType
        },
        {
          responseType: 'stream'
        }
      );
      
      return {
        stream: res.data,
        mimeType
      };
    } catch (error) {
      console.error(`Error exporting file ${fileId} as ${mimeType}:`, error);
      throw error;
    }
  }
}

module.exports = new DriveService();