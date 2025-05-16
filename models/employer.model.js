import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const messagesFromUsersSchema = new mongoose.Schema({
    message: String,
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

const messagesToUsersSchema = new mongoose.Schema({
    message: String,
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

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
    messagesFromUsers: {
        type: [messagesFromUsersSchema],
        default: [],
    },
    messagesToUsers: {
        type: [messagesToUsersSchema],
        default: [],
    },
    blockedApplicants: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
        default: [],
    },
    pricingPlan: {
        type: String,
        enum: ['Standard', 'Boosted100App', 'Boosted100Email', 'Boosted100Both', 
               'Boosted250App', 'Boosted250Email', 'Boosted250Both',
               'Boosted500App', 'Boosted500Email', 'Boosted500Both',
               'Boosted750App', 'Boosted750Email', 'Boosted750Both',
               'Boosted1000App', 'Boosted1000Email', 'Boosted1000Both'],
        default: 'Standard'
    },
    planPurchaseDate: {
        type: Date,
        default: null
    },
    planExpiryDate: {
        type: Date,
        default: null
    },
    earlyBirdPricing: {
        type: Boolean,
        default: true
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
