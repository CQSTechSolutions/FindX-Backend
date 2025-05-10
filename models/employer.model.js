import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const employerSchema = new mongoose.Schema({
    password: {
        type: String,
        required: true,
        minlength: 6,
        select: false,
    },
    companyName: {
        type: String,
        required: true,
    },
    companyDescription: {
        type: String,
        required: false,
    },
    companyWebsite: {
        type: String,
        required: true,
    },
    companyLogo: {
        type: String,
        required: true,
    },
    companyIndustry: {
        type: String,
        required: true,
    },
    companySize: {
        type: Number,
        required: true,
    },
    companyLocation: {
        type: String,
        required: true,
    },
    EmployerName: {
        type: String,
        required: true,
    },
    EmployerEmail: {
        type: String,
        required: true,
    },
    EmployerDesignation: {
        type: String,
        required: true,
    },
    EmployerPhone: {
        type: String,
        required: true,
    },
    companyEmployerId: {
        type: String,
        required: true,
        unique: true,
    },
    totalPostedJobs: {
        type: Number,
        default: 0,
    },
    totalHiredCandidates: {
        type: Number,
        default: 0,
    },
    messagesAllowed: {
        type: Boolean,
        default: false,
    },
    messagesAllowedFrom: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
        default: [],
    },
    blockedApplicants: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
        default: [],
    }
}, { timestamps: true });

// Hash password before saving
employerSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Compare password method
employerSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const Employer = mongoose.model("Employer", employerSchema);

export default Employer;
