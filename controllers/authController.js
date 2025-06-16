import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import mongoose from 'mongoose';
import bcrypt from "bcryptjs";
import _ from 'lodash';

// Register user
export const register = async (req, res) => {
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

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user' });
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

    // Get complete user data without sensitive fields
    const userWithoutPassword = await User.findById(user._id).select('-password -passwordResetOtp -passwordResetExpire');

    res.json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    next(error);
  }
};

// Get current user
export const getCurrentUser = async (req, res, next) => {
  try {
    // req.user is set by the protect middleware
    const user = await User.findById(req.user._id).select('-password -passwordResetOtp -passwordResetExpire');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    next(error);
  }
};


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

export const updateUserProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    // List of allowed fields
    const allowedFields = [
      'name', 'gender', 'preferred_pronouns', 'nationality', 'resident_country',
      'known_language', 'preferred_time_zone', 'highest_qualification',
      'achievements', 'skills_and_capabilities', 'resume', 'resume_downloadble',
      'cover_letter', 'dream_job_title', 'preferred_job_types',
      'work_env_preferences', 'relocation', 'personal_branding_statement',
      'hobbies', 'emergency_contact_info', 'externalLinks', 'education',
      'work_history', 'savedJobs', 'isProfileCompleted', 'appliedJobs'
    ];

    const invalidFields = Object.keys(updates).filter(
        (key) => !allowedFields.includes(key)
    );

    if (invalidFields.length) {
      return res.status(400).json({
        success: false,
        message: `Invalid fields in request: ${invalidFields.join(', ')}`
      });
    }

    // Fetch user to update deeply nested fields
    const user = await User.findById(userId).select('+passwordResetOtp +passwordResetExpire');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Deep merge updates into user document
    _.merge(user, updates);

    await user.save();

    // Remove sensitive fields from response
    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;
    delete sanitizedUser.passwordResetOtp;
    delete sanitizedUser.passwordResetExpire;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: sanitizedUser
    });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const {id} = req.params;
    const Fuser = await User.findById(id).select('-password -passwordResetOtp -passwordResetExpire');
    if (!Fuser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      message: 'User found successfully',
      data: Fuser
    });
  } catch (e) {
    next(e);
  }
};

export const updateSavedJobs = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { jobId, action } = req.body; // action can be 'add' or 'remove'

    // Verify that the authenticated user matches the requested userId
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "You're not authorized to update this user's saved jobs" 
      });
    }

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid job ID" 
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ 
      success: false, 
      message: "User not found" 
    });

    const jobObjectId = new mongoose.Types.ObjectId(jobId);

    if (action === "add" && !user.savedJobs.includes(jobObjectId)) {
      user.savedJobs.push(jobObjectId);
    } else if (action === "remove") {
      user.savedJobs = user.savedJobs.filter(id => !id.equals(jobObjectId));
    }

    await user.save();
    return res.status(200).json({ 
      success: true,
      message: "Saved jobs updated", 
      savedJobs: user.savedJobs,
      user: user
    });
  } catch (error) {
    console.error("Error updating saved jobs:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error" 
    });
  }
};