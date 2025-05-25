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
    getMyApplications,
    updateSavedJobs
} from '../controllers/jobController.js';
import { protect } from '../middleware/auth.js';
import { protectEmployer } from '../middleware/employerAuth.js';

const router = express.Router();

// Public routes
router.get('/', getAllJobs);
router.get('/:id', getJob);

// Protected user routes
router.post('/:id/apply', protect, applyForJob);
router.get('/my/applications', protect, getMyApplications);
router.put('/users/:userId/saved-jobs', protect, updateSavedJobs);

// Protected employer routes
router.post('/', protectEmployer, createJob);
router.put('/:id', protectEmployer, updateJob);
router.delete('/:id', protectEmployer, deleteJob);
router.put('/:id/applications/:applicationId', protectEmployer, updateApplicationStatus);
router.get('/my/posted', protectEmployer, getMyPostedJobs);

export default router; 