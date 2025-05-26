import Job from '../models/Job.model.js';
import User from '../models/User.js';

// Create a new job
export const createJob = async (req, res, next) => {
    try {
        const jobData = req.body;
        
        // No need to set up pay range as currency, from, and to are now direct fields in the model
        
        const job = await Job.create(jobData);

        res.status(201).json({
            success: true,
            message: 'Job created successfully',
            job
        });
    } catch (error) {
        next(error);
    }
};

// Get all jobs
export const getAllJobs = async (req, res, next) => {
    try {
        // TODO: Might have to block the poplulate method.
        // FIXME: Update the method controller to make it work.
        const jobs = await Job.find()
            .populate('postedBy', 'name email')
            .sort('-createdAt');

        res.json({
            success: true,
            count: jobs.length,
            jobs
        });
    } catch (error) {
        next(error);
    }
};

// Get single job
export const getJob = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.id)
            .populate('postedBy', 'name email')
            .populate('applicants.user', 'name email');

        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        res.json({
            success: true,
            job
        });
    } catch (error) {
        next(error);
    }
};

// Update job
export const updateJob = async (req, res, next) => {
    try {
        const jobData = req.body;
        
        let job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        // Check if user is job owner
        if (job.postedBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to update this job'
            });
        }

        job = await Job.findByIdAndUpdate(
            req.params.id,
            jobData,
            { new: true, runValidators: true }
        ).populate('postedBy', 'name email');

        res.json({
            success: true,
            message: 'Job updated successfully',
            job
        });
    } catch (error) {
        next(error);
    }
};

// Delete job
export const deleteJob = async (req, res, next) => {
    try {
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        // Check if user is job owner
        if (job.postedBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to delete this job'
            });
        }

        await job.deleteOne();

        res.json({
            success: true,
            message: 'Job deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Apply for a job
export const applyForJob = async (req, res, next) => {
    try {
        const { questionResponses } = req.body;
        console.log('Job application request:', {
            jobId: req.params.id,
            userId: req.user.id,
            hasQuestionResponses: !!questionResponses,
            questionResponsesLength: questionResponses?.length || 0
        });
        
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        // Check if job is closed
        if (job.status === 'Closed') {
            return res.status(400).json({
                success: false,
                message: 'This job is no longer accepting applications'
            });
        }

        // Check if user has already applied
        const alreadyApplied = job.applicants.find(
            applicant => applicant.user.toString() === req.user.id
        );

        if (alreadyApplied) {
            return res.status(400).json({
                success: false,
                message: 'You have already applied for this job'
            });
        }

        // Validate question responses if job has application questions
        if (job.applicationQuestions && job.applicationQuestions.length > 0) {
            if (!questionResponses || questionResponses.length !== job.applicationQuestions.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Please answer all application questions'
                });
            }

            // Validate each response
            for (let i = 0; i < job.applicationQuestions.length; i++) {
                const question = job.applicationQuestions[i];
                const response = questionResponses[i];

                if (!response || !response.selectedOption) {
                    return res.status(400).json({
                        success: false,
                        message: `Please answer question ${i + 1}`
                    });
                }

                // Validate that selected option is one of the available options
                if (!question.options.includes(response.selectedOption)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid option selected for question ${i + 1}`
                    });
                }
            }
        }

        // Add applicant to job
        job.applicants.push({
            user: req.user.id,
            status: 'Pending'
        });

        await job.save();

        console.log('Successfully added applicant to job:', {
            jobId: req.params.id,
            userId: req.user.id,
            totalApplicants: job.applicants.length
        });

        // Create application response record if there are questions
        if (job.applicationQuestions && job.applicationQuestions.length > 0 && questionResponses) {
            try {
                const ApplicationResponse = (await import('../models/application_response.model.js')).default;
                
                const applicationResponse = new ApplicationResponse({
                    userId: req.user.id,
                    jobId: job._id,
                    jobPostedBy: job.postedBy,
                    questionResponses: questionResponses.map((response, index) => ({
                        question: job.applicationQuestions[index].question,
                        selectedOption: response.selectedOption,
                        options: job.applicationQuestions[index].options
                    })),
                    status: 'pending'
                });

                await applicationResponse.save();
                console.log('Application response saved successfully');
            } catch (responseError) {
                console.error('Error saving application response:', responseError);
                // Don't fail the entire application if response saving fails
            }
        }

        res.json({
            success: true,
            message: 'Application submitted successfully'
        });
    } catch (error) {
        console.error('Error in applyForJob:', {
            jobId: req.params.id,
            userId: req.user?.id,
            error: error.message,
            stack: error.stack
        });
        
        // Handle specific validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error: ' + error.message
            });
        }
        
        next(error);
    }
};

// Update application status
export const updateApplicationStatus = async (req, res, next) => {
    try {
        const { status, interviewDetails, rejectionReason, blockReason } = req.body;
        const { id, applicationId } = req.params;

        const job = await Job.findById(id);

        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        // Check if user is job owner
        if (job.postedBy.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to update application status'
            });
        }

        const application = job.applicants.id(applicationId);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found'
            });
        }

        // Update status
        application.status = status;
        
        // Update specific fields based on action
        if (status === 'Interview' && interviewDetails) {
            application.interviewDetails = {
                date: interviewDetails.date || null,
                time: interviewDetails.time || '',
                location: interviewDetails.location || '',
                notes: interviewDetails.notes || ''
            };
        }
        
        if (status === 'Rejected' && rejectionReason) {
            application.rejectionReason = rejectionReason;
        }
        
        if (status === 'Blocked' && blockReason) {
            application.isBlocked = true;
            application.blockReason = blockReason;
        }
        
        await job.save();

        res.json({
            success: true,
            message: 'Application status updated successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Get my posted jobs
export const getMyPostedJobs = async (req, res, next) => {
    try {
        // When used by a regular user
        let userId = req.user?._id;
        
        // When used by an employer
        if (req.employer) {
            userId = req.employer._id;
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        const jobs = await Job.find({ postedBy: userId })
            .populate('applicants.user', 'name email')
            .sort('-createdAt');

        res.json({
            success: true,
            count: jobs.length,
            jobs
        });
    } catch (error) {
        next(error);
    }
};

// Get my applications
export const getMyApplications = async (req, res, next) => {
    try {
        const jobs = await Job.find({
            'applicants.user': req.user.id
        }).populate('postedBy', 'name email');

        const applications = jobs.map(job => ({
            job: {
                id: job._id,
                jobTitle: job.jobTitle,
                jobDescription: job.jobDescription,
                postedBy: job.postedBy
            },
            status: job.applicants.find(
                applicant => applicant.user.toString() === req.user.id
            ).status,
            appliedAt: job.applicants.find(
                applicant => applicant.user.toString() === req.user.id
            ).appliedAt
        }));

        res.json({
            success: true,
            count: applications.length,
            applications
        });
    } catch (error) {
        next(error);
    }
};

// Update saved jobs for a user
export const updateSavedJobs = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { jobId, action } = req.body;

        if (!jobId || !['add', 'remove'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request. Please provide jobId and action (add/remove)'
            });
        }

        // Verify job exists
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        // Find user and update savedJobs
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (action === 'add') {
            // Check if job is already saved
            if (!user.savedJobs.includes(jobId)) {
                user.savedJobs.push(jobId);
            }
        } else if (action === 'remove') {
            user.savedJobs = user.savedJobs.filter(id => id.toString() !== jobId);
        }

        await user.save();

        res.json({
            success: true,
            message: `Job ${action === 'add' ? 'saved' : 'removed'} successfully`,
            user
        });
    } catch (error) {
        next(error);
    }
};

// Get application responses for a job (for employers)
export const getApplicationResponses = async (req, res, next) => {
    try {
        const { jobId } = req.params;
        
        // Verify job exists and user owns it
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        // Check if user is job owner (works for both regular users and employers)
        const userId = req.user?._id || req.employer?._id;
        if (job.postedBy.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to view these application responses'
            });
        }

        const ApplicationResponse = (await import('../models/application_response.model.js')).default;
        
        const responses = await ApplicationResponse.find({ jobId })
            .populate('userId', 'name email')
            .sort('-submittedAt');

        res.json({
            success: true,
            count: responses.length,
            responses
        });
    } catch (error) {
        next(error);
    }
};

// Get user's application response for a specific job
export const getUserApplicationResponse = async (req, res, next) => {
    try {
        const { jobId } = req.params;
        
        const ApplicationResponse = (await import('../models/application_response.model.js')).default;
        
        const response = await ApplicationResponse.findOne({
            userId: req.user.id,
            jobId: jobId
        }).populate('jobId', 'jobTitle applicationQuestions');

        if (!response) {
            return res.status(404).json({
                success: false,
                message: 'Application response not found'
            });
        }

        res.json({
            success: true,
            response
        });
    } catch (error) {
        next(error);
    }
}; 