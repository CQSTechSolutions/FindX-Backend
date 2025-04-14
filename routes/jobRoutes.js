import express from 'express';
import {
    createJob,
    getAllJobs,
    getJob,
    updateJob,
    deleteJob,
    applyForJob,
    updateApplicationStatus,
    getMyPostedJobs,
    getMyApplications
} from '../controllers/jobController.js';
// import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllJobs);
router.get('/:id', getJob);

// Protected routes
// router.use(protect); // All routes below this will require authentication

// Job management routes
router.post('/', createJob);
router.put('/:id', updateJob);
router.delete('/:id', deleteJob);

// Application routes
router.post('/:id/apply', applyForJob);
router.put('/:id/applications/:applicationId', updateApplicationStatus);

// User specific routes
router.get('/my/posted', getMyPostedJobs);
router.get('/my/applications', getMyApplications);

export default router; 