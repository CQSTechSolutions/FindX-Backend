import express from "express";
import { 
    createAccount, 
    login, 
    getEmployer, 
    getAllEmployers, 
    getCurrentEmployer,
    setMessagingStatus,
    enableMessaging,
    updatePricingPlan
} from "../controllers/employer.controller.js";
import { protectEmployer } from "../middleware/employerAuth.js";
import Employer from '../models/employer.model.js';

const router = express.Router();

// Public routes
router.post("/createAccount", createAccount);
router.post("/login", login);

// Get employer details by ID (public endpoint for job seekers)
router.get('/company/:employerId', async (req, res) => {
  try {
    const { employerId } = req.params;
    
    // Find employer by ID and exclude sensitive information
    const employer = await Employer.findById(employerId).select(
      'companyName companyDescription companyWebsite companyLogo companyIndustry companySize companyLocation EmployerName EmployerDesignation totalPostedJobs totalHiredCandidates createdAt'
    );
    
    if (!employer) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }
    
    res.status(200).json(employer);
  } catch (error) {
    console.error('Error fetching employer details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Protected routes - require authentication
router.use(protectEmployer);

router.get("/me", getCurrentEmployer);
router.get("/getEmployer/:employerId", getEmployer);
router.get("/getAllEmployers", getAllEmployers);
router.patch("/updateMessagingStatus", setMessagingStatus);
router.patch("/enable-messaging", enableMessaging);
router.patch("/updatePricingPlan", updatePricingPlan);

export default router;
