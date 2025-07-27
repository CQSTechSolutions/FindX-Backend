import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        required: function() {
            // Allow null for system messages
            return !this.isSystemMessage;
        },
        refPath: 'fromModel'
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'toModel'
    },
    fromModel: {
        type: String,
        required: true,
        enum: ['User', 'Employer', 'System']
    },
    toModel: {
        type: String,
        required: true,
        enum: ['User', 'Employer']
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true // Making this required to ensure messages are always job-related
    },
    read: {
        type: Boolean,
        default: false
    },
    messageType: {
        type: String,
        enum: ['application_message', 'interview_invite', 'general', 'job_notification', 'system_notification'],
        default: 'general'
    },
    // New fields for system messages and visibility control
    isSystemMessage: {
        type: Boolean,
        default: false
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    requiresReply: {
        type: Boolean,
        default: false
    },
    systemMessageData: {
        jobTitle: String,
        companyName: String,
        matchScore: Number,
        matchReasons: [String],
        actionUrl: String
    },
    // Track when user first interacts with the message
    firstInteractionAt: {
        type: Date,
        default: null
    },
    // Track if user has replied to this system message
    hasReplied: {
        type: Boolean,
        default: false
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index for better query performance
messageSchema.index({ from: 1, to: 1, jobId: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ isSystemMessage: 1, isVisible: 1 });
messageSchema.index({ to: 1, hasReplied: 1 });

// Virtual to populate job details
messageSchema.virtual('job', {
    ref: 'Job',
    localField: 'jobId',
    foreignField: '_id',
    justOne: true
});

// Virtual to populate sender details
messageSchema.virtual('sender', {
    ref: function() { return this.fromModel; },
    localField: 'from',
    foreignField: '_id',
    justOne: true
});

// Virtual to populate recipient details
messageSchema.virtual('recipient', {
    ref: function() { return this.toModel; },
    localField: 'to',
    foreignField: '_id',
    justOne: true
});

// Method to make system message visible when user replies
messageSchema.methods.makeVisible = function() {
    this.isVisible = true;
    this.firstInteractionAt = new Date();
    return this.save();
};

// Method to mark as replied
messageSchema.methods.markAsReplied = function() {
    this.hasReplied = true;
    this.firstInteractionAt = this.firstInteractionAt || new Date();
    return this.save();
};

const Message = mongoose.model('Message', messageSchema);

export default Message; 