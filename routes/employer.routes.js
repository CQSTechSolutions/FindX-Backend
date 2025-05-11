import express from "express";
import { 
    createAccount, 
    login, 
    getEmployer, 
    getAllEmployers, 
    getCurrentEmployer
} from "../controllers/employer.controller.js";
import { protectEmployer } from "../middleware/employerAuth.js";

const router = express.Router();

// Public routes
router.post("/createAccount", createAccount);
router.post("/login", login);

// Protected routes - require authentication
router.use(protectEmployer);

router.get("/me", getCurrentEmployer);
router.get("/getEmployer/:employerId", getEmployer);
router.get("/getAllEmployers", getAllEmployers);

export default router;
