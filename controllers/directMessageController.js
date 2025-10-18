import DirectMessage from '../models/DirectMessage.model.js';
import Employer from '../models/employer.model.js';
import User from '../models/User.js';
import Notification from '../models/Notification.model.js';

// Constants
const DIRECT_MESSAGE_LIMIT = 5;

// Get employer's direct message subscription status and quota
export const getSubscriptionStatus = async (req, res) => {
    try {
        const employerId = req.employer.id;
        
        const employer = await Employer.findById(employerId).select(
            'hasDirectMessageSubscription directMessagesSentCount directMessageSubscriptionDate directMessageSubscriptionExpiryDate'
        );
        
        if (!employer) {
            return res.status(404).json({
                success: false,
                message: 'Employer not found'
            });
        }
        
        const remainingMessages = employer.hasDirectMessageSubscription 
            ? Math.max(0, DIRECT_MESSAGE_LIMIT - employer.directMessagesSentCount)
            : 0;
        
        res.status(200).json({
            success: true,
            data: {
                hasSubscription: employer.hasDirectMessageSubscription,
                messagesSent: employer.directMessagesSentCount,
                remainingMessages,
                messageLimit: DIRECT_MESSAGE_LIMIT,
                subscriptionDate: employer.directMessageSubscriptionDate,
                expiryDate: employer.directMessageSubscriptionExpiryDate
            }
        });
    } catch (error) {
        console.error('Error getting subscription status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Send direct message to candidate
export const sendDirectMessage = async (req, res) => {
    try {
        const employerId = req.employer.id;
        const { candidateId, message } = req.body;
        
        if (!candidateId || !message) {
            return res.status(400).json({
                success: false,
                message: 'Candidate ID and message are required'
            });
        }
        
        // Get employer and check subscription status
        const employer = await Employer.findById(employerId);
        if (!employer) {
            return res.status(404).json({
                success: false,
                message: 'Employer not found'
            });
        }
        
        // Check if employer has subscription
        if (!employer.hasDirectMessageSubscription) {
            return res.status(403).json({
                success: false,
                message: 'Direct messaging subscription required'
            });
        }
        
        // Check message limit
        if (employer.directMessagesSentCount >= DIRECT_MESSAGE_LIMIT) {
            return res.status(403).json({
                success: false,
                message: 'Direct message limit reached. Please upgrade your subscription.'
            });
        }
        
        // Verify candidate exists
        const candidate = await User.findById(candidateId);
        if (!candidate) {
            return res.status(404).json({
                success: false,
                message: 'Candidate not found'
            });
        }
        
        // Generate conversation ID
        const conversationId = DirectMessage.generateConversationId(employerId, candidateId);
        
        // Check if this is the first message in this conversation
        const existingMessages = await DirectMessage.countDocuments({ conversationId });
        const isInitialContact = existingMessages === 0;
        
        // Create the direct message
        const directMessage = new DirectMessage({
            employer: employerId,
            candidate: candidateId,
            message: message.trim(),
            sender: 'employer',
            messageType: 'direct',
            conversationId,
            isInitialContact
        });
        
        await directMessage.save();
        
        // If this is initial contact, increment the employer's sent count and create notification
        if (isInitialContact) {
            await Employer.findByIdAndUpdate(employerId, {
                $inc: { directMessagesSentCount: 1 }
            });
            
            // Create notification for candidate
            const notification = new Notification({
                userId: candidateId,
                type: 'direct_message',
                title: 'New Direct Message',
                message: `${employer.companyName} wants to connect with you directly`,
                priority: 'medium',
                actionUrl: `/messages/direct/${conversationId}`,
                metadata: {
                    employerId,
                    conversationId
                }
            });
            
            await notification.save();
        }
        
        // Populate the message for response
        await directMessage.populate([
            { path: 'employer', select: 'companyName EmployerName EmployerDesignation companyLogo' },
            { path: 'candidate', select: 'firstName lastName email profilePicture' }
        ]);
        
        res.status(201).json({
            success: true,
            message: 'Direct message sent successfully',
            data: directMessage
        });
        
    } catch (error) {
        console.error('Error sending direct message:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get conversation between employer and candidate
export const getConversation = async (req, res) => {
    try {
        const employerId = req.employer.id;
        const { candidateId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        
        if (!candidateId) {
            return res.status(400).json({
                success: false,
                message: 'Candidate ID is required'
            });
        }
        
        const messages = await DirectMessage.getConversation(employerId, candidateId, page, limit);
        
        // Mark messages from candidate as read
        await DirectMessage.markAsRead(
            DirectMessage.generateConversationId(employerId, candidateId),
            'employer'
        );
        
        res.status(200).json({
            success: true,
            data: messages
        });
        
    } catch (error) {
        console.error('Error getting conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get all conversations for employer
export const getEmployerConversations = async (req, res) => {
    try {
        const employerId = req.employer.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Get unique conversations with latest message
        const conversations = await DirectMessage.aggregate([
            { $match: { employer: employerId } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$conversationId',
                    latestMessage: { $first: '$$ROOT' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$sender', 'candidate'] }, { $eq: ['$isRead', false] }] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { 'latestMessage.createdAt': -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'latestMessage.candidate',
                    foreignField: '_id',
                    as: 'candidate'
                }
            },
            {
                $lookup: {
                    from: 'employers',
                    localField: 'latestMessage.employer',
                    foreignField: '_id',
                    as: 'employer'
                }
            }
        ]);
        
        res.status(200).json({
            success: true,
            data: conversations
        });
        
    } catch (error) {
        console.error('Error getting employer conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update subscription status (for admin or payment processing)
export const updateSubscriptionStatus = async (req, res) => {
    try {
        const { employerId } = req.params;
        const { hasSubscription, resetCount = false } = req.body;
        
        const updateData = {
            hasDirectMessageSubscription: hasSubscription
        };
        
        if (hasSubscription) {
            updateData.directMessageSubscriptionDate = new Date();
            // Set expiry to 30 days from now (adjust as needed)
            updateData.directMessageSubscriptionExpiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        } else {
            updateData.directMessageSubscriptionDate = null;
            updateData.directMessageSubscriptionExpiryDate = null;
        }
        
        if (resetCount) {
            updateData.directMessagesSentCount = 0;
        }
        
        const employer = await Employer.findByIdAndUpdate(
            employerId,
            updateData,
            { new: true }
        ).select('hasDirectMessageSubscription directMessagesSentCount directMessageSubscriptionDate directMessageSubscriptionExpiryDate');
        
        if (!employer) {
            return res.status(404).json({
                success: false,
                message: 'Employer not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Subscription status updated successfully',
            data: employer
        });
        
    } catch (error) {
        console.error('Error updating subscription status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Reset message count (for subscription renewal)
export const resetMessageCount = async (req, res) => {
    try {
        const employerId = req.employer.id;
        
        const employer = await Employer.findByIdAndUpdate(
            employerId,
            { directMessagesSentCount: 0 },
            { new: true }
        ).select('directMessagesSentCount');
        
        if (!employer) {
            return res.status(404).json({
                success: false,
                message: 'Employer not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Message count reset successfully',
            data: { directMessagesSentCount: employer.directMessagesSentCount }
        });
        
    } catch (error) {
        console.error('Error resetting message count:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};