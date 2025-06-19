import mongoose from 'mongoose';

const interviewInvitationSchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    employerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employer',
        required: true
    },
    applicantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    applicationId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true // Reference to the application in job.applicants
    },
    
    // Interview Details
    interviewDetails: {
        date: {
            type: Date,
            required: true
        },
        time: {
            type: String,
            required: true
        },
        duration: {
            type: Number, // Duration in minutes
            default: 60
        },
        location: {
            type: String,
            required: true
        },
        interviewType: {
            type: String,
            enum: ['in-person', 'video-call', 'phone-call'],
            default: 'video-call'
        },
        meetingLink: String, // For video calls
        contactNumber: String, // For phone calls
        notes: String,
        requirements: [String] // Things to bring/prepare
    },
    
    // Status and Response
    status: {
        type: String,
        enum: ['pending', 'accepted', 'declined', 'reschedule_requested', 'rescheduled', 'completed', 'cancelled'],
        default: 'pending'
    },
    
    // Applicant Response
    applicantResponse: {
        respondedAt: Date,
        message: String, // Optional message from applicant
        rescheduleReason: String, // If requesting reschedule
        suggestedTimes: [{
            date: Date,
            time: String,
            notes: String
        }]
    },
    
    // Employer Response to Reschedule
    employerResponse: {
        respondedAt: Date,
        message: String,
        acceptedSuggestedTime: {
            date: Date,
            time: String
        }
    },
    
    // Notifications
    notifications: {
        invitationSent: {
            type: Boolean,
            default: false
        },
        reminderSent: {
            type: Boolean,
            default: false
        },
        responseSent: {
            type: Boolean,
            default: false
        }
    },
    
    // Metadata
    originalInvitationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InterviewInvitation' // For tracking rescheduled interviews
    },
    isRescheduled: {
        type: Boolean,
        default: false
    },
    
    // Feedback (post-interview)
    feedback: {
        employerFeedback: {
            rating: {
                type: Number,
                min: 1,
                max: 5
            },
            comments: String,
            decision: {
                type: String,
                enum: ['hire', 'reject', 'next_round', 'pending']
            }
        },
        applicantFeedback: {
            rating: {
                type: Number,
                min: 1,
                max: 5
            },
            comments: String,
            experience: {
                type: String,
                enum: ['excellent', 'good', 'average', 'poor']
            }
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better performance
interviewInvitationSchema.index({ jobId: 1, applicantId: 1 });
interviewInvitationSchema.index({ employerId: 1, status: 1 });
interviewInvitationSchema.index({ applicantId: 1, status: 1 });
interviewInvitationSchema.index({ 'interviewDetails.date': 1 });

// Virtual to populate job details
interviewInvitationSchema.virtual('job', {
    ref: 'Job',
    localField: 'jobId',
    foreignField: '_id',
    justOne: true
});

// Virtual to populate employer details
interviewInvitationSchema.virtual('employer', {
    ref: 'Employer',
    localField: 'employerId',
    foreignField: '_id',
    justOne: true
});

// Virtual to populate applicant details
interviewInvitationSchema.virtual('applicant', {
    ref: 'User',
    localField: 'applicantId',
    foreignField: '_id',
    justOne: true
});

// Method to check if interview is upcoming
interviewInvitationSchema.methods.isUpcoming = function() {
    const now = new Date();
    const interviewDateTime = new Date(this.interviewDetails.date);
    return interviewDateTime > now && this.status === 'accepted';
};

// Method to check if interview is overdue
interviewInvitationSchema.methods.isOverdue = function() {
    const now = new Date();
    const interviewDateTime = new Date(this.interviewDetails.date);
    return interviewDateTime < now && this.status === 'pending';
};

// Static method to get upcoming interviews for a user
interviewInvitationSchema.statics.getUpcomingInterviews = function(userId, userType = 'applicant') {
    const query = userType === 'applicant' 
        ? { applicantId: userId, status: 'accepted' }
        : { employerId: userId, status: 'accepted' };
    
    return this.find(query)
        .populate('job', 'jobTitle companyName')
        .populate('employer', 'companyName')
        .populate('applicant', 'name email')
        .sort({ 'interviewDetails.date': 1 });
};

const InterviewInvitation = mongoose.model('InterviewInvitation', interviewInvitationSchema);

export default InterviewInvitation; 