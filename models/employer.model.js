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
    blockedApplicants: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
        default: [],
    }
},{timestamps: true});

const Employer = mongoose.model("Employer", employerSchema);

employerSchema.methods.comparePassword = async function(employerPassword) {
    return await bcrypt.compare(employerPassword, this.password);
}

employerSchema.pre("save", async function(next) {
    if(!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

export default Employer;
