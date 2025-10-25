import DirectMessage from '../models/DirectMessage.model.js';
import Employer from '../models/employer.model.js';
import User from '../models/User.js';
import Notification from '../models/Notification.model.js';
import MessagingSubscription from '../models/MessagingSubscription.model.js';
import mongoose from 'mongoose';

// Constants
const DIRECT_MESSAGE_LIMIT = 5; // Pack limit for direct messages

// Get employer's direct message subscription status and quota
export const getSubscriptionStatus = async (req, res) => {
    try {
        const employerId = req.employer.id;
        
        // Get the unified messaging subscription
        const subscription = await MessagingSubscription.findOne({ 
            employerId: employerId 
        });
        
        const employer = await Employer.findById(employerId).select(
            'hasDirectMessageSubscription directMessagesSentCount directMessageSubscriptionDate directMessageSubscriptionExpiryDate messagingSubscription'
        );
        
        if (!employer) {
            return res.status(404).json({
                success: false,
                message: 'Employer not found'
            });
        }

        // Use unified subscription if available, otherwise fall back to legacy system
        let hasActiveSubscription = false;
        let messagesUsed = 0;
        let messagesRemaining = 0;
        let subscriptionDate = null;
        let expiryDate = null;

        if (subscription) {
            // Use unified MessagingSubscription system
            hasActiveSubscription = subscription.isActive;
            messagesUsed = DIRECT_MESSAGE_LIMIT - subscription.remainingContacts;
            messagesRemaining = subscription.remainingContacts;
            subscriptionDate = subscription.purchaseDate;
            // MessagingSubscription doesn't have expiry date - it's based on usage
        } else {
            // Fall back to legacy direct message system
            hasActiveSubscription = employer.hasDirectMessageSubscription && 
                (!employer.directMessageSubscriptionExpiryDate || 
                 new Date() < employer.directMessageSubscriptionExpiryDate);
            messagesUsed = employer.directMessagesSentCount || 0;
            messagesRemaining = Math.max(0, DIRECT_MESSAGE_LIMIT - messagesUsed);
            subscriptionDate = employer.directMessageSubscriptionDate;
            expiryDate = employer.directMessageSubscriptionExpiryDate;
        }
        
        res.status(200).json({
            success: true,
            data: {
                hasActiveSubscription,
                messagesUsed,
                messagesRemaining,
                totalMessages: DIRECT_MESSAGE_LIMIT,
                subscriptionDate,
                expiryDate,
                usingUnifiedSystem: !!subscription
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
        const { candidateId, message, messageType = 'text' } = req.body;
        
        if (!candidateId || !message) {
            return res.status(400).json({
                success: false,
                message: 'Candidate ID and message are required'
            });
        }
        
        // Get employer and unified subscription
        const employer = await Employer.findById(employerId);
        if (!employer) {
            return res.status(404).json({
                success: false,
                message: 'Employer not found'
            });
        }

        // Get the unified messaging subscription
        const subscription = await MessagingSubscription.findOne({ 
            employerId: employerId 
        });
        
        // Check subscription status using unified system or legacy fallback
        let hasActiveSubscription = false;
        let remainingContacts = 0;

        if (subscription) {
            // Use unified MessagingSubscription system
            hasActiveSubscription = subscription.isActive;
            remainingContacts = subscription.remainingContacts;
        } else {
            // Fall back to legacy direct message system
            hasActiveSubscription = employer.hasDirectMessageSubscription && 
                (!employer.directMessageSubscriptionExpiryDate || 
                 new Date() < employer.directMessageSubscriptionExpiryDate);
            remainingContacts = hasActiveSubscription ?
                Math.max(0, DIRECT_MESSAGE_LIMIT - (employer.directMessagesSentCount || 0)) : 0;
        }
        
        // Check if employer has active subscription
        if (!hasActiveSubscription) {
            return res.status(403).json({
                success: false,
                message: 'Direct messaging subscription required'
            });
        }
        
        // Check message limit
        if (remainingContacts <= 0) {
            return res.status(403).json({
                success: false,
                message: 'Direct message limit reached (5). Purchase another pack to continue.'
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
        
        // Check if conversation already exists using the new static method
        let conversation = await DirectMessage.findConversation(employerId, candidateId);
        
        const isInitialContact = !conversation;
        
        if (conversation) {
            // Add message to existing conversation using the new instance method
            conversation.addMessage(message.trim(), employerId, messageType);
            await conversation.save();
        } else {
            // Create new conversation with optimized structure
            conversation = new DirectMessage({
                participants: {
                    employer: employerId,
                    candidate: candidateId
                },
                messages: [{
                    content: message.trim(),
                    senderId: employerId,
                    messageType,
                    timestamp: new Date(),
                    isRead: false
                }],
                lastMessage: {
                    content: message.trim(),
                    senderId: employerId,
                    timestamp: new Date()
                },
                messageCount: {
                    total: 1,
                    unreadByEmployer: 0,
                    unreadByCandidate: 1
                },
                status: 'active',
                isInitialContact: true
            });
            await conversation.save();
        }
        
        // If this is initial contact, decrement remaining contacts and create notification
        if (isInitialContact) {
            if (subscription) {
                // Use unified MessagingSubscription system
                await MessagingSubscription.findByIdAndUpdate(subscription._id, {
                    $inc: { remainingContacts: -1 },
                    $addToSet: { contactedUsers: { userId: candidateId } }
                });

                await Employer.findByIdAndUpdate(employerId, {
                    $inc: { directMessagesSentCount: 1 }
                });
            }
            
            // Create notification for candidate
            const notification = new Notification({
                userId: candidateId,
                type: 'direct_message',
                title: 'New Direct Message',
                message: `${employer.companyName} wants to connect with you directly`,
                priority: 'medium',
                actionUrl: `/messages/direct/${conversation._id}`,
                metadata: {
                    employerId,
                    conversationId: conversation._id
                }
            });
            
            await notification.save();
        }
        
        res.status(201).json({
            success: true,
            message: 'Direct message sent successfully',
            data: {
                conversationId: conversation._id,
                senderId: employerId,
                receiverId: candidateId,
                message: message.trim(),
                messageType,
                timestamp: new Date(),
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        
        if (!candidateId) {
            return res.status(400).json({
                success: false,
                message: 'Candidate ID is required'
            });
        }
        
        // Find conversation using the new static method
        const conversation = await DirectMessage.findConversation(employerId, candidateId);
        
        if (!conversation) {
            return res.status(200).json({
                success: true,
                data: {
                    conversationId: null,
                    messages: [],
                    participants: {
                        employer: employerId,
                        candidate: candidateId
                    },
                    pagination: {
                        page,
                        limit,
                        total: 0,
                        totalPages: 0
                    }
                }
            });
        }
        
        // Get participant details
        const [employer, candidate] = await Promise.all([
            Employer.findById(employerId).select('companyName EmployerName EmployerDesignation companyLogo'),
            User.findById(candidateId).select('firstName lastName email profilePicture')
        ]);
        
        // Calculate pagination for messages
        const totalMessages = conversation.messages.length;
        const totalPages = Math.ceil(totalMessages / limit);
        const skip = (page - 1) * limit;
        
        // Get paginated messages (most recent first)
        const paginatedMessages = conversation.messages
            .slice()
            .reverse() // Most recent first
            .slice(skip, skip + limit)
            .reverse(); // Back to chronological order for display
        
        // Format messages for response
        const messages = paginatedMessages.map((msg, index) => ({
            id: msg._id,
            content: msg.content,
            senderId: msg.senderId,
            sender: msg.senderId.toString() === employerId ? 'employer' : 'candidate',
            messageType: msg.messageType,
            timestamp: msg.timestamp,
            isRead: msg.isRead
        }));
        
        // Mark messages as read for the employer
        await conversation.markMessagesAsRead(employerId);
        await conversation.save();
        
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
                },
                lastMessage: conversation.lastMessage,
                messageCount: conversation.messageCount,
                status: conversation.status,
                pagination: {
                    page,
                    limit,
                    total: totalMessages,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
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
        const status = 'active';

        // Fetch conversations and total count
        const [conversations, total] = await Promise.all([
            DirectMessage.getEmployerConversations(employerId, { page, limit, status }),
            DirectMessage.countDocuments({ 'participants.employer': employerId, status })
        ]);

        if (!conversations.length) {
            return res.status(200).json({
                success: true,
                data: [],
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                }
            });
        }
        
        // Get all unique candidate IDs
        const candidateIds = conversations.map(conv => conv.participants.candidate);
        
        console.log('Candidate IDs from conversations:', candidateIds);
        console.log('Candidate ID types:', candidateIds.map(id => typeof id));
        
        // Convert string IDs to ObjectIds if needed
        const objectIdCandidateIds = candidateIds.map(id => {
            if (typeof id === 'string') {
                return new mongoose.Types.ObjectId(id);
            }
            return id;
        });
        
        console.log('Converted candidate IDs:', objectIdCandidateIds);
        
        // Get candidate details
        const candidates = await User.find({
            _id: { $in: objectIdCandidateIds }
        }).select('name email');
        
        console.log('Found candidates:', candidates);
        console.log('Candidate IDs:', candidateIds);
        
        // Create a map for quick candidate lookup
        const candidateMap = candidates.reduce((map, candidate) => {
            // Map both string and ObjectId versions for lookup
            map[candidate._id.toString()] = candidate;
            map[candidate._id] = candidate;
            return map;
        }, {});
        
        console.log('Candidate map:', candidateMap);
        
        // Format conversations for response
        const formattedConversations = conversations.map(conversation => {
            const candidateId = conversation.participants.candidate;
            const candidate = candidateMap[candidateId.toString()];
            
            const formattedConv = {
                conversationId: conversation._id,
                candidate: {
                    id: candidateId,
                    name: candidate?.name || '',
                    email: candidate?.email || '',
                },
                lastMessage: {
                    content: conversation.lastMessage?.content || '',
                    senderId: conversation.lastMessage?.senderId || '',
                    sender: conversation.lastMessage?.senderId && conversation.lastMessage.senderId.toString() === employerId ? 'employer' : 'candidate',
                    timestamp: conversation.lastMessage?.timestamp || conversation.updatedAt
                },
                messageCount: conversation.messageCount,
                status: conversation.status,
                isInitialContact: conversation.isInitialContact,
                lastActivity: conversation.updatedAt
            };
            
            console.log(`Formatted conversation for candidate ${candidateId}:`, formattedConv);
            return formattedConv;
        });
        
        const totalPages = Math.ceil(total / limit) || 1;
        res.status(200).json({
            success: true,
            data: formattedConversations,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
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
        const candidateId = req.user._id; // Using full user object now
        const { employerId, message, messageType = 'text' } = req.body;
        
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
        
        // Find existing conversation using the new static method
        let conversation = await DirectMessage.findConversation(employerId, candidateId);
        
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'No existing conversation found. Employer must initiate contact first.'
            });
        }
        
        // Add candidate's reply using the new instance method (content, senderId, messageType)
        await conversation.addMessage(message.trim(), candidateId, messageType);
        
        res.status(201).json({
            success: true,
            message: 'Reply sent successfully',
            data: {
                conversationId: conversation._id,
                senderId: candidateId,
                receiverId: employerId,
                message: message.trim(),
                messageType,
                timestamp: new Date()
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
        
        // Get the unified messaging subscription
        const subscription = await MessagingSubscription.findOne({ 
            employerId: employerId 
        });
        
        if (subscription) {
            // Reset using unified MessagingSubscription system
            await MessagingSubscription.findByIdAndUpdate(subscription._id, {
                remainingContacts: DIRECT_MESSAGE_LIMIT,
                contactedUsers: []
            });
            
            res.status(200).json({
                success: true,
                message: 'Message count reset successfully (unified system)',
                data: { 
                    remainingContacts: DIRECT_MESSAGE_LIMIT,
                    usingUnifiedSystem: true
                }
            });
        } else {
            // Fall back to legacy system
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
                message: 'Message count reset successfully (legacy system)',
                data: { 
                    directMessagesSentCount: employer.directMessagesSentCount,
                    usingUnifiedSystem: false
                }
            });
        }
        
    } catch (error) {
        console.error('Error resetting message count:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get all conversations for candidate
export const getCandidateConversations = async (req, res) => {
    try {
        const candidateId = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = 'active';

        // Fetch conversations and total count
        const [conversations, total] = await Promise.all([
            DirectMessage.getCandidateConversations(candidateId, { page, limit, status }),
            DirectMessage.countDocuments({ 'participants.candidate': candidateId, status })
        ]);

        if (!conversations.length) {
            return res.status(200).json({
                success: true,
                data: [],
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false
                }
            });
        }
        
        // Get all unique employer IDs
        const employerIds = conversations.map(conv => conv.participants.employer);
        
        // Convert string IDs to ObjectIds if needed
        const objectIdEmployerIds = employerIds.map(id => {
            if (typeof id === 'string') {
                return new mongoose.Types.ObjectId(id);
            }
            return id;
        });
        
        // Get employer details
        const employers = await Employer.find({
            _id: { $in: objectIdEmployerIds }
        }).select('companyName EmployerName EmployerDesignation companyLogo');
        
        // Create a map for quick employer lookup
        const employerMap = employers.reduce((map, employer) => {
            map[employer._id.toString()] = employer;
            map[employer._id] = employer;
            return map;
        }, {});
        
        // Format conversations for response
        const formattedConversations = conversations.map(conversation => {
            const employerId = conversation.participants.employer;
            const employer = employerMap[employerId.toString()];
            
            return {
                conversationId: conversation._id,
                employer: {
                    id: employerId,
                    name: employer?.companyName || employer?.EmployerName || '',
                    email: employer?.email || '',
                    avatar: employer?.companyLogo || '',
                    designation: employer?.EmployerDesignation || ''
                },
                lastMessage: {
                    content: conversation.lastMessage?.content || '',
                    senderId: conversation.lastMessage?.senderId || '',
                    sender: conversation.lastMessage?.senderId && conversation.lastMessage.senderId.toString() === candidateId ? 'candidate' : 'employer',
                    timestamp: conversation.lastMessage?.timestamp || conversation.updatedAt
                },
                messageCount: conversation.messageCount,
                status: conversation.status,
                isInitialContact: conversation.isInitialContact,
                lastActivity: conversation.updatedAt
            };
        });
        
        const totalPages = Math.ceil(total / limit) || 1;
        res.status(200).json({
            success: true,
            data: formattedConversations,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('Error getting candidate conversations:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get conversation between candidate and employer
export const getCandidateConversation = async (req, res) => {
    try {
        const candidateId = req.user._id;
        const { employerId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        
        if (!employerId) {
            return res.status(400).json({
                success: false,
                message: 'Employer ID is required'
            });
        }
        
        // Find conversation using the new static method
        const conversation = await DirectMessage.findConversation(employerId, candidateId);
        
        if (!conversation) {
            return res.status(200).json({
                success: true,
                data: {
                    conversationId: null,
                    messages: [],
                    participants: {
                        employer: employerId,
                        candidate: candidateId
                    },
                    pagination: {
                        page,
                        limit,
                        total: 0,
                        totalPages: 0
                    }
                }
            });
        }
        
        // Get participant details
        const [employer, candidate] = await Promise.all([
            Employer.findById(employerId).select('companyName EmployerName EmployerDesignation companyLogo'),
            User.findById(candidateId).select('firstName lastName email profilePicture')
        ]);
        
        // Calculate pagination for messages
        const totalMessages = conversation.messages.length;
        const totalPages = Math.ceil(totalMessages / limit);
        const skip = (page - 1) * limit;
        
        // Get paginated messages (most recent first)
        const paginatedMessages = conversation.messages
            .slice()
            .reverse() // Most recent first
            .slice(skip, skip + limit)
            .reverse(); // Back to chronological order for display
        
        // Format messages for response
        const messages = paginatedMessages.map((msg, index) => ({
            id: msg._id,
            content: msg.content,
            senderId: msg.senderId,
            sender: msg.senderId.toString() === candidateId ? 'candidate' : 'employer',
            messageType: msg.messageType,
            timestamp: msg.timestamp,
            isRead: msg.isRead
        }));
        
        // Mark messages as read for the candidate
        await conversation.markMessagesAsRead(candidateId);
        await conversation.save();
        
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
                },
                lastMessage: conversation.lastMessage,
                messageCount: conversation.messageCount,
                status: conversation.status,
                pagination: {
                    page,
                    limit,
                    total: totalMessages,
                    totalPages,
                    hasNext: page < totalPages,
                    hasPrev: page > 1
                }
            }
        });
        
    } catch (error) {
        console.error('Error getting candidate conversation:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};