const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = path.join(__dirname, '../uploads');
    
    // Organize uploads by type
    if (file.fieldname === 'cv') {
      uploadPath = path.join(uploadPath, 'cvs');
    } else if (file.fieldname === 'profilePicture') {
      uploadPath = path.join(uploadPath, 'profiles');
    } else if (file.fieldname === 'courseImage' || file.fieldname === 'thumbnail') {
      uploadPath = path.join(uploadPath, 'courses');
    } else if (file.fieldname === 'marketplaceImages') {
      uploadPath = path.join(uploadPath, 'marketplace');
    } else if (file.fieldname === 'marketplaceFiles') {
      uploadPath = path.join(uploadPath, 'marketplace/files');
    } else {
      uploadPath = path.join(uploadPath, 'misc');
    }
    
    ensureDirectoryExists(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    const cleanBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    
    cb(null, `${cleanBaseName}-${uniqueSuffix}${extension}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    cv: ['.pdf', '.doc', '.docx'],
    profilePicture: ['.jpg', '.jpeg', '.png', '.gif'],
    courseImage: ['.jpg', '.jpeg', '.png'],
    thumbnail: ['.jpg', '.jpeg', '.png'],
    marketplaceImages: ['.jpg', '.jpeg', '.png'],
    marketplaceFiles: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.zip', '.rar', '.txt']
  };
  
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const allowedForField = allowedTypes[file.fieldname] || [];
  
  if (allowedForField.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type for ${file.fieldname}. Allowed types: ${allowedForField.join(', ')}`), false);
  }
};

// Create multer instance with configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files per request
  }
});

// Specific upload configurations
const uploadConfig = {
  // Single file uploads
  cv: upload.single('cv'),
  profilePicture: upload.single('profilePicture'),
  courseImage: upload.single('courseImage'),
  thumbnail: upload.single('thumbnail'),
  
  // Multiple file uploads
  marketplaceImages: upload.array('marketplaceImages', 5),
  marketplaceFiles: upload.array('marketplaceFiles', 3),
  
  // Mixed uploads
  courseFiles: upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'resources', maxCount: 10 }
  ]),
  
  marketplaceItem: upload.fields([
    { name: 'marketplaceImages', maxCount: 5 },
    { name: 'marketplaceFiles', maxCount: 3 }
  ])
};

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        message: 'File too large. Maximum size is 10MB.' 
      });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        message: 'Too many files uploaded.' 
      });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ 
        message: 'Unexpected file field.' 
      });
    }
    return res.status(400).json({ 
      message: `Upload error: ${error.message}` 
    });
  } else if (error) {
    return res.status(400).json({ 
      message: error.message 
    });
  }
  next();
};

// Utility function to delete uploaded files
const deleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
  return false;
};

// Utility function to delete multiple files
const deleteFiles = (filePaths) => {
  const results = [];
  for (const filePath of filePaths) {
    results.push(deleteFile(filePath));
  }
  return results;
};

// Middleware to clean up files on request error
const cleanupOnError = (req, res, next) => {
  const originalEnd = res.end;
  
  res.end = function(...args) {
    // If response status indicates error, clean up uploaded files
    if (res.statusCode >= 400 && req.files) {
      if (Array.isArray(req.files)) {
        // Handle array of files
        req.files.forEach(file => deleteFile(file.path));
      } else if (typeof req.files === 'object') {
        // Handle object with multiple file fields
        Object.values(req.files).forEach(fileArray => {
          if (Array.isArray(fileArray)) {
            fileArray.forEach(file => deleteFile(file.path));
          } else {
            deleteFile(fileArray.path);
          }
        });
      }
    } else if (res.statusCode >= 400 && req.file) {
      // Handle single file
      deleteFile(req.file.path);
    }
    
    originalEnd.apply(this, args);
  };
  
  next();
};

// Middleware to validate file requirements
const validateFileRequirements = (requirements) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const [fieldName, config] of Object.entries(requirements)) {
      const files = req.files && req.files[fieldName];
      const file = req.file && req.file.fieldname === fieldName ? req.file : null;
      
      if (config.required && !files && !file) {
        errors.push(`${fieldName} is required`);
      }
      
      if (config.minFiles && files && files.length < config.minFiles) {
        errors.push(`${fieldName} requires at least ${config.minFiles} files`);
      }
      
      if (config.maxFiles && files && files.length > config.maxFiles) {
        errors.push(`${fieldName} allows maximum ${config.maxFiles} files`);
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        message: 'File validation failed',
        errors: errors
      });
    }
    
    next();
  };
};

module.exports = {
  upload,
  uploadConfig,
  handleUploadError,
  deleteFile,
  deleteFiles,
  cleanupOnError,
  validateFileRequirements
};
