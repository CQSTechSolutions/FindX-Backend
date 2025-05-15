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
    jobType: {
        type: String,
        enum: ['Full-Time', 'Part-Time', 'Contract', 'Temporary', 'Volunteer', 'Internship'],
        required: true,
    },
    jobSalary: {
        type: Number,
        required: true,
    },
    jobSalaryType: {
        type: String,
        enum: ['Per Month', 'Per Annum', 'Per Week', 'Per Hour', 'Per Contract'],
        default: 'Per Month',
        required: true,
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