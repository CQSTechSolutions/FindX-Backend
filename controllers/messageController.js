import mongoose from 'mongoose';
import User from '../models/User.js';
import Employer from '../models/employer.model.js';
import Job from '../models/Job.model.js';

// Create a new Message model
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
        required: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
    },
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

const Message = mongoose.model('Message', messageSchema);

// @desc    Send a message
// @route   POST /api/messages/send
// @access  Private
export const sendMessage = async (req, res) => {
    try {
        const { from, to, content, jobId } = req.body;
        
        if (!from || !to || !content) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        // Determine the from and to models
        let fromModel, toModel;
        
        // Check if from is an employer
        const employer = await Employer.findById(from);
        if (employer) {
            fromModel = 'Employer';
            toModel = 'User';
        } else {
            // From is a user
            fromModel = 'User';
            toModel = 'Employer';
        }
        
        // Create the message
        const message = await Message.create({
            from,
            to,
            fromModel,
            toModel,
            content,
            jobId
        });
        
        return res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            messageId: message._id
        });
    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send message'
        });
    }
};

// @desc    Get messages between an employer and a user
// @route   GET /api/messages/:employerId/:userId
// @access  Private
export const getMessagesBetweenUsers = async (req, res) => {
    try {
        const { employerId, userId } = req.params;
        
        // Validate IDs
        if (!mongoose.Types.ObjectId.isValid(employerId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user or employer ID'
            });
        }
        
        // Find all messages between the employer and user
        const messages = await Message.find({
            $or: [
                { from: employerId, to: userId, fromModel: 'Employer', toModel: 'User' },
                { from: userId, to: employerId, fromModel: 'User', toModel: 'Employer' }
            ]
        }).sort({ createdAt: 1 });
        
        return res.status(200).json({
            success: true,
            messages
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch messages'
        });
    }
};

// @desc    Get all conversations for a user
// @route   GET /api/messages/conversations/:userId
// @access  Private
export const getUserConversations = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Validate user ID
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }
        
        // Find all messages sent by or to the user
        const messages = await Message.find({
            $or: [
                { from: userId, fromModel: 'User' },
                { to: userId, toModel: 'User' }
            ]
        }).sort({ createdAt: -1 });
        
        // Extract unique employer IDs
        const employerIds = new Set();
        const conversationMap = new Map();
        
        // Process messages to get unique conversations
        for (const message of messages) {
            let employerId;
            
            if (message.fromModel === 'Employer') {
                employerId = message.from;
            } else if (message.toModel === 'Employer') {
                employerId = message.to;
            }
            
            if (employerId && !conversationMap.has(employerId.toString())) {
                employerIds.add(employerId);
                conversationMap.set(employerId.toString(), {
                    lastMessage: message.content,
                    lastMessageDate: message.createdAt,
                    jobId: message.jobId
                });
            }
        }
        
        // Get employer details
        const employers = await Employer.find({
            _id: { $in: Array.from(employerIds) }
        });
        
        // Format conversations
        const conversations = await Promise.all(
            employers.map(async (employer) => {
                const conversationData = conversationMap.get(employer._id.toString());
                let jobTitle;
                
                if (conversationData.jobId) {
                    try {
                        const job = await Job.findById(conversationData.jobId);
                        jobTitle = job?.jobTitle;
                    } catch (error) {
                        console.error('Error finding job:', error);
                    }
                }
                
                return {
                    _id: employer._id,
                    companyName: employer.companyName,
                    companyLogo: employer.companyLogo,
                    jobTitle: jobTitle,
                    jobId: conversationData.jobId,
                    lastMessage: conversationData.lastMessage,
                    lastMessageDate: conversationData.lastMessageDate
                };
            })
        );
        
        return res.status(200).json({
            success: true,
            conversations
        });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch conversations'
        });
    }
}; 