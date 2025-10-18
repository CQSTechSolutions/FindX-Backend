import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
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
        enum: ['User', 'Employer']
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
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    messageType: {
        type: String,
        enum: ['application_message', 'interview_invite', 'general'],
        default: 'general'
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index for better query performance
messageSchema.index({ from: 1, to: 1, jobId: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ to: 1, isRead: 1 });

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

const Message = mongoose.model('Message', messageSchema);

export default Message; 