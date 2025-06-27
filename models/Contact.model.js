import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        trim: true,
        lowercase: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email address'
        ]
    },
    company: {
        type: String,
        trim: true,
        maxlength: [200, 'Company name cannot exceed 200 characters']
    },
    subject: {
        type: String,
        required: [true, 'Subject is required'],
        enum: {
            values: ['general', 'pricing', 'technical', 'partnership', 'feedback', 'demo', 'enterprise'],
            message: 'Please select a valid subject'
        }
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxlength: [2000, 'Message cannot exceed 2000 characters']
    },
    status: {
        type: String,
        enum: ['new', 'in-progress', 'resolved', 'closed'],
        default: 'new'
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    assignedTo: {
        type: String,
        default: null
    },
    responseCount: {
        type: Number,
        default: 0
    },
    lastResponseDate: {
        type: Date,
        default: null
    },
    // Track source and user agent for analytics
    source: {
        type: String,
        default: 'web'
    },
    userAgent: {
        type: String,
        default: null
    },
    ipAddress: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Index for efficient queries
contactSchema.index({ email: 1, createdAt: -1 });
contactSchema.index({ status: 1, priority: -1, createdAt: -1 });
contactSchema.index({ subject: 1, createdAt: -1 });

// Pre-save middleware to set priority based on subject
contactSchema.pre('save', function(next) {
    if (this.isNew) {
        // Set priority based on subject
        switch (this.subject) {
            case 'technical':
                this.priority = 'high';
                break;
            case 'enterprise':
            case 'partnership':
                this.priority = 'high';
                break;
            case 'pricing':
            case 'demo':
                this.priority = 'medium';
                break;
            default:
                this.priority = 'medium';
        }
    }
    next();
});

// Instance method to mark as resolved
contactSchema.methods.markAsResolved = function() {
    this.status = 'resolved';
    this.lastResponseDate = new Date();
    return this.save();
};

// Static method to get contact stats
contactSchema.statics.getContactStats = function() {
    return this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$count' },
                statuses: {
                    $push: {
                        status: '$_id',
                        count: '$count'
                    }
                }
            }
        }
    ]);
};

const Contact = mongoose.model('Contact', contactSchema);

export default Contact; 