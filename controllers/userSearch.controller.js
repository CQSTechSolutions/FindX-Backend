import User from '../models/User.js';

/**
 * @desc    Search users by various criteria
 * @route   GET /api/usersearch
 * @access  Private (Employer only)
 */
export const searchUsers = async (req, res) => {
    try {
        const {
            skills, 
            qualifications, 
            location, 
            jobTypes, 
            workEnv, 
            languages,
            keyword,
            limit = 10,
            page = 1
        } = req.query;

        // Build query
        const query = {};
        
        // Search by skills
        if (skills) {
            const skillsArray = skills.split(',').map(skill => skill.trim());
            query.skills_and_capabilities = { $in: skillsArray };
        }
        
        // Search by highest qualification
        if (qualifications) {
            const qualArray = qualifications.split(',').map(qual => qual.trim());
            query.highest_qualification = { $in: qualArray };
        }
        
        // Search by location (in preferred locations or resident country)
        if (location) {
            query.$or = [
                { 'relocation.preferred_location': location },
                { resident_country: { $regex: location, $options: 'i' } }
            ];
        }
        
        // Search by preferred job types
        if (jobTypes) {
            const typesArray = jobTypes.split(',').map(type => type.trim());
            query.preferred_job_types = { $in: typesArray };
        }
        
        // Search by work environment preferences
        if (workEnv) {
            const envArray = workEnv.split(',').map(env => env.trim());
            query.work_env_preferences = { $in: envArray };
        }
        
        // Search by languages
        if (languages) {
            const languagesArray = languages.split(',').map(lang => lang.trim());
            query.known_language = { $in: languagesArray };
        }
        
        // Search by keyword in name, skills, or dream job title
        if (keyword) {
            if (!query.$or) query.$or = [];
            
            query.$or.push(
                { name: { $regex: keyword, $options: 'i' } },
                { skills_and_capabilities: { $regex: keyword, $options: 'i' } },
                { dream_job_title: { $regex: keyword, $options: 'i' } }
            );
        }

        // Calculate pagination
        const skip = (page - 1) * limit;
        
        // Execute query with pagination
        const users = await User.find(query)
            .select('name skills_and_capabilities highest_qualification dream_job_title preferred_job_types work_env_preferences resident_country relocation known_language')
            .skip(skip)
            .limit(parseInt(limit));
            
        // Get total count for pagination
        const totalUsers = await User.countDocuments(query);
        
        return res.status(200).json({
            success: true,
            count: users.length,
            totalPages: Math.ceil(totalUsers / limit),
            currentPage: parseInt(page),
            users
        });
    } catch (error) {
        console.error('Error searching users:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while searching users'
        });
    }
};

/**
 * @desc    Get detailed user profile by ID
 * @route   GET /api/usersearch/:userId
 * @access  Private (Employer only)
 */
export const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId)
            .select('-password -passwordResetOtp -passwordResetExpire -messagesFromEmployer -messagesToEmployer');
            
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if the employer has blocked this user
        const employer = req.employer;
        const isBlocked = employer.blockedApplicants.includes(userId);
        
        return res.status(200).json({
            success: true,
            user,
            isBlocked
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching user profile'
        });
    }
};

/**
 * @desc    Get suggested users based on employer's industry
 * @route   GET /api/usersearch/suggested
 * @access  Private (Employer only)
 */
export const getSuggestedUsers = async (req, res) => {
    try {
        const employer = req.employer;
        
        // Get employer's industry
        const industry = employer.companyIndustry;
        
        // Find users with skills related to the industry
        // This is a simplified approach - you might want to implement a more sophisticated
        // matching algorithm based on your specific requirements
        const suggestedUsers = await User.find({
            $or: [
                { skills_and_capabilities: { $regex: industry, $options: 'i' } },
                { dream_job_title: { $regex: industry, $options: 'i' } }
            ]
        })
        .select('name skills_and_capabilities highest_qualification dream_job_title preferred_job_types work_env_preferences resident_country known_language')
        .limit(10);
        
        return res.status(200).json({
            success: true,
            count: suggestedUsers.length,
            users: suggestedUsers
        });
    } catch (error) {
        console.error('Error fetching suggested users:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while fetching suggested users'
        });
    }
}; 