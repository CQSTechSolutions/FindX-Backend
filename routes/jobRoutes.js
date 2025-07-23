import express from 'express';
import {
    createJob,
    getAllJobs,
    getLatestJobs,
    getJob,
    updateJob,
    deleteJob,
    applyForJob,
    updateApplicationStatus,
    updateJobStatus,
    getMyPostedJobs,
    getMyApplications,
    updateSavedJobs,
    getApplicationResponses,
    getUserApplicationResponse,
    fixEmptyQuestionResponses,
    getJobRecommendations,
    sendPromotionNotifications,
    getJobCategories,
    getJobSubcategories,
    getJobStatistics,
    getSavedJobs,
    saveJob
} from '../controllers/jobController.js';
import { protect } from '../middleware/auth.js';
import { protectEmployer } from '../middleware/employerAuth.js';

const router = express.Router();

// Public routes
router.get('/', getAllJobs);
router.get('/latest', getLatestJobs);
router.get('/categories', getJobCategories);
router.get('/categories/:category/subcategories', getJobSubcategories);
router.get('/statistics', getJobStatistics);

// Protected user routes - specific routes must come before parameterized routes
router.get('/recommendations', protect, getJobRecommendations);
router.get('/my/applications', protect, getMyApplications);
router.get('/saved', protect, getSavedJobs);
router.put('/users/:userId/saved-jobs', protect, updateSavedJobs);
router.put('/:jobId/save', protect, saveJob);

// Parameterized routes - must come after specific routes
router.get('/:id', getJob);
router.post('/:id/apply', protect, applyForJob);

// Protected employer routes
router.post('/', protectEmployer, createJob);
router.post('/promotion/notify', protectEmployer, sendPromotionNotifications);
router.put('/:id', protectEmployer, updateJob);
router.put('/:id/status', protectEmployer, updateJobStatus);
router.delete('/:id', protectEmployer, deleteJob);
router.put('/:id/applications/:applicationId', protectEmployer, updateApplicationStatus);
router.get('/my/posted', protectEmployer, getMyPostedJobs);

// Application responses routes
router.get('/:jobId/responses', protectEmployer, getApplicationResponses);
router.get('/:jobId/my-response', protect, getUserApplicationResponse);

// Admin/debug routes - temporary for debugging
router.get('/admin/fix-empty-responses', fixEmptyQuestionResponses);
router.post('/admin/fix-empty-responses', protectEmployer, fixEmptyQuestionResponses);

export default router; 