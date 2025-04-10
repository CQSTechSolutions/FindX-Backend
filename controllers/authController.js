import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Job from '../models/Job.model.js';
import sendEmail from '../utils/sendEmail.js';

// Register user
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password
    });

    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isProfileCompleted: user.isProfileCompleted
      }
    });
  } catch (error) {
    next(error);
  }
};

// Login user
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No such user exists'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isProfileCompleted: user.isProfileCompleted
      }
    });
  } catch (error) {
    next(error);
  }
};

// Send OTP for forgot password
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    
    // Save OTP to user
    user.passwordResetOtp = otp;
    user.passwordResetExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Email message
    const emailContent = {
      subject: 'Password Reset OTP',
      html: `
        <h2>Password Reset Request</h2>
        <p>Your OTP for password reset is: <strong>${otp}</strong></p>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    try {
      await sendEmail({
        email: user.email,
        subject: emailContent.subject,
        html: emailContent.html
      });

      res.json({
        success: true,
        message: 'OTP sent to your email'
      });
    } catch (error) {
      user.passwordResetOtp = undefined;
      user.passwordResetExpire = undefined;
      await user.save();

      return res.status(500).json({
        success: false,
        message: 'Email could not be sent'
      });
    }
  } catch (error) {
    next(error);
  }
};

// Verify OTP
export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // Find user with OTP and check if it's expired
    const user = await User.findOne({
      email,
      passwordResetOtp: otp,
      passwordResetExpire: { $gt: Date.now() }
    }).select('+passwordResetOtp +passwordResetExpire');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    res.json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Reset password after OTP verification
export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Find user with OTP and check if it's expired
    const user = await User.findOne({
      email,
      passwordResetOtp: otp,
      passwordResetExpire: { $gt: Date.now() }
    }).select('+passwordResetOtp +passwordResetExpire');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }

    // Set new password
    user.password = newPassword;
    user.passwordResetOtp = undefined;
    user.passwordResetExpire = undefined;
    await user.save();

    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });

    res.json({
      success: true,
      message: 'Password reset successful',
      token
    });
  } catch (error) {
    next(error);
  }
};

// Get all users
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password -passwordResetOtp -passwordResetExpire');

    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    next(error);
  }
};

// Save a job
export const saveJob = async (req, res, next) => {
  try {
    const jobId = req.params.jobId;

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Get user with saved jobs
    const user = await User.findById(req.user.id);

    // Check if job is already saved
    if (user.savedJobs.includes(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Job already saved'
      });
    }

    // Add job to saved jobs
    user.savedJobs.push(jobId);
    await user.save();

    res.json({
      success: true,
      message: 'Job saved successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Unsave a job
export const unsaveJob = async (req, res, next) => {
  try {
    const jobId = req.params.jobId;

    // Get user with saved jobs
    const user = await User.findById(req.user.id);

    // Check if job is saved
    if (!user.savedJobs.includes(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Job not saved'
      });
    }

    // Remove job from saved jobs
    user.savedJobs = user.savedJobs.filter(
      (id) => id.toString() !== jobId
    );
    await user.save();

    res.json({
      success: true,
      message: 'Job removed from saved jobs'
    });
  } catch (error) {
    next(error);
  }
};

// Get saved jobs
export const getSavedJobs = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({
        path: 'savedJobs',
        select: 'jobTitle jobDescription status postedBy createdAt',
        populate: {
          path: 'postedBy',
          select: 'name email'
        }
      });

    res.json({
      success: true,
      count: user.savedJobs.length,
      jobs: user.savedJobs
    });
  } catch (error) {
    next(error);
  }
}; 