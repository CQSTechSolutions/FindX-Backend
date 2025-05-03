import express from "express";
import { createAccount, login, getEmployer, getAllEmployers } from "../controllers/employer.controller.js";
const router = express.Router();

router.post("/createAccount", createAccount);
router.post("/login", login);

router.get("/getEmployer/:employerId", getEmployer);
router.get("/getEmployers", getAllEmployers);


export default router;
