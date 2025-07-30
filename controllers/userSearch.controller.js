import User from '../models/User.js';

/**
 * @desc    Search users by various criteria
 * @route   GET /api/user-search
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
        const andConditions = [];
        
        // Search by skills
        if (skills) {
            const skillsArray = skills.split(',').map(skill => skill.trim());
            andConditions.push({
                skills_and_capabilities: { 
                    $in: skillsArray.map(skill => new RegExp(skill, 'i'))
                }
            });
        }
        
        // Search by highest qualification
        if (qualifications) {
            const qualArray = qualifications.split(',').map(qual => qual.trim());
            andConditions.push({
                highest_qualification: { $in: qualArray }
            });
        }
        
        // Search by location (in preferred locations or resident country)
        if (location) {
            andConditions.push({
                $or: [
                    { 'relocation.preferred_location': { $in: [new RegExp(location, 'i')] } },
                    { resident_country: { $regex: location, $options: 'i' } }
                ]
            });
        }
        
        // Search by preferred job types
        if (jobTypes) {
            const typesArray = jobTypes.split(',').map(type => type.trim());
            andConditions.push({
                preferred_job_types: { $in: typesArray }
            });
        }
        
        // Search by work environment preferences
        if (workEnv) {
            const envArray = workEnv.split(',').map(env => env.trim());
            andConditions.push({
                work_env_preferences: { $in: envArray }
            });
        }
        
        // Search by languages
        if (languages) {
            const languagesArray = languages.split(',').map(lang => lang.trim());
            andConditions.push({
                known_language: { $in: languagesArray }
            });
        }
        
        // Search by keyword in name, skills, or dream job title
        if (keyword) {
            andConditions.push({
                $or: [
                    { name: { $regex: keyword, $options: 'i' } },
                    { skills_and_capabilities: { $regex: keyword, $options: 'i' } },
                    { dream_job_title: { $regex: keyword, $options: 'i' } }
                ]
            });
        }

        // Combine all conditions
        if (andConditions.length > 0) {
            query.$and = andConditions;
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
            totalUsers: totalUsers,
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
 * @route   GET /api/user-search/:userId
 * @access  Private (Employer only)
 */
export const getUserProfile = async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId).select(
        "-password -passwordResetOtp -passwordResetExpire -messagesFromEmployer -messagesToEmployer"
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if the employer has blocked this user
      const employer = req.employer;
      const isBlocked =
        employer.blockedApplicants &&
        employer.blockedApplicants.includes(userId);

      // Remove resumes from user data when showing to employers
      const userForEmployer = {
        ...user.toObject(),
        resumes: [], // Don't show any resumes to employers
        resume: undefined, // Don't show single resume field to employers
        cover_letter: undefined, // Don't show cover letter to employers
      };

      return res.status(200).json({
        success: true,
        user: userForEmployer,
        isBlocked,
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
 * @route   GET /api/user-search/suggested
 * @access  Private (Employer only)
 */
export const getSuggestedUsers = async (req, res) => {
    try {
        const employer = req.employer;
        
        // Get employer's industry
        const industry = employer.companyIndustry;
        
        let query = {};
        
        // If employer has industry, find related users
        if (industry) {
            query = {
                $or: [
                    { skills_and_capabilities: { $regex: industry, $options: 'i' } },
                    { dream_job_title: { $regex: industry, $options: 'i' } }
                ]
            };
        }
        
        // Find suggested users - if no industry match, get random users
        const suggestedUsers = await User.find(query)
            .select('name skills_and_capabilities highest_qualification dream_job_title preferred_job_types work_env_preferences resident_country known_language')
            .limit(10);
        
        // If no industry-specific users found, get random users
        if (suggestedUsers.length === 0) {
            const randomUsers = await User.aggregate([
                { $sample: { size: 10 } },
                { 
                    $project: {
                        name: 1,
                        skills_and_capabilities: 1,
                        highest_qualification: 1,
                        dream_job_title: 1,
                        preferred_job_types: 1,
                        work_env_preferences: 1,
                        resident_country: 1,
                        known_language: 1
                    }
                }
            ]);
            
            return res.status(200).json({
                success: true,
                count: randomUsers.length,
                users: randomUsers
            });
        }
        
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
