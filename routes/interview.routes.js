import express from 'express';
import { protect } from '../middleware/auth.js';
import { protectEmployer } from '../middleware/employerAuth.js';
import {
    sendInterviewInvitation,
    getMyInterviewInvitations,
    getSentInterviewInvitations,
    respondToInterviewInvitation,
    respondToRescheduleRequest,
    getUpcomingInterviews,
    cancelInterviewInvitation
} from '../controllers/interviewController.js';

const router = express.Router();

// Employer routes (protected by employer auth)
router.post('/send-invitation', protectEmployer, sendInterviewInvitation);
router.get('/sent-invitations', protectEmployer, getSentInterviewInvitations);
router.put('/:invitationId/reschedule-response', protectEmployer, respondToRescheduleRequest);
router.delete('/:invitationId/cancel', protectEmployer, cancelInterviewInvitation);

// User routes (protected by user auth)
router.get('/my-invitations', protect, getMyInterviewInvitations);
router.put('/:invitationId/respond', protect, respondToInterviewInvitation);

// Routes accessible by both users and employers
router.get('/upcoming', protect, getUpcomingInterviews);
router.get('/upcoming', protectEmployer, getUpcomingInterviews);

export default router; 