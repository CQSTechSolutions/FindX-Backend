import mongoose from "mongoose";

// Individual message schema for better structure and performance
const messageSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    senderId: {
        type: String,
        required: true,
        index: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    messageType: {
        type: String,
        enum: ['text', 'system'],
        default: 'text'
    }
}, {
    _id: true,
    timestamps: false // We're using custom timestamp field
});

// Main conversation schema
const directMessageSchema = new mongoose.Schema({
    // Participants in the conversation
    participants: {
        employer: {
            type: String,
            required: true,
            index: true
        },
        candidate: {
            type: String,
            required: true,
            index: true
        }
    },
    
    // Messages array with embedded message documents
    messages: [messageSchema],
    
    // Conversation metadata
    lastMessage: {
        content: String,
        senderId: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    },
    
    // Message counts for quick access
    messageCount: {
        total: {
            type: Number,
            default: 0
        },
        unreadByEmployer: {
            type: Number,
            default: 0
        },
        unreadByCandidate: {
            type: Number,
            default: 0
        }
    },
    
    // Conversation status
    status: {
        type: String,
        enum: ['active', 'archived', 'blocked'],
        default: 'active',
        index: true
    },
    
    // Track initial contact for subscription counting
    isInitialContact: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    // Optimize for read operations
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound indexes for optimal query performance
directMessageSchema.index({ 
    'participants.employer': 1, 
    'participants.candidate': 1 
}, { unique: true });

directMessageSchema.index({ 
    'participants.employer': 1, 
    'lastMessage.timestamp': -1 
});

directMessageSchema.index({ 
    'participants.candidate': 1, 
    'lastMessage.timestamp': -1 
});

directMessageSchema.index({ 
    status: 1, 
    'lastMessage.timestamp': -1 
});

// Index for message queries within conversations
directMessageSchema.index({ 
    'messages.timestamp': -1 
});

directMessageSchema.index({ 
    'messages.isRead': 1,
    'messages.senderId': 1 
});

// Virtual for getting conversation partner
directMessageSchema.virtual('conversationPartner').get(function() {
    return {
        employer: this.participants.employer,
        candidate: this.participants.candidate
    };
});

// Instance method to add a message
directMessageSchema.methods.addMessage = function(content, senderId, messageType = 'text') {
    const message = {
        content: content.trim(),
        senderId,
        timestamp: new Date(),
        isRead: false,
        messageType
    };
    
    this.messages.push(message);
    
    // Update last message
    this.lastMessage = {
        content: message.content,
        senderId: message.senderId,
        timestamp: message.timestamp
    };
    
    // Update message counts
    this.messageCount.total += 1;
    
    // Update unread counts
    if (senderId === this.participants.employer) {
        this.messageCount.unreadByCandidate += 1;
    } else {
        this.messageCount.unreadByEmployer += 1;
    }
    
    return message;
};

// Instance method to mark messages as read
directMessageSchema.methods.markMessagesAsRead = function(readerId) {
    let markedCount = 0;
    
    this.messages.forEach(message => {
        if (!message.isRead && message.senderId !== readerId) {
            message.isRead = true;
            markedCount += 1;
        }
    });
    
    // Update unread counts
    if (readerId === this.participants.employer) {
        this.messageCount.unreadByEmployer = 0;
    } else {
        this.messageCount.unreadByCandidate = 0;
    }
    
    return markedCount;
};

// Static method to find conversation between two users
directMessageSchema.statics.findConversation = function(employerId, candidateId) {
    return this.findOne({
        'participants.employer': employerId,
        'participants.candidate': candidateId
    });
};

// Static method to get employer conversations with pagination
directMessageSchema.statics.getEmployerConversations = function(employerId, options = {}) {
    const { page = 1, limit = 20, status = 'active' } = options;
    const skip = (page - 1) * limit;
    
    return this.find({
        'participants.employer': employerId,
        status
    })
    .sort({ 'lastMessage.timestamp': -1 })
    .skip(skip)
    .limit(limit)
    .select('-messages') // Exclude messages for list view
    .lean();
};

// Static method to get candidate conversations
directMessageSchema.statics.getCandidateConversations = function(candidateId, options = {}) {
    const { page = 1, limit = 20, status = 'active' } = options;
    const skip = (page - 1) * limit;
    
    return this.find({
        'participants.candidate': candidateId,
        status
    })
    .sort({ 'lastMessage.timestamp': -1 })
    .skip(skip)
    .limit(limit)
    .select('-messages') // Exclude messages for list view
    .lean();
};

const DirectMessage = mongoose.model("DirectMessage", directMessageSchema);

export default DirectMessage;