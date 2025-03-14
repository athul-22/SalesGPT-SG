const pdfParse = require('pdf-parse');
const storageService = require('./storageService');
const chromaService = require('./chromaService');
const geminiService = require('./geminiService');

class PDFService {
  async extractText(fileBuffer) {
    try {
      const data = await pdfParse(fileBuffer);
      return data.text;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw error;
    }
  }

  async processFile(fileName, documentId, userId) {
    try {
      // Step 1: Download file from Google Cloud Storage
      const fileBuffer = await storageService.downloadFile(fileName);
      
      // Step 2: Extract text from PDF
      const text = await this.extractText(fileBuffer);
      
      // Step 3: Get file metadata
      const metadata = await storageService.getFileMetadata(fileName);
      
      // Step 4: Add document to ChromaDB
      const chunkIds = await chromaService.addDocument(documentId, text, {
        fileName,
        originalName: metadata.metadata.originalName,
        userId,
        uploadedAt: new Date().toISOString()
      });
      
      // Step 5: Analyze with Gemini (in background)
      const metadataObj = {
        originalName: metadata.metadata.originalName,
        userId,
        fileName
      };
      
      let analysis = null;
      try {
        analysis = await geminiService.analyzePdfContent(text, metadataObj);
      } catch (analysisError) {
        console.error('Error during PDF analysis:', analysisError);
        // Continue even if analysis fails
      }
      
      // Return the combined results
      return {
        documentId,
        chunkIds,
        metadata: metadataObj,
        textLength: text.length,
        analysis
      };
    } catch (error) {
      console.error(`Error processing PDF ${fileName}:`, error);
      throw error;
    }
  }
}

module.exports = new PDFService();