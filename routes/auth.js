import express from 'express';
import {
  register,
  login,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getAllUsers,
  updateName,
  updateGender,
  updatePronouns,
  updateNationality,
  updateResidentCountry,
  updateKnownLanguages,
  updateTimeZone,
  updateQualification,
  updateAchievements,
  updateSkills,
  updateResume,
  updateCoverLetter,
  updateDreamJob,
  updatePreferredJobTypes,
  updateWorkEnvPreferences,
  updatePreferredLocations,
  updateVideoIntro,
  updateMobilityPreferences,
  updateInterviewMode,
  updateBrandingStatement,
  updateHobbies,
  updateEmergencyContact,
  updateSocialLinks,
  // Import GET controllers
  getUserProfile,
  getName,
  getGender,
  getPronouns,
  getNationality,
  getResidentCountry,
  getKnownLanguages,
  getTimeZone,
  getQualification,
  getAchievements,
  getSkills,
  getResume,
  getCoverLetter,
  getDreamJob,
  getPreferredJobTypes,
  getWorkEnvPreferences,
  getPreferredLocations,
  getVideoIntro,
  getMobilityPreferences,
  getInterviewMode,
  getBrandingStatement,
  getHobbies,
  getEmergencyContact,
  getSocialLinks
} from '../controllers/authController.js';
import {protect} from "../middleware/auth.js";

const router = express.Router();

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgotpassword', forgotPassword);
router.post('/verifyotp', verifyOtp);
router.post('/resetpassword', resetPassword);

// User routes
router.get('/users', getAllUsers);
router.get('/profile', protect, getUserProfile);

// Individual field update routes
router.put('/update/name', protect, updateName);
router.put('/update/gender', protect, updateGender);
router.put('/update/pronouns', protect, updatePronouns);
router.put('/update/nationality', protect, updateNationality);
router.put('/update/resident-country', protect, updateResidentCountry);
router.put('/update/languages', protect, updateKnownLanguages);
router.put('/update/timezone', protect, updateTimeZone);
router.put('/update/qualification', protect, updateQualification);
router.put('/update/achievements', protect, updateAchievements);
router.put('/update/skills', protect, updateSkills);
router.put('/update/resume', protect, updateResume);
router.put('/update/cover-letter', protect, updateCoverLetter);
router.put('/update/dream-job', protect, updateDreamJob);
router.put('/update/job-types', protect, updatePreferredJobTypes);
router.put('/update/work-environment', protect, updateWorkEnvPreferences);
router.put('/update/locations', protect, updatePreferredLocations);
router.put('/update/video-intro', protect, updateVideoIntro);
router.put('/update/mobility', protect, updateMobilityPreferences);
router.put('/update/interview-mode', protect, updateInterviewMode);
router.put('/update/branding-statement', protect, updateBrandingStatement);
router.put('/update/hobbies', protect, updateHobbies);
router.put('/update/emergency-contact', protect, updateEmergencyContact);
router.put('/update/social-links', protect, updateSocialLinks);

// Individual field get routes
router.get('/name', protect, getName);
router.get('/gender', protect, getGender);
router.get('/pronouns', protect, getPronouns);
router.get('/nationality', protect, getNationality);
router.get('/resident-country', protect, getResidentCountry);
router.get('/languages', protect, getKnownLanguages);
router.get('/timezone', protect, getTimeZone);
router.get('/qualification', protect, getQualification);
router.get('/achievements', protect, getAchievements);
router.get('/skills', protect, getSkills);
router.get('/resume', protect, getResume);
router.get('/cover-letter', protect, getCoverLetter);
router.get('/dream-job', protect, getDreamJob);
router.get('/job-types', protect, getPreferredJobTypes);
router.get('/work-environment', protect, getWorkEnvPreferences);
router.get('/locations', protect, getPreferredLocations);
router.get('/video-intro', protect, getVideoIntro);
router.get('/mobility', protect, getMobilityPreferences);
router.get('/interview-mode', protect, getInterviewMode);
router.get('/branding-statement', protect, getBrandingStatement);
router.get('/hobbies', protect, getHobbies);
router.get('/emergency-contact', protect, getEmergencyContact);
router.get('/social-links', protect, getSocialLinks);

export default router; 