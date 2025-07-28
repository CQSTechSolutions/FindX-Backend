import express from 'express';
import { updateUserDomain, updateMyDomain, getAllDomains, initializeDomains } from '../controllers/domainController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Initialize domains (admin only - can be called once to set up the database)
router.post('/initialize', initializeDomains);

// Get all domains
router.get('/', getAllDomains);

// Update user domain (admin/with userId)
router.put('/user/:userId', protect, updateUserDomain);

// Update current user's domain
router.put('/my-domain', protect, updateMyDomain);

export default router; 