import express from 'express';
import { 
  getBroadcastStats, 
  testEmailConfig,
  sendJobAlertEmails
} from '../controllers/broadcastController.js';
import { protect } from '../middleware/auth.js';
import { protectEmployer } from '../middleware/employerAuth.js';

const router = express.Router();

// GET /api/broadcast/stats - Get broadcast statistics (System/Admin only)
router.get('/stats', getBroadcastStats);

// GET /api/broadcast/test-config - Test email configuration (System/Admin only)
router.get('/test-config', testEmailConfig);

// POST /api/broadcast/job-alerts - Send job alert emails to matched users (Employer only)
router.post('/job-alerts', protectEmployer, async (req, res) => {
  try {
    const { jobId, matchedUsers } = req.body;

    if (!jobId || !matchedUsers || !Array.isArray(matchedUsers)) {
      return res.status(400).json({
        success: false,
        message: 'Job ID and matched users array are required'
      });
    }

    // Import Job model
    const Job = (await import('../models/Job.model.js')).default;

    // Find the job
    const job = await Job.findById(jobId).populate('postedBy', 'companyName email companyLogo');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Verify the job belongs to the authenticated employer
    if (job.postedBy._id.toString() !== req.employer._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to send alerts for this job'
      });
    }

    // Send job alert emails
    const emailResult = await sendJobAlertEmails(job, matchedUsers);

    res.json({
      success: true,
      message: 'Job alert emails sent successfully',
      emailNotifications: {
        sentCount: emailResult.sentCount,
        totalCount: emailResult.totalCount,
        failedEmails: emailResult.failedEmails || []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error sending job alert emails',
      error: error.message
    });
  }
});

export default router; 