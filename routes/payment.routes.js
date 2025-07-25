import express from 'express';
import { 
    createJobPostingPayment,
    createNotificationPayment,
    confirmPaymentSuccess,
    handlePaymentFailure,
    getPaymentHistory,
    getInvoice,
    handleStripeWebhook,
    createSetupIntent,
    getPaymentMethods
} from '../controllers/paymentController.js';
import { protectEmployer } from '../middleware/employerAuth.js';

const router = express.Router();

// Job posting payment routes
router.post('/create-job-posting-payment', protectEmployer, createJobPostingPayment);
router.post('/create-notification-payment', protectEmployer, createNotificationPayment);

// Payment confirmation routes
router.post('/confirm-success', protectEmployer, confirmPaymentSuccess);
router.post('/handle-failure', protectEmployer, handlePaymentFailure);

// Payment management routes
router.get('/history/:employerId', protectEmployer, getPaymentHistory);
router.get('/invoice/:invoiceId', protectEmployer, getInvoice);

// Payment methods management
router.post('/setup-intent', protectEmployer, createSetupIntent);
router.get('/payment-methods/:customerId', protectEmployer, getPaymentMethods);

// Stripe webhook endpoint (no auth required)
router.post('/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router; 