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
    jobTitle: {
        type: String,
        required: true,
    },
    jobDescription: {
        type: String,
        required: true,
    },
    jobLocation: {
        type: String,
        required: true,
    },
    workspaceOption: {
        type: String,
        enum: ['On-site', 'Hybrid', 'Remote'],
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    subcategory: {
        type: String,
        required: true,
    },
    workType: {
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Casual'],
        required: true,
    },
    payType: {
        type: String,
        enum: ['Hourly rate', 'Monthly salary', 'Annual salary', 'Annual plus commission'],
        required: true,
    },
    payRange: {
        currency: {
            type: String,
            required: true,
        },
        from: {
            type: Number,
            required: true,
        },
        to: {
            type: Number,
            required: true,
        }
    },
    showSalaryOnAd: {
        type: Boolean,
        default: true,
    },
    jobType: {
        type: String,
        enum: ['Full-Time', 'Part-Time', 'Contract', 'Temporary', 'Volunteer', 'Internship'],
    },
    jobSalary: {
        type: Number,
    },
    jobSalaryType: {
        type: String,
        enum: ['Per Month', 'Per Annum', 'Per Week', 'Per Hour', 'Per Contract'],
    },
    jobBanner: {
        type: String,
        default: '',
    },
    jobIndustry: {
        type: String,
        required: true,
    },
    jobExperience: {
        type: String,
        enum: ['Entry', 'Mid', 'Senior', 'Lead'],
        required: true,
    },
    jobSkills: {
        type: [String],
        required: true,
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employer',
        required: true
    },
    applicants: [applicantSchema],
    jobKeywords: {
        type: [String],
        required: true,
    },
    status: {
        type: String,
        enum: ['Open', 'Closed'],
        default: 'Open'
    }
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema);

export default Job;