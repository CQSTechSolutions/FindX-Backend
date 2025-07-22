import express from 'express';
import { 
  sendBroadcastEmail, 
  getBroadcastStats, 
  testEmailConfig 
} from '../controllers/broadcastController.js';

const router = express.Router();

// POST /api/broadcast/email - Send broadcast email to all users (System/Admin only)
// Removed employer access - this should only be called by system processes
router.post('/email', sendBroadcastEmail);

// GET /api/broadcast/stats - Get broadcast statistics (System/Admin only)
router.get('/stats', getBroadcastStats);

// GET /api/broadcast/test-config - Test email configuration (System/Admin only)
router.get('/test-config', testEmailConfig);

export default router; 