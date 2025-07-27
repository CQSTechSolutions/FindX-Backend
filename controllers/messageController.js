import Message from '../models/Message.model.js';
import Job from '../models/Job.model.js';
import User from '../models/User.js';
import Employer from '../models/employer.model.js';

// Validate if user can message employer for a specific job
export const validateMessagingPermission = async (req, res, next) => {
    try {
        const { userId, employerId, jobId, userType } = req.body;
        
        if (userType === 'User') {
            // Check if user has applied for this job
            const job = await Job.findById(jobId);
            if (!job) {
                return res.status(404).json({
                    success: false,
                    message: 'Job not found'
                });
            }
            
            // Check if user has applied for this job
            const hasApplied = job.applicants.some(
                applicant => applicant.user.toString() === userId
            );
            
            if (!hasApplied) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only message employers for jobs you have applied to'
                });
            }
            
            // Check if the employer owns this job
            if (job.postedBy.toString() !== employerId) {
                return res.status(403).json({
                    success: false,
                    message: 'This employer is not associated with this job'
                });
            }
        }
        
        next();
    } catch (error) {
        console.error('Error validating messaging permission:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while validating messaging permission'
        });
    }
};

// Get user's conversations with validation
export const getUserConversations = async (req, res, next) => {
    try {
        const { userId, userType } = req.params;
        
        // Validate user
        if (userType === 'User') {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }
        } else if (userType === 'Employer') {
            const employer = await Employer.findById(userId);
            if (!employer) {
                return res.status(404).json({
                    success: false,
                    message: 'Employer not found'
                });
            }
        }
        
        // Find all conversations involving the user
        const messages = await Message.find({
            $or: [
                { from: userId, fromModel: userType },
                { to: userId, toModel: userType }
            ]
        })
        .populate('jobId', 'jobTitle companyLogo')
        .populate({
            path: 'from',
            refPath: 'fromModel',
            select: 'name email companyName'
        })
        .populate({
            path: 'to',
            refPath: 'toModel',
            select: 'name email companyName'
        })
        .populate({
            path: 'jobId',
            populate: {
                path: 'postedBy',
                model: 'Employer',
                select: 'messagesAllowed companyName'
            }
        })
        .sort({ createdAt: -1 });

        // Group messages by conversation
        const conversations = {};
        messages.forEach(message => {
            const jobId = message.jobId?._id?.toString();
            const otherUserId = message.from?.toString() === userId ? message.to?.toString() : message.from?.toString();
            const conversationKey = `${jobId}-${otherUserId}`;
            
            if (!conversations[conversationKey]) {
                conversations[conversationKey] = {
                    jobId: message.jobId,
                    otherUser: message.from?.toString() === userId ? message.to : message.from,
                    lastMessage: message,
                    unreadCount: 0
                };
            }
            
            // Update unread count
            if (message.to?.toString() === userId && !message.isRead) {
                conversations[conversationKey].unreadCount++;
            }
            
            // Update last message if this one is newer
            if (!conversations[conversationKey].lastMessage || 
                message.createdAt > conversations[conversationKey].lastMessage.createdAt) {
                conversations[conversationKey].lastMessage = message;
            }
        });

        const conversationList = Object.values(conversations).sort((a, b) => 
            b.lastMessage.createdAt - a.lastMessage.createdAt
        );

        res.json({
            success: true,
            conversations: conversationList
        });

    } catch (error) {
        console.error('Error getting user conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting conversations'
        });
    }
};

// Get conversation history between two users for a specific job
export const getConversationHistory = async (req, res, next) => {
    try {
        const { userId1, userId2, jobId } = req.params;
        const { limit = 50, skip = 0 } = req.query;

        // Validate job exists
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        // Find messages between these users for this job
        const messages = await Message.find({
            jobId: jobId,
            $or: [
                { from: userId1, to: userId2 },
                { from: userId2, to: userId1 }
            ]
        })
        .populate({
            path: 'from',
            refPath: 'fromModel',
            select: 'name email companyName'
        })
        .populate({
            path: 'to',
            refPath: 'toModel',
            select: 'name email companyName'
        })
        .populate('jobId', 'jobTitle companyName')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

        res.json({
            success: true,
            messages: messages.reverse(), // Show oldest first
            job: job
        });

    } catch (error) {
        console.error('Error getting conversation history:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting conversation history'
        });
    }
};

// Send a message
export const sendMessage = async (req, res, next) => {
    try {
        const { from, to, fromModel, toModel, content, jobId, messageType = 'application_message' } = req.body;

        // Validate required fields
        if (!from || !to || !fromModel || !toModel || !content || !jobId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Validate job exists
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        // Create new message
        const message = new Message({
            from,
            to,
            fromModel,
            toModel,
            content,
            jobId,
            messageType,
            isRead: false
        });

        await message.save();

        // Populate the message
        const populatedMessage = await Message.findById(message._id)
            .populate({
                path: 'from',
                refPath: 'fromModel',
                select: 'name email companyName'
            })
            .populate({
                path: 'to',
                refPath: 'toModel',
                select: 'name email companyName'
            })
            .populate('jobId', 'jobTitle companyName');

        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            data: populatedMessage
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while sending message'
        });
    }
};

// Mark messages as read
export const markMessagesAsRead = async (req, res, next) => {
    try {
        const { messageIds, userId } = req.body;

        if (!messageIds || !Array.isArray(messageIds) || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Message IDs array and user ID are required'
            });
        }

        await Message.updateMany(
            { _id: { $in: messageIds }, to: userId },
            { isRead: true }
        );

        res.json({
            success: true,
            message: 'Messages marked as read'
        });

    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while marking messages as read'
        });
    }
};

// Get jobs that user has applied to (for messaging)
export const getUserAppliedJobs = async (req, res, next) => {
    try {
        const { userId } = req.params;

        // Find jobs where user has applied
        const jobs = await Job.find({
            'applicants.user': userId
        })
        .populate('postedBy', 'companyName email')
        .select('jobTitle companyName postedBy createdAt')
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            jobs: jobs
        });

    } catch (error) {
        console.error('Error getting user applied jobs:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting applied jobs'
        });
    }
};

// Get employer's conversations
export const getEmployerConversations = async (req, res, next) => {
    try {
        const { userId, userType } = req.params;
        
        // Validate employer
        const employer = await Employer.findById(userId);
        if (!employer) {
            return res.status(404).json({
                success: false,
                message: 'Employer not found'
            });
        }
        
        // Find all conversations involving the employer
        const messages = await Message.find({
            $or: [
                { from: userId, fromModel: userType },
                { to: userId, toModel: userType }
            ]
        })
        .populate('jobId', 'jobTitle companyLogo')
        .populate({
            path: 'from',
            refPath: 'fromModel',
            select: 'name email companyName'
        })
        .populate({
            path: 'to',
            refPath: 'toModel',
            select: 'name email companyName'
        })
        .populate({
            path: 'jobId',
            populate: {
                path: 'postedBy',
                model: 'Employer',
                select: 'messagesAllowed companyName'
            }
        })
        .sort({ createdAt: -1 });

        // Group messages by conversation
        const conversations = {};
        messages.forEach(message => {
            const jobId = message.jobId?._id?.toString();
            const otherUserId = message.from?.toString() === userId ? message.to?.toString() : message.from?.toString();
            const conversationKey = `${jobId}-${otherUserId}`;
            
            if (!conversations[conversationKey]) {
                conversations[conversationKey] = {
                    jobId: message.jobId,
                    otherUser: message.from?.toString() === userId ? message.to : message.from,
                    lastMessage: message,
                    unreadCount: 0
                };
            }
            
            // Update unread count
            if (message.to?.toString() === userId && !message.isRead) {
                conversations[conversationKey].unreadCount++;
            }
            
            // Update last message if this one is newer
            if (!conversations[conversationKey].lastMessage || 
                message.createdAt > conversations[conversationKey].lastMessage.createdAt) {
                conversations[conversationKey].lastMessage = message;
            }
        });

        const conversationList = Object.values(conversations).sort((a, b) => 
            b.lastMessage.createdAt - a.lastMessage.createdAt
        );

        res.json({
            success: true,
            conversations: conversationList
        });

    } catch (error) {
        console.error('Error getting employer conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting conversations'
        });
    }
};

// Mark all messages as read for a user
export const markAllMessagesAsRead = async (req, res, next) => {
    try {
        const { userId } = req.params;

        await Message.updateMany(
            { to: userId, isRead: false },
            { isRead: true }
        );

        res.json({
            success: true,
            message: 'All messages marked as read'
        });

    } catch (error) {
        console.error('Error marking all messages as read:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while marking messages as read'
        });
    }
};

// Get unread message count
export const getUnreadMessageCount = async (req, res, next) => {
    try {
        const { userId } = req.params;

        const count = await Message.countDocuments({
            to: userId,
            isRead: false
        });

        res.json({
            success: true,
            count: count
        });

    } catch (error) {
        console.error('Error getting unread message count:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting unread count'
        });
    }
};

// Get recent messages for a user
export const getRecentMessages = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { limit = 10 } = req.query;

        const messages = await Message.find({
            $or: [
                { from: userId },
                { to: userId }
            ]
        })
        .populate({
            path: 'from',
            refPath: 'fromModel',
            select: 'name email companyName'
        })
        .populate({
            path: 'to',
            refPath: 'toModel',
            select: 'name email companyName'
        })
        .populate('jobId', 'jobTitle')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

        res.json({
            success: true,
            messages: messages
        });

    } catch (error) {
        console.error('Error getting recent messages:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting recent messages'
        });
    }
};

// Delete a message
export const deleteMessage = async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const { userId } = req.body;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Only allow deletion by the sender
        if (message.from.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You can only delete your own messages'
            });
        }

        await Message.findByIdAndDelete(messageId);

        res.json({
            success: true,
            message: 'Message deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting message'
        });
    }
};

// Get user messages with pagination
export const getUserMessages = async (req, res, next) => {
    try {
        const { limit = 20, skip = 0, jobId } = req.query;
        const userId = req.user._id;

        let query = {
            $or: [
                { from: userId },
                { to: userId }
            ]
        };

        if (jobId) {
            query.jobId = jobId;
        }

        const messages = await Message.find(query)
            .populate({
                path: 'from',
                refPath: 'fromModel',
                select: 'name email companyName'
            })
            .populate({
                path: 'to',
                refPath: 'toModel',
                select: 'name email companyName'
            })
            .populate('jobId', 'jobTitle companyName')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const total = await Message.countDocuments(query);

        res.json({
            success: true,
            messages: messages,
            total: total,
            hasMore: total > parseInt(skip) + messages.length
        });

    } catch (error) {
        console.error('Error getting user messages:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting messages'
        });
    }
};

// Mark a specific message as read
export const markMessageAsRead = async (req, res, next) => {
    try {
        const { messageId } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        // Only mark as read if user is the recipient
        if (message.to.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You can only mark messages sent to you as read'
            });
        }

        message.isRead = true;
        await message.save();

        res.json({
            success: true,
            message: 'Message marked as read'
        });

    } catch (error) {
        console.error('Error marking message as read:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while marking message as read'
        });
    }
};

// Get user's unread message count
export const getUserUnreadMessageCount = async (req, res, next) => {
    try {
        const userId = req.user._id;

        const count = await Message.countDocuments({
            to: userId,
            isRead: false
        });

        res.json({
            success: true,
            count: count
        });

    } catch (error) {
        console.error('Error getting user unread message count:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while getting unread count'
        });
    }
}; 