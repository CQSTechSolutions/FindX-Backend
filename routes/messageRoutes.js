import express from 'express';
import {
    getUserConversations,
    getConversationHistory,
    sendMessage,
    markMessagesAsRead,
    getUserAppliedJobs,
    validateMessagingPermission,
    getUnreadMessageCount,
    deleteMessage,
    getEmployerConversations,
    markAllMessagesAsRead,
    getRecentMessages,
    getUserMessages,
    markMessageAsRead,
    getUserUnreadMessageCount,
    getUserSystemMessages,
    makeSystemMessageVisible,
    markSystemMessageAsReplied,
    getSystemMessageStats,
    replyToSystemMessage
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';
import { protectEmployer } from '../middleware/employerAuth.js';

const router = express.Router();

// User routes (protected)
router.get('/user/:userId/:userType/conversations', protect, getUserConversations);
router.get('/user/:userId/applied-jobs', protect, getUserAppliedJobs);
router.get('/user/:userId/unread-count', protect, getUnreadMessageCount);
router.get('/user/:userId/recent', protect, getRecentMessages);
router.get('/user/messages', protect, getUserMessages);
router.get('/user/messages/unread-count', protect, getUserUnreadMessageCount);
router.put('/user/messages/:messageId/read', protect, markMessageAsRead);
router.get('/conversation/:userId1/:userId2/:jobId', protect, getConversationHistory);
router.post('/send', protect, sendMessage);
router.put('/mark-read', protect, markMessagesAsRead);
router.put('/mark-all-read/:userId', protect, markAllMessagesAsRead);
router.delete('/message/:messageId', protect, deleteMessage);

// System message routes (protected)
router.get('/user/:userId/system-messages', protect, getUserSystemMessages);
router.put('/system-message/:messageId/visible', protect, makeSystemMessageVisible);
router.put('/system-message/:messageId/replied', protect, markSystemMessageAsReplied);
router.post('/system-message/:messageId/reply', protect, replyToSystemMessage);
router.get('/system-messages/stats', protect, getSystemMessageStats);

// Employer routes (protected)
router.get('/employer/:userId/:userType/conversations', protectEmployer, getEmployerConversations);
router.get('/employer/:userId/unread-count', protectEmployer, getUnreadMessageCount);
router.get('/employer/:userId/recent', protectEmployer, getRecentMessages);
router.get('/employer/conversation/:userId1/:userId2/:jobId', protectEmployer, getConversationHistory);
router.post('/employer/send', protectEmployer, sendMessage);
router.put('/employer/mark-read', protectEmployer, markMessagesAsRead);
router.put('/employer/mark-all-read/:userId', protectEmployer, markAllMessagesAsRead);
router.delete('/employer/message/:messageId', protectEmployer, deleteMessage);

// Validation and utility routes
router.post('/validate-permission', protect, validateMessagingPermission);

export default router; 