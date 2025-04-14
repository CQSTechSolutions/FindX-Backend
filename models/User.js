import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false
  },
  isProfileCompleted: {
    type: Boolean,
    required: [true, 'Provide Update Flag'],
    default: false
  },
  savedJobs: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Job',
    default: []
  },
  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
    required: false
  },
  preferred_pronouns: {
    type: String,
    enum: ["He/Him", "She/Her", "They/Them"],
    required: false
  },
  nationality: {
    type: String,
    required: false
  },
  resident_country: {
    type: String,
    required: false
  },
  known_language: {
    type: [String],
    required: false,
    default: []
  },
  preferred_time_zone: {
    type: String,
    required: false,
    default: 'UTC'
  },
  highest_qualification: {
    type: String,
    enum: ["High School", "Bachelors", "Masters", "PhD"],
    required: false
  },
  achievements: {
    type: [String],
    required: false,
    default: []
  },
  skills_and_capabilities: {
    type: [String],
    required: false,
    default: []
  },
  resume: {
    type: String,
    required: false
  },
  resume_downloadble: {
    type: Boolean,
    default: true,
    required: [true, "Please provide a resume download flag"]
  },
  cover_letter: {
    type: String,
    required: false
  },
  work_history: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'WorkHistory',
    required: false,
    default: []
  },
  education: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Education',
    required: false,
    default: []
  },
  dream_job_title: {
    type: String,
    required: false
  },
  preferred_job_types: {
    type: [String],
    enum: ["Full-time", "Part-time", "Contract", "Internship"],
    required: false,
    default: []
  },
  work_env_preferences: {
    type: [String],
    enum: ["Startup", "Corporate", "NGO", "Freelance", "Remote"],
    required: false,
    default: []
  },
  preferred_locations: {
    type: [String],
    required: false,
    default: []
  },
  video_intro: {
    type: String,
    required: false
  },
  willing_to_relocate: {
    type: Boolean,
    required: false,
    default: false
  },
  willing_to_travel: {
    type: Boolean,
    required: false,
    default: false
  },
  preferred_interview_mode: {
    type: String,
    enum: ["In-person", "On-Call"],
  },
  personal_branding_statement: {
    type: String,
    required: false
  },
  hobbies: {
    type: [String],
    required: false,
    default: []
  },
  emergency_contact_number: {
    type: String,
    required: false
  },
  emergency_contact_name: {
    type: String,
    required: false
  },
  emergency_contact_relationship: {
    type: String,
    required: false
  },
  profile_link: {
    type: String,
    required: false
  },
  github_link: {
    type: String,
    required: false
  },
  linkedIn_link: {
    type: String,
    required: false
  },
  passwordResetOtp: {
    type: String,
    select: false
  },
  passwordResetExpire: {
    type: Date,
    select: false
  }
},{timestamps: true});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User; 