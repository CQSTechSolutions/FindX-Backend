import mongoose from "mongoose";

const directMessageSchema = new mongoose.Schema({
    employer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employer',
        required: true
    },
    candidate: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    sender: {
        type: String,
        enum: ['employer', 'candidate'],
        required: true
    },
    messageType: {
        type: String,
        enum: ['direct', 'application'],
        default: 'direct',
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    conversationId: {
        type: String,
        required: true,
        index: true
    },
    // For tracking if this is the initial contact message
    isInitialContact: {
        type: Boolean,
        default: false
    },
    // Reference to job if this becomes an application-related message later
    relatedJob: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: false
    }
}, { 
    timestamps: true,
    // Add indexes for better query performance
    indexes: [
        { employer: 1, candidate: 1 },
        { conversationId: 1 },
        { createdAt: -1 }
    ]
});

// Generate conversation ID based on employer and candidate IDs
directMessageSchema.statics.generateConversationId = function(employerId, candidateId) {
    return `dm_${employerId}_${candidateId}`;
};

// Method to mark messages as read
directMessageSchema.statics.markAsRead = async function(conversationId, userType) {
    const query = { conversationId };
    if (userType === 'employer') {
        query.sender = 'candidate';
    } else {
        query.sender = 'employer';
    }
    
    return this.updateMany(query, { isRead: true });
};

// Get conversation between employer and candidate
directMessageSchema.statics.getConversation = async function(employerId, candidateId, page = 1, limit = 50) {
    const conversationId = this.generateConversationId(employerId, candidateId);
    const skip = (page - 1) * limit;
    
    return this.find({ conversationId })
        .populate('employer', 'companyName EmployerName EmployerDesignation companyLogo')
        .populate('candidate', 'firstName lastName email profilePicture')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
};

const DirectMessage = mongoose.model("DirectMessage", directMessageSchema);

export default DirectMessage;