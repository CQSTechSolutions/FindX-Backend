import dotenv from "dotenv";
import Employer from "../models/employer.model.js";
import jwt from "jsonwebtoken";

dotenv.config();

export const createAccount = async (req, res) => {
    const employer = req.body;
    try {
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
            companyEmployerId: loginData.companyEmployerId,
            EmployerEmail: loginData.EmployerEmail 
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
