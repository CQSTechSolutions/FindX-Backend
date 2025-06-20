import dotenv from "dotenv";
import Employer from "../models/employer.model.js";
import jwt from "jsonwebtoken";

dotenv.config();

export const createAccount = async (req, res) => {
    const employer = req.body;
    try {
        // Map EmployerEmail to email if it exists and email doesn't
        if (employer.EmployerEmail && !employer.email) {
            employer.email = employer.EmployerEmail;
            delete employer.EmployerEmail;
        }
        
        // Generate a unique employer ID based on company name
        employer.companyEmployerId = `${employer.companyName.replace(/\s+/g, '').toLowerCase()}_${Date.now()}`;
        
        const newEmployer = await Employer.create(employer);
        
        // Create JWT token
        const token = jwt.sign(
            { id: newEmployer._id }, 
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );
        
        // Remove password from response
        newEmployer.password = undefined;
        
        res.status(201).json({
            success: true,
            token,
            employer: newEmployer
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
}

export const login = async (req, res) => {
    const loginData = req.body;
    try {
        const employer = await Employer.findOne({ 
            email: loginData.email 
        }).select('+password');

        if (!employer) {
            return res.status(404).json({ 
                success: false,
                message: "Employer not found" 
            });
        }

        const isMatch = await employer.comparePassword(loginData.password);
        if (!isMatch) {
            return res.status(401).json({ 
                success: false,
                message: "Invalid Credentials" 
            });
        }

        // Create JWT token
        const token = jwt.sign(
            { id: employer._id }, 
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );

        employer.password = undefined;
        
        res.status(200).json({
            success: true,
            token,
            employer
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
}

export const getEmployer = async (req, res) => {
    const employerId = req.params.employerId;
    try {
        const employer = await Employer.findById(employerId);
        if (!employer) {
            return res.status(404).json({
                success: false,
                message: "Employer not found"
            });
        }
        res.status(200).json({
            success: true,
            employer
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
}

export const getAllEmployers = async (req, res) => {
    try {
        const employers = await Employer.find();
        res.status(200).json({
            success: true,
            count: employers.length,
            employers
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
}

export const getCurrentEmployer = async (req, res) => {
    try {
        // req.employer is set by the protect middleware
        const employer = await Employer.findById(req.employer._id);
        
        if (!employer) {
            return res.status(404).json({
                success: false,
                message: 'Employer not found'
            });
        }

        res.json({
            success: true,
            employer
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export const setMessagingStatus = async (req, res) => {
    try {
        const { messagingStatus, empId }  = req.body;

        if (typeof messagingStatus !== "boolean" || !empId) {
            return res.status(400).json({ message: "Invalid input" });
        }

        const updatedEmployer = await Employer.findByIdAndUpdate(
            empId,
            { messagesAllowed: messagingStatus },
            { new: true, runValidators: true }
        );

        if (!updatedEmployer) {
            return res.status(404).json({ message: "Employer not found" });
        }

        res.status(200).json(updatedEmployer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const enableMessaging = async (req, res) => {
    try {
        const { employerId } = req.body;
        
        if (!employerId) {
            return res.status(400).json({ 
                success: false,
                message: "Employer ID is required" 
            });
        }

        const updatedEmployer = await Employer.findByIdAndUpdate(
            employerId,
            { messagesAllowed: true },
            { new: true, runValidators: true }
        );

        if (!updatedEmployer) {
            return res.status(404).json({ 
                success: false,
                message: "Employer not found" 
            });
        }

        res.status(200).json({
            success: true,
            employer: updatedEmployer,
            message: "Messaging enabled successfully"
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
}

export const updatePricingPlan = async (req, res) => {
    try {
        const { pricingPlan, empId } = req.body;
        
        if (!pricingPlan || !empId) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid input" 
            });
        }

        // Calculate expiry date (typically 30 days from purchase)
        const planPurchaseDate = new Date();
        const planExpiryDate = new Date();
        planExpiryDate.setDate(planExpiryDate.getDate() + 30);

        const updatedEmployer = await Employer.findByIdAndUpdate(
            empId,
            { 
                pricingPlan, 
                planPurchaseDate, 
                planExpiryDate 
            },
            { new: true, runValidators: true }
        );

        if (!updatedEmployer) {
            return res.status(404).json({ 
                success: false,
                message: "Employer not found" 
            });
        }

        res.status(200).json({
            success: true,
            employer: updatedEmployer
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
}
