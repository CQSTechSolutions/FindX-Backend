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

// Get latest 8 jobs for home page (regardless of user skills/performance)
export const getLatestJobs = async (req, res, next) => {
    try {
        const jobs = await Job.find({ 
            status: 'Open' 
        })
            .populate('postedBy', 'companyName email companyLogo')
            .sort('-createdAt')
            .limit(8);

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
            'skills_and_capabilities work_history education dream_job_title preferred_job_types work_env_preferences relocation appliedJobs savedJobs highest_qualification known_language personal_summary hobbies next_role_info profileCompletionPercentage'
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Enhanced profile completion check with more fields
        const missingFields = [];
        const profileRequirements = {
            'skills_and_capabilities': 'Skills & Capabilities',
            'personal_summary': 'Personal Summary',
            'dream_job_title': 'Dream Job Title',
            'preferred_job_types': 'Preferred Job Types'
        };

        // Check required fields for better recommendations
        for (const [field, displayName] of Object.entries(profileRequirements)) {
            if (!user[field] || (Array.isArray(user[field]) && user[field].length === 0)) {
                missingFields.push(displayName);
            }
        }

        // If critical fields are missing, return profile completion message
        if (missingFields.length >= 3) { // Allow some flexibility
            return res.json({
                success: false,
                profileIncomplete: true,
                missingFields: missingFields,
                count: 0,
                jobs: [],
                message: `Complete your profile to get personalized recommendations. Missing: ${missingFields.join(', ')}`
            });
        }

        // Get open jobs with efficient query - only fetch necessary fields initially
        const allJobs = await Job.find({ 
            status: 'Open',
            // Add date filter to only get recent jobs (last 90 days)
            createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        })
        .select('jobTitle jobSkills jobKeywords category subcategory workType workspaceOption jobLocation from to currency payType premiumListing immediateStart postedBy createdAt')
        .populate('postedBy', 'companyName companyLogo')
        .lean(); // Use lean() for better performance

        if (!allJobs.length) {
            return res.json({
                success: true,
                count: 0,
                jobs: [],
                message: 'No jobs available at the moment'
            });
        }

        // Filter out jobs user has already applied to or saved
        const appliedJobIds = new Set(user.appliedJobs?.map(id => id.toString()) || []);
        const savedJobIds = new Set(user.savedJobs?.map(id => id.toString()) || []);
        
        const availableJobs = allJobs.filter(job => 
            !appliedJobIds.has(job._id.toString()) && 
            !savedJobIds.has(job._id.toString())
        );

        // Calculate scores efficiently with enhanced algorithm
        const jobsWithScores = availableJobs.map(job => {
            const score = calculateEnhancedRecommendationScore(user, job);
            return {
                job,
                score,
                matchReasons: getEnhancedMatchReasons(user, job)
            };
        });

        // Get top 6 jobs with score > 15 (minimum threshold for relevance)
        const topRecommendations = jobsWithScores
            .filter(item => item.score > 15)
            .sort((a, b) => b.score - a.score)
            .slice(0, 6);

        // If we have top recommendations, fetch full job details
        if (topRecommendations.length > 0) {
            const jobIds = topRecommendations.map(item => item.job._id);
            const fullJobs = await Job.find({ _id: { $in: jobIds } })
                .populate('postedBy', 'companyName email companyLogo')
                .lean();

            // Map full job details with scores and match reasons
            const recommendedJobs = topRecommendations.map(item => {
                const fullJob = fullJobs.find(job => job._id.toString() === item.job._id.toString());
                return {
                    ...fullJob,
                    recommendationScore: Math.round(item.score * 10) / 10, // Round to 1 decimal
                    matchReasons: item.matchReasons,
                    matchPercentage: Math.min(Math.round(item.score), 100)
                };
            });

            res.json({
                success: true,
                count: recommendedJobs.length,
                jobs: recommendedJobs,
                message: `Found ${recommendedJobs.length} highly-matched job recommendations`,
                avgMatchScore: Math.round(recommendedJobs.reduce((sum, job) => sum + job.recommendationScore, 0) / recommendedJobs.length)
            });
        } else {
            // Fallback: get best available jobs even with lower scores
            const fallbackJobs = jobsWithScores
                .sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map(item => ({
                    ...item.job,
                    recommendationScore: Math.round(item.score * 10) / 10,
                    matchReasons: item.matchReasons.length > 0 ? item.matchReasons : ['New opportunity in your field'],
                    matchPercentage: Math.min(Math.round(item.score), 100)
                }));

            res.json({
                success: true,
                count: fallbackJobs.length,
                jobs: fallbackJobs,
                message: fallbackJobs.length > 0 
                    ? 'Here are some opportunities that might interest you'
                    : 'No matching jobs found. Try updating your profile or skills.',
                isLowConfidence: true
            });
        }

    } catch (error) {
        console.error('Error in getJobRecommendations:', error);
        next(error);
    }
};

// Enhanced recommendation scoring algorithm
const calculateEnhancedRecommendationScore = (user, job) => {
    let score = 0;
    const weights = {
        skillsMatch: 35,        // Slightly reduced but still primary
        jobTitleMatch: 20,      // New: Direct job title matching
        categoryMatch: 15,      // Job category relevance
        workTypeMatch: 10,      // Employment type preference
        workEnvMatch: 8,        // Work environment preference
        locationMatch: 5,       // Location preference
        experienceMatch: 4,     // Work history relevance
        salaryMatch: 3          // Salary range considerations
    };

    // 1. Enhanced Skills Matching (fuzzy matching + exact matching)
    if (user.skills_and_capabilities?.length && (job.jobSkills?.length || job.jobKeywords?.length)) {
        const userSkills = user.skills_and_capabilities.map(skill => skill.toLowerCase().trim());
        const jobSkills = [...(job.jobSkills || []), ...(job.jobKeywords || [])].map(skill => skill.toLowerCase().trim());
        
        let exactMatches = 0;
        let fuzzyMatches = 0;
        
        userSkills.forEach(userSkill => {
            // Exact matches (higher weight)
            if (jobSkills.some(jobSkill => jobSkill === userSkill)) {
                exactMatches++;
            }
            // Fuzzy matches (partial contains)
            else if (jobSkills.some(jobSkill => 
                jobSkill.includes(userSkill) || userSkill.includes(jobSkill)
            )) {
                fuzzyMatches++;
            }
        });
        
        const skillScore = (exactMatches * 2 + fuzzyMatches) / Math.max(userSkills.length, 1);
        score += Math.min(skillScore * weights.skillsMatch, weights.skillsMatch);
    }

    // 2. Job Title Matching (new feature)
    if (user.dream_job_title && job.jobTitle) {
        const dreamTitle = user.dream_job_title.toLowerCase();
        const jobTitle = job.jobTitle.toLowerCase();
        
        if (jobTitle.includes(dreamTitle) || dreamTitle.includes(jobTitle)) {
            score += weights.jobTitleMatch;
        } else {
            // Partial word matching
            const dreamWords = dreamTitle.split(' ').filter(word => word.length > 2);
            const jobWords = jobTitle.split(' ').filter(word => word.length > 2);
            const wordMatches = dreamWords.filter(word => 
                jobWords.some(jobWord => jobWord.includes(word) || word.includes(jobWord))
            );
            
            if (wordMatches.length > 0) {
                score += (wordMatches.length / dreamWords.length) * weights.jobTitleMatch * 0.7;
            }
        }
    }

    // 3. Enhanced Category Matching
    if (job.category && (user.work_history?.length || user.dream_job_title)) {
        let categoryScore = 0;
        
        // Match with work history
        if (user.work_history?.length) {
            const hasRelevantCategory = user.work_history.some(work => {
                const pastTitle = work.past_job_title?.toLowerCase() || '';
                const category = job.category.toLowerCase();
                return pastTitle.includes(category) || category.includes(pastTitle);
            });
            if (hasRelevantCategory) categoryScore += 0.6;
        }
        
        // Match with dream job
        if (user.dream_job_title) {
            const dreamTitle = user.dream_job_title.toLowerCase();
            const category = job.category.toLowerCase();
            if (dreamTitle.includes(category) || category.includes(dreamTitle)) {
                categoryScore += 0.4;
            }
        }
        
        score += Math.min(categoryScore * weights.categoryMatch, weights.categoryMatch);
    }

    // 4. Work Type Matching
    if (user.preferred_job_types?.includes(job.workType)) {
        score += weights.workTypeMatch;
    }

    // 5. Work Environment Matching
    if (user.work_env_preferences?.length && job.workspaceOption) {
        const envScore = user.work_env_preferences.some(pref => {
            // More flexible matching
            if (pref.toLowerCase().includes('remote') && job.workspaceOption === 'Remote') return true;
            if (pref.toLowerCase().includes('office') && job.workspaceOption === 'On-site') return true;
            if (pref.toLowerCase().includes('hybrid') && job.workspaceOption === 'Hybrid') return true;
            return pref.toLowerCase() === job.workspaceOption.toLowerCase();
        });
        if (envScore) score += weights.workEnvMatch;
    }

    // 6. Location Preference
    if (user.relocation?.preferred_location?.length && job.jobLocation) {
        const locationMatch = user.relocation.preferred_location.some(location =>
            job.jobLocation.toLowerCase().includes(location.toLowerCase()) ||
            location.toLowerCase().includes(job.jobLocation.toLowerCase())
        );
        if (locationMatch || user.relocation.willing_to_relocate) {
            score += weights.locationMatch;
        }
    }

    // 7. Experience Level Matching
    if (user.work_history?.length && job.jobTitle) {
        const experienceYears = user.work_history.length; // Simple heuristic
        const jobTitle = job.jobTitle.toLowerCase();
        
        // Check for seniority level alignment
        const seniorityMatches = {
            junior: experienceYears <= 2,
            mid: experienceYears >= 2 && experienceYears <= 5,
            senior: experienceYears >= 5,
            lead: experienceYears >= 7,
            principal: experienceYears >= 10
        };
        
        Object.entries(seniorityMatches).forEach(([level, matches]) => {
            if (matches && jobTitle.includes(level)) {
                score += weights.experienceMatch;
            }
        });
    }

    // 8. Salary Range Consideration (bonus scoring)
    if (job.from && job.to) {
        // Bonus for competitive salaries (assuming higher salaries are more attractive)
        const avgSalary = (job.from + job.to) / 2;
        if (avgSalary > 50000) score += weights.salaryMatch; // Adjust threshold as needed
    }

    // 9. Premium and urgency bonuses
    if (job.premiumListing) score += 3;
    if (job.immediateStart) score += 2;

    // 10. Recency bonus (newer jobs get slight boost)
    const daysSincePosted = (Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePosted <= 7) score += 2; // 1 week
    else if (daysSincePosted <= 30) score += 1; // 1 month

    return Math.min(score, 100); // Cap at 100
};

// Enhanced match reasons with more detailed explanations
const getEnhancedMatchReasons = (user, job) => {
    const reasons = [];

    // Skills match with specific skills mentioned
    if (user.skills_and_capabilities?.length && (job.jobSkills?.length || job.jobKeywords?.length)) {
        const userSkills = user.skills_and_capabilities.map(skill => skill.toLowerCase().trim());
        const jobSkills = [...(job.jobSkills || []), ...(job.jobKeywords || [])].map(skill => skill.toLowerCase().trim());
        
        const matchingSkills = user.skills_and_capabilities.filter(skill => 
            jobSkills.some(jobSkill => 
                jobSkill.toLowerCase().includes(skill.toLowerCase()) || 
                skill.toLowerCase().includes(jobSkill.toLowerCase())
            )
        );
        
        if (matchingSkills.length > 0) {
            const skillText = matchingSkills.length === 1 
                ? `${matchingSkills.length} skill match: ${matchingSkills[0]}`
                : `${matchingSkills.length} skills match: ${matchingSkills.slice(0, 2).join(', ')}${matchingSkills.length > 2 ? ` +${matchingSkills.length - 2} more` : ''}`;
            reasons.push(skillText);
        }
    }

    // Job title alignment
    if (user.dream_job_title && job.jobTitle) {
        const dreamTitle = user.dream_job_title.toLowerCase();
        const jobTitle = job.jobTitle.toLowerCase();
        
        if (jobTitle.includes(dreamTitle) || dreamTitle.includes(jobTitle)) {
            reasons.push(`Matches your dream role: ${user.dream_job_title}`);
        }
    }

    // Work type preference
    if (user.preferred_job_types?.includes(job.workType)) {
        reasons.push(`Preferred employment: ${job.workType}`);
    }

    // Work environment
    if (user.work_env_preferences?.some(pref => {
        const prefLower = pref.toLowerCase();
        const workspaceOption = job.workspaceOption.toLowerCase();
        return prefLower.includes('remote') && workspaceOption === 'remote' ||
               prefLower.includes('office') && workspaceOption === 'on-site' ||
               prefLower.includes('hybrid') && workspaceOption === 'hybrid';
    })) {
        reasons.push(`Work environment: ${job.workspaceOption}`);
    }

    // Experience relevance
    if (user.work_history?.some(work => {
        const pastTitle = work.past_job_title?.toLowerCase() || '';
        const jobTitle = job.jobTitle.toLowerCase();
        const category = job.category.toLowerCase();
        return pastTitle.includes(jobTitle) || jobTitle.includes(pastTitle) ||
               pastTitle.includes(category) || category.includes(pastTitle);
    })) {
        reasons.push('Relevant work experience');
    }

    // Premium features
    if (job.premiumListing && job.immediateStart) {
        reasons.push('Premium listing with immediate start');
    } else if (job.premiumListing) {
        reasons.push('Premium listing');
    } else if (job.immediateStart) {
        reasons.push('Immediate start available');
    }

    return reasons.slice(0, 3); // Limit to top 3 reasons for clean UI
};

// Send promotion notifications to recommended users
export const sendPromotionNotifications = async (req, res, next) => {
    try {
        const { jobId, promotionType } = req.body;
        
        // Get the job details
        const job = await Job.findById(jobId).populate('postedBy', 'companyName');
        
        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }
        
        // Check if employer is job owner
        if (job.postedBy._id.toString() !== req.employer._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to promote this job'
            });
        }
        
        // Get users who might be interested in this job
        const potentialUsers = await User.find({
            // Only users with completed profiles
            isProfileCompleted: true,
            // Exclude users who have already applied
            appliedJobs: { $ne: jobId },
            // Exclude users who have saved this job
            savedJobs: { $ne: jobId }
        }).select('_id skills_and_capabilities dream_job_title work_history preferred_job_types work_env_preferences messagesFromEmployer');
        
        const companyName = job.postedBy.companyName || 'Company';
        const notifiedUsers = [];
        
        // Create promotion message for each matching user
        for (const user of potentialUsers) {
            // Calculate basic match score to determine if user should receive notification
            const matchScore = calculateEnhancedRecommendationScore(user, job);
            
            // Only send to users with decent match score (>10)
            if (matchScore > 10) {
                let title, message;
                
                switch (promotionType) {
                    case 'premium_listing':
                        title = '🌟 Premium Job Match Found!';
                        message = `${job.jobTitle} at ${companyName} is now a premium listing and matches your skills perfectly!`;
                        break;
                    case 'featured_job':
                        title = '🔥 Featured Job Opportunity!';
                        message = `${job.jobTitle} at ${companyName} is now featured and looking for candidates like you!`;
                        break;
                    case 'urgent_hiring':
                        title = '⚡ Urgent Hiring Alert!';
                        message = `${job.jobTitle} at ${companyName} is urgently hiring and you're a great match!`;
                        break;
                    case 'top_match':
                        title = '🎯 Top Match Alert!';
                        message = `${job.jobTitle} at ${companyName} is a top match for your skills and experience!`;
                        break;
                    default:
                        title = '💼 New Job Promotion!';
                        message = `${job.jobTitle} at ${companyName} has been promoted and matches your profile!`;
                }
                
                const promotionMessage = {
                    message: message,
                    sender: req.employer._id,
                    messageType: 'promotion',
                    relatedJob: jobId,
                    promotionData: {
                        promotionType,
                        originalMatchScore: matchScore,
                        promotionBoostScore: matchScore * 1.5 // Boost score by 50%
                    },
                    isRead: false,
                    priority: 'high',
                    actionUrl: `/jobDetails?id=${jobId}`
                };
                
                // Add message to user's messagesFromEmployer array
                user.messagesFromEmployer.push(promotionMessage);
                await user.save();
                
                notifiedUsers.push({
                    userId: user._id,
                    matchScore: Math.round(matchScore * 10) / 10
                });
            }
        }
        
        // Update job with promotion status
        await Job.findByIdAndUpdate(jobId, {
            premiumListing: promotionType === 'premium_listing' ? true : job.premiumListing,
            immediateStart: promotionType === 'urgent_hiring' ? true : job.immediateStart,
            promotionType: promotionType,
            promotedAt: new Date()
        });
        
        res.json({
            success: true,
            message: `Promotion notifications sent to ${notifiedUsers.length} users`,
            notifiedUsers: notifiedUsers,
            promotionType: promotionType
        });
        
    } catch (error) {
        console.error('Error sending promotion notifications:', error);
        next(error);
    }
}; 