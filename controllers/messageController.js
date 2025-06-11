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
        .sort({ createdAt: -1 });
        
        // Group by conversation partners and jobs
        const conversations = [];
        const conversationMap = new Map();
        
        messages.forEach(message => {
            let partnerId, partnerType, partnerInfo;
            
            if (message.from._id.toString() === userId) {
                partnerId = message.to._id;
                partnerType = message.toModel;
                partnerInfo = message.to;
            } else {
                partnerId = message.from._id;
                partnerType = message.fromModel;
                partnerInfo = message.from;
            }
            
            const conversationKey = `${partnerId}-${message.jobId._id}`;
            
            if (!conversationMap.has(conversationKey)) {
                conversationMap.set(conversationKey, {
                    partnerId: partnerId.toString(),
                    partnerType,
                    partnerInfo: {
                        name: partnerInfo.name || partnerInfo.companyName,
                        email: partnerInfo.email,
                        avatar: partnerInfo.companyLogo || null
                    },
                    jobId: message.jobId._id,
                    jobTitle: message.jobId.jobTitle,
                    lastMessage: {
                        content: message.content,
                        createdAt: message.createdAt,
                        fromModel: message.fromModel,
                        read: message.read
                    },
                    unreadCount: 0
                });
            }
            
            // Count unread messages
            if (!message.read && message.to._id.toString() === userId) {
                const conversation = conversationMap.get(conversationKey);
                conversation.unreadCount++;
            }
        });
        
        const conversationsList = Array.from(conversationMap.values());
        
        res.json({
            success: true,
            conversations: conversationsList
        });
        
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching conversations'
        });
    }
};

// Get conversation history between two users for a specific job
export const getConversationHistory = async (req, res, next) => {
    try {
        const { userId1, userId2, jobId } = req.params;
        
        console.log('Getting conversation history:', {
            userId1,
            userId2, 
            jobId
        });
        
        // Validate job exists
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }
        
        // Find all messages for this job first (for debugging)
        const allJobMessages = await Message.find({ jobId: jobId });
        console.log('All messages for this job:', allJobMessages.length);
        
        // Find messages between the two users for this specific job
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
        .populate('jobId', 'jobTitle')
        .sort({ createdAt: 1 });
        
        console.log('Found messages between users:', messages.length);
        console.log('Messages details:', messages.map(m => ({
            _id: m._id,
            from: m.from,
            to: m.to,
            fromModel: m.fromModel,
            toModel: m.toModel,
            content: m.content.substring(0, 50),
            createdAt: m.createdAt
        })));
        
        res.json({
            success: true,
            messages,
            job: {
                _id: job._id,
                jobTitle: job.jobTitle
            }
        });
        
    } catch (error) {
        console.error('Error fetching conversation history:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching conversation history'
        });
    }
};

// Send a message with validation
export const sendMessage = async (req, res, next) => {
    try {
        const { from, to, content, fromModel, toModel, jobId } = req.body;
        
        // Validate required fields
        if (!from || !to || !content || !fromModel || !toModel || !jobId) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
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
        
        // If sender is a user, validate they have applied for this job
        if (fromModel === 'User') {
            const hasApplied = job.applicants.some(
                applicant => applicant.user.toString() === from
            );
            
            if (!hasApplied) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only message employers for jobs you have applied to'
                });
            }
            
            // Validate the recipient is the job poster
            if (job.postedBy.toString() !== to) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only message the employer who posted this job'
                });
            }
        }
        
        // If sender is an employer, validate they own this job
        if (fromModel === 'Employer') {
            if (job.postedBy.toString() !== from) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only send messages for jobs you have posted'
                });
            }
            
            // Validate the recipient has applied for this job
            const hasApplied = job.applicants.some(
                applicant => applicant.user.toString() === to
            );
            
            if (!hasApplied) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only message users who have applied for your jobs'
                });
            }
        }
        
        // Create and save the message
        const newMessage = new Message({
            from,
            to,
            content,
            fromModel,
            toModel,
            jobId
        });
        
        const savedMessage = await newMessage.save();
        
        // Populate the saved message
        const populatedMessage = await Message.findById(savedMessage._id)
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
            .populate('jobId', 'jobTitle');
        
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
        const { userId, partnerId, jobId } = req.body;
        
        // Mark all messages from partnerId to userId for this job as read
        const result = await Message.updateMany(
            {
                from: partnerId,
                to: userId,
                jobId: jobId,
                read: false
            },
            { read: true }
        );
        
        res.json({
            success: true,
            message: 'Messages marked as read',
            modifiedCount: result.modifiedCount
        });
        
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while marking messages as read'
        });
    }
};

// Get jobs user has applied to (for messaging purposes)
export const getUserAppliedJobs = async (req, res, next) => {
    try {
        const { userId } = req.params;
        
        // Find all jobs where user has applied
        const jobs = await Job.find({
            'applicants.user': userId
        })
        .populate('postedBy', 'companyName email companyLogo')
        .select('jobTitle postedBy applicants');
        
        // Filter to only include jobs where user has applied
        const appliedJobs = jobs.map(job => {
            const userApplication = job.applicants.find(
                applicant => applicant.user.toString() === userId
            );
            
            return {
                _id: job._id,
                jobTitle: job.jobTitle,
                employer: job.postedBy,
                applicationStatus: userApplication?.status,
                appliedOn: userApplication?.appliedOn
            };
        });
        
        res.json({
            success: true,
            jobs: appliedJobs
        });
        
    } catch (error) {
        console.error('Error fetching applied jobs:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching applied jobs'
        });
    }
};

// Get employer's conversations (enhanced version for employers)
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
                { from: userId, fromModel: 'Employer' },
                { to: userId, toModel: 'Employer' }
            ]
        })
        .populate('jobId', 'jobTitle')
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
        .sort({ createdAt: -1 });
        
        // Group by conversation partners and jobs
        const conversations = [];
        const conversationMap = new Map();
        
        messages.forEach(message => {
            let partnerId, partnerType, partnerInfo;
            
            if (message.from._id.toString() === userId) {
                partnerId = message.to._id;
                partnerType = message.toModel;
                partnerInfo = message.to;
            } else {
                partnerId = message.from._id;
                partnerType = message.fromModel;
                partnerInfo = message.from;
            }
            
            const conversationKey = `${partnerId}-${message.jobId._id}`;
            
            if (!conversationMap.has(conversationKey)) {
                conversationMap.set(conversationKey, {
                    partnerId: partnerId.toString(),
                    partnerType,
                    partnerInfo: {
                        name: partnerInfo.name || partnerInfo.companyName,
                        email: partnerInfo.email,
                        avatar: partnerInfo.companyLogo || null
                    },
                    jobId: message.jobId._id,
                    jobTitle: message.jobId.jobTitle,
                    lastMessage: {
                        content: message.content,
                        createdAt: message.createdAt,
                        fromModel: message.fromModel,
                        read: message.read
                    },
                    unreadCount: 0
                });
            }
            
            // Count unread messages
            if (!message.read && message.to._id.toString() === userId) {
                const conversation = conversationMap.get(conversationKey);
                conversation.unreadCount++;
            }
        });
        
        const conversationsList = Array.from(conversationMap.values());
        
        res.json({
            success: true,
            conversations: conversationsList
        });
        
    } catch (error) {
        console.error('Error fetching employer conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching conversations'
        });
    }
};

// Mark all messages as read for a user
export const markAllMessagesAsRead = async (req, res, next) => {
    try {
        const { userId } = req.params;
        
        // Mark all messages to this user as read
        const result = await Message.updateMany(
            {
                to: userId,
                read: false
            },
            { read: true }
        );
        
        res.json({
            success: true,
            message: 'All messages marked as read',
            modifiedCount: result.modifiedCount
        });
        
    } catch (error) {
        console.error('Error marking all messages as read:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while marking messages as read'
        });
    }
};

// Get unread message count for a user
export const getUnreadMessageCount = async (req, res, next) => {
    try {
        const { userId } = req.params;
        
        const unreadCount = await Message.countDocuments({
            to: userId,
            read: false
        });
        
        res.json({
            success: true,
            unreadCount
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
        const limit = parseInt(req.query.limit) || 10;
        
        const recentMessages = await Message.find({
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
        .limit(limit);
        
        res.json({
            success: true,
            messages: recentMessages
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
        
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
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