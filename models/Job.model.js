import mongoose from "mongoose"

const applicantSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    status: {
        type: String,
        enum: ['Pending', 'Reviewed', 'Shortlisted', 'Rejected', 'Blocked', 'Interview'],
        default: 'Pending'
    },
    appliedOn: {
        type: Date,
        default: Date.now
    },
    interviewDetails: {
        date: Date,
        time: String,
        location: String,
        notes: String
    },
    rejectionReason: String,
    isBlocked: {
        type: Boolean,
        default: false
    },
    blockReason: String
}, {_id: true});

const jobSchema = new mongoose.Schema({
    // Basic Job Information
    jobTitle: {
        type: String,
        required: true,
        trim: true
    },
    jobDescription: {
        type: String,
        required: true,
    },
    jobSummary: {
        type: String,
        default: '',
    },
    jobLocation: {
        type: String,
        required: true,
        trim: true
    },
    workspaceOption: {
        type: String,
        enum: ['On-site', 'Hybrid', 'Remote'],
        required: true,
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    subcategory: {
        type: String,
        required: true,
        trim: true
    },
    
    // Employment Details
    workType: {
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Casual'],
        required: true,
    },
    
    // Compensation Information
    payType: {
        type: String,
        enum: ['Hourly rate', 'Monthly salary', 'Annual salary', 'Annual plus commission'],
        required: true,
    },
    currency: {
        type: String,
        required: function() {
            // Only require for new documents, not for updates
            return this.isNew;
        },
        trim: true
    },
    from: {
        type: Number,
        required: function() {
            // Only require for new documents, not for updates
            return this.isNew;
        },
    },
    to: {
        type: Number,
        required: function() {
            // Only require for new documents, not for updates
            return this.isNew;
        },
    },
    showSalaryOnAd: {
        type: Boolean,
        default: true,
    },
    jobSalaryType: {
        type: String,
        enum: ['Per Month', 'Per Annum', 'Per Week', 'Per Hour', 'Per Contract'],
        default: 'Per Month',
    },
    
    // Skills and Keywords
    jobSkills: {
        type: [String],
        default: [],
    },
    jobKeywords: {
        type: [String],
        default: [],
    },
    sellingPoints: {
        type: [String],
        default: [],
    },
    
    // Media Elements
    jobBanner: {
        type: String,
        default: '',
    },
    companyLogo: {
        type: String,
        default: '',
    },
    videoLink: {
        type: String,
        default: '',
        trim: true
    },
    
    // Application Questions and References
    jobQuestions: {
        type: [String],
        default: [],
    },
    // Structured questions with multiple choice options
    applicationQuestions: [{
        question: {
            type: String,
            required: true
        },
        options: [{
            type: String,
            required: true
        }],
        required: {
            type: Boolean,
            default: true
        }
    }],
    // Questions marked as mandatory by employer
    mandatoryQuestions: {
        type: [String],
        default: [],
    },
    // Selected options for each question (employer can choose which options to show)
    selectedOptions: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    internalReference: {
        type: String,
        default: '',
        trim: true
    },
    
    // Premium Listing Options
    premiumListing: {
        type: Boolean,
        default: true,
    },
    immediateStart: {
        type: Boolean,
        default: false,
    },
    referencesRequired: {
        type: Boolean,
        default: false,
    },
    notificationOption: {
        type: String,
        enum: ['both', 'email', 'app', 'none'],
        default: 'both',
    },
    
    // Relationship and Status Fields
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employer',
        required: true
    },
    applicants: [applicantSchema],
    status: {
        type: String,
        enum: ['Open', 'Closed'],
        default: 'Open'
    }
}, { timestamps: true });

// Add virtual property for full salary range display
jobSchema.virtual('salaryDisplay').get(function() {
    if (!this.currency) return '';
    return `${this.currency} ${this.from.toLocaleString()} - ${this.to.toLocaleString()} ${this.jobSalaryType || 'Per Month'}`;
});

// Ensure virtuals are included when converting to JSON
jobSchema.set('toJSON', { virtuals: true });
jobSchema.set('toObject', { virtuals: true });

const Job = mongoose.model('Job', jobSchema);

export default Job;