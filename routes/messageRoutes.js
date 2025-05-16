import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { 
    sendMessage, 
    getMessagesBetweenUsers 
} from '../controllers/messageController.js';

const router = express.Router();

// Routes for messages
router.post('/send', protect, sendMessage);
router.get('/:employerId/:userId', protect, getMessagesBetweenUsers);

export default router; 