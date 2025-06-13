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
            .populate('postedBy', 'companyName email companyLogo')
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
            .populate('postedBy', 'companyName email companyLogo')
            .populate('applicants.user', 'name email');

        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        // Debug logging to help identify the issue
        console.log('Job retrieved:', {
            jobId: req.params.id,
            jobTitle: job.jobTitle,
            applicantsCount: job.applicants?.length || 0,
            applicants: job.applicants?.map(applicant => ({
                _id: applicant._id,
                user: applicant.user,
                status: applicant.status,
                appliedOn: applicant.appliedOn
            })) || []
        });

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
        ).populate('postedBy', 'companyName email companyLogo');

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
        }).populate('postedBy', 'companyName email companyLogo');

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

// Get personalized job recommendations for a user
export const getJobRecommendations = async (req, res, next) => {
    try {
        const userId = req.user.id;
        
        // Get user profile with all relevant data
        const user = await User.findById(userId).select(
            'skills_and_capabilities work_history education dream_job_title preferred_job_types work_env_preferences relocation appliedJobs savedJobs highest_qualification known_language name email isProfileCompleted'
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Debug: Log user data to understand what's available
        console.log('Debug - User profile data:', {
            userId: user._id,
            name: user.name,
            email: user.email,
            skills_and_capabilities: user.skills_and_capabilities,
            highest_qualification: user.highest_qualification,
            work_env_preferences: user.work_env_preferences,
            education: user.education,
            isProfileCompleted: user.isProfileCompleted
        });

        // Check for essential profile completion
        const missingFields = [];
        const profileRequirements = {
            'skills_and_capabilities': 'Skills',
            'highest_qualification': 'Highest Qualification',
            'work_env_preferences': 'Work Environment',
            'education': 'Education'
        };

        // Check required fields
        for (const [field, displayName] of Object.entries(profileRequirements)) {
            if (!user[field] || (Array.isArray(user[field]) && user[field].length === 0)) {
                missingFields.push(displayName);
            }
        }

        console.log('Debug - Missing fields:', missingFields);

        // If critical fields are missing, return profile completion message
        if (missingFields.length > 0) {
            console.log('Debug - Returning profile incomplete response');
            return res.json({
                success: false,
                profileIncomplete: true,
                missingFields: missingFields,
                count: 0,
                jobs: [],
                message: `Complete your profile to get personalized recommendations. Missing: ${missingFields.join(', ')}`
            });
        }

        console.log('Debug - Profile complete, fetching jobs...');

        // Get all open jobs with error handling
        let allJobs;
        try {
            allJobs = await Job.find({ status: 'Open' })
                .populate('postedBy', 'companyName email companyLogo')
                .sort('-createdAt');
        } catch (error) {
            console.error('Error fetching jobs:', error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching jobs from database'
            });
        }

        console.log('Debug - Found jobs:', allJobs.length);

        if (!allJobs.length) {
            console.log('Debug - No jobs found in database');
            return res.json({
                success: true,
                count: 0,
                jobs: [],
                message: 'No jobs available at the moment'
            });
        }

        // Filter out jobs user has already applied to or saved
        const appliedJobIds = user.appliedJobs?.map(id => id.toString()) || [];
        const savedJobIds = user.savedJobs?.map(id => id.toString()) || [];
        const excludedJobIds = new Set([...appliedJobIds, ...savedJobIds]);

        const availableJobs = allJobs.filter(job => !excludedJobIds.has(job._id.toString()));

        // Calculate recommendation scores for each job with error handling
        const jobsWithScores = availableJobs.map(job => {
            try {
                const score = calculateRecommendationScore(user, job);
                return {
                    job,
                    score,
                    matchReasons: getMatchReasons(user, job)
                };
            } catch (error) {
                console.error('Error calculating score for job:', job._id, error);
                return {
                    job,
                    score: 0,
                    matchReasons: ['Error calculating match score']
                };
            }
        });

        // Sort by score (highest first) and filter jobs with score > 0
        const recommendedJobs = jobsWithScores
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 50) // Limit to top 50 recommendations
            .map(item => ({
                ...item.job.toObject(),
                recommendationScore: item.score,
                matchReasons: item.matchReasons
            }));

        res.json({
            success: true,
            count: recommendedJobs.length,
            jobs: recommendedJobs,
            message: recommendedJobs.length > 0 
                ? `Found ${recommendedJobs.length} job recommendations based on your profile`
                : 'No matching jobs found. Try updating your profile or skills.'
        });

    } catch (error) {
        console.error('Error in getJobRecommendations:', error);
        next(error);
    }
};

// Helper function to calculate recommendation score
const calculateRecommendationScore = (user, job) => {
    let score = 0;
    const weights = {
        skillsMatch: 40,
        jobTypeMatch: 25,
        workEnvMatch: 15,
        locationMatch: 10,
        educationMatch: 5,
        languageMatch: 3,
        experienceMatch: 2
    };

    // 1. Skills matching (highest weight)
    if (user.skills_and_capabilities?.length && job.jobSkills?.length) {
        const userSkills = user.skills_and_capabilities.map(skill => skill.toLowerCase());
        const jobSkills = job.jobSkills.map(skill => skill.toLowerCase());
        
        const matchingSkills = userSkills.filter(skill => 
            jobSkills.some(jobSkill => 
                jobSkill.includes(skill) || skill.includes(jobSkill)
            )
        );
        
        const skillMatchPercentage = matchingSkills.length / Math.max(jobSkills.length, 1);
        score += skillMatchPercentage * weights.skillsMatch;
    }

    // 2. Job type preference matching
    if (user.preferred_job_types?.length && job.workType) {
        const hasPreferredJobType = user.preferred_job_types.includes(job.workType);
        if (hasPreferredJobType) {
            score += weights.jobTypeMatch;
        }
    }

    // 3. Work environment preference matching
    if (user.work_env_preferences?.length && job.workspaceOption) {
        const workEnvMatch = user.work_env_preferences.some(pref => {
            if (pref === 'Remote' && job.workspaceOption === 'Remote') return true;
            if (pref === 'Corporate' && job.workspaceOption === 'On-site') return true;
            if (pref === 'Startup' && job.workspaceOption === 'Hybrid') return true;
            return false;
        });
        if (workEnvMatch) {
            score += weights.workEnvMatch;
        }
    }

    // 4. Location preference matching
    if (user.relocation?.preferred_location?.length && job.jobLocation) {
        const locationMatch = user.relocation.preferred_location.some(location =>
            job.jobLocation.toLowerCase().includes(location.toLowerCase()) ||
            location.toLowerCase().includes(job.jobLocation.toLowerCase())
        );
        if (locationMatch || user.relocation.willing_to_relocate) {
            score += weights.locationMatch;
        }
    }

    // 5. Education level matching
    if (user.highest_qualification && job.category) {
        // Basic education matching - can be improved with more specific requirements
        const educationLevels = {
            'High School': 1,
            'Bachelors': 2,
            'Masters': 3,
            'PhD': 4
        };
        
        const userLevel = educationLevels[user.highest_qualification] || 0;
        if (userLevel >= 2) { // Has bachelor's or higher
            score += weights.educationMatch;
        }
    }

    // 6. Language matching
    if (user.known_language?.length) {
        // Assume English is required for most jobs
        const hasEnglish = user.known_language.some(lang => 
            lang.toLowerCase().includes('english')
        );
        if (hasEnglish) {
            score += weights.languageMatch;
        }
    }

    // 7. Experience matching based on work history
    if (user.work_history?.length) {
        const hasRelevantExperience = user.work_history.some(work => {
            const titleMatch = work.past_job_title?.toLowerCase().includes(job.jobTitle.toLowerCase()) ||
                              job.jobTitle.toLowerCase().includes(work.past_job_title?.toLowerCase() || '');
            const categoryMatch = job.category.toLowerCase().includes(work.past_job_title?.toLowerCase() || '') ||
                                 (work.past_job_title?.toLowerCase() || '').includes(job.category.toLowerCase());
            return titleMatch || categoryMatch;
        });
        
        if (hasRelevantExperience) {
            score += weights.experienceMatch;
        }
    }

    // 8. Dream job title matching (bonus)
    if (user.dream_job_title && job.jobTitle) {
        const dreamJobMatch = job.jobTitle.toLowerCase().includes(user.dream_job_title.toLowerCase()) ||
                             user.dream_job_title.toLowerCase().includes(job.jobTitle.toLowerCase());
        if (dreamJobMatch) {
            score += 10; // Bonus points for dream job match
        }
    }

    // 9. Premium listing boost
    if (job.premiumListing) {
        score += 5;
    }

    // 10. Immediate start preference
    if (job.immediateStart) {
        score += 3;
    }

    return Math.min(score, 100); // Cap at 100
};

// Helper function to get match reasons for display
const getMatchReasons = (user, job) => {
    const reasons = [];

    // Skills match
    if (user.skills_and_capabilities?.length && job.jobSkills?.length) {
        const userSkills = user.skills_and_capabilities.map(skill => skill.toLowerCase());
        const jobSkills = job.jobSkills.map(skill => skill.toLowerCase());
        
        const matchingSkills = user.skills_and_capabilities.filter(skill => 
            jobSkills.some(jobSkill => 
                jobSkill.toLowerCase().includes(skill.toLowerCase()) || 
                skill.toLowerCase().includes(jobSkill.toLowerCase())
            )
        );
        
        if (matchingSkills.length > 0) {
            reasons.push(`Skills match: ${matchingSkills.slice(0, 3).join(', ')}`);
        }
    }

    // Job type match
    if (user.preferred_job_types?.includes(job.workType)) {
        reasons.push(`Preferred job type: ${job.workType}`);
    }

    // Work environment match
    if (user.work_env_preferences?.some(pref => {
        if (pref === 'Remote' && job.workspaceOption === 'Remote') return true;
        if (pref === 'Corporate' && job.workspaceOption === 'On-site') return true;
        return false;
    })) {
        reasons.push(`Work environment: ${job.workspaceOption}`);
    }

    // Location match
    if (user.relocation?.preferred_location?.some(location =>
        job.jobLocation.toLowerCase().includes(location.toLowerCase())
    )) {
        reasons.push(`Location preference: ${job.jobLocation}`);
    }

    // Experience match
    if (user.work_history?.some(work => 
        work.past_job_title?.toLowerCase().includes(job.jobTitle.toLowerCase()) ||
        job.jobTitle.toLowerCase().includes(work.past_job_title?.toLowerCase() || '')
    )) {
        reasons.push('Relevant work experience');
    }

    // Dream job match
    if (user.dream_job_title && 
        (job.jobTitle.toLowerCase().includes(user.dream_job_title.toLowerCase()) ||
         user.dream_job_title.toLowerCase().includes(job.jobTitle.toLowerCase()))) {
        reasons.push('Matches your dream job');
    }

    return reasons.slice(0, 3); // Limit to top 3 reasons
}; 