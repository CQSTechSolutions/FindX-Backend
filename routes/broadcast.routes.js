import express from 'express';
import { 
  sendBroadcastEmail, 
  getBroadcastStats, 
  testEmailConfig 
} from '../controllers/broadcastController.js';
import { protectEmployer } from '../middleware/employerAuth.js';

const router = express.Router();

// POST /api/broadcast/email - Send broadcast email to all users
router.post('/email', protectEmployer, sendBroadcastEmail);

// GET /api/broadcast/stats - Get broadcast statistics  
router.get('/stats', protectEmployer, getBroadcastStats);

// GET /api/broadcast/test-config - Test email configuration
router.get('/test-config', protectEmployer, testEmailConfig);

export default router; 