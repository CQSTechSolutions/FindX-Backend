import dotenv from "dotenv";
import Employer from "../models/employer.model.js";
import bcrypt from "bcryptjs";

dotenv.config();

export const createAccount = async (req, res) => {
    const employer = req.body;
    try {
        const newEmployer = await Employer.create(employer);
        res.status(201).json(newEmployer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const login = async (req, res) => {
    const loginData = req.body;
    // console.log(loginData);
    try {
        const employer = await Employer.findOne({ 
            companyEmployerId: loginData.companyEmployerId,
            EmployerEmail: loginData.EmployerEmail 
        }).select('+password');

        if (!employer) {
            return res.status(404).json({ message: "Employer not found" });
        }

        const isMatch = await bcrypt.compare(loginData.password, employer.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid Credentials" });
        }

        employer.password = undefined;
        res.status(200).json(employer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const getEmployer = async (req, res) => {
    const employerId = req.params.employerId;
    try {
        const employer = await Employer.findById(employerId);
        res.status(200).json(employer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

export const getAllEmployers = async (req, res) => {
    try {
        const employers = await Employer.find();
        res.status(200).json(employers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}