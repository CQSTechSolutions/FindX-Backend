import InterviewInvitation from '../models/InterviewInvitation.model.js';
import Job from '../models/Job.model.js';
import Message from '../models/Message.model.js';

/**
 * @desc    Send interview invitation to applicant
 * @route   POST /api/interviews/send-invitation
 * @access  Private (Employer only)
 */
export const sendInterviewInvitation = async (req, res, next) => {
    try {
        const {
            jobId,
            applicantId,
            applicationId,
            interviewDetails
        } = req.body;

        // Validate required fields
        if (!jobId || !applicantId || !applicationId || !interviewDetails) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Verify job exists and employer owns it
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        if (job.postedBy.toString() !== req.employer._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to send interview invitations for this job'
            });
        }

        // Verify application exists
        const application = job.applicants.id(applicationId);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        if (application.user.toString() !== applicantId) {
            return res.status(400).json({
                success: false,
                message: 'Application does not match the specified applicant'
            });
        }

        // Check if interview invitation already exists
        const existingInvitation = await InterviewInvitation.findOne({
            jobId,
            applicantId,
            status: { $in: ['pending', 'accepted', 'reschedule_requested'] }
        });

        if (existingInvitation) {
            return res.status(400).json({
                success: false,
                message: 'An active interview invitation already exists for this applicant'
            });
        }

        // Create interview invitation
        const invitation = new InterviewInvitation({
            jobId,
            employerId: req.employer._id,
            applicantId,
            applicationId,
            interviewDetails: {
                date: new Date(interviewDetails.date),
                time: interviewDetails.time,
                duration: interviewDetails.duration || 60,
                location: interviewDetails.location,
                interviewType: interviewDetails.interviewType || 'video-call',
                meetingLink: interviewDetails.meetingLink,
                contactNumber: interviewDetails.contactNumber,
                notes: interviewDetails.notes,
                requirements: interviewDetails.requirements || []
            }
        });

        await invitation.save();

        // Update application status to 'Interview'
        application.status = 'Interview';
        application.interviewDetails = {
            date: interviewDetails.date,
            time: interviewDetails.time,
            location: interviewDetails.location,
            notes: interviewDetails.notes
        };
        await job.save();

        // Send notification message to applicant
        const notificationMessage = new Message({
            from: req.employer._id,
            to: applicantId,
            fromModel: 'Employer',
            toModel: 'User',
            jobId: jobId,
            content: `You have been invited for an interview for the position of ${job.jobTitle}. Please check your interview invitations to respond.`,
            messageType: 'interview_invite'
        });

        await notificationMessage.save();

        // Mark notification as sent
        invitation.notifications.invitationSent = true;
        await invitation.save();

        // Populate the invitation for response
        const populatedInvitation = await InterviewInvitation.findById(invitation._id)
            .populate('job', 'jobTitle companyName')
            .populate('employer', 'companyName email')
            .populate('applicant', 'name email');

        res.status(201).json({
            success: true,
            message: 'Interview invitation sent successfully',
            invitation: populatedInvitation
        });

    } catch (error) {
        console.error('Error sending interview invitation:', error);
        next(error);
    }
};

/**
 * @desc    Get interview invitations for applicant
 * @route   GET /api/interviews/my-invitations
 * @access  Private (User only)
 */
export const getMyInterviewInvitations = async (req, res, next) => {
    try {
        console.log('getMyInterviewInvitations called');
        console.log('User ID:', req.user?.id);
        console.log('Query params:', req.query);
        
        const { status } = req.query;
        
        let query = { applicantId: req.user.id };
        if (status) {
            query.status = status;
        }

        console.log('Database query:', query);

        const invitations = await InterviewInvitation.find(query)
            .populate({
                path: 'jobId',
                select: 'jobTitle companyName jobLocation',
                model: 'Job'
            })
            .populate({
                path: 'employerId',
                select: 'companyName email',
                model: 'Employer'
            })
            .sort({ createdAt: -1 });

        console.log('Found invitations:', invitations.length);

        // Transform the data to match frontend expectations
        const transformedInvitations = invitations.map(invitation => ({
            ...invitation.toObject(),
            job: invitation.jobId, // Map jobId to job for consistency
            employer: invitation.employerId // Map employerId to employer for consistency
        }));

        res.json({
            success: true,
            count: transformedInvitations.length,
            invitations: transformedInvitations
        });

    } catch (error) {
        console.error('Error fetching interview invitations:', error);
        next(error);
    }
};

/**
 * @desc    Get interview invitations sent by employer
 * @route   GET /api/interviews/sent-invitations
 * @access  Private (Employer only)
 */
export const getSentInterviewInvitations = async (req, res, next) => {
    try {
        console.log('getSentInterviewInvitations called');
        console.log('Employer ID:', req.employer?._id);
        
        const { status, jobId } = req.query;
        
        let query = { employerId: req.employer._id };
        if (status) {
            query.status = status;
        }
        if (jobId) {
            query.jobId = jobId;
        }

        console.log('Database query:', query);

        const invitations = await InterviewInvitation.find(query)
            .populate('job', 'jobTitle companyName')
            .populate({
                path: 'applicantId',
                select: 'name email',
                model: 'User'
            })
            .sort({ createdAt: -1 });

        console.log('Found invitations:', invitations.length);

        // Transform the data to match frontend expectations
        const transformedInvitations = invitations.map(invitation => ({
            ...invitation.toObject(),
            applicant: invitation.applicantId // Map applicantId to applicant for consistency
        }));

        res.json({
            success: true,
            count: transformedInvitations.length,
            invitations: transformedInvitations
        });

    } catch (error) {
        console.error('Error fetching sent interview invitations:', error);
        next(error);
    }
};

/**
 * @desc    Respond to interview invitation (Accept/Decline/Request Reschedule)
 * @route   PUT /api/interviews/:invitationId/respond
 * @access  Private (User only)
 */
export const respondToInterviewInvitation = async (req, res, next) => {
    try {
        const { invitationId } = req.params;
        const { action, message, rescheduleReason, suggestedTimes } = req.body;

        // Validate action
        if (!['accept', 'decline', 'reschedule'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid action. Must be accept, decline, or reschedule'
            });
        }

        // Find invitation
        const invitation = await InterviewInvitation.findById(invitationId)
            .populate('job')
            .populate('employer');

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: 'Interview invitation not found'
            });
        }

        // Verify user is the applicant
        if (invitation.applicantId.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to respond to this invitation'
            });
        }

        // Check if invitation is still pending
        if (invitation.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'This invitation has already been responded to'
            });
        }

        // Update invitation based on action
        invitation.applicantResponse = {
            respondedAt: new Date(),
            message: message || '',
            rescheduleReason: action === 'reschedule' ? rescheduleReason : undefined,
            suggestedTimes: action === 'reschedule' ? suggestedTimes : undefined
        };

        // Set status based on action
        switch (action) {
            case 'accept':
                invitation.status = 'accepted';
                break;
            case 'decline':
                invitation.status = 'declined';
                break;
            case 'reschedule':
                invitation.status = 'reschedule_requested';
                if (!rescheduleReason || !suggestedTimes || suggestedTimes.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Reschedule reason and suggested times are required'
                    });
                }
                break;
        }

        await invitation.save();

        // Send notification to employer
        let notificationContent = '';
        switch (action) {
            case 'accept':
                notificationContent = `${req.user.name} has accepted the interview invitation for ${invitation.job.jobTitle}.`;
                break;
            case 'decline':
                notificationContent = `${req.user.name} has declined the interview invitation for ${invitation.job.jobTitle}.`;
                break;
            case 'reschedule':
                notificationContent = `${req.user.name} has requested to reschedule the interview for ${invitation.job.jobTitle}.`;
                break;
        }

        const notificationMessage = new Message({
            from: req.user.id,
            to: invitation.employerId,
            fromModel: 'User',
            toModel: 'Employer',
            jobId: invitation.jobId,
            content: notificationContent,
            messageType: 'interview_invite'
        });

        await notificationMessage.save();

        // Mark response notification as sent
        invitation.notifications.responseSent = true;
        await invitation.save();

        res.json({
            success: true,
            message: `Interview invitation ${action}ed successfully`,
            invitation
        });

    } catch (error) {
        console.error('Error responding to interview invitation:', error);
        next(error);
    }
};

/**
 * @desc    Employer responds to reschedule request
 * @route   PUT /api/interviews/:invitationId/reschedule-response
 * @access  Private (Employer only)
 */
export const respondToRescheduleRequest = async (req, res, next) => {
    try {
        const { invitationId } = req.params;
        const { action, message, selectedTime } = req.body;

        // Validate action
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid action. Must be approve or reject'
            });
        }

        // Find invitation
        const invitation = await InterviewInvitation.findById(invitationId)
            .populate('job')
            .populate('applicant');

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: 'Interview invitation not found'
            });
        }

        // Verify employer owns the invitation
        if (invitation.employerId.toString() !== req.employer._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to respond to this reschedule request'
            });
        }

        // Check if invitation is in reschedule_requested status
        if (invitation.status !== 'reschedule_requested') {
            return res.status(400).json({
                success: false,
                message: 'No reschedule request found for this invitation'
            });
        }

        if (action === 'approve') {
            if (!selectedTime || !selectedTime.date || !selectedTime.time) {
                return res.status(400).json({
                    success: false,
                    message: 'Selected time is required when approving reschedule'
                });
            }

            // Update interview details with new time
            invitation.interviewDetails.date = new Date(selectedTime.date);
            invitation.interviewDetails.time = selectedTime.time;
            invitation.status = 'rescheduled';
            invitation.isRescheduled = true;

            // Update employer response
            invitation.employerResponse = {
                respondedAt: new Date(),
                message: message || '',
                acceptedSuggestedTime: selectedTime
            };

            // Update the job application's interview details
            const job = await Job.findById(invitation.jobId);
            const application = job.applicants.id(invitation.applicationId);
            if (application) {
                application.interviewDetails.date = selectedTime.date;
                application.interviewDetails.time = selectedTime.time;
                await job.save();
            }

        } else { // reject
            invitation.status = 'declined';
            invitation.employerResponse = {
                respondedAt: new Date(),
                message: message || 'Reschedule request rejected'
            };
        }

        await invitation.save();

        // Send notification to applicant
        const notificationContent = action === 'approve' 
            ? `Your reschedule request for the interview has been approved. New interview time: ${selectedTime.date} at ${selectedTime.time}.`
            : `Your reschedule request for the interview has been rejected.`;

        const notificationMessage = new Message({
            from: req.employer._id,
            to: invitation.applicantId,
            fromModel: 'Employer',
            toModel: 'User',
            jobId: invitation.jobId,
            content: notificationContent,
            messageType: 'interview_invite'
        });

        await notificationMessage.save();

        res.json({
            success: true,
            message: `Reschedule request ${action}d successfully`,
            invitation
        });

    } catch (error) {
        console.error('Error responding to reschedule request:', error);
        next(error);
    }
};

/**
 * @desc    Get upcoming interviews for user or employer
 * @route   GET /api/interviews/upcoming
 * @access  Private (User or Employer)
 */
export const getUpcomingInterviews = async (req, res, next) => {
    try {
        let query = {};
        let populateFields = [];

        // Determine if request is from user or employer
        if (req.user) {
            // User request
            query = { 
                applicantId: req.user.id, 
                status: { $in: ['accepted', 'rescheduled'] },
                'interviewDetails.date': { $gte: new Date() }
            };
            populateFields = [
                { path: 'job', select: 'jobTitle companyName' },
                { path: 'employer', select: 'companyName email' }
            ];
        } else if (req.employer) {
            // Employer request
            query = { 
                employerId: req.employer._id, 
                status: { $in: ['accepted', 'rescheduled'] },
                'interviewDetails.date': { $gte: new Date() }
            };
            populateFields = [
                { path: 'job', select: 'jobTitle' },
                { path: 'applicant', select: 'name email' }
            ];
        } else {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const interviews = await InterviewInvitation.find(query)
            .populate(populateFields)
            .sort({ 'interviewDetails.date': 1 });

        res.json({
            success: true,
            count: interviews.length,
            interviews
        });

    } catch (error) {
        console.error('Error fetching upcoming interviews:', error);
        next(error);
    }
};

/**
 * @desc    Cancel interview invitation
 * @route   DELETE /api/interviews/:invitationId/cancel
 * @access  Private (Employer only)
 */
export const cancelInterviewInvitation = async (req, res, next) => {
    try {
        const { invitationId } = req.params;
        const { reason } = req.body;

        const invitation = await InterviewInvitation.findById(invitationId)
            .populate('job')
            .populate('applicant');

        if (!invitation) {
            return res.status(404).json({
                success: false,
                message: 'Interview invitation not found'
            });
        }

        // Verify employer owns the invitation
        if (invitation.employerId.toString() !== req.employer._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to cancel this invitation'
            });
        }

        // Update status to cancelled
        invitation.status = 'cancelled';
        invitation.employerResponse = {
            respondedAt: new Date(),
            message: reason || 'Interview cancelled by employer'
        };

        await invitation.save();

        // Send notification to applicant
        const notificationMessage = new Message({
            from: req.employer._id,
            to: invitation.applicantId,
            fromModel: 'Employer',
            toModel: 'User',
            jobId: invitation.jobId,
            content: `Your interview for ${invitation.job.jobTitle} has been cancelled. ${reason ? 'Reason: ' + reason : ''}`,
            messageType: 'interview_invite'
        });

        await notificationMessage.save();

        res.json({
            success: true,
            message: 'Interview invitation cancelled successfully'
        });

    } catch (error) {
        console.error('Error cancelling interview invitation:', error);
        next(error);
    }
}; 