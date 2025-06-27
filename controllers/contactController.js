import Contact from '../models/Contact.model.js';

// Helper function to send error responses
const sendErrorResponse = (res, message, statusCode = 500) => {
    return res.status(statusCode).json({
        success: false,
        message: message
    });
};

// Submit contact form
export const submitContactForm = async (req, res) => {
    try {
        const { name, email, company, subject, message } = req.body;

        // Validate required fields
        if (!name || !email || !subject || !message) {
            return sendErrorResponse(res, 'All required fields must be provided', 400);
        }

        // Create contact record with additional metadata
        const contactData = {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            company: company?.trim() || '',
            subject,
            message: message.trim(),
            userAgent: req.headers['user-agent'],
            ipAddress: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
            source: 'web'
        };

        const contact = new Contact(contactData);
        await contact.save();

        // Log the submission for monitoring
        console.log(`New contact form submission: ${contact._id} from ${email}`);

        // Send auto-response email (you can implement email service later)
        // await sendAutoResponseEmail(contact);

        // Notify admin team (you can implement notification service later)
        // await notifyAdminTeam(contact);

        res.status(201).json({
            success: true,
            message: 'Thank you for contacting us! We\'ll get back to you within 24 hours.',
            data: {
                id: contact._id,
                submissionTime: contact.createdAt,
                estimatedResponseTime: '24 hours'
            }
        });

    } catch (error) {
        console.error('Contact form submission error:', error);

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return sendErrorResponse(res, validationErrors.join(', '), 400);
        }

        // Handle duplicate submissions (optional rate limiting)
        if (error.code === 11000) {
            return sendErrorResponse(res, 'A recent submission from this email already exists', 429);
        }

        return sendErrorResponse(res, 'Failed to submit contact form. Please try again.', 500);
    }
};

// Get all contact submissions (Admin only)
export const getAllContacts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const priority = req.query.priority;
        const subject = req.query.subject;

        // Build filter object
        const filter = {};
        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (subject) filter.subject = subject;

        // Calculate skip value for pagination
        const skip = (page - 1) * limit;

        // Get contacts with pagination
        const contacts = await Contact.find(filter)
            .sort({ createdAt: -1, priority: -1 })
            .skip(skip)
            .limit(limit)
            .select('-userAgent -ipAddress'); // Hide sensitive data

        // Get total count for pagination
        const totalContacts = await Contact.countDocuments(filter);
        const totalPages = Math.ceil(totalContacts / limit);

        // Get contact statistics
        const stats = await Contact.getContactStats();

        res.json({
            success: true,
            data: {
                contacts,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalContacts,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                },
                statistics: stats[0] || { total: 0, statuses: [] }
            }
        });

    } catch (error) {
        console.error('Get contacts error:', error);
        return sendErrorResponse(res, 'Failed to retrieve contact submissions', 500);
    }
};

// Get single contact by ID (Admin only)
export const getContactById = async (req, res) => {
    try {
        const { id } = req.params;

        const contact = await Contact.findById(id);

        if (!contact) {
            return sendErrorResponse(res, 'Contact submission not found', 404);
        }

        res.json({
            success: true,
            data: contact
        });

    } catch (error) {
        console.error('Get contact by ID error:', error);
        return sendErrorResponse(res, 'Failed to retrieve contact submission', 500);
    }
};

// Update contact status (Admin only)
export const updateContactStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, assignedTo, notes } = req.body;

        const validStatuses = ['new', 'in-progress', 'resolved', 'closed'];
        if (status && !validStatuses.includes(status)) {
            return sendErrorResponse(res, 'Invalid status value', 400);
        }

        const updateData = {};
        if (status) {
            updateData.status = status;
            if (status === 'resolved' || status === 'closed') {
                updateData.lastResponseDate = new Date();
            }
        }
        if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

        const contact = await Contact.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!contact) {
            return sendErrorResponse(res, 'Contact submission not found', 404);
        }

        // Log the status update
        console.log(`Contact ${id} status updated to ${status} by admin`);

        res.json({
            success: true,
            message: 'Contact status updated successfully',
            data: contact
        });

    } catch (error) {
        console.error('Update contact status error:', error);
        return sendErrorResponse(res, 'Failed to update contact status', 500);
    }
};

// Delete contact (Admin only)
export const deleteContact = async (req, res) => {
    try {
        const { id } = req.params;

        const contact = await Contact.findByIdAndDelete(id);

        if (!contact) {
            return sendErrorResponse(res, 'Contact submission not found', 404);
        }

        console.log(`Contact ${id} deleted by admin`);

        res.json({
            success: true,
            message: 'Contact submission deleted successfully'
        });

    } catch (error) {
        console.error('Delete contact error:', error);
        return sendErrorResponse(res, 'Failed to delete contact submission', 500);
    }
};

// Get contact statistics dashboard (Admin only)
export const getContactDashboard = async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get various statistics
        const [
            totalContacts,
            newContacts,
            resolvedContacts,
            recentContacts,
            subjectStats,
            priorityStats
        ] = await Promise.all([
            Contact.countDocuments(),
            Contact.countDocuments({ status: 'new' }),
            Contact.countDocuments({ status: 'resolved' }),
            Contact.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
            Contact.aggregate([
                { $group: { _id: '$subject', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            Contact.aggregate([
                { $group: { _id: '$priority', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);

        // Get daily submissions for the last 30 days
        const dailySubmissions = await Contact.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        res.json({
            success: true,
            data: {
                overview: {
                    totalContacts,
                    newContacts,
                    resolvedContacts,
                    recentContacts,
                    responseRate: totalContacts > 0 ? Math.round((resolvedContacts / totalContacts) * 100) : 0
                },
                subjectBreakdown: subjectStats,
                priorityBreakdown: priorityStats,
                dailySubmissions
            }
        });

    } catch (error) {
        console.error('Get contact dashboard error:', error);
        return sendErrorResponse(res, 'Failed to retrieve contact dashboard data', 500);
    }
};

// Helper function for auto-response email (implement with your email service)
const sendAutoResponseEmail = async (contact) => {
    // TODO: Implement email service integration
    // Example: SendGrid, NodeMailer, etc.
    console.log(`Auto-response email would be sent to: ${contact.email}`);
};

// Helper function for admin notifications (implement with your notification service)
const notifyAdminTeam = async (contact) => {
    // TODO: Implement notification service
    // Example: Slack webhook, Discord, email notification to admin team
    console.log(`Admin notification for new contact: ${contact._id}`);
}; 