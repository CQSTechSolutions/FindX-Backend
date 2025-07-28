import express from 'express';
import {
  cleanupExpiredNotifications,
  createNotification,
  deleteNotification,
  getUnreadCount,
  getUserNotifications,
  markNotificationsAsRead,
} from "../controllers/notificationController.js";
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

// POST /api/notifications/test - Create a test notification (for debugging)
router.post('/test', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        const notificationData = {
            userId,
            type: 'general',
            title: 'Test Notification',
            message: 'This is a test notification to verify the system is working.',
            priority: 'medium'
        };

        const notification = await createNotification(notificationData);
        
        res.json({
            success: true,
            message: 'Test notification created successfully',
            notification
        });
    } catch (error) {
        console.error('Error creating test notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test notification',
            error: error.message
        });
    }
});

export default router; 
