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

        // Check if employer is job owner
        if (job.postedBy.toString() !== req.employer._id.toString()) {
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

        // Check if employer is job owner
        if (job.postedBy.toString() !== req.employer._id.toString()) {
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
            console.log('Validating application questions:', {
                applicationQuestionsCount: job.applicationQuestions.length,
                questionResponses: questionResponses,
                questionResponsesLength: questionResponses?.length || 0
            });

            // Check if questionResponses array exists and has correct length
            if (!questionResponses) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide responses for application questions'
                });
            }

            if (questionResponses.length !== job.applicationQuestions.length) {
                return res.status(400).json({
                    success: false,
                    message: `Expected ${job.applicationQuestions.length} responses, but received ${questionResponses.length}`
                });
            }

            // Validate each response
            for (let i = 0; i < job.applicationQuestions.length; i++) {
                const question = job.applicationQuestions[i];
                const response = questionResponses[i];

                console.log(`Validating question ${i + 1}:`, {
                    question: question.question,
                    required: question.required,
                    response: response,
                    selectedOption: response?.selectedOption,
                    availableOptions: question.options
                });

                // Only require answers for mandatory questions
                if (question.required && (!response || !response.selectedOption || response.selectedOption.trim() === '')) {
                    return res.status(400).json({
                        success: false,
                        message: `Please answer required question ${i + 1}: "${question.question}"`
                    });
                }

                // If response is provided, validate that selected option is one of the available options
                if (response && response.selectedOption && response.selectedOption.trim() !== '' && !question.options.includes(response.selectedOption)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid option selected for question ${i + 1}. Selected: "${response.selectedOption}", Available: ${question.options.join(', ')}`
                    });
                }
            }
        }

        // Prepare applicant data
        const applicantData = {
            user: req.user.id,
            status: 'Pending'
        };

        // Add question responses if they exist
        if (job.applicationQuestions && job.applicationQuestions.length > 0 && questionResponses && questionResponses.length > 0) {
            // Filter out empty responses and only include responses with valid selected options
            const validResponses = questionResponses
                .map((response, index) => ({
                    question: job.applicationQuestions[index].question,
                    selectedOption: response.selectedOption,
                    options: job.applicationQuestions[index].options
                }))
                .filter(response => response.selectedOption && response.selectedOption.trim() !== '');
            
            if (validResponses.length > 0) {
                applicantData.questionResponses = validResponses;
                
                console.log('Adding question responses to applicant:', {
                    jobId: req.params.id,
                    userId: req.user.id,
                    questionResponsesCount: applicantData.questionResponses.length,
                    questionResponses: applicantData.questionResponses,
                    originalResponsesCount: questionResponses.length,
                    filteredValidResponses: validResponses.length
                });
            } else {
                console.log('No valid question responses found (all responses were empty):', {
                    jobId: req.params.id,
                    userId: req.user.id,
                    originalResponses: questionResponses
                });
            }
        } else {
            console.log('No question responses to add:', {
                jobId: req.params.id,
                userId: req.user.id,
                hasApplicationQuestions: !!(job.applicationQuestions && job.applicationQuestions.length > 0),
                hasQuestionResponses: !!questionResponses,
                questionResponsesLength: questionResponses?.length || 0,
                questionResponses: questionResponses
            });
        }

        // Add applicant to job
        job.applicants.push(applicantData);

        await job.save();

        console.log('Successfully added applicant to job:', {
            jobId: req.params.id,
            userId: req.user.id,
            totalApplicants: job.applicants.length,
            newApplicant: job.applicants[job.applicants.length - 1] // Show the newly added applicant
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

        // Check if employer is job owner
        if (job.postedBy.toString() !== req.employer._id.toString()) {
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

// Update job status only
export const updateJobStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const { id } = req.params;

        // Validate status
        if (!status || !['Open', 'Closed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Status must be either "Open" or "Closed"'
            });
        }

        const job = await Job.findById(id);

        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        // Check if employer is job owner
        if (job.postedBy.toString() !== req.employer._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to update this job status'
            });
        }

        // Update only the status field
        job.status = status;
        await job.save();

        res.json({
            success: true,
            message: `Job status updated to ${status} successfully`,
            job: {
                _id: job._id,
                status: job.status,
                jobTitle: job.jobTitle
            }
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

// Fix empty question responses for existing applicants
export const fixEmptyQuestionResponses = async (req, res, next) => {
    try {
        console.log('Starting fix for empty question responses...');
        
        // Find all jobs with application questions
        const jobsWithQuestions = await Job.find({
            'applicationQuestions.0': { $exists: true }
        });
        
        let fixedCount = 0;
        let totalApplicants = 0;
        
        for (const job of jobsWithQuestions) {
            console.log(`Processing job: ${job.jobTitle} (${job._id})`);
            
            // Check each applicant in this job
            for (const applicant of job.applicants) {
                totalApplicants++;
                
                // If applicant has empty questionResponses array but job has questions
                if ((!applicant.questionResponses || applicant.questionResponses.length === 0) && 
                    job.applicationQuestions && job.applicationQuestions.length > 0) {
                    
                    console.log(`Found applicant ${applicant.user} with empty responses for job with ${job.applicationQuestions.length} questions`);
                    
                    // Remove the empty questionResponses array to avoid confusion
                    applicant.questionResponses = undefined;
                    fixedCount++;
                }
            }
            
            // Save the job if any changes were made
            if (fixedCount > 0) {
                await job.save();
            }
        }
        
        console.log(`Fix completed. Fixed ${fixedCount} applicants out of ${totalApplicants} total applicants.`);
        
        res.json({
            success: true,
            message: `Fixed ${fixedCount} applicants with empty question responses`,
            data: {
                fixedCount,
                totalApplicants,
                jobsProcessed: jobsWithQuestions.length
            }
        });
    } catch (error) {
        console.error('Error fixing empty question responses:', error);
        next(error);
    }
}; 