import express from 'express';
import { protect } from '../middleware/auth.js';
import { 
    sendMessage, 
    getMessagesBetweenUsers,
    getUserConversations 
} from '../controllers/messageController.js';

const router = express.Router();

// Routes for messages
router.post('/send', protect, sendMessage);
router.get('/:employerId/:userId', protect, getMessagesBetweenUsers);
router.get('/conversations/:userId', protect, getUserConversations);

export default router; 