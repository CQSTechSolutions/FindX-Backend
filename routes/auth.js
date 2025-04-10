import express from 'express';
import {
  register,
  login,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getAllUsers
} from '../controllers/authController.js';

const router = express.Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgotpassword', forgotPassword);
router.post('/verifyotp', verifyOtp);
router.post('/resetpassword', resetPassword);

// User routes
router.get('/users', getAllUsers);

export default router; 