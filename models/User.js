import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const relocationSchema = new mongoose.Schema({
    preferred_location: [String],
    willing_to_relocate: Boolean,
    willing_to_travel: Boolean
}, {_id: true});

const emergencyContactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: false
    },
    relationship: {
        type: String,
        required: false
    },
    phone: {
        type: String,
        required: false
    },
    email: {
        type: String,
        required: false
    }
}, {_id: false});

const socialLinksSchema = new mongoose.Schema({
    linkedin: {
        type: String,
        required: false
    },
    github: {
        type: String,
        required: false
    },
    portfolio: {
        type: String,
        required: false
    },
    twitter: {
        type: String,
        required: false
    },
    website: {
        type: String,
        required: false
    }
}, {_id: false});

const educationSchema = new mongoose.Schema({
    institute_name: String,
    course_name: String,
    description: String,
    year_of_graduation: String,
    grade: String,
    currently_pursuing: Boolean
}, {_id: true});

const workHistorySchema = new mongoose.Schema({
    past_job_title: {
        type: String,
        required: [true, "Please provide a past job title"]
    },
    past_company_name: {
        type: String,
        required: [true, "Please provide a past company name"]
    },
    past_job_location: {
        type: String,
        required: [true, "Please provide a past job location"]
    },
    past_job_start_date: {
        type: Date,
        required: [true, "Please provide a past job start date"]
    },
    past_job_end_date: {
        type: Date,
        // Not required for current roles
        required: false
    },
    past_employment_type: {
        type: String,
        enum: ["Full-time", "Part-time", "Contract", "Internship", "Remote"],
        required: [true, "Please provide a past employment type"]
    },
    past_job_leave_reason: {
        type: String,
        // Not required for current roles
        required: false
    },
    past_job_refrence_person: {
        type: String,
        // Make optional since it might not always be available
        required: false
    },
    NoticePeriod: {
        type: String,
        // Make optional
        required: false
    }
}, {_id: true});

const notInterestedJobCategoriesSchema = new mongoose.Schema({
    jobCategory: {
        type: String,
        required: true
    },
    jobSubCategory: {
        type: String,
        required: true
    }
}, {_id: true});

// Main User Schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        index: true,
        trim: true,
        match: [/\S+@\S+\.\S+/, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: 6,
        select: false
    },
    isProfileCompleted: {
        type: Boolean,
        default: false
    },
    savedJobs: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Job',
        default: []
    },
    appliedJobs: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'Job',
        default: []
    },
    gender: {
        type: String,
        enum: ['Male', 'Female', 'Other']
    },
    preferred_pronouns: {
        type: String,
        enum: ['He/Him', 'She/Her', 'They/Them']
    },
    nationality: String,
    resident_country: String,
    known_language: {
        type: [String],
        default: []
    },
    preferred_time_zone: {
        type: String,
        default: 'UTC'
    },
    highest_qualification: {
        type: String,
        enum: ['High School', 'Bachelors', 'Masters', 'PhD']
    },
    achievements: {
        type: [String],
        default: []
    },
    licenses: {
        type: [{
            licenseName: String,
            issuingOrganisation: String,
            issueDate: String,
            noExpiry: {
                type: Boolean,
                default: false
            },
            expiryDate: String,
            description: String
        }],
        default: []
    },
    skills_and_capabilities: {
        type: [String],
        default: []
    },
    // Single resume field (for backward compatibility)
    resume: String,
    resume_downloadble: {
        type: Boolean,
        default: true
    },
    // Multiple resumes support
    resumes: {
        type: [{
            name: {
                type: String,
                required: true
            },
            url: {
                type: String,
                required: true
            },
            size: {
                type: Number,
                required: false
            },
            type: {
                type: String,
                required: false
            },
            extension: {
                type: String,
                required: false
            },
            uploadedAt: {
                type: Date,
                default: Date.now
            },
            isPrimary: {
                type: Boolean,
                default: false
            },
            isDownloadable: {
                type: Boolean,
                default: true
            },
            coverLetter: {
                type: String,
                default: ''
            },
            coverLetterUpdatedAt: {
                type: Date,
                default: Date.now
            }
        }],
        default: []
    },
    cover_letter: String,
    work_history: {
        type: [workHistorySchema],
        default: []
    },
    education: {
        type: [educationSchema],
        default: []
    },
    dream_job_title: String,
    preferred_job_types: {
        type: [String],
        enum: ['Full-time', 'Part-time', 'Contract', 'Internship'],
        default: []
    },
    work_env_preferences: {
        type: [String],
        enum: ['Startup', 'Corporate', 'NGO', 'Freelance', 'Remote'],
        default: []
    },
    relocation: {
        type: relocationSchema,
        default: {}
    },
    personal_branding_statement: String,
    work_domain: String,
    hobbies: {
        type: [String],
        default: []
    },
    emergency_contact: {
        type: emergencyContactSchema,
        default: {}
    },
    social_links: {
        type: socialLinksSchema,
        default: {}
    },
    passwordResetOtp: {
        type: String,
        select: false
    },
    passwordResetExpire: {
        type: Date,
        select: false
    },
    notInterestedJobCategories: {
        type: [notInterestedJobCategoriesSchema],
        default: []
    }
}, {timestamps: true});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Password comparison method
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
