
// DEPLOYMENT TIMESTAMP: 2025-07-27T05:26:22.655Z - Force redeploy for notification system fix
import Message from '../models/Message.model.js';
import User from '../models/User.js';
import Job from '../models/Job.model.js';

class SystemMessageService {
    /**
     * Send job notification messages to best-fit candidates
     * @param {Object} job - The job object
     * @param {Array} matchedUsers - Array of matched users with scores
     * @param {Object} options - Configuration options
     */
    async sendJobNotificationMessages(job, matchedUsers, options = {}) {
        const {
            maxMessages = 20, // Maximum number of messages to send
            minScore = 30, // Minimum match score to send message
            messageTemplate = null // Custom message template
        } = options;

        try {
            console.log(`🔔 Sending job notification messages to best-fit candidates for job: ${job.jobTitle}`);
            console.log(`📊 Total matched users: ${matchedUsers.length}`);
            console.log(`🎯 Minimum score threshold: ${minScore}`);
            console.log(`📝 Maximum messages to send: ${maxMessages}`);

            // Filter users by minimum score and limit to max messages
            const qualifiedUsers = matchedUsers
                .filter(match => match.score >= minScore)
                .slice(0, maxMessages);

            console.log(`✅ Qualified users for messaging: ${qualifiedUsers.length}`);

            if (qualifiedUsers.length === 0) {
                console.log('⚠️ No qualified users found for job notification messages');
                return {
                    success: true,
                    sentCount: 0,
                    totalCount: 0,
                    details: []
                };
            }

            const results = [];
            const messages = [];

            for (const match of qualifiedUsers) {
                const user = match.user;
                const matchScore = match.score;
                const matchDetails = match.matchDetails || [];

                try {
                    // Create system message for this user
                    const messageData = this.createJobNotificationMessage(job, user, matchScore, matchDetails, messageTemplate);
                    
                    const systemMessage = new Message({
                        from: null, // System message has no sender
                        to: user._id,
                        fromModel: 'System',
                        toModel: 'User',
                        content: messageData.content,
                        jobId: job._id,
                        messageType: 'job_notification',
                        isSystemMessage: true,
                        isVisible: false, // Hidden until user replies
                        requiresReply: true,
                        systemMessageData: {
                            jobTitle: job.jobTitle,
                            companyName: job.postedBy?.companyName || job.companyName,
                            matchScore: matchScore,
                            matchReasons: matchDetails,
                            actionUrl: `/job-details/${job._id}`
                        }
                    });

                    await systemMessage.save();
                    messages.push(systemMessage);

                    results.push({
                        userId: user._id,
                        userEmail: user.email,
                        userName: user.name,
                        matchScore: matchScore,
                        messageId: systemMessage._id,
                        success: true
                    });

                    console.log(`✅ System message sent to ${user.name} (${user.email}) - Score: ${matchScore}`);

                } catch (error) {
                    console.error(`❌ Failed to send system message to ${user.name} (${user.email}):`, error);
                    results.push({
                        userId: user._id,
                        userEmail: user.email,
                        userName: user.name,
                        matchScore: matchScore,
                        success: false,
                        error: error.message
                    });
                }
            }

            console.log(`🎉 Job notification messages completed:`);
            console.log(`   ✅ Successfully sent: ${results.filter(r => r.success).length}`);
            console.log(`   ❌ Failed: ${results.filter(r => !r.success).length}`);

            return {
                success: true,
                sentCount: results.filter(r => r.success).length,
                totalCount: qualifiedUsers.length,
                details: results
            };

        } catch (error) {
            console.error('❌ Error sending job notification messages:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create job notification message content
     */
    createJobNotificationMessage(job, user, matchScore, matchDetails, customTemplate = null) {
        const companyName = job.postedBy?.companyName || job.companyName;
        const jobTitle = job.jobTitle;
        const jobLocation = job.jobLocation;
        const workType = job.workType;
        const salaryRange = job.from && job.to ? 
            `${job.currency || 'AUD'} ${job.from.toLocaleString()} - ${job.to.toLocaleString()}` : 
            'Competitive salary';

        // Use custom template if provided, otherwise use default
        if (customTemplate) {
            return {
                content: customTemplate
                    .replace('{{userName}}', user.name)
                    .replace('{{jobTitle}}', jobTitle)
                    .replace('{{companyName}}', companyName)
                    .replace('{{jobLocation}}', jobLocation)
                    .replace('{{workType}}', workType)
                    .replace('{{salaryRange}}', salaryRange)
                    .replace('{{matchScore}}', matchScore)
                    .replace('{{matchReasons}}', matchDetails.join(', '))
            };
        }

        // Default message template
        const content = `🎯 Perfect Match Alert!

Hi ${user.name},

We found a job that perfectly matches your profile and skills!

💼 **${jobTitle}** at **${companyName}**
📍 Location: ${jobLocation}
💼 Work Type: ${workType}
💰 Salary: ${salaryRange}
🎯 Match Score: ${matchScore}%

This opportunity aligns with your skills and preferences. Would you like to learn more about this position?

Reply to this message to express your interest and we'll connect you with the employer!`;

        return { content };
    }

    /**
     * Get system messages for a user (hidden until replied)
     */
    async getUserSystemMessages(userId, options = {}) {
        const {
            includeReplied = false,
            limit = 50,
            skip = 0
        } = options;

        try {
            const query = {
                to: userId,
                isSystemMessage: true
            };

            // Only include replied messages if requested
            if (!includeReplied) {
                query.hasReplied = false;
            }

            console.log('🔍 Debug: Query for system messages:', query);

            const messages = await Message.find(query)
                .populate('jobId', 'jobTitle companyName jobLocation workType')
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip);

            console.log('🔍 Debug: Found messages:', messages.length);

            return {
                success: true,
                messages,
                count: messages.length
            };

        } catch (error) {
            console.error('Error getting user system messages:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Make a system message visible when user replies
     */
    async makeMessageVisible(messageId, userId) {
        try {
            const message = await Message.findOne({
                _id: messageId,
                to: userId,
                isSystemMessage: true
            });

            if (!message) {
                return {
                    success: false,
                    error: 'Message not found'
                };
            }

            await message.makeVisible();

            return {
                success: true,
                message: 'Message made visible successfully'
            };

        } catch (error) {
            console.error('Error making message visible:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Mark a system message as replied
     */
    async markMessageAsReplied(messageId, userId) {
        try {
            const message = await Message.findOne({
                _id: messageId,
                to: userId,
                isSystemMessage: true
            });

            if (!message) {
                return {
                    success: false,
                    error: 'Message not found'
                };
            }

            await message.markAsReplied();

            return {
                success: true,
                message: 'Message marked as replied successfully'
            };

        } catch (error) {
            console.error('Error marking message as replied:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Reply to a system message (creates a new message from user to employer)
     */
    async replyToSystemMessage(messageId, userId, content) {
        try {
            // Find the system message
            const systemMessage = await Message.findOne({
                _id: messageId,
                to: userId,
                fromModel: 'System',
                isSystemMessage: true
            });

            if (!systemMessage) {
                return {
                    success: false,
                    error: 'System message not found'
                };
            }

            // Mark the system message as replied and make it visible
            await systemMessage.markAsReplied();
            await systemMessage.makeVisible();

            // Create a new message from the user to the employer
            const userMessage = new Message({
                from: userId,
                to: systemMessage.jobId, // The job ID, which will be used to find the employer
                fromModel: 'User',
                toModel: 'Employer',
                content: content,
                jobId: systemMessage.jobId,
                messageType: 'application_message',
                isSystemMessage: false,
                isVisible: true,
                requiresReply: false
            });

            await userMessage.save();

            return {
                success: true,
                data: userMessage,
                systemMessageUpdated: true,
                message: 'Reply sent successfully'
            };

        } catch (error) {
            console.error('Error replying to system message:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get system message statistics
     */
    async getSystemMessageStats() {
        try {
            const stats = await Message.aggregate([
                {
                    $match: {
                        fromModel: 'System',
                        isSystemMessage: true
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalMessages: { $sum: 1 },
                        visibleMessages: {
                            $sum: { $cond: ['$isVisible', 1, 0] }
                        },
                        repliedMessages: {
                            $sum: { $cond: ['$hasReplied', 1, 0] }
                        },
                        avgMatchScore: { $avg: '$systemMessageData.matchScore' }
                    }
                }
            ]);

            return {
                success: true,
                stats: stats[0] || {
                    totalMessages: 0,
                    visibleMessages: 0,
                    repliedMessages: 0,
                    avgMatchScore: 0
                }
            };

        } catch (error) {
            console.error('Error getting system message stats:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Create singleton instance
const systemMessageService = new SystemMessageService();
export default systemMessageService; 