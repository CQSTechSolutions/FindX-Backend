import Job from '../models/Job.model.js';
import User from '../models/User.js';

// Create a new job
export const createJob = async (req, res, next) => {
    try {
        const { jobTitle, jobDescription } = req.body;
        
        const job = await Job.create({
            jobTitle,
            jobDescription,
            postedBy: req.user.id // This will come from auth middleware
        });

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
        const { jobTitle, jobDescription, status } = req.body;
        
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
            { jobTitle, jobDescription, status },
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

        job.applicants.push({
            user: req.user.id,
            status: 'Pending'
        });

        await job.save();

        res.json({
            success: true,
            message: 'Application submitted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// Update application status
export const updateApplicationStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
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

        application.status = status;
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
        const jobs = await Job.find({ postedBy: req.user.id })
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