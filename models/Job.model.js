import mongoose from "mongoose"

const jobSchema = new mongoose.Schema({
    jobTitle: {
        type: String,
        required: true,
    },
    jobDescription: {
        type: String,
        required: true,
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    applicants: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        status: {
            type: String,
            enum: ['Pending', 'Reviewed', 'Shortlisted', 'Rejected'],
            default: 'Pending'
        },
        appliedAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['Open', 'Closed'],
        default: 'Open'
    }
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema);

export default Job;