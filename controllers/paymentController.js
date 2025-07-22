import Stripe from 'stripe';
import Payment from '../models/Payment.model.js';
import Job from '../models/Job.model.js';
import Employer from '../models/employer.model.js';
import User from '../models/User.js';
import ErrorResponse from '../utils/errorResponse.js';
import mongoose from 'mongoose';
import { sendJobAlertEmails } from './broadcastController.js';

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
        immediateStart: { id: 'immediateStart', name: 'Immediate Start Badge', price: 1900 },
        referenceCheck: { id: 'referenceCheck', name: 'Reference Check Access', price: 1900 }
    }
};

// Function to find similar users based on job criteria
const findSimilarUsers = async (jobData) => {
    try {
        console.log('🔍 Finding similar users for job:', jobData.jobTitle);
        
        // Extract relevant job data for matching
        const jobCriteria = {
            jobTitle: jobData.jobTitle,
            jobLocation: jobData.jobLocation,
            category: jobData.category,
            subcategory: jobData.subcategory,
            workType: jobData.workType,
            workspaceOption: jobData.workspaceOption,
            jobSkills: jobData.jobSkills || [],
            jobKeywords: jobData.jobKeywords || [],
            from: jobData.from,
            to: jobData.to,
            currency: jobData.currency
        };

        console.log('📋 Job Criteria:', jobCriteria);

        // Build query to find matching users
        const matchQuery = {
            // Users with completed profiles
            isProfileCompleted: true
        };

        // Add location matching if job location is provided
        if (jobCriteria.jobLocation) {
            // Extract country from location (e.g., "Delhi, India" -> "India")
            const locationParts = jobCriteria.jobLocation.split(',').map(part => part.trim());
            const country = locationParts[locationParts.length - 1]; // Get the last part as country
            
            console.log('📍 Location matching details:', {
                fullLocation: jobCriteria.jobLocation,
                locationParts,
                country,
                city: locationParts[0]
            });
            
            matchQuery.$or = [
                // Match by country
                { resident_country: { $regex: country, $options: 'i' } },
                // Match by full location
                { resident_country: { $regex: jobCriteria.jobLocation, $options: 'i' } },
                // Match by preferred locations
                { 'relocation.preferred_location': { $regex: country, $options: 'i' } },
                { 'relocation.preferred_location': { $regex: jobCriteria.jobLocation, $options: 'i' } },
                // Match by city (first part)
                { resident_country: { $regex: locationParts[0], $options: 'i' } },
                { 'relocation.preferred_location': { $regex: locationParts[0], $options: 'i' } }
            ];
        }

        // If no location matches found, make location optional and focus on other criteria
        let matchingUsers = await User.find(matchQuery)
            .select('name email skills_and_capabilities dream_job_title preferred_job_types work_env_preferences resident_country relocation highest_qualification personal_branding_statement')
            .limit(100);

        // If no users found with location criteria, try without location
        if (matchingUsers.length === 0 && jobCriteria.jobLocation) {
            console.log('🔍 No users found with location criteria, trying without location...');
            const fallbackQuery = {
                isProfileCompleted: true
            };

            // Add work type preferences if available
            if (jobCriteria.workType) {
                fallbackQuery.preferred_job_types = jobCriteria.workType;
            }

            // Add work environment preferences if available
            if (jobCriteria.workspaceOption) {
                const envMapping = {
                    'On-site': 'Corporate',
                    'Hybrid': 'Corporate',
                    'Remote': 'Remote'
                };
                const mappedEnv = envMapping[jobCriteria.workspaceOption];
                if (mappedEnv) {
                    fallbackQuery.work_env_preferences = mappedEnv;
                }
            }

            matchingUsers = await User.find(fallbackQuery)
                .select('name email skills_and_capabilities dream_job_title preferred_job_types work_env_preferences resident_country relocation highest_qualification personal_branding_statement')
                .limit(100);
        }

        // If still no users found, try with just completed profiles
        if (matchingUsers.length === 0) {
            console.log('🔍 No users found with any criteria, trying with just completed profiles...');
            matchingUsers = await User.find({ isProfileCompleted: true })
                .select('name email skills_and_capabilities dream_job_title preferred_job_types work_env_preferences resident_country relocation highest_qualification personal_branding_statement')
                .limit(100);
        }

        // If still no users found, check if there are any users at all
        if (matchingUsers.length === 0) {
            console.log('🔍 No users with completed profiles found, checking total users in database...');
            const totalUsers = await User.countDocuments();
            const completedUsers = await User.countDocuments({ isProfileCompleted: true });
            console.log(`📊 Database stats: ${totalUsers} total users, ${completedUsers} completed profiles`);
        }



        console.log(`👥 Found ${matchingUsers.length} potential matches`);
        
        if (matchingUsers.length === 0) {
            console.log('⚠️  No users found. This could be due to:');
            console.log('   - No users with completed profiles');
            console.log('   - No users matching the location criteria');
            console.log('   - No users matching the work type/environment preferences');
            console.log('   - Database connection issues');
        }

        // Score and rank users based on multiple criteria
        const scoredUsers = matchingUsers.map(user => {
            let score = 0;
            const matchDetails = [];

            // 1. Skills matching (highest weight)
            if (user.skills_and_capabilities && jobCriteria.jobSkills.length > 0) {
                const userSkills = user.skills_and_capabilities.map(skill => skill.toLowerCase());
                const jobSkills = jobCriteria.jobSkills.map(skill => skill.toLowerCase());
                
                const matchingSkills = jobSkills.filter(skill => 
                    userSkills.some(userSkill => 
                        userSkill.includes(skill) || skill.includes(userSkill)
                    )
                );
                
                const skillMatchPercentage = (matchingSkills.length / jobSkills.length) * 100;
                score += skillMatchPercentage * 0.4; // 40% weight
                matchDetails.push(`Skills: ${matchingSkills.length}/${jobSkills.length} (${skillMatchPercentage.toFixed(1)}%)`);
            }

            // 2. Job title matching
            if (user.dream_job_title && jobCriteria.jobTitle) {
                const userTitle = user.dream_job_title.toLowerCase();
                const jobTitle = jobCriteria.jobTitle.toLowerCase();
                
                if (userTitle.includes(jobTitle) || jobTitle.includes(userTitle)) {
                    score += 25;
                    matchDetails.push('Job title match');
                }
            }

            // 3. Work type preference
            if (user.preferred_job_types && user.preferred_job_types.includes(jobCriteria.workType)) {
                score += 15;
                matchDetails.push('Work type preference match');
            }

            // 4. Work environment preference
            if (user.work_env_preferences) {
                const envMapping = {
                    'On-site': 'Corporate',
                    'Hybrid': 'Corporate',
                    'Remote': 'Remote'
                };
                const mappedEnv = envMapping[jobCriteria.workspaceOption];
                if (mappedEnv && user.work_env_preferences.includes(mappedEnv)) {
                    score += 10;
                    matchDetails.push('Work environment preference match');
                }
            }

            // 5. Location matching
            if (user.resident_country && jobCriteria.jobLocation) {
                const userCountry = user.resident_country.toLowerCase();
                const jobLocation = jobCriteria.jobLocation.toLowerCase();
                
                if (userCountry.includes(jobLocation) || jobLocation.includes(userCountry)) {
                    score += 10;
                    matchDetails.push('Location match');
                }
            }

            // 6. Relocation willingness
            if (user.relocation && user.relocation.willing_to_relocate) {
                score += 5;
                matchDetails.push('Willing to relocate');
            }

            return {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    skills_and_capabilities: user.skills_and_capabilities,
                    dream_job_title: user.dream_job_title,
                    preferred_job_types: user.preferred_job_types,
                    work_env_preferences: user.work_env_preferences,
                    resident_country: user.resident_country,
                    highest_qualification: user.highest_qualification,
                    personal_branding_statement: user.personal_branding_statement
                },
                score: Math.round(score),
                matchDetails
            };
        });

        // Sort by score (highest first) and get top matches
        const topMatches = scoredUsers
            .filter(user => user.score > 0) // Include all users with any match score
            .sort((a, b) => b.score - a.score)
            .slice(0, 100); // Top 100 matches

        console.log(`🎯 Top ${topMatches.length} matches found:`);
        topMatches.forEach((match, index) => {
            console.log(`${index + 1}. ${match.user.name} (${match.user.email}) - Score: ${match.score}`);
            console.log(`   Match Details: ${match.matchDetails.join(', ')}`);
        });

        return {
            jobTitle: jobCriteria.jobTitle,
            jobLocation: jobCriteria.jobLocation,
            totalCandidates: matchingUsers.length,
            topMatches: topMatches.length,
            matches: topMatches
        };

    } catch (error) {
        console.error('❌ Error finding similar users:', error);
        return {
            error: error.message,
            matches: []
        };
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
            currency: 'usd',
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
            currency: 'usd',
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

            // Auto-create job if this is a job posting payment and job data exists
            let createdJob = null;
            if (paymentRecord.type === 'job_posting' && paymentRecord.jobData && paymentRecord.employerId) {
                try {
                    // Get employer details for fallback logo
                    const employer = await Employer.findById(paymentRecord.employerId);
                    
                    // Debug: Log the original job data
                    console.log('🔍 Original job data from payment:', paymentRecord.jobData);
                    
                    // Prepare job data with validation and fallbacks
                    const jobData = {
                        ...paymentRecord.jobData,
                        postedBy: paymentRecord.employerId,
                        isPaid: true,
                        status: 'Open',
                        // Use employer's company logo as fallback if no logo provided
                        companyLogo: paymentRecord.jobData.companyLogo || (employer && employer.companyLogo ? employer.companyLogo : ''),
                        // Ensure required fields have fallback values
                        jobTitle: paymentRecord.jobData.jobTitle || 'Job Posting',
                        jobDescription: paymentRecord.jobData.jobDescription || 'Job description will be provided',
                        jobLocation: paymentRecord.jobData.jobLocation || 'Location TBD',
                        workspaceOption: paymentRecord.jobData.workspaceOption || 'On-site',
                        category: paymentRecord.jobData.category || 'General',
                        subcategory: paymentRecord.jobData.subcategory || 'Other',
                        workType: paymentRecord.jobData.workType || 'Full-time',
                        payType: paymentRecord.jobData.payType || 'Monthly salary',
                        currency: paymentRecord.jobData.currency || 'USD',
                        from: paymentRecord.jobData.from || 0,
                        to: paymentRecord.jobData.to || 0
                    };

                    // Debug: Log the processed job data
                    console.log('🔍 Processed job data:', jobData);

                    // Validate required fields before creating job
                    const requiredFields = ['jobTitle', 'jobDescription', 'jobLocation', 'workspaceOption', 'category', 'subcategory', 'workType', 'payType', 'currency'];
                    const missingFields = requiredFields.filter(field => !jobData[field]);
                    
                    // Special validation for numeric fields
                    if (typeof jobData.from !== 'number' || typeof jobData.to !== 'number') {
                        missingFields.push('from', 'to');
                    }
                    
                    if (missingFields.length > 0) {
                        console.error('Missing required job fields:', missingFields);
                        throw new Error(`Missing required job fields: ${missingFields.join(', ')}`);
                    }

                                        // Create the job with email alert flag to prevent duplicate emails
                    const jobDataWithFlag = {
                        ...jobData,
                        skipEmailAlerts: true // Prevent duplicate emails from direct job creation
                    };
                    createdJob = await Job.create(jobDataWithFlag);
                    console.log('Auto-created job after payment:', createdJob._id);
                    
                    // Find similar users after job creation
                    console.log('🚀 Job auto-created after payment, now finding similar users...');
                    const userMatches = await findSimilarUsers(jobData);
                    
                     // Send job alert emails to matched users (ONLY from payment flow)
                     if (userMatches.matches && userMatches.matches.length > 0) {
                         console.log(`📧 Sending BCC job alert emails to ${userMatches.matches.length} matched users for job: ${jobData.jobTitle}`);
                         // Extract user objects from the matches (which contain user, score, matchDetails)
                         const matchedUsers = userMatches.matches.map(match => match.user);
                         const emailResult = await sendJobAlertEmails(createdJob, matchedUsers);
                         console.log(`✅ BCC emails sent successfully: ${emailResult.sentCount}/${emailResult.totalCount} recipients`);
                     }
                    
                    // Update payment record with job ID
                    paymentRecord.jobId = createdJob._id;
                    await paymentRecord.save();
                } catch (jobCreationError) {
                    console.error('Error auto-creating job after payment:', jobCreationError);
                    // Don't fail the payment confirmation, just log the error
                }
            }

            res.json({
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
            res.json({
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