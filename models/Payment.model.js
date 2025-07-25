import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    employerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employer',
        required: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: false // Not required for job posting payments
    },
    stripePaymentIntentId: {
        type: String,
        required: true,
        unique: true
    },
    stripeCustomerId: {
        type: String,
        required: false
    },
    amount: {
        type: Number,
        required: true // Amount in cents
    },
    currency: {
        type: String,
        default: 'aud'
    },
    type: {
        type: String,
        enum: ['job_posting', 'notification_package', 'subscription'],
        required: true
    },
    planId: {
        type: String,
        required: false // For job posting payments
    },
    packageId: {
        type: String,
        required: false // For notification packages
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'cancelled'],
        default: 'pending'
    },
    jobData: {
        type: Object,
        required: false
    },
    addOns: [{
        id: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true
        }
    }],
    candidateCount: {
        type: Number,
        required: false
    },
    notificationType: {
        type: String,
        enum: ['app', 'email', 'both'],
        required: false
    },
    metadata: {
        type: Object,
        default: {}
    },
    completedAt: {
        type: Date,
        required: false
    },
    failedAt: {
        type: Date,
        required: false
    },
    failureReason: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

// Index for efficient queries
paymentSchema.index({ employerId: 1, createdAt: -1 });
paymentSchema.index({ stripePaymentIntentId: 1 });
paymentSchema.index({ status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment; 