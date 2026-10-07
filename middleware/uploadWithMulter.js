const multer = require("multer");
const { uid } = require("uid");
const path = require("path");
const fs = require("fs");

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create documents directory
const documentUploadPath = path.join(__dirname, "../uploads/documents");
if (!fs.existsSync(documentUploadPath)) {
  fs.mkdirSync(documentUploadPath, { recursive: true });
}

// Set the storage engine and file size limit for images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const uniqueId = uid(16);
    const extension = path.extname(file.originalname);
    const filename = `${uniqueId}${extension}`;
    
    const filelink = `${process.env.BASE_URL || "http://localhost:2000"}/uploads/${filename}`;
    
    req.filelink = filelink;
    req.filename = filename;
    
    cb(null, filename);
  },
});

// File filter to accept ALL image types
const fileFilter = (req, file, cb) => {
  // Accept all image types
  const allowedTypes = /jpeg|jpg|png|gif|webp|bmp|tiff|svg|ico|avif|heic|heif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.startsWith('image/');

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Error: Images Only! (jpeg, jpg, png, gif, webp, bmp, tiff, svg, ico, avif)"));
  }
};

// Document storage (no file filter - accepts anything)
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, documentUploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// INCREASE FILE SIZE LIMIT TO 500MB
const uploadDocumentMiddleware = multer({ 
  storage: documentStorage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit for documents
});

// Image upload with increased limit and all image types
const uploadWithMulter = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Increased to 10MB for images
  fileFilter: fileFilter
});

// Export both
module.exports = uploadWithMulter;
module.exports.uploadDocument = uploadDocumentMiddleware;
