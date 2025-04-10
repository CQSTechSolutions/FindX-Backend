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

// Update user name
export const updateName = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a name'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Name updated successfully',
      name: user.name
    });
  } catch (error) {
    next(error);
  }
};

// Update gender
export const updateGender = async (req, res, next) => {
  try {
    const { gender } = req.body;
    if (!gender || !["Male", "Female", "Other"].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid gender (Male, Female, or Other)'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { gender },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Gender updated successfully',
      gender: user.gender
    });
  } catch (error) {
    next(error);
  }
};

// Update preferred pronouns
export const updatePronouns = async (req, res, next) => {
  try {
    const { preferred_pronouns } = req.body;
    if (!preferred_pronouns || !["He/Him", "She/Her", "They/Them"].includes(preferred_pronouns)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid pronouns (He/Him, She/Her, or They/Them)'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { preferred_pronouns },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Pronouns updated successfully',
      preferred_pronouns: user.preferred_pronouns
    });
  } catch (error) {
    next(error);
  }
};

// Update nationality
export const updateNationality = async (req, res, next) => {
  try {
    const { nationality } = req.body;
    if (!nationality) {
      return res.status(400).json({
        success: false,
        message: 'Please provide nationality'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { nationality },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Nationality updated successfully',
      nationality: user.nationality
    });
  } catch (error) {
    next(error);
  }
};

// Update resident country
export const updateResidentCountry = async (req, res, next) => {
  try {
    const { resident_country } = req.body;
    if (!resident_country) {
      return res.status(400).json({
        success: false,
        message: 'Please provide resident country'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { resident_country },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Resident country updated successfully',
      resident_country: user.resident_country
    });
  } catch (error) {
    next(error);
  }
};

// Update known languages
export const updateKnownLanguages = async (req, res, next) => {
  try {
    const { known_language } = req.body;
    if (!Array.isArray(known_language)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide languages as an array'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { known_language },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Known languages updated successfully',
      known_language: user.known_language
    });
  } catch (error) {
    next(error);
  }
};

// Update preferred time zone
export const updateTimeZone = async (req, res, next) => {
  try {
    const { preferred_time_zone } = req.body;
    if (!preferred_time_zone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide preferred time zone'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { preferred_time_zone },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Time zone updated successfully',
      preferred_time_zone: user.preferred_time_zone
    });
  } catch (error) {
    next(error);
  }
};

// Update highest qualification
export const updateQualification = async (req, res, next) => {
  try {
    const { highest_qualification } = req.body;
    if (!highest_qualification || !["High School", "Bachelors", "Masters", "PhD"].includes(highest_qualification)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid qualification (High School, Bachelors, Masters, or PhD)'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { highest_qualification },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Qualification updated successfully',
      highest_qualification: user.highest_qualification
    });
  } catch (error) {
    next(error);
  }
};

// Update achievements
export const updateAchievements = async (req, res, next) => {
  try {
    const { achievements } = req.body;
    if (!Array.isArray(achievements)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide achievements as an array'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { achievements },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Achievements updated successfully',
      achievements: user.achievements
    });
  } catch (error) {
    next(error);
  }
};

// Update skills and capabilities
export const updateSkills = async (req, res, next) => {
  try {
    const { skills_and_capabilities } = req.body;
    if (!Array.isArray(skills_and_capabilities)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide skills as an array'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { skills_and_capabilities },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Skills updated successfully',
      skills_and_capabilities: user.skills_and_capabilities
    });
  } catch (error) {
    next(error);
  }
};

// Update resume
export const updateResume = async (req, res, next) => {
  try {
    const { resume, resume_downloadble } = req.body;
    if (!resume) {
      return res.status(400).json({
        success: false,
        message: 'Please provide resume URL'
      });
    }

    const updateData = { resume };
    if (resume_downloadble !== undefined) {
      updateData.resume_downloadble = resume_downloadble;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Resume updated successfully',
      resume: user.resume,
      resume_downloadble: user.resume_downloadble
    });
  } catch (error) {
    next(error);
  }
};

// Update cover letter
export const updateCoverLetter = async (req, res, next) => {
  try {
    const { cover_letter } = req.body;
    if (!cover_letter) {
      return res.status(400).json({
        success: false,
        message: 'Please provide cover letter URL'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { cover_letter },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Cover letter updated successfully',
      cover_letter: user.cover_letter
    });
  } catch (error) {
    next(error);
  }
};

// Update dream job title
export const updateDreamJob = async (req, res, next) => {
  try {
    const { dream_job_title } = req.body;
    if (!dream_job_title) {
      return res.status(400).json({
        success: false,
        message: 'Please provide dream job title'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { dream_job_title },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Dream job updated successfully',
      dream_job_title: user.dream_job_title
    });
  } catch (error) {
    next(error);
  }
};

// Update preferred job types
export const updatePreferredJobTypes = async (req, res, next) => {
  try {
    const { preferred_job_types } = req.body;
    if (!Array.isArray(preferred_job_types) || 
        !preferred_job_types.every(type => ["Full-time", "Part-time", "Contract", "Internship"].includes(type))) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid job types array (Full-time, Part-time, Contract, or Internship)'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { preferred_job_types },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Preferred job types updated successfully',
      preferred_job_types: user.preferred_job_types
    });
  } catch (error) {
    next(error);
  }
};

// Update work environment preferences
export const updateWorkEnvPreferences = async (req, res, next) => {
  try {
    const { work_env_preferences } = req.body;
    if (!Array.isArray(work_env_preferences) || 
        !work_env_preferences.every(pref => ["Startup", "Corporate", "NGO", "Freelance", "Remote"].includes(pref))) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid work environment preferences array'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { work_env_preferences },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Work environment preferences updated successfully',
      work_env_preferences: user.work_env_preferences
    });
  } catch (error) {
    next(error);
  }
};

// Update preferred locations
export const updatePreferredLocations = async (req, res, next) => {
  try {
    const { preferred_locations } = req.body;
    if (!Array.isArray(preferred_locations)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide locations as an array'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { preferred_locations },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Preferred locations updated successfully',
      preferred_locations: user.preferred_locations
    });
  } catch (error) {
    next(error);
  }
};

// Update video intro
export const updateVideoIntro = async (req, res, next) => {
  try {
    const { video_intro } = req.body;
    if (!video_intro) {
      return res.status(400).json({
        success: false,
        message: 'Please provide video intro URL'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { video_intro },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Video intro updated successfully',
      video_intro: user.video_intro
    });
  } catch (error) {
    next(error);
  }
};

// Update relocation and travel preferences
export const updateMobilityPreferences = async (req, res, next) => {
  try {
    const { willing_to_relocate, willing_to_travel } = req.body;
    if (willing_to_relocate === undefined && willing_to_travel === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one preference'
      });
    }

    const updateData = {};
    if (willing_to_relocate !== undefined) updateData.willing_to_relocate = willing_to_relocate;
    if (willing_to_travel !== undefined) updateData.willing_to_travel = willing_to_travel;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Mobility preferences updated successfully',
      willing_to_relocate: user.willing_to_relocate,
      willing_to_travel: user.willing_to_travel
    });
  } catch (error) {
    next(error);
  }
};

// Update preferred interview mode
export const updateInterviewMode = async (req, res, next) => {
  try {
    const { preferred_interview_mode } = req.body;
    if (!preferred_interview_mode || !["In-person", "On-Call"].includes(preferred_interview_mode)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid interview mode (In-person or On-Call)'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { preferred_interview_mode },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Interview mode updated successfully',
      preferred_interview_mode: user.preferred_interview_mode
    });
  } catch (error) {
    next(error);
  }
};

// Update personal branding statement
export const updateBrandingStatement = async (req, res, next) => {
  try {
    const { personal_branding_statement } = req.body;
    if (!personal_branding_statement) {
      return res.status(400).json({
        success: false,
        message: 'Please provide personal branding statement'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { personal_branding_statement },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Personal branding statement updated successfully',
      personal_branding_statement: user.personal_branding_statement
    });
  } catch (error) {
    next(error);
  }
};

// Update hobbies
export const updateHobbies = async (req, res, next) => {
  try {
    const { hobbies } = req.body;
    if (!Array.isArray(hobbies)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide hobbies as an array'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { hobbies },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Hobbies updated successfully',
      hobbies: user.hobbies
    });
  } catch (error) {
    next(error);
  }
};

// Update emergency contact
export const updateEmergencyContact = async (req, res, next) => {
  try {
    const { emergency_contact_number, emergency_contact_name, emergency_contact_relationship } = req.body;
    if (!emergency_contact_number || !emergency_contact_name || !emergency_contact_relationship) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all emergency contact details'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        emergency_contact_number,
        emergency_contact_name,
        emergency_contact_relationship
      },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Emergency contact updated successfully',
      emergency_contact: {
        name: user.emergency_contact_name,
        number: user.emergency_contact_number,
        relationship: user.emergency_contact_relationship
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update social links
export const updateSocialLinks = async (req, res, next) => {
  try {
    const { profile_link, github_link, linkedIn_link } = req.body;
    if (!profile_link && !github_link && !linkedIn_link) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one social link'
      });
    }

    const updateData = {};
    if (profile_link) updateData.profile_link = profile_link;
    if (github_link) updateData.github_link = github_link;
    if (linkedIn_link) updateData.linkedIn_link = linkedIn_link;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Social links updated successfully',
      social_links: {
        profile: user.profile_link,
        github: user.github_link,
        linkedIn: user.linkedIn_link
      }
    });
  } catch (error) {
    next(error);
  }
}; 