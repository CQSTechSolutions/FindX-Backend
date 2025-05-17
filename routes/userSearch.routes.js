import express from 'express';
import { protectEmployer } from '../middleware/employerAuth.js';
import { 
    searchUsers, 
    getUserProfile,
    getSuggestedUsers 
} from '../controllers/userSearch.controller.js';

const router = express.Router();

// Protect all routes - only employers can search users
router.use(protectEmployer);

// Search routes
router.get('/', searchUsers);
router.get('/suggested', getSuggestedUsers);
router.get('/:userId', getUserProfile);

export default router; 