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
        
        // Check if conversation already exists between employer and candidate
        let existingConversation = await DirectMessage.findOne({
            $or: [
                { senderId: employerId, receiverId: candidateId },
                { senderId: candidateId, receiverId: employerId }
            ]
        });
        
        const isInitialContact = !existingConversation;
        
        if (existingConversation) {
            // Add message to existing conversation
            if (existingConversation.senderId === employerId) {
                // Employer is sender, add to senderMessageContent
                existingConversation.senderMessageContent.push(message.trim());
            } else {
                // Employer is receiver, add to receiverMessageContent
                existingConversation.receiverMessageContent.push(message.trim());
            }
            await existingConversation.save();
        } else {
            // Create new conversation with employer as sender
            existingConversation = new DirectMessage({
                senderId: employerId,
                receiverId: candidateId,
                senderMessageContent: [message.trim()],
                receiverMessageContent: []
            });
            await existingConversation.save();
        }
        
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
                actionUrl: `/messages/direct/${existingConversation._id}`,
                metadata: {
                    employerId,
                    conversationId: existingConversation._id
                }
            });
            
            await notification.save();
        }
        
        res.status(201).json({
            success: true,
            message: 'Direct message sent successfully',
            data: {
                conversationId: existingConversation._id,
                senderId: employerId,
                receiverId: candidateId,
                message: message.trim(),
                isInitialContact
            }
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
        
        if (!candidateId) {
            return res.status(400).json({
                success: false,
                message: 'Candidate ID is required'
            });
        }
        
        // Find conversation between employer and candidate
        const conversation = await DirectMessage.findOne({
            $or: [
                { senderId: employerId, receiverId: candidateId },
                { senderId: candidateId, receiverId: employerId }
            ]
        });
        
        if (!conversation) {
            return res.status(200).json({
                success: true,
                data: {
                    conversationId: null,
                    messages: [],
                    participants: {
                        employer: employerId,
                        candidate: candidateId
                    }
                }
            });
        }
        
        // Get participant details
        const [employer, candidate] = await Promise.all([
            Employer.findById(employerId).select('companyName EmployerName EmployerDesignation companyLogo'),
            User.findById(candidateId).select('firstName lastName email profilePicture')
        ]);
        
        // Format messages for response
        const messages = [];
        const isEmployerSender = conversation.senderId === employerId;
        
        // Add sender messages (from employer's perspective)
        if (isEmployerSender) {
            conversation.senderMessageContent.forEach((msg, index) => {
                messages.push({
                    id: `sender_${index}`,
                    content: msg,
                    sender: 'employer',
                    senderId: employerId,
                    timestamp: conversation.createdAt // Using conversation creation time as base
                });
            });
            
            // Add receiver messages (candidate messages)
            conversation.receiverMessageContent.forEach((msg, index) => {
                messages.push({
                    id: `receiver_${index}`,
                    content: msg,
                    sender: 'candidate',
                    senderId: candidateId,
                    timestamp: conversation.updatedAt // Using conversation update time as base
                });
            });
        } else {
            // Employer is receiver, so sender messages are from candidate
            conversation.senderMessageContent.forEach((msg, index) => {
                messages.push({
                    id: `sender_${index}`,
                    content: msg,
                    sender: 'candidate',
                    senderId: candidateId,
                    timestamp: conversation.createdAt
                });
            });
            
            // Add receiver messages (employer messages)
            conversation.receiverMessageContent.forEach((msg, index) => {
                messages.push({
                    id: `receiver_${index}`,
                    content: msg,
                    sender: 'employer',
                    senderId: employerId,
                    timestamp: conversation.updatedAt
                });
            });
        }
        
        // Sort messages by timestamp (though they'll be in order anyway)
        messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        res.status(200).json({
            success: true,
            data: {
                conversationId: conversation._id,
                messages,
                participants: {
                    employer: {
                        id: employerId,
                        ...employer?.toObject()
                    },
                    candidate: {
                        id: candidateId,
                        ...candidate?.toObject()
                    }
                }
            }
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
        
        // Find all conversations where employer is either sender or receiver
        const conversations = await DirectMessage.find({
            $or: [
                { senderId: employerId },
                { receiverId: employerId }
            ]
        })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit);
        
        if (!conversations.length) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }
        
        // Get all unique candidate IDs
        const candidateIds = conversations.map(conv => 
            conv.senderId === employerId ? conv.receiverId : conv.senderId
        );
        
        // Get candidate details
        const candidates = await User.find({
            _id: { $in: candidateIds }
        }).select('firstName lastName email profilePicture');
        
        // Create a map for quick candidate lookup
        const candidateMap = candidates.reduce((map, candidate) => {
            map[candidate._id.toString()] = candidate;
            return map;
        }, {});
        
        // Format conversations for response
        const formattedConversations = conversations.map(conversation => {
            const isEmployerSender = conversation.senderId === employerId;
            const candidateId = isEmployerSender ? conversation.receiverId : conversation.senderId;
            const candidate = candidateMap[candidateId];
            
            // Get the latest message
            let latestMessage = '';
            let latestMessageSender = '';
            
            if (isEmployerSender) {
                // Check which array has the most recent message
                const senderMessages = conversation.senderMessageContent || [];
                const receiverMessages = conversation.receiverMessageContent || [];
                
                if (senderMessages.length > 0 && receiverMessages.length > 0) {
                    // Use updated timestamp to determine latest
                    latestMessage = senderMessages[senderMessages.length - 1];
                    latestMessageSender = 'employer';
                } else if (senderMessages.length > 0) {
                    latestMessage = senderMessages[senderMessages.length - 1];
                    latestMessageSender = 'employer';
                } else if (receiverMessages.length > 0) {
                    latestMessage = receiverMessages[receiverMessages.length - 1];
                    latestMessageSender = 'candidate';
                }
            } else {
                // Employer is receiver
                const senderMessages = conversation.senderMessageContent || [];
                const receiverMessages = conversation.receiverMessageContent || [];
                
                if (senderMessages.length > 0 && receiverMessages.length > 0) {
                    latestMessage = receiverMessages[receiverMessages.length - 1];
                    latestMessageSender = 'employer';
                } else if (receiverMessages.length > 0) {
                    latestMessage = receiverMessages[receiverMessages.length - 1];
                    latestMessageSender = 'employer';
                } else if (senderMessages.length > 0) {
                    latestMessage = senderMessages[senderMessages.length - 1];
                    latestMessageSender = 'candidate';
                }
            }
            
            return {
                conversationId: conversation._id,
                candidate: {
                    id: candidateId,
                    firstName: candidate?.firstName || '',
                    lastName: candidate?.lastName || '',
                    email: candidate?.email || '',
                    profilePicture: candidate?.profilePicture || ''
                },
                latestMessage: {
                    content: latestMessage,
                    sender: latestMessageSender,
                    timestamp: conversation.updatedAt
                },
                messageCount: {
                    total: (conversation.senderMessageContent?.length || 0) + (conversation.receiverMessageContent?.length || 0),
                    fromEmployer: isEmployerSender ? (conversation.senderMessageContent?.length || 0) : (conversation.receiverMessageContent?.length || 0),
                    fromCandidate: isEmployerSender ? (conversation.receiverMessageContent?.length || 0) : (conversation.senderMessageContent?.length || 0)
                },
                lastActivity: conversation.updatedAt
            };
        });
        
        res.status(200).json({
            success: true,
            data: formattedConversations
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

// Send reply from candidate to employer
export const sendCandidateReply = async (req, res) => {
    try {
        const candidateId = req.user.id; // Assuming candidate auth middleware sets req.user
        const { employerId, message } = req.body;
        
        if (!employerId || !message) {
            return res.status(400).json({
                success: false,
                message: 'Employer ID and message are required'
            });
        }
        
        // Verify employer exists
        const employer = await Employer.findById(employerId);
        if (!employer) {
            return res.status(404).json({
                success: false,
                message: 'Employer not found'
            });
        }
        
        // Find existing conversation
        let conversation = await DirectMessage.findOne({
            $or: [
                { senderId: employerId, receiverId: candidateId },
                { senderId: candidateId, receiverId: employerId }
            ]
        });
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'No existing conversation found. Employer must initiate contact first.'
            });
        }
        
        // Add candidate's reply to the appropriate array
        if (conversation.senderId === candidateId) {
            // Candidate is sender, add to senderMessageContent
            conversation.senderMessageContent.push(message.trim());
        } else {
            // Candidate is receiver, add to receiverMessageContent
            conversation.receiverMessageContent.push(message.trim());
        }
        
        await conversation.save();
        
        res.status(201).json({
            success: true,
            message: 'Reply sent successfully',
            data: {
                conversationId: conversation._id,
                senderId: candidateId,
                receiverId: employerId,
                message: message.trim()
            }
        });
        
    } catch (error) {
        console.error('Error sending candidate reply:', error);
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