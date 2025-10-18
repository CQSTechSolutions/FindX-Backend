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
    getUserBasedConversations,
    getUserBasedConversationHistory,
    sendUserBasedMessage,
    markUserBasedMessagesAsRead
} from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';
import { protectEmployer } from '../middleware/employerAuth.js';
import { checkMessagingSubscription, getSubscriptionStatus, canContactUser } from '../middleware/messagingSubscription.js';

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

// Employer routes (protected)
router.get('/employer/:userId/:userType/conversations', protectEmployer, getEmployerConversations);
router.get('/employer/:userId/unread-count', protectEmployer, getUnreadMessageCount);
router.get('/employer/:userId/recent', protectEmployer, getRecentMessages);
router.get('/employer/conversation/:userId1/:userId2/:jobId', protectEmployer, getConversationHistory);
router.post('/employer/send', protectEmployer, checkMessagingSubscription, sendMessage);
router.put('/employer/mark-read', protectEmployer, markMessagesAsRead);
router.put('/employer/mark-all-read/:userId', protectEmployer, markAllMessagesAsRead);
router.delete('/employer/message/:messageId', protectEmployer, deleteMessage);

// Messaging subscription routes
router.get('/employer/:employerId/subscription-status', protectEmployer, getSubscriptionStatus, (req, res) => {
  res.json({
    success: true,
    data: req.subscriptionStatus
  });
});
router.get('/employer/:employerId/can-contact/:userId', protectEmployer, canContactUser, (req, res) => {
  res.json({
    success: true,
    data: req.contactStatus
  });
});

// Validation and utility routes
router.post('/validate-permission', protect, validateMessagingPermission);

// User-based messaging routes (without job dependency)
router.get('/user-based/:userId/:userType/conversations', protect, getUserBasedConversations);
router.get('/user-based/conversation/:userId1/:userId2', protect, getUserBasedConversationHistory);
router.post('/user-based/send', protect, sendUserBasedMessage);
router.put('/user-based/mark-read', protect, markUserBasedMessagesAsRead);

// Employer user-based messaging routes (without job dependency)
router.get('/employer-user-based/:userId/:userType/conversations', protectEmployer, getUserBasedConversations);
router.get('/employer-user-based/conversation/:userId1/:userId2', protectEmployer, getUserBasedConversationHistory);
router.post('/employer-user-based/send', protectEmployer, checkMessagingSubscription, sendUserBasedMessage);
router.put('/employer-user-based/mark-read', protectEmployer, markUserBasedMessagesAsRead);

export default router;