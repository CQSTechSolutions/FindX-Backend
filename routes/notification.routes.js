import express from 'express';
import {
    cleanupExpiredNotifications,
    deleteNotification,
    getUnreadCount,
    getUserNotifications,
    markNotificationsAsRead
} from '../controllers/notificationController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET /api/notifications - Get user notifications with pagination
router.get('/', getUserNotifications);

// GET /api/notifications/unread-count - Get unread notification count
router.get('/unread-count', getUnreadCount);

// PUT /api/notifications/mark-read - Mark notifications as read
router.put('/mark-read', markNotificationsAsRead);

// DELETE /api/notifications/:notificationId - Delete a specific notification
router.delete('/:notificationId', deleteNotification);

// POST /api/notifications/cleanup - Cleanup expired notifications (admin only)
router.post('/cleanup', cleanupExpiredNotifications);

export default router; 
