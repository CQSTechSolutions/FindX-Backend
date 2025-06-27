import express from 'express';
import {
    submitContactForm,
    getAllContacts,
    getContactById,
    updateContactStatus,
    deleteContact,
    getContactDashboard
} from '../controllers/contactController.js';
    

const router = express.Router();

// Public routes
router.post('/submit', submitContactForm);

// Admin routes (require authentication)
// Note: You may want to create a separate admin middleware for better security
// router.get('/admin/all', employerAuth, getAllContacts);
// router.get('/admin/dashboard', employerAuth, getContactDashboard);
// router.get('/admin/:id', employerAuth, getContactById);
// router.put('/admin/:id/status', employerAuth, updateContactStatus);
// router.delete('/admin/:id', employerAuth, deleteContact);

export default router; 