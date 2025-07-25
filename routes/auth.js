import express from 'express';
import {
    getAllUsers,
    login,
    register,
    resetPassword,
    verifyOtp,
    updateUserProfile,
    getUser,
    getCurrentUser,
    updateSavedJobs,
    updateNotInterestedJobCategories
} from '../controllers/authController.js';
import {protect} from "../middleware/auth.js";

const router = express.Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/verifyotp', verifyOtp);
router.post('/resetpassword', resetPassword);

// User routes
router.get('/users', protect, getAllUsers);
router.get('/user/me', protect, getCurrentUser);
router.get('/user/:id', getUser);

// Generic Update Route
router.patch('/user/updateUserProfile', protect, updateUserProfile);
router.put("/users/:userId/saved-jobs", protect, updateSavedJobs);
router.put("/users/:userId/exclude-jobcategory", protect, updateNotInterestedJobCategories);

export default router; 