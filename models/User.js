import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const relocationSchema = new mongoose.Schema({
    preferred_location: [String],
    willing_to_relocate: Boolean,
    willing_to_travel: Boolean
}, {_id: true});

const emergencyContactSchema = new mongoose.Schema({
    emergency_contact_number: String,
    emergency_contact_name: String,
    emergency_contact_relationship: String
}, {_id: true});

const externalLinksSchema = new mongoose.Schema({
    personal_website_link: String,
    github_link: String,
    linkedin_link: String,
    twitter_link: String
}, {_id: true});

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
        required: [true, "Please provide a past job end date"]
    },
    past_employment_type: {
        type: String,
        enum: ["Full-time", "Part-time", "Contract", "Internship", "Remote"],
        required: [true, "Please provide a past employment type"]
    },
    past_job_leave_reason: {
        type: String,
        required: true
    },
    past_job_refrence_person: {
        type: String,
        required: [true, "Please provide past job reference"]
    },
    NoticePeriod: {
        type: String,
        required: [true, "Please provide a notice period"]
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
    skills_and_capabilities: {
        type: [String],
        default: []
    },
    resume: String,
    resume_downloadble: {
        type: Boolean,
        default: true
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
    hobbies: {
        type: [String],
        default: []
    },
    emergency_contact_info: {
        type: emergencyContactSchema,
        default: {}
    },
    externalLinks: {
        type: externalLinksSchema,
        default: {}
    },
    passwordResetOtp: {
        type: String,
        select: false
    },
    passwordResetExpire: {
        type: Date,
        select: false
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
