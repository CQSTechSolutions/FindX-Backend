import express from 'express';
import {
  getUserEducation,
  addEducation,
  updateEducation,
  deleteEducation
} from '../controllers/educationController.js';
import { protect } from "../middleware/auth.js";

const router = express.Router();

// All routes are protected
router.use(protect);

// Get all education records
router.get('/', getUserEducation);

// Add a new education record
router.post('/', addEducation);

// Update an education record
router.put('/:id', updateEducation);

// Delete an education record
router.delete('/:id', deleteEducation);

export default router; 