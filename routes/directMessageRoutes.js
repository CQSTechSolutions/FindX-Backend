import express from 'express';
import {
    getSubscriptionStatus,
    sendDirectMessage,
    getConversation,
    getEmployerConversations,
    updateSubscriptionStatus,
    resetMessageCount,
    sendCandidateReply
} from '../controllers/directMessageController.js';
import { protectEmployer, protectCandidate } from '../middleware/employerAuth.js';

const router = express.Router();

// Get employer's subscription status and quota
router.get('/subscription-status', protectEmployer, getSubscriptionStatus);

// Send direct message to candidate
router.post('/send', protectEmployer, sendDirectMessage);

// Send reply from candidate to employer (requires candidate auth middleware)
// Note: This route would need candidate authentication middleware instead of protectEmployer
// router.post('/reply', protectCandidate, sendCandidateReply);

// Get conversation between employer and specific candidate
router.get('/conversation/:candidateId', protectEmployer || protectCandidate, getConversation);

// Get all conversations for employer
router.get('/conversations', protectEmployer, getEmployerConversations);

// Reset message count (for subscription renewal)
router.post('/reset-count', protectEmployer, resetMessageCount);

// Admin routes for subscription management
router.put('/subscription/:employerId', updateSubscriptionStatus);

export default router;