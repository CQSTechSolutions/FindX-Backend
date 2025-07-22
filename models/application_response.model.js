import mongoose from "mongoose";

// Schema for individual question responses
const questionResponseSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    selectedOption: {
        type: String,
        required: false, // Make optional to handle empty responses
        default: ''
    },
    options: [{
        type: String,
        required: true
    }]
}, { _id: false });

// Add custom validation for question responses
questionResponseSchema.pre('save', function(next) {
    // Only validate if selectedOption is provided and not empty
    if (this.selectedOption !== undefined && this.selectedOption !== null && this.selectedOption.trim() !== '') {
        // Validate that selectedOption is one of the available options
        if (!this.options.includes(this.selectedOption)) {
            return next(new Error(`Selected option "${this.selectedOption}" is not one of the available options: ${this.options.join(', ')}`));
        }
    }
    next();
});

const applicationResponseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
        required: true,
    },
    jobPostedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Employer",
        required: true,
    },
    questionResponses: [questionResponseSchema],
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'reviewed', 'shortlisted', 'interview'],
        default: 'pending',
    },
    submittedAt: {
        type: Date,
        default: Date.now
    },
    reviewedAt: {
        type: Date
    },
    reviewNotes: {
        type: String,
        default: ''
    }
}, { timestamps: true });

// Index for better query performance
applicationResponseSchema.index({ userId: 1, jobId: 1 }, { unique: true });
applicationResponseSchema.index({ jobPostedBy: 1 });
applicationResponseSchema.index({ status: 1 });

const ApplicationResponse = mongoose.model('ApplicationResponse', applicationResponseSchema);

export default ApplicationResponse;
