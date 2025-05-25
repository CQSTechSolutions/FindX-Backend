import express from 'express';
import {
    getUserConversations,
    getConversationHistory,
    sendMessage,
    markMessagesAsRead,
    getUserAppliedJobs,
    validateMessagingPermission
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';
import { protectEmployer } from '../middleware/employerAuth.js';

const router = express.Router();

// User routes (protected)
router.get('/user/:userId/:userType/conversations', protect, getUserConversations);
router.get('/user/:userId/applied-jobs', protect, getUserAppliedJobs);
router.get('/conversation/:userId1/:userId2/:jobId', protect, getConversationHistory);
router.post('/send', protect, sendMessage);
router.put('/mark-read', protect, markMessagesAsRead);

// Employer routes (protected)
router.get('/employer/:userId/:userType/conversations', protectEmployer, getUserConversations);
router.get('/employer/conversation/:userId1/:userId2/:jobId', protectEmployer, getConversationHistory);
router.post('/employer/send', protectEmployer, sendMessage);
router.put('/employer/mark-read', protectEmployer, markMessagesAsRead);

// Validation middleware route
router.post('/validate-permission', protect, validateMessagingPermission);

export default router; 