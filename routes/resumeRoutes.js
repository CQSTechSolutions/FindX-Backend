import express from 'express';
import multer from 'multer';
import { uploadResume, deleteResume, updateResumeVisibility } from '../controllers/resumeController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for memory storage (we'll upload to Cloudinary)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Accept PDF, DOC, and DOCX files
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Routes
router.post('/upload', protect, upload.single('resume'), uploadResume);
router.delete('/delete', protect, deleteResume);
router.patch('/visibility', protect, updateResumeVisibility);

export default router; 