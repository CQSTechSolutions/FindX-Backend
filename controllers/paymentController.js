import Stripe from 'stripe';
import Payment from '../models/Payment.model.js';
import mongoose from 'mongoose';
import { createJob } from './jobController.js';

// Initialize Stripe with error handling
let stripe;
try {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_your_stripe_secret_key_here') {
        console.warn('⚠️  STRIPE_SECRET_KEY not configured. Payment functionality will be disabled.');
        console.warn('   Please set your Stripe secret key in the .env file');
        stripe = null;
    } else {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        console.log('✅ Stripe initialized successfully');
    }
} catch (error) {
    console.error('❌ Failed to initialize Stripe:', error.message);
    stripe = null;
}

// Pricing configuration matching frontend
const PRICING_CONFIG = {
    STANDARD: {
        id: 'Standard',
        name: 'Standard Listing',
        price: 4900, // $49.00 in cents (early bird)
        regularPrice: 19900, // $199.00 in cents
    },
    NOTIFICATION_PACKAGES: {
        Boosted100App: { id: 'Boosted100App', name: 'Boosted 100 - App Only', price: 4900 },
        Boosted100Email: { id: 'Boosted100Email', name: 'Boosted 100 - Email Only', price: 4900 },
        Boosted100Both: { id: 'Boosted100Both', name: 'Boosted 100 - Both', price: 6900, savings: 2900 },
        Boosted250App: { id: 'Boosted250App', name: 'Boosted 250 - App Only', price: 9900 },
        Boosted250Email: { id: 'Boosted250Email', name: 'Boosted 250 - Email Only', price: 9900 },
        Boosted250Both: { id: 'Boosted250Both', name: 'Boosted 250 - Both', price: 12900, savings: 6900 },
        Boosted500App: { id: 'Boosted500App', name: 'Boosted 500 - App Only', price: 14900 },
        Boosted500Email: { id: 'Boosted500Email', name: 'Boosted 500 - Email Only', price: 14900 },
        Boosted500Both: { id: 'Boosted500Both', name: 'Boosted 500 - Both', price: 18900, savings: 10900 },
        Boosted750App: { id: 'Boosted750App', name: 'Boosted 750 - App Only', price: 19900 },
        Boosted750Email: { id: 'Boosted750Email', name: 'Boosted 750 - Email Only', price: 19900 },
        Boosted750Both: { id: 'Boosted750Both', name: 'Boosted 750 - Both', price: 24900, savings: 14900 },
        Boosted1000App: { id: 'Boosted1000App', name: 'Boosted 1000 - App Only', price: 24900 },
        Boosted1000Email: { id: 'Boosted1000Email', name: 'Boosted 1000 - Email Only', price: 24900 },
        Boosted1000Both: { id: 'Boosted1000Both', name: 'Boosted 1000 - Both', price: 29900, savings: 19900 }
    },
    ADD_ONS: {
        immediateStart: { id: 'immediateStart', name: 'Immediate Start Badge', price: 4500 },
        referenceCheck: { id: 'referenceCheck', name: 'Reference Check Access', price: 1900 }
    }
};

// Helper function to check if Stripe is available
const checkStripeAvailable = () => {
    if (!stripe) {
        throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.');
    }
};

// Create payment intent for job posting
export const createJobPostingPayment = async (req, res) => {
    try {
        checkStripeAvailable();
        
        const { planId, amount, employerId, jobData, addOns = [], packageId, candidateCount, notificationType } = req.body;

        // Validate input
        if (!planId || !amount || !employerId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: planId, amount, employerId'
            });
        }

        // Convert employerId to ObjectId if it's a valid string
        let objectIdEmployerId = employerId;
        if (typeof employerId === 'string' && mongoose.Types.ObjectId.isValid(employerId)) {
            objectIdEmployerId = new mongoose.Types.ObjectId(employerId);
        }

        console.log('Creating payment for employer:', objectIdEmployerId);

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'aud',
            metadata: {
                type: 'job_posting',
                planId: planId,
                employerId: employerId,
                jobTitle: jobData?.title || 'Job Posting'
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Store payment record in database
        const paymentRecord = new Payment({
            employerId: objectIdEmployerId,
            stripePaymentIntentId: paymentIntent.id,
            amount: amount,
            type: 'job_posting',
            planId: planId,
            status: 'pending',
            jobData: jobData,
            addOns: addOns,
            packageId: packageId,
            candidateCount: candidateCount,
            notificationType: notificationType,
            metadata: {
                stripeCustomerId: paymentIntent.customer,
                paymentMethodTypes: paymentIntent.payment_method_types
            }
        });

        await paymentRecord.save();
        console.log('Payment record saved:', paymentRecord._id);

        res.json({
            success: true,
            client_secret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: amount,
            paymentRecordId: paymentRecord._id
        });

    } catch (error) {
        console.error('Error creating job posting payment:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create payment intent',
            error: error.message
        });
    }
};

// Create payment intent for notification packages
export const createNotificationPayment = async (req, res) => {
    try {
        checkStripeAvailable();
        
        const { packageId, amount, employerId, jobId, candidateCount, notificationType } = req.body;

        // Validate input
        if (!packageId || !amount || !employerId || !jobId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'aud',
            metadata: {
                type: 'notification_package',
                packageId: packageId,
                employerId: employerId,
                jobId: jobId
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Store payment record in database
        const paymentRecord = new Payment({
            employerId: employerId,
            jobId: jobId,
            stripePaymentIntentId: paymentIntent.id,
            amount: amount,
            type: 'notification_package',
            packageId: packageId,
            candidateCount: candidateCount,
            notificationType: notificationType,
            status: 'pending',
            metadata: {
                stripeCustomerId: paymentIntent.customer,
                paymentMethodTypes: paymentIntent.payment_method_types
            }
        });

        await paymentRecord.save();

        res.json({
            success: true,
            client_secret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: amount,
            paymentRecordId: paymentRecord._id
        });

    } catch (error) {
        console.error('Error creating notification payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment intent',
            error: error.message
        });
    }
};

// Confirm payment success
export const confirmPaymentSuccess = async (req, res) => {
    try {
        checkStripeAvailable();
        const { paymentIntentId } = req.body;
        if (!paymentIntentId) {
            return res.status(400).json({
                success: false,
                message: 'Payment intent ID is required'
            });
        }
        // Get payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({
                success: false,
                message: 'Payment has not succeeded'
            });
        }
        // Update payment record in database
        const paymentRecord = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
        if (paymentRecord) {
            paymentRecord.status = 'completed';
            paymentRecord.completedAt = new Date();
            paymentRecord.stripeCustomerId = paymentIntent.customer;
            paymentRecord.metadata = {
                ...paymentRecord.metadata,
                paymentMethod: paymentIntent.payment_method,
                receiptUrl: paymentIntent.charges?.data[0]?.receipt_url
            };
            await paymentRecord.save();

            // Only call jobController.createJob after payment, do not create jobs here
            let createdJob = null;
            if (paymentRecord.type === 'job_posting' && paymentRecord.jobData && paymentRecord.employerId) {
                try {
                    // Prepare a mock request/response for createJob
                    const mockReq = {
                        body: {
                            ...paymentRecord.jobData,
                            postedBy: paymentRecord.employerId,
                            isPaid: true,
                            status: 'Open',
                            skipEmailAlerts: false
                        },
                        employer: { _id: paymentRecord.employerId }
                    };
                    const mockRes = {
                        status: (code) => ({
                            json: (data) => {
                                if (code === 201 && data.success) {
                                    createdJob = data.job;
                                } else {
                                    throw new Error(data.message || 'Job creation failed');
                                }
                            }
                        })
                    };
                    await createJob(mockReq, mockRes, (error) => {
                        if (error) throw error;
                    });
                    // Update payment record with job ID
                    paymentRecord.jobId = createdJob._id;
                    await paymentRecord.save();
                } catch (jobCreationError) {
                    console.error('Error auto-creating job after payment:', jobCreationError);
                    // Don't fail the payment confirmation, just log the error
                }
            }
            return res.json({
                success: true,
                message: 'Payment confirmed successfully',
                paymentIntent: paymentIntent,
                paymentRecord: paymentRecord,
                createdJob: createdJob ? {
                    _id: createdJob._id,
                    jobTitle: createdJob.jobTitle,
                    status: createdJob.status
                } : null
            });
        } else {
            return res.json({
                success: true,
                message: 'Payment confirmed successfully',
                paymentIntent: paymentIntent,
                paymentRecord: null
            });
        }
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm payment',
            error: error.message
        });
    }
};

// Handle payment failure
export const handlePaymentFailure = async (req, res) => {
    try {
        const { paymentIntentId, errorMessage } = req.body;

        // Update payment record in database
        const paymentRecord = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
        if (paymentRecord) {
            paymentRecord.status = 'failed';
            paymentRecord.failedAt = new Date();
            paymentRecord.failureReason = errorMessage;
            await paymentRecord.save();
        }

        res.json({
            success: true,
            message: 'Payment failure recorded',
            paymentRecord: paymentRecord
        });

    } catch (error) {
        console.error('Error handling payment failure:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to handle payment failure',
            error: error.message
        });
    }
};

// Get payment history for employer
export const getPaymentHistory = async (req, res) => {
    try {
        const { employerId } = req.params;
        const { page = 1, limit = 10, status, type } = req.query;

        // Convert employerId to ObjectId if it's a valid MongoDB ObjectId string
        let queryEmployerId = employerId;
        if (mongoose.Types.ObjectId.isValid(employerId)) {
            queryEmployerId = new mongoose.Types.ObjectId(employerId);
        }

        // Build query
        const query = { employerId: queryEmployerId };
        if (status) query.status = status;
        if (type) query.type = type;

        console.log('Payment history query:', query);

        // Execute query with pagination
        const payments = await Payment.find(query)
            .populate('jobId', 'title')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        console.log('Found payments:', payments.length);

        // Get total count
        const total = await Payment.countDocuments(query);

        // Calculate summary statistics
        const totalSpent = await Payment.aggregate([
            { $match: { employerId: queryEmployerId, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const statusCounts = await Payment.aggregate([
            { $match: { employerId: queryEmployerId } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            payments,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit)
            },
            summary: {
                totalSpent: totalSpent[0]?.total || 0,
                statusCounts: statusCounts.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        console.error('Error getting payment history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payment history',
            error: error.message
        });
    }
};

// Get invoice for specific payment
export const getInvoice = async (req, res) => {
    try {
        const { invoiceId } = req.params;

        const payment = await Payment.findById(invoiceId)
            .populate('employerId', 'companyName EmployerEmail')
            .populate('jobId', 'title');

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        // Format invoice data
        const invoice = {
            id: payment._id,
            invoiceNumber: `INV-${payment._id.toString().slice(-8).toUpperCase()}`,
            paymentIntentId: payment.stripePaymentIntentId,
            date: payment.completedAt || payment.createdAt,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            type: payment.type,
            company: payment.employerId,
            job: payment.jobId,
            planId: payment.planId,
            packageId: payment.packageId,
            addOns: payment.addOns,
            metadata: payment.metadata
        };

        res.json({
            success: true,
            invoice
        });

    } catch (error) {
        console.error('Error getting invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get invoice',
            error: error.message
        });
    }
};

// Create setup intent
export const createSetupIntent = async (req, res) => {
    try {
        checkStripeAvailable();
        
        const setupIntent = await stripe.setupIntents.create({
            payment_method_types: ['card'],
        });

        res.json({
            success: true,
            client_secret: setupIntent.client_secret
        });

    } catch (error) {
        console.error('Error creating setup intent:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create setup intent',
            error: error.message
        });
    }
};

// Get payment methods (placeholder)
export const getPaymentMethods = async (req, res) => {
    try {
        res.json({
            success: true,
            paymentMethods: []
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get payment methods',
            error: error.message
        });
    }
};

// Handle Stripe webhooks
export const handleStripeWebhook = async (req, res) => {
    try {
        checkStripeAvailable();
        
        const sig = req.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntentSucceeded = event.data.object;
                console.log('Payment succeeded:', paymentIntentSucceeded.id);
                
                // Update payment record
                await Payment.findOneAndUpdate(
                    { stripePaymentIntentId: paymentIntentSucceeded.id },
                    { 
                        status: 'completed',
                        completedAt: new Date(),
                        metadata: {
                            paymentMethod: paymentIntentSucceeded.payment_method,
                            receiptUrl: paymentIntentSucceeded.charges?.data[0]?.receipt_url
                        }
                    }
                );
                break;
            
            case 'payment_intent.payment_failed':
                const paymentIntentFailed = event.data.object;
                console.log('Payment failed:', paymentIntentFailed.id);
                
                // Update payment record
                await Payment.findOneAndUpdate(
                    { stripePaymentIntentId: paymentIntentFailed.id },
                    { 
                        status: 'failed',
                        failedAt: new Date(),
                        failureReason: paymentIntentFailed.last_payment_error?.message || 'Payment failed'
                    }
                );
                break;
            
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });

    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to handle webhook',
            error: error.message
        });
    }
}; 
