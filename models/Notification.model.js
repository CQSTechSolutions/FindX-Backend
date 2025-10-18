import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['job_match', 'application_update', 'interview_invitation', 'profile_completion', 'promotion', 'general', 'direct_message'],
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    read: {
        type: Boolean,
        default: false
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    actionUrl: {
        type: String,
        trim: true
    },
    metadata: {
        jobId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Job'
        },
        employerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employer'
        },
        applicationId: {
            type: mongoose.Schema.Types.ObjectId
        },
        interviewId: {
            type: mongoose.Schema.Types.ObjectId
        }
    },
    expiresAt: {
        type: Date,
        default: function() {
            // Notifications expire after 30 days
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index for better query performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to maintain 50 notification limit per user
notificationSchema.pre('save', async function(next) {
    if (this.isNew) {
        try {
            // Count existing notifications for this user
            const count = await this.constructor.countDocuments({ userId: this.userId });
            
            // If we're at or exceeding the limit, remove the oldest notifications
            if (count >= 50) {
                const notificationsToRemove = count - 49; // Keep 49 + the new one = 50
                
                // Find and remove the oldest notifications
                const oldestNotifications = await this.constructor
                    .find({ userId: this.userId })
                    .sort({ createdAt: 1 })
                    .limit(notificationsToRemove)
                    .select('_id');
                
                if (oldestNotifications.length > 0) {
                    const idsToRemove = oldestNotifications.map(n => n._id);
                    await this.constructor.deleteMany({ _id: { $in: idsToRemove } });
                    
                    console.log(`Removed ${oldestNotifications.length} old notifications for user ${this.userId}`);
                }
            }
        } catch (error) {
            console.error('Error in notification pre-save middleware:', error);
        }
    }
    next();
});

// Static method to create notification and handle limit
notificationSchema.statics.createNotification = async function(notificationData) {
    try {
        // Create the notification
        const notification = new this(notificationData);
        await notification.save();
        
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

// Static method to get user notifications with pagination
notificationSchema.statics.getUserNotifications = async function(userId, page = 1, limit = 20) {
    try {
        const skip = (page - 1) * limit;
        
        const notifications = await this.find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate(
            "metadata.jobId",
            "jobTitle companyName jobLocation salaryRange workType"
          )
          .populate(
            "metadata.employerId",
            "companyName companyIndustry companyWebsite"
          );
        
        const total = await this.countDocuments({ userId });
        
        return {
            notifications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1
            }
        };
    } catch (error) {
        console.error('Error getting user notifications:', error);
        throw error;
    }
};

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = async function(userId, notificationIds = null) {
    try {
        const query = { userId };
        if (notificationIds) {
            query._id = { $in: notificationIds };
        }
        
        const result = await this.updateMany(query, { read: true });
        return result;
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        throw error;
    }
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
    try {
        return await this.countDocuments({ userId, read: false });
    } catch (error) {
        console.error('Error getting unread count:', error);
        throw error;
    }
};

// Static method to delete expired notifications
notificationSchema.statics.cleanupExpired = async function() {
    try {
        const result = await this.deleteMany({ expiresAt: { $lt: new Date() } });
        console.log(`Cleaned up ${result.deletedCount} expired notifications`);
        return result;
    } catch (error) {
        console.error('Error cleaning up expired notifications:', error);
        throw error;
    }
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
