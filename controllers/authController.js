import jwt from 'jsonwebtoken';
import mongoose from "mongoose";
import Domain from "../models/Domain.model.js";
import User from "../models/User.js";

// Register user
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email and password",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    // Create new user (password will be hashed automatically by User model pre-save middleware)
    const user = new User({
      name,
      email,
      password, // Don't hash manually - let the model handle it
    });

    await user.save();

    // Generate JWT token (use 'id' to match login and middleware)
    const token = jwt.sign(
      { id: user._id }, // Changed from userId to id for consistency
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );

    // Get user data without sensitive fields
    const userWithoutPassword = await User.findById(user._id).select(
      "-password -passwordResetOtp -passwordResetExpire"
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Error registering user",
    });
  }
};

// Login user
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Check for user and include password field
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No such user exists",
      });
    }

    // Check if password matches using the model method
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Create token with consistent structure
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || "7d",
    });

    // Get complete user data without sensitive fields
    const userWithoutPassword = await User.findById(user._id).select(
      "-password -passwordResetOtp -passwordResetExpire"
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Login error:", error);
    next(error);
  }
};

// Get current user
export const getCurrentUser = async (req, res, next) => {
  try {
    // req.user is set by the protect middleware
    const user = await User.findById(req.user._id).select(
      "-password -passwordResetOtp -passwordResetExpire"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
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
      passwordResetExpire: { $gt: Date.now() },
    }).select("+passwordResetOtp +passwordResetExpire");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    res.json({
      success: true,
      message: "OTP verified successfully",
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
      passwordResetExpire: { $gt: Date.now() },
    }).select("+passwordResetOtp +passwordResetExpire");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Set new password
    user.password = newPassword;
    user.passwordResetOtp = undefined;
    user.passwordResetExpire = undefined;
    await user.save();

    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE,
    });

    res.json({
      success: true,
      message: "Password reset successful",
      token,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select(
      "-password -passwordResetOtp -passwordResetExpire"
    );

    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    // Debug: Log what we received
    console.log("[DEBUG] Received update request for user:", userId);
    console.log("[DEBUG] Update data:", JSON.stringify(updates, null, 2));

    // List of allowed fields
    const allowedFields = [
      "name",
      "gender",
      "preferred_pronouns",
      "nationality",
      "resident_country",
      "known_language",
      "preferred_time_zone",
      "highest_qualification",
      "achievements",
      "licenses",
      "skills_and_capabilities",
      "resume",
      "cover_letter",
      "dream_job_title",
      "preferred_job_types",
      "work_env_preferences",
      "relocation",
      "personal_branding_statement",
      "hobbies",
      "education",
      "emergency_contact",
      "social_links",
      "work_history",
      "savedJobs",
      "isProfileCompleted",
      "appliedJobs",
      "notInterestedJobCategories",
      "work_domain",
    ];

    const invalidFields = Object.keys(updates).filter(
      (key) => !allowedFields.includes(key)
    );

    if (invalidFields.length) {
      console.log("[DEBUG] Invalid fields detected:", invalidFields);
      return res.status(400).json({
        success: false,
        message: `Invalid fields in request: ${invalidFields.join(", ")}`,
      });
    }

    // Get current user data for logging
    const currentUser = await User.findById(userId).select(
      "-password -passwordResetOtp -passwordResetExpire"
    );
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Handle array and object fields specially to avoid merge issues
    const arrayFields = [
      "work_history",
      "licenses",
      "education",
      "skills_and_capabilities",
      "achievements",
      "known_language",
      "preferred_job_types",
      "work_env_preferences",
      "hobbies",
      "savedJobs",
      "appliedJobs",
      "notInterestedJobCategories",
    ];
    const objectFields = ["relocation", "emergency_contact", "social_links"];

    // Prepare update operations
    const updateOps = {};

    for (const [key, value] of Object.entries(updates)) {
      if (arrayFields.includes(key)) {
        // For array fields, directly assign the new array
        updateOps[key] = value;
      } else if (objectFields.includes(key)) {
        // For object fields, replace the entire object instead of merging
        // This prevents issues with nested object updates
        updateOps[key] = value;
        console.log(
          `[DEBUG] Will update ${key}:`,
          JSON.stringify(updateOps[key], null, 2)
        );
      } else {
        // For simple fields, direct assignment
        updateOps[key] = value;
      }
    }

    // Handle work_domain updates specially to maintain domain-user relationships
    if (updates.work_domain) {
      const currentUser = await User.findById(userId);
      if (!currentUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Validate that the domain is one of the predefined domains
      const validDomains = Domain.schema.path("name").enumValues;
      if (!validDomains.includes(updates.work_domain)) {
        return res.status(400).json({
          message: "Invalid domain",
          validDomains: validDomains,
        });
      }

      // Store the previous domain to remove user email from it
      const previousDomain = currentUser.work_domain;

      // Remove user email from previous domain if it exists
      if (previousDomain && previousDomain !== updates.work_domain) {
        await Domain.findOneAndUpdate(
          { name: previousDomain },
          { $pull: { userEmails: currentUser.email } }
        );
      }

      // Add user email to the new domain
      await Domain.findOneAndUpdate(
        { name: updates.work_domain },
        { $addToSet: { userEmails: currentUser.email } },
        { upsert: true }
      );
    }

    // Use findByIdAndUpdate to avoid version conflicts
    console.log(
      "[DEBUG] Final update operations:",
      JSON.stringify(updateOps, null, 2)
    );

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateOps },
      {
        new: true, // Return the updated document
        runValidators: true, // Run schema validations
        select: "-password -passwordResetOtp -passwordResetExpire", // Exclude sensitive fields
      }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found after update",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);

    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate value error. Please check your input.",
      });
    }

    if (error.name === "ValidationError") {
      console.error("[DEBUG] Validation error details:", error.message);
      console.error("[DEBUG] Validation error fields:", error.errors);
      return res.status(400).json({
        success: false,
        message: `Validation error: ${error.message}`,
      });
    }

    // Handle version key errors (just in case)
    if (error.message && error.message.includes("version")) {
      console.log("[DEBUG] Version conflict detected, retrying...");
      // For now, just return a user-friendly message
      return res.status(409).json({
        success: false,
        message:
          "Data was updated by another process. Please refresh and try again.",
      });
    }

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
      message: "Error updating saved jobs" 
    });
  }
};

export const updateNotInterestedJobCategories = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { jobCategory, jobSubCategory } = req.body;

    // Verify that the authenticated user matches the requested userId
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "You're not authorized to update this user's not interested categories" 
      });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ 
      success: false, 
      message: "User not found" 
    });

    const existingIndex = user.notInterestedJobCategories.findIndex(
      item => item.jobCategory === jobCategory && item.jobSubCategory === jobSubCategory
    );

    if (existingIndex === -1) {
      user.notInterestedJobCategories.push({
        jobCategory,
        jobSubCategory
      });
    }

    await user.save();
    
    const updatedUser = await User.findById(userId).select('-password -passwordResetOtp -passwordResetExpire');
    
    return res.status(201).json({ 
      success: true,
      message: "Not interested job categories updated", 
      notInterestedJobCategories: user.notInterestedJobCategories,
      user: updatedUser
    });
  } catch (error) {
    console.error("Error updating not interested job categories:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error updating not interested job categories" 
    });
  }
};
