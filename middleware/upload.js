const multer = require('multer');

// Create a storage engine
const storage = multer.memoryStorage();

// Create file filter to accept PDF and DOCX with improved MIME type detection
const fileFilter = (req, file, cb) => {
  console.log("Uploaded file MIME type:", file.mimetype);
  
  // Check file extension as well as MIME type
  const filename = file.originalname.toLowerCase();
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/octet-stream' // Sometimes files are sent with this generic type
  ];
  
  if (allowedMimeTypes.includes(file.mimetype) || 
      filename.endsWith('.pdf') || 
      filename.endsWith('.docx') || 
      filename.endsWith('.doc')) {
    // File type is allowed
    cb(null, true);
  } else {
    // File type is not allowed
    cb(new Error(`Unsupported file format: ${file.mimetype}. Please upload PDF or DOCX files only.`), false);
  }
};

// Set up the multer middleware with more generous limits
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max file size
  },
});

module.exports = upload;