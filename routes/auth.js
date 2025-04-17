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
  updateSocialLinks
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

// Individual field update routes
router.put('/update/name', updateName);
router.put('/update/gender', updateGender);
router.put('/update/pronouns', updatePronouns);
router.put('/update/nationality', updateNationality);
router.put('/update/resident-country', updateResidentCountry);
router.put('/update/languages', updateKnownLanguages);
router.put('/update/timezone', updateTimeZone);
router.put('/update/qualification', updateQualification);
router.put('/update/achievements', updateAchievements);
router.put('/update/skills', protect ,updateSkills);
router.put('/update/resume', updateResume);
router.put('/update/cover-letter', updateCoverLetter);
router.put('/update/dream-job', updateDreamJob);
router.put('/update/job-types', updatePreferredJobTypes);
router.put('/update/work-environment', updateWorkEnvPreferences);
router.put('/update/locations', updatePreferredLocations);
router.put('/update/video-intro', updateVideoIntro);
router.put('/update/mobility', updateMobilityPreferences);
router.put('/update/interview-mode', updateInterviewMode);
router.put('/update/branding-statement', protect ,updateBrandingStatement);
router.put('/update/hobbies', updateHobbies);
router.put('/update/emergency-contact', updateEmergencyContact);
router.put('/update/social-links', updateSocialLinks);

export default router; 