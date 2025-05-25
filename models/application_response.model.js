import mongoose from "mongoose";

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
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
    },
},{timestamps: true});

const ApplicationResponse = mongoose.model('ApplicationResponse', applicationResponseSchema);

export default ApplicationResponse;
