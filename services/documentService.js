const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

class DocumentService {
  /**
   * Extract text from uploaded file
   * @param {Object} file - The file object from multer
   * @returns {Promise<string>} - Extracted text
   */
  async extractTextFromFile(file) {
    try {
      console.log(`Extracting text from ${file.originalname} (${file.mimetype})`);
      
      // Get file extension
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      // Extract based on file type
      if (file.mimetype.includes('pdf') || fileExtension === '.pdf') {
        console.log('Extracting text from PDF...');
        return await this.extractTextFromPDF(file.buffer);
      } else if (
        file.mimetype.includes('word') || 
        file.mimetype.includes('docx') || 
        file.mimetype.includes('doc') ||
        fileExtension === '.docx' || 
        fileExtension === '.doc'
      ) {
        console.log('Extracting text from DOCX/DOC...');
        return await this.extractTextFromDOCX(file.buffer);
      } else {
        // For plain text or other types
        console.log('Treating as plain text...');
        return file.buffer.toString('utf-8');
      }
    } catch (error) {
      console.error(`Error extracting text: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract text from PDF buffer
   * @param {Buffer} buffer - PDF file as buffer
   * @returns {Promise<string>} - Extracted text
   */
  async extractTextFromPDF(buffer) {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      console.error('Error parsing PDF:', error);
      throw error;
    }
  }

  /**
   * Extract text from DOCX buffer
   * @param {Buffer} buffer - DOCX file as buffer
   * @returns {Promise<string>} - Extracted text
   */
  async extractTextFromDOCX(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('Error parsing DOCX:', error);
      throw error;
    }
  }
}

module.exports = new DocumentService();