import express from 'express';
import multer from 'multer';
import { 
    uploadResume, 
    uploadMultipleResume,
    deleteResume, 
    updateResumeVisibility, 
    testCloudinary,
    getResumes,
    deleteResumeById,
    setPrimaryResume,
    updateResumeVisibilityById,
    updateCoverLetter,
    getCoverLetter
} from '../controllers/resumeController.js';
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
// Single resume routes (for backward compatibility)
router.post('/upload', protect, upload.single('resume'), uploadResume);
router.delete('/delete', protect, deleteResume);
router.patch('/visibility', protect, updateResumeVisibility);

// Multiple resumes routes
router.post('/upload-multiple', protect, upload.single('resume'), uploadMultipleResume);
router.get('/list', protect, getResumes);
router.delete('/delete/:resumeId', protect, deleteResumeById);
router.patch('/set-primary/:resumeId', protect, setPrimaryResume);
router.patch('/visibility/:resumeId', protect, updateResumeVisibilityById);

// Cover letter routes
router.get('/cover-letter/:resumeId', protect, getCoverLetter);
router.patch('/cover-letter/:resumeId', protect, updateCoverLetter);

// Test route
router.get('/test-cloudinary', protect, testCloudinary);

export default router; 