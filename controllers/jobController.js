import Job from '../models/Job.model.js';
import User from '../models/User.js';
import Employer from '../models/employer.model.js';
import { sendJobAlertEmails } from './broadcastController.js';
import systemMessageService from '../services/systemMessageService.js';

// Function to find similar users based on job criteria
const findSimilarUsers = async (jobData) => {
    try {
        console.log('🔍 Finding similar users for job:', jobData.jobTitle);
        
        // Extract relevant job data for matching
        const jobCriteria = {
            jobTitle: jobData.jobTitle,
            jobLocation: jobData.jobLocation,
            category: jobData.category,
            subcategory: jobData.subcategory,
            workType: jobData.workType,
            workspaceOption: jobData.workspaceOption,
            jobSkills: jobData.jobSkills || [],
            jobKeywords: jobData.jobKeywords || [],
            from: jobData.from,
            to: jobData.to,
            currency: jobData.currency
        };

        console.log('📋 Job Criteria:', jobCriteria);

        // Get ALL users with skills (focus on skills rather than profile completion)
        let allUsers = await User.find({ 
            skills_and_capabilities: { $exists: true, $ne: [], $not: { $size: 0 } }
        })
            .select('name email skills_and_capabilities dream_job_title preferred_job_types work_env_preferences resident_country relocation highest_qualification personal_branding_statement resume work_history education achievements licenses hobbies social_links emergency_contact isProfileCompleted notInterestedJobCategories');

        console.log(`📊 Found ${allUsers.length} users with skills (regardless of profile completion)`);

        // Filter out users who have marked this job category as not interested
        allUsers = allUsers.filter(user => {
            if (!user.notInterestedJobCategories || user.notInterestedJobCategories.length === 0) {
                return true; // User has no not interested categories
            }
            
            // Check if user has marked this specific subcategory as not interested
            return !user.notInterestedJobCategories.some(category => 
                category.jobSubCategory === jobData.subcategory
            );
        });

        console.log(`📊 After filtering not interested categories: ${allUsers.length} users`);

        // Function to analyze profile completeness
        const analyzeProfileCompleteness = (user) => {
            const missingFields = [];
            const profileFields = {
                'Skills & Capabilities': user.skills_and_capabilities?.length > 0,
                'Dream Job Title': !!user.dream_job_title,
                'Preferred Job Types': user.preferred_job_types?.length > 0,
                'Work Environment Preferences': user.work_env_preferences?.length > 0,
                'Resident Country': !!user.resident_country,
                'Highest Qualification': !!user.highest_qualification,
                'Personal Branding Statement': !!user.personal_branding_statement,
                'Resume': !!user.resume,
                'Work History': user.work_history?.length > 0,
                'Education': user.education?.length > 0,
                'Achievements': user.achievements?.length > 0,
                'Licenses': user.licenses?.length > 0,
                'Hobbies': user.hobbies?.length > 0,
                'Social Links': !!(user.social_links?.linkedin || user.social_links?.github || user.social_links?.portfolio),
                'Emergency Contact': !!(user.emergency_contact?.name && user.emergency_contact?.phone)
            };

            Object.entries(profileFields).forEach(([field, hasValue]) => {
                if (!hasValue) {
                    missingFields.push(field);
                }
            });

            const completedFields = Object.keys(profileFields).length - missingFields.length;
            const completionPercentage = Math.round((completedFields / Object.keys(profileFields).length) * 100);

            return {
                missingFields,
                completionPercentage,
                totalFields: Object.keys(profileFields).length,
                completedFields
            };
        };

        // Enhanced location matching function
        const analyzeLocationMatch = (userLocation, jobLocation, user = null) => {
            if (!userLocation || !jobLocation) return { score: 0, matchType: 'No location data', details: [] };

            const userLoc = userLocation.toLowerCase().trim();
            const jobLoc = jobLocation.toLowerCase().trim();
            
            const details = [];
            let score = 0;
            let matchType = 'No match';

            // Extract location components
            const jobParts = jobLoc.split(',').map(part => part.trim());
            const userParts = userLoc.split(',').map(part => part.trim());
            
            const jobCity = jobParts[0];
            const jobCountry = jobParts[jobParts.length - 1];
            const userCity = userParts[0];
            const userCountry = userParts[userParts.length - 1];

            // Perfect match (exact location)
            if (userLoc === jobLoc) {
                score = 100;
                matchType = 'Perfect match';
                details.push('Exact location match');
            }
            // Same city and country
            else if (userCity === jobCity && userCountry === jobCountry) {
                score = 95;
                matchType = 'Same city and country';
                details.push(`City: ${userCity}`, `Country: ${userCountry}`);
            }
            // Same city, different country (unlikely but possible)
            else if (userCity === jobCity) {
                score = 80;
                matchType = 'Same city';
                details.push(`City: ${userCity}`);
            }
            // Same country, different city
            else if (userCountry === jobCountry) {
                score = 70;
                matchType = 'Same country';
                details.push(`Country: ${userCountry}`);
            }
            // Partial city match (e.g., "New York" vs "NYC")
            else if (userCity.includes(jobCity) || jobCity.includes(userCity)) {
                score = 100;
                matchType = 'Partial city match';
                details.push(`Partial city: ${userCity} vs ${jobCity}`);
            }
            // Partial country match
            else if (userCountry.includes(jobCountry) || jobCountry.includes(userCountry)) {
                score = 50;
                matchType = 'Partial country match';
                details.push(`Partial country: ${userCountry} vs ${jobCountry}`);
            }
            // Check if user has preferred locations that match
            else if (user && user.relocation?.preferred_location) {
                const preferredLocations = Array.isArray(user.relocation.preferred_location) 
                    ? user.relocation.preferred_location 
                    : [user.relocation.preferred_location];
                
                for (const prefLoc of preferredLocations) {
                    const prefLocLower = prefLoc.toLowerCase().trim();
                    if (prefLocLower === jobLoc) {
                        score = 85;
                        matchType = 'Preferred location match';
                        details.push(`Preferred location: ${prefLoc}`);
                        break;
                    } else if (prefLocLower.includes(jobCity) || jobCity.includes(prefLocLower)) {
                        score = 75;
                        matchType = 'Preferred city match';
                        details.push(`Preferred city: ${prefLoc}`);
                        break;
                    } else if (prefLocLower.includes(jobCountry) || jobCountry.includes(prefLocLower)) {
                        score = 65;
                        matchType = 'Preferred country match';
                        details.push(`Preferred country: ${prefLoc}`);
                        break;
                    }
                }
            }

            return { score, matchType, details };
        };

        // Enhanced job title matching function with precise matching
        const analyzeJobTitleMatch = (userJobTitle, jobTitle) => {
            if (!userJobTitle || !jobTitle) return { score: 0, matchType: 'No job title data', details: [] };

            const userTitle = userJobTitle.toLowerCase().trim();
            const jobTitleLower = jobTitle.toLowerCase().trim();
            
            const details = [];
            let score = 0;
            let matchType = 'No match';

            // Normalize job titles for better matching
            const normalizeTitle = (title) => {
                return title
                    .toLowerCase()
                    .trim()
                    .replace(/[^\w\s]/g, ' ') // Remove special characters
                    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                    .trim();
            };

            const normalizedUserTitle = normalizeTitle(userTitle);
            const normalizedJobTitle = normalizeTitle(jobTitleLower);

            // Perfect exact match (case-insensitive)
            if (userTitle === jobTitleLower) {
                score = 100;
                matchType = 'Perfect exact match';
                details.push('Exact job title match (case-insensitive)');
            }
            // Normalized perfect match
            else if (normalizedUserTitle === normalizedJobTitle) {
                score = 98;
                matchType = 'Perfect normalized match';
                details.push('Exact job title match (normalized)');
            }
            // Contains exact job title (bidirectional)
            else if (userTitle.includes(jobTitleLower) || jobTitleLower.includes(userTitle)) {
                score = 90;
                matchType = 'Contains exact title';
                details.push('Job title contains/contained in user preference');
            }
            // Contains normalized job title
            else if (normalizedUserTitle.includes(normalizedJobTitle) || normalizedJobTitle.includes(normalizedUserTitle)) {
                score = 85;
                matchType = 'Contains normalized title';
                details.push('Normalized job title contains/contained in user preference');
            }
            // Word-by-word matching
            else {
                const userWords = normalizedUserTitle.split(/\s+/).filter(word => word.length > 2);
                const jobWords = normalizedJobTitle.split(/\s+/).filter(word => word.length > 2);
                
                if (userWords.length > 0 && jobWords.length > 0) {
                    // Find exact word matches
                    const exactWordMatches = userWords.filter(userWord => 
                        jobWords.some(jobWord => userWord === jobWord)
                    );
                    
                    // Find partial word matches
                    const partialWordMatches = userWords.filter(userWord => 
                        jobWords.some(jobWord => 
                            userWord.includes(jobWord) || jobWord.includes(userWord)
                        )
                    );
                    
                    const totalMatches = exactWordMatches.length + partialWordMatches.length;
                    const maxWords = Math.max(userWords.length, jobWords.length);
                    const wordMatchPercentage = (totalMatches / maxWords) * 100;
                    
                    if (wordMatchPercentage >= 80) {
                        score = 80;
                        matchType = 'High word similarity';
                        details.push(`Exact word matches: ${exactWordMatches.join(', ')}`);
                        details.push(`Partial word matches: ${partialWordMatches.join(', ')}`);
                        details.push(`Word similarity: ${wordMatchPercentage.toFixed(1)}%`);
                    } else if (wordMatchPercentage >= 60) {
                        score = 65;
                        matchType = 'Medium word similarity';
                        details.push(`Exact word matches: ${exactWordMatches.join(', ')}`);
                        details.push(`Partial word matches: ${partialWordMatches.join(', ')}`);
                        details.push(`Word similarity: ${wordMatchPercentage.toFixed(1)}%`);
                    } else if (wordMatchPercentage >= 40) {
                        score = 50;
                        matchType = 'Low word similarity';
                        details.push(`Exact word matches: ${exactWordMatches.join(', ')}`);
                        details.push(`Partial word matches: ${partialWordMatches.join(', ')}`);
                        details.push(`Word similarity: ${wordMatchPercentage.toFixed(1)}%`);
                    }
                }
                
                // Check for role level matches if no word matches found
                if (score === 0) {
                    const roleLevels = ['senior', 'junior', 'lead', 'principal', 'staff', 'associate', 'entry', 'mid', 'senior'];
                    const userLevel = roleLevels.find(level => userTitle.includes(level));
                    const jobLevel = roleLevels.find(level => jobTitleLower.includes(level));
                    
                    if (userLevel && jobLevel && userLevel === jobLevel) {
                        score = 40;
                        matchType = 'Role level match';
                        details.push(`Role level: ${userLevel}`);
                    }
                }
            }

            return { 
                score, 
                matchType, 
                details,
                originalUserTitle: userJobTitle,
                originalJobTitle: jobTitle,
                normalizedUserTitle,
                normalizedJobTitle
            };
        };

        // Score and rank ALL users based on multiple criteria
        const scoredUsers = allUsers.map(user => {
            let totalScore = 0;
            const matchDetails = [];
            const profileAnalysis = analyzeProfileCompleteness(user);

            // 1. Enhanced Skills matching (highest weight - 40%)
            let skillsScore = 0;
            if (user.skills_and_capabilities && jobCriteria.jobSkills.length > 0) {
                const userSkills = user.skills_and_capabilities.map(skill => skill.toLowerCase());
                const jobSkills = jobCriteria.jobSkills.map(skill => skill.toLowerCase());
                
                const matchingSkills = jobSkills.filter(skill => 
                    userSkills.some(userSkill => 
                        userSkill.includes(skill) || skill.includes(userSkill)
                    )
                );
                
                const skillMatchPercentage = (matchingSkills.length / jobSkills.length) * 100;
                skillsScore = skillMatchPercentage;
                matchDetails.push(`Skills: ${matchingSkills.length}/${jobSkills.length} (${skillMatchPercentage.toFixed(1)}%)`);
            }
            totalScore += skillsScore * 0.4; // 40% weight

            // 2. Enhanced Job title matching (25% weight)
            const jobTitleAnalysis = analyzeJobTitleMatch(user.dream_job_title, jobCriteria.jobTitle);
            const jobTitleScore = jobTitleAnalysis.score;
            totalScore += jobTitleScore * 0.25; // 25% weight
            matchDetails.push(`Job Title: ${jobTitleAnalysis.matchType} (${jobTitleScore}%)`);

            // 3. Enhanced Location matching (20% weight)
            const locationAnalysis = analyzeLocationMatch(user.resident_country, jobCriteria.jobLocation, user);
            const locationScore = locationAnalysis.score;
            totalScore += locationScore * 0.2; // 20% weight
            matchDetails.push(`Location: ${locationAnalysis.matchType} (${locationScore}%)`);

            // 4. Work type preference (10% weight)
            let workTypeScore = 0;
            if (user.preferred_job_types && user.preferred_job_types.includes(jobCriteria.workType)) {
                workTypeScore = 100;
                matchDetails.push('Work type preference match');
            }
            totalScore += workTypeScore * 0.1; // 10% weight

            // 5. Work environment preference (5% weight)
            let workEnvScore = 0;
            if (user.work_env_preferences && user.work_env_preferences.includes(jobCriteria.workspaceOption)) {
                workEnvScore = 100;
                    matchDetails.push('Work environment preference match');
                }
            totalScore += workEnvScore * 0.05; // 5% weight

            return {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    skills_and_capabilities: user.skills_and_capabilities,
                    dream_job_title: user.dream_job_title,
                    preferred_job_types: user.preferred_job_types,
                    work_env_preferences: user.work_env_preferences,
                    resident_country: user.resident_country,
                    highest_qualification: user.highest_qualification,
                    personal_branding_statement: user.personal_branding_statement
                },
                score: Math.round(totalScore),
                matchDetails,
                profileAnalysis,
                detailedAnalysis: {
                    skillsScore: Math.round(skillsScore),
                    jobTitleScore: Math.round(jobTitleScore),
                    locationScore: Math.round(locationScore),
                    workTypeScore: Math.round(workTypeScore),
                    workEnvScore: Math.round(workEnvScore),
                    jobTitleAnalysis,
                    locationAnalysis
                }
            };
        });

        // Sort by score (highest first) and get ALL matches (no artificial limits)
        // FIXED: Include ALL users with completed profiles, regardless of score
        const topMatches = scoredUsers
            .sort((a, b) => b.score - a.score); // ALL matches, no limit, no score filtering

        // Enhanced console logging with detailed information
        console.log('\n🎯 ===== PERFECT JOB MATCHING ANALYSIS =====');
        console.log(`📋 Job: ${jobCriteria.jobTitle}`);
        console.log(`📍 Location: ${jobCriteria.jobLocation}`);
        console.log(`💼 Work Type: ${jobCriteria.workType}`);
        console.log(`🏢 Work Environment: ${jobCriteria.workspaceOption}`);
        console.log(`🔧 Required Skills: ${jobCriteria.jobSkills.join(', ')}`);
        console.log(`📊 Total Users Analyzed: ${allUsers.length}`);
        console.log(`🎯 Users to Receive Emails: ${topMatches.length} (ALL users with completed profiles)`);
        console.log('');

        // Show top matches with detailed information
        console.log('🏆 TOP PERFECT MATCHES:');
        topMatches.slice(0, 20).forEach((match, index) => {
            console.log(`\n${index + 1}. ${match.user.name} (${match.user.email})`);
            console.log(`   📊 Total Match Score: ${match.score}/100`);
            console.log(`   📈 Profile Completion: ${match.profileAnalysis.completionPercentage}%`);
            
            // Detailed breakdown
            console.log(`   🔧 Skills Score: ${match.detailedAnalysis.skillsScore}/100`);
            console.log(`   💼 Job Title Score: ${match.detailedAnalysis.jobTitleScore}/100 (${match.detailedAnalysis.jobTitleAnalysis.matchType})`);
            console.log(`   📍 Location Score: ${match.detailedAnalysis.locationScore}/100 (${match.detailedAnalysis.locationAnalysis.matchType})`);
            console.log(`   ⚡ Work Type Score: ${match.detailedAnalysis.workTypeScore}/100`);
            console.log(`   🏢 Work Environment Score: ${match.detailedAnalysis.workEnvScore}/100`);
            
            // Enhanced job title details
            const titleAnalysis = match.detailedAnalysis.jobTitleAnalysis;
            console.log(`   📋 Job Title Analysis:`);
            console.log(`      Original Job Title: "${titleAnalysis.originalJobTitle}"`);
            console.log(`      User Dream Job: "${titleAnalysis.originalUserTitle}"`);
            console.log(`      Normalized Job: "${titleAnalysis.normalizedJobTitle}"`);
            console.log(`      Normalized User: "${titleAnalysis.normalizedUserTitle}"`);
            console.log(`      Match Details: ${titleAnalysis.details.join(', ')}`);
            
            console.log(`   🎯 Match Details: ${match.matchDetails.join(', ')}`);
            
            if (match.profileAnalysis.missingFields.length > 0) {
                console.log(`   ❌ Missing Fields: ${match.profileAnalysis.missingFields.join(', ')}`);
            } else {
                console.log(`   ✅ Profile Complete`);
            }
            
            console.log(`   📍 Location: ${match.user.resident_country || 'Not specified'}`);
            console.log(`   💼 Dream Job: ${match.user.dream_job_title || 'Not specified'}`);
            console.log(`   🔧 Skills: ${match.user.skills_and_capabilities?.slice(0, 5).join(', ') || 'None'}${match.user.skills_and_capabilities?.length > 5 ? '...' : ''}`);
        });

        // Show perfect matches (score >= 90)
        const perfectMatches = topMatches.filter(match => match.score >= 90);
        if (perfectMatches.length > 0) {
            console.log('\n🌟 PERFECT MATCHES (Score >= 90):');
            perfectMatches.forEach((match, index) => {
            console.log(`${index + 1}. ${match.user.name} (${match.user.email}) - Score: ${match.score}`);
                console.log(`   💼 Job Title: "${match.detailedAnalysis.jobTitleAnalysis.originalJobTitle}" vs "${match.detailedAnalysis.jobTitleAnalysis.originalUserTitle}"`);
                console.log(`   📍 Location: ${match.detailedAnalysis.locationAnalysis.matchType}`);
                console.log(`   🔧 Skills: ${match.detailedAnalysis.skillsScore}/100`);
            });
        }

        // Show location-specific matches
        const locationMatches = topMatches.filter(match => match.detailedAnalysis.locationScore >= 70);
        if (locationMatches.length > 0) {
            console.log('\n📍 STRONG LOCATION MATCHES (Score >= 70):');
            locationMatches.slice(0, 10).forEach((match, index) => {
                console.log(`${index + 1}. ${match.user.name} (${match.user.email})`);
                console.log(`   📍 Location: ${match.user.resident_country} - ${match.detailedAnalysis.locationAnalysis.matchType}`);
                console.log(`   💼 Job Title: "${match.detailedAnalysis.jobTitleAnalysis.originalJobTitle}" vs "${match.detailedAnalysis.jobTitleAnalysis.originalUserTitle}"`);
                console.log(`   📊 Total Score: ${match.score}/100`);
            });
        }

        // Show job title-specific matches
        const jobTitleMatches = topMatches.filter(match => match.detailedAnalysis.jobTitleScore >= 70);
        if (jobTitleMatches.length > 0) {
            console.log('\n💼 STRONG JOB TITLE MATCHES (Score >= 70):');
            jobTitleMatches.slice(0, 10).forEach((match, index) => {
                console.log(`${index + 1}. ${match.user.name} (${match.user.email})`);
                console.log(`   💼 Job Title: "${match.detailedAnalysis.jobTitleAnalysis.originalJobTitle}" vs "${match.detailedAnalysis.jobTitleAnalysis.originalUserTitle}"`);
                console.log(`   📍 Location: ${match.user.resident_country} - ${match.detailedAnalysis.locationAnalysis.matchType}`);
                console.log(`   📊 Total Score: ${match.score}/100`);
            });
        }

        // Show users with low scores but complete profiles
        const lowScoreCompleteProfiles = scoredUsers
            .filter(user => user.score <= 20 && user.profileAnalysis.completionPercentage >= 80)
            .sort((a, b) => b.profileAnalysis.completionPercentage - a.profileAnalysis.completionPercentage)
            .slice(0, 10);

        if (lowScoreCompleteProfiles.length > 0) {
            console.log('\n📈 HIGH COMPLETION, LOW MATCH SCORE:');
            lowScoreCompleteProfiles.forEach((user, index) => {
                console.log(`${index + 1}. ${user.user.name} (${user.user.email})`);
                console.log(`   📊 Match Score: ${user.score}/100`);
                console.log(`   📈 Profile Completion: ${user.profileAnalysis.completionPercentage}%`);
                console.log(`   ❌ Missing Fields: ${user.profileAnalysis.missingFields.join(', ')}`);
            });
        }

        // Show profile completion statistics
        const completionStats = {
            '90-100%': 0,
            '80-89%': 0,
            '70-79%': 0,
            '60-69%': 0,
            '50-59%': 0,
            '40-49%': 0,
            '30-39%': 0,
            '20-29%': 0,
            '10-19%': 0,
            '0-9%': 0
        };

        scoredUsers.forEach(user => {
            const completion = user.profileAnalysis.completionPercentage;
            if (completion >= 90) completionStats['90-100%']++;
            else if (completion >= 80) completionStats['80-89%']++;
            else if (completion >= 70) completionStats['70-79%']++;
            else if (completion >= 60) completionStats['60-69%']++;
            else if (completion >= 50) completionStats['50-59%']++;
            else if (completion >= 40) completionStats['40-49%']++;
            else if (completion >= 30) completionStats['30-39%']++;
            else if (completion >= 20) completionStats['20-29%']++;
            else if (completion >= 10) completionStats['10-19%']++;
            else completionStats['0-9%']++;
        });

        console.log('\n📊 PROFILE COMPLETION STATISTICS:');
        Object.entries(completionStats).forEach(([range, count]) => {
            if (count > 0) {
                const percentage = Math.round((count / allUsers.length) * 100);
                console.log(`   ${range}: ${count} users (${percentage}%)`);
            }
        });

        // Show most common missing fields
        const missingFieldsCount = {};
        scoredUsers.forEach(user => {
            user.profileAnalysis.missingFields.forEach(field => {
                missingFieldsCount[field] = (missingFieldsCount[field] || 0) + 1;
            });
        });

        const sortedMissingFields = Object.entries(missingFieldsCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        if (sortedMissingFields.length > 0) {
            console.log('\n❌ MOST COMMON MISSING FIELDS:');
            sortedMissingFields.forEach(([field, count]) => {
                const percentage = Math.round((count / allUsers.length) * 100);
                console.log(`   ${field}: ${count} users (${percentage}%)`);
            });
        }

        // Show matching statistics
        const matchStats = {
            'Perfect (90-100)': topMatches.filter(m => m.score >= 90).length,
            'Excellent (80-89)': topMatches.filter(m => m.score >= 80 && m.score < 90).length,
            'Good (70-79)': topMatches.filter(m => m.score >= 70 && m.score < 80).length,
            'Fair (60-69)': topMatches.filter(m => m.score >= 60 && m.score < 70).length,
            'Poor (1-59)': topMatches.filter(m => m.score >= 1 && m.score < 60).length
        };

        console.log('\n🎯 MATCH QUALITY DISTRIBUTION:');
        Object.entries(matchStats).forEach(([range, count]) => {
            if (count > 0) {
                const percentage = Math.round((count / topMatches.length) * 100);
                console.log(`   ${range}: ${count} users (${percentage}%)`);
            }
        });

        console.log('\n✅ ===== SKILLS-BASED ANALYSIS COMPLETE =====\n');

        return {
            jobTitle: jobCriteria.jobTitle,
            jobLocation: jobCriteria.jobLocation,
            totalCandidates: allUsers.length,
            topMatches: topMatches.length,
            matches: topMatches,
            perfectMatches: perfectMatches.length,
            analysis: {
                totalUsersAnalyzed: allUsers.length,
                usersWithMatchScore: topMatches.length,
                perfectMatches: perfectMatches.length,
                completionStats,
                mostCommonMissingFields: sortedMissingFields,
                matchQualityStats: matchStats
            }
        };

    } catch (error) {
        console.error('❌ Error finding similar users:', error);
        return {
            error: error.message,
            matches: []
        };
    }
};

// Create a new job
export const createJob = async (req, res, next) => {
    try {
        const jobData = req.body;
        
        // Only use employer's company logo as fallback if no logo is provided
        if (jobData.postedBy && (!jobData.companyLogo || jobData.companyLogo.trim() === '')) {
            const employer = await Employer.findById(jobData.postedBy);
            if (employer && employer.companyLogo) {
                // Use employer's company logo as fallback
                jobData.companyLogo = employer.companyLogo;
            }
        }
        
        // Process array fields to ensure they are properly formatted
        const processArrayField = (fieldName, data) => {
            if (data[fieldName]) {
                if (Array.isArray(data[fieldName])) {
                // Filter out empty strings and trim whitespace
                    data[fieldName] = data[fieldName]
                        .map(item => typeof item === 'string' ? item.trim() : String(item))
                        .filter(item => item.length > 0);
                } else if (typeof data[fieldName] === 'string') {
                // If it's a string, split by comma and process
                    data[fieldName] = data[fieldName]
                    .split(',')
                        .map(item => item.trim())
                        .filter(item => item.length > 0);
            } else {
                // If invalid format, set to empty array
                    data[fieldName] = [];
                }
            } else {
                data[fieldName] = [];
            }
        };

        // Process all array fields
        processArrayField('shortDescription', jobData);
        processArrayField('jobSkills', jobData);
        processArrayField('jobKeywords', jobData);
        processArrayField('sellingPoints', jobData);
        processArrayField('jobQuestions', jobData);
        processArrayField('mandatoryQuestions', jobData);
        
        // Ensure showShortDescription is a boolean
        if (typeof jobData.showShortDescription !== 'boolean') {
            jobData.showShortDescription = false;
        }
        
        // If showShortDescription is false, clear shortDescription
        if (!jobData.showShortDescription) {
            jobData.shortDescription = [];
        }
        
        // Log processed short description data for debugging
        console.log('Processed short description data:', {
            showShortDescription: jobData.showShortDescription,
            shortDescription: jobData.shortDescription,
            shortDescriptionLength: jobData.shortDescription?.length || 0
        });
        
        // Ensure selectedOptions is properly formatted (it's an object, not an array)
        if (!jobData.selectedOptions || typeof jobData.selectedOptions !== 'object') {
            jobData.selectedOptions = {};
        }
        
        // Transform jobQuestions + selectedOptions + mandatoryQuestions to applicationQuestions
        console.log('=== QUESTION TRANSFORMATION DEBUG ===');
        console.log('Raw jobData before transformation:', {
            jobQuestions: jobData.jobQuestions,
            selectedOptions: jobData.selectedOptions,
            mandatoryQuestions: jobData.mandatoryQuestions,
            hasJobQuestions: !!(jobData.jobQuestions && jobData.jobQuestions.length > 0),
            jobQuestionsLength: jobData.jobQuestions?.length || 0,
            selectedOptionsKeys: jobData.selectedOptions ? Object.keys(jobData.selectedOptions) : [],
            mandatoryQuestionsLength: jobData.mandatoryQuestions?.length || 0,
            hasApplicationQuestions: !!(jobData.applicationQuestions && jobData.applicationQuestions.length > 0),
            applicationQuestionsLength: jobData.applicationQuestions?.length || 0
        });

        // Only transform if applicationQuestions are not already provided
        if (!jobData.applicationQuestions || jobData.applicationQuestions.length === 0) {
            if (jobData.jobQuestions && jobData.jobQuestions.length > 0) {
                console.log('Transforming job questions to application questions format...');
                
                jobData.applicationQuestions = jobData.jobQuestions.map(question => {
                    const options = jobData.selectedOptions && jobData.selectedOptions[question] 
                        ? jobData.selectedOptions[question] 
                        : [];
                    const required = jobData.mandatoryQuestions && jobData.mandatoryQuestions.includes(question);
                    
                    // Ensure options is always an array and has at least one option
                    let finalOptions = options;
                    if (!finalOptions || finalOptions.length === 0) {
                        // If no options provided, create default options
                        finalOptions = ['Yes', 'No'];
                        console.log(`No options provided for question "${question}", using default options:`, finalOptions);
                    }
                    
                    console.log(`Processing question: "${question}"`, {
                        hasOptions: !!finalOptions.length,
                        optionsCount: finalOptions.length,
                        options: finalOptions,
                        required: required
                    });
                    
                    return {
                        question: question,
                        options: finalOptions,
                        required: required
                    };
                });
                
                console.log('Transformed application questions:', {
                    count: jobData.applicationQuestions.length,
                    questions: jobData.applicationQuestions
                });
            } else {
                // Ensure applicationQuestions is an empty array if no questions
                jobData.applicationQuestions = [];
                console.log('No job questions provided, setting applicationQuestions to empty array');
            }
        } else {
            console.log('ApplicationQuestions already provided, skipping transformation');
        }
        
        // No need to set up pay range as currency, from, and to are now direct fields in the model
        
        const job = await Job.create(jobData);

        // Verify the job was created with applicationQuestions
        console.log('=== JOB CREATION VERIFICATION ===');
        console.log('Created job details:', {
            jobId: job._id,
            jobTitle: job.jobTitle,
            hasApplicationQuestions: !!(job.applicationQuestions && job.applicationQuestions.length > 0),
            applicationQuestionsCount: job.applicationQuestions?.length || 0,
            applicationQuestions: job.applicationQuestions
        });

        // Find similar users after job creation
        console.log('🚀 Job created successfully, now finding similar users...');
        const userMatches = await findSimilarUsers(jobData);
        
        // Send job alert emails to matched users (only if not created via payment)
        if (!jobData.skipEmailAlerts && userMatches.matches && userMatches.matches.length > 0) {
            console.log(`📧 Sending BCC job alert emails to ${userMatches.matches.length} users with skills for job: ${jobData.jobTitle}`);
            // Extract user objects from the matches (which contain user, score, matchDetails)
            const matchedUsers = userMatches.matches.map(match => match.user);
            const emailResult = await sendJobAlertEmails(job, matchedUsers);
            console.log(`✅ BCC emails sent successfully: ${emailResult.sentCount}/${emailResult.totalCount} recipients`);
        } else if (jobData.skipEmailAlerts) {
            console.log(`⏭️ Skipping email alerts for job: ${jobData.jobTitle} (created via payment flow)`);
        }

        // Send system messages to best-fit candidates (NEW FEATURE)
        if (userMatches.matches && userMatches.matches.length > 0) {
            console.log(`🔔 Sending system messages to best-fit candidates for job: ${jobData.jobTitle}`);
            
            // Get top matches for system messages (higher quality than email alerts)
            const topMatches = userMatches.matches
                .filter(match => match.score >= 40) // Higher threshold for system messages
                .slice(0, 15); // Limit to top 15 candidates
            
            if (topMatches.length > 0) {
                const systemMessageResult = await systemMessageService.sendJobNotificationMessages(
                    job, 
                    topMatches, 
                    {
                        maxMessages: 15,
                        minScore: 40,
                        messageTemplate: null // Use default template
                    }
                );
                
                console.log(`✅ System messages sent: ${systemMessageResult.sentCount}/${systemMessageResult.totalCount}`);
            } else {
                console.log(`⚠️ No qualified candidates found for system messages (min score: 40)`);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Job created successfully',
            job,
            userMatches: {
                totalCandidates: userMatches.totalCandidates,
                topMatches: userMatches.topMatches,
                emailSent: userMatches.matches ? userMatches.matches.length : 0,
                systemMessagesSent: userMatches.matches ? 
                    userMatches.matches.filter(match => match.score >= 40).slice(0, 15).length : 0
            }
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
            })) || [],
            applicationQuestionsCount: job.applicationQuestions?.length || 0,
            applicationQuestions: job.applicationQuestions,
            jobQuestionsCount: job.jobQuestions?.length || 0,
            jobQuestions: job.jobQuestions
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

        // Process array fields to ensure they are properly formatted (same logic as createJob)
        const processArrayField = (fieldName, data) => {
            if (data[fieldName]) {
                if (Array.isArray(data[fieldName])) {
                // Filter out empty strings and trim whitespace
                    data[fieldName] = data[fieldName]
                        .map(item => typeof item === 'string' ? item.trim() : String(item))
                        .filter(item => item.length > 0);
                } else if (typeof data[fieldName] === 'string') {
                // If it's a string, split by comma and process
                    data[fieldName] = data[fieldName]
                    .split(',')
                        .map(item => item.trim())
                        .filter(item => item.length > 0);
            } else {
                // If invalid format, set to empty array
                    data[fieldName] = [];
                }
            } else {
                data[fieldName] = [];
            }
        };

        // Process all array fields
        processArrayField('shortDescription', jobData);
        processArrayField('jobSkills', jobData);
        processArrayField('jobKeywords', jobData);
        processArrayField('sellingPoints', jobData);
        processArrayField('jobQuestions', jobData);
        processArrayField('mandatoryQuestions', jobData);
        
        // Ensure showShortDescription is a boolean
        if (typeof jobData.showShortDescription !== 'boolean') {
            jobData.showShortDescription = false;
        }
        
        // If showShortDescription is false, clear shortDescription
        if (!jobData.showShortDescription) {
            jobData.shortDescription = [];
        }
        
        // Log processed short description data for debugging
        console.log('Updated job short description data:', {
            showShortDescription: jobData.showShortDescription,
            shortDescription: jobData.shortDescription,
            shortDescriptionLength: jobData.shortDescription?.length || 0
        });

        // Transform jobQuestions + selectedOptions + mandatoryQuestions to applicationQuestions
        console.log('Input data for update:', {
            jobQuestions: jobData.jobQuestions,
            selectedOptions: jobData.selectedOptions,
            mandatoryQuestions: jobData.mandatoryQuestions,
            hasApplicationQuestions: !!(jobData.applicationQuestions && jobData.applicationQuestions.length > 0),
            applicationQuestionsLength: jobData.applicationQuestions?.length || 0
        });
        
        // Only transform if applicationQuestions are not already provided
        if (!jobData.applicationQuestions || jobData.applicationQuestions.length === 0) {
            if (jobData.jobQuestions && jobData.jobQuestions.length > 0) {
                console.log('Transforming job questions to application questions format (update)...');
                
                jobData.applicationQuestions = jobData.jobQuestions.map(question => {
                    const options = jobData.selectedOptions && jobData.selectedOptions[question] 
                        ? jobData.selectedOptions[question] 
                        : [];
                    const required = jobData.mandatoryQuestions && jobData.mandatoryQuestions.includes(question);
                    
                    // Ensure options is always an array and has at least one option
                    let finalOptions = options;
                    if (!finalOptions || finalOptions.length === 0) {
                        // If no options provided, create default options
                        finalOptions = ['Yes', 'No'];
                        console.log(`No options provided for question "${question}", using default options:`, finalOptions);
                    }
                    
                    return {
                        question: question,
                        options: finalOptions,
                        required: required
                    };
                });
                
                console.log('Transformed application questions (update):', {
                    count: jobData.applicationQuestions.length,
                    questions: jobData.applicationQuestions
                });
            } else {
                // Ensure applicationQuestions is an empty array if no questions
                jobData.applicationQuestions = [];
                console.log('No job questions provided for update, setting applicationQuestions to empty array');
            }
        } else {
            console.log('ApplicationQuestions already provided for update, skipping transformation');
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
        const { questionResponses, selectedResume, selectedCoverLetter } = req.body;
        console.log('=== JOB APPLICATION REQUEST ===');
        console.log('Job application request:', {
            jobId: req.params.id,
            userId: req.user.id,
            hasQuestionResponses: !!questionResponses,
            questionResponsesLength: questionResponses?.length || 0,
            questionResponses: questionResponses,
            hasSelectedResume: !!selectedResume,
            hasSelectedCoverLetter: !!selectedCoverLetter,
            selectedResume: selectedResume,
            selectedCoverLetter: selectedCoverLetter
        });
        
        const job = await Job.findById(req.params.id);

        if (!job) {
            return res.status(404).json({
                success: false,
                message: 'Job not found'
            });
        }

        console.log('Job found:', {
            jobId: job._id,
            jobTitle: job.jobTitle,
            hasApplicationQuestions: !!(job.applicationQuestions && job.applicationQuestions.length > 0),
            applicationQuestionsCount: job.applicationQuestions?.length || 0,
            applicationQuestions: job.applicationQuestions
        });

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

            // If questionResponses is provided, validate it
            if (questionResponses && questionResponses.length > 0) {
                // Only validate that we have responses for all questions if responses are provided
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
            } else {
                // If no questionResponses provided but job has questions, check if any are required
                const requiredQuestions = job.applicationQuestions.filter(q => q.required);
                if (requiredQuestions.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `This job has ${requiredQuestions.length} required questions that must be answered before applying`
                    });
                }
            }
        }

        // Prepare applicant data
        const applicantData = {
            user: req.user.id,
            status: 'Pending'
        };

        // Add resume and cover letter information if provided
        if (selectedResume) {
            applicantData.selectedResume = selectedResume;
        }
        
        if (selectedCoverLetter) {
            applicantData.selectedCoverLetter = selectedCoverLetter;
        }

        // Add question responses if they exist
        if (job.applicationQuestions && job.applicationQuestions.length > 0) {
            if (questionResponses && questionResponses.length > 0) {
                // Map all responses to match the job's questions structure
                const mappedResponses = job.applicationQuestions.map((question, index) => {
                    const response = questionResponses[index];
                    return {
                        question: question.question,
                        selectedOption: response?.selectedOption || '',
                        options: question.options
                    };
                });
                
                applicantData.questionResponses = mappedResponses;
                
                console.log('Adding question responses to applicant:', {
                    jobId: req.params.id,
                    userId: req.user.id,
                    questionResponsesCount: applicantData.questionResponses.length,
                    questionResponses: applicantData.questionResponses,
                    originalResponsesCount: questionResponses.length,
                    mappedResponses: mappedResponses.length
                });
            } else {
                // If no responses provided but job has questions, create empty responses
                const emptyResponses = job.applicationQuestions.map(question => ({
                    question: question.question,
                    selectedOption: '',
                    options: question.options
                }));
                
                applicantData.questionResponses = emptyResponses;
                
                console.log('Adding empty question responses to applicant:', {
                    jobId: req.params.id,
                    userId: req.user.id,
                    questionResponsesCount: applicantData.questionResponses.length,
                    questionResponses: applicantData.questionResponses
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

        // Update user's appliedJobs array
        try {
            const updatedUser = await User.findByIdAndUpdate(
                req.user.id,
                { $addToSet: { appliedJobs: job._id } },
                { new: true }
            );
            
            if (updatedUser) {
                console.log('Successfully updated user appliedJobs array');
            } else {
                console.error('User not found when updating appliedJobs');
            }
        } catch (userUpdateError) {
            console.error('Error updating user appliedJobs:', userUpdateError);
            // Don't fail the entire application if user update fails
            // But log it for debugging
        }

        // Create application response record if there are questions
        if (job.applicationQuestions && job.applicationQuestions.length > 0) {
            try {
                const ApplicationResponse = (await import('../models/application_response.model.js')).default;
                
                // Map all questions with their responses
                const mappedResponses = job.applicationQuestions.map((question, index) => {
                    const response = questionResponses ? questionResponses[index] : null;
                    return {
                        question: question.question,
                        selectedOption: response?.selectedOption || '',
                        options: question.options
                    };
                });
                
                const applicationResponse = new ApplicationResponse({
                    userId: req.user.id,
                    jobId: job._id,
                    jobPostedBy: job.postedBy,
                    questionResponses: mappedResponses,
                    status: 'pending'
                });

                await applicationResponse.save();
                console.log('Application response saved successfully:', {
                    jobId: job._id,
                    userId: req.user.id,
                    responsesCount: mappedResponses.length,
                    responses: mappedResponses
                });
            } catch (responseError) {
                console.error('Error saving application response:', responseError);
                
                // Log detailed error information
                if (responseError.name === 'ValidationError') {
                    console.error('Validation errors:', responseError.errors);
                } else if (responseError.code === 11000) {
                    console.error('Duplicate key error - user may have already applied');
                }
                
                // Don't fail the entire application if response saving fails
                // But log it for debugging
            }
        }

        res.json({
            success: true,
            message: 'Application submitted successfully'
        });

        console.log('=== APPLICATION SUBMITTED SUCCESSFULLY ===');
        console.log('Final applicant data saved:', {
            jobId: job._id,
            userId: req.user.id,
            applicantData: applicantData,
            totalApplicants: job.applicants.length,
            newApplicant: job.applicants[job.applicants.length - 1]
        });
    } catch (error) {
        console.error('Error in applyForJob:', {
            jobId: req.params.id,
            userId: req.user.id,
            error: error.message,
            stack: error.stack
        });
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

        console.log(`Retrieved ${responses.length} application responses for job ${jobId}`);

        res.json({
            success: true,
            count: responses.length,
            responses
        });
    } catch (error) {
        console.error('Error getting application responses:', error);
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

        console.log(`Retrieved application response for user ${req.user.id} and job ${jobId}`);

        res.json({
            success: true,
            response
        });
    } catch (error) {
        console.error('Error getting user application response:', error);
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
            'skills_and_capabilities work_history education dream_job_title preferred_job_types work_env_preferences relocation appliedJobs savedJobs highest_qualification known_language personal_branding_statement hobbies next_role_info profileCompletionPercentage notInterestedJobCategories'
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Enhanced profile completion check with correct field names
        const missingFields = [];
        const profileRequirements = {
            'skills_and_capabilities': 'Skills & Capabilities',
            'personal_branding_statement': 'Personal Summary',
            'dream_job_title': 'Dream Job Title',
            'preferred_job_types': 'Preferred Job Types',
            'highest_qualification': 'Highest Qualification',
            'work_env_preferences': 'Work Environment Preferences'
        };

        // Check required fields for better recommendations
        for (const [field, displayName] of Object.entries(profileRequirements)) {
            if (!user[field] || (Array.isArray(user[field]) && user[field].length === 0)) {
                missingFields.push(displayName);
            }
        }

        // Additional checks for work history and education
        if (!user.work_history || user.work_history.length === 0) {
            missingFields.push('Work History');
        }
        if (!user.education || user.education.length === 0) {
            missingFields.push('Education');
        }

        // Calculate profile completion score (out of 8 total fields)
        const totalFields = 8;
        const completedFields = totalFields - missingFields.length;
        const completionPercentage = Math.round((completedFields / totalFields) * 100);

        // More flexible profile completion requirements
        const hasEssentialFields = user.skills_and_capabilities && user.skills_and_capabilities.length > 0;
        const hasJobPreferences = user.dream_job_title || (user.preferred_job_types && user.preferred_job_types.length > 0);
        const hasBasicInfo = user.highest_qualification || user.personal_branding_statement;

        // If critical fields are missing, return profile completion message
        // Require at least essential fields (skills) plus either job preferences or basic info
        if (!hasEssentialFields || (!hasJobPreferences && !hasBasicInfo)) {
            return res.json({
                success: false,
                profileIncomplete: true,
                missingFields: missingFields,
                completionPercentage: completionPercentage,
                count: 0,
                jobs: [],
                message: `Complete your profile to get personalized recommendations. Missing: ${missingFields.join(', ')}`
            });
        }

        // If profile is somewhat complete but could be better
        if (completionPercentage < 60) {
            console.log(`User ${userId} has ${completionPercentage}% profile completion. Providing limited recommendations.`);
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
        
        // Filter out jobs from categories user is not interested in
        const notInterestedSubCategories = new Set();
        if (user.notInterestedJobCategories && user.notInterestedJobCategories.length > 0) {
            user.notInterestedJobCategories.forEach(category => {
                notInterestedSubCategories.add(category.jobSubCategory);
            });
        }
        
        const availableJobs = allJobs.filter(job => 
            !appliedJobIds.has(job._id.toString()) && 
            !savedJobIds.has(job._id.toString()) &&
            !notInterestedSubCategories.has(job.subcategory)
        );

        console.log(`Recommendations Debug - Total jobs: ${allJobs.length}, Available after filtering: ${availableJobs.length}, Applied: ${appliedJobIds.size}, Saved: ${savedJobIds.size}, Not interested categories: ${notInterestedSubCategories.size}`);

        // Calculate scores efficiently with enhanced algorithm
        const jobsWithScores = availableJobs.map(job => {
            const score = calculateEnhancedRecommendationScore(user, job);
            return {
                job,
                score,
                matchReasons: getEnhancedMatchReasons(user, job)
            };
        });

        // Get top 8 jobs with score > 10 (lowered threshold for more results)
        const topRecommendations = jobsWithScores
            .filter(item => item.score > 10)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        console.log(`Recommendations Debug - Jobs with scores > 10: ${jobsWithScores.filter(item => item.score > 10).length}, Top recommendations: ${topRecommendations.length}`);

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
                .slice(0, 8)
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

        console.log('\n🚀 ===== PROMOTION NOTIFICATION ANALYSIS =====');
        console.log(`📋 Job: ${job.jobTitle}`);
        console.log(`🏢 Company: ${job.postedBy.companyName}`);
        console.log(`🎯 Promotion Type: ${promotionType}`);
        console.log('');

        // Function to analyze profile completeness
        const analyzeProfileCompleteness = (user) => {
            const missingFields = [];
            const profileFields = {
                'Skills & Capabilities': user.skills_and_capabilities?.length > 0,
                'Dream Job Title': !!user.dream_job_title,
                'Preferred Job Types': user.preferred_job_types?.length > 0,
                'Work Environment Preferences': user.work_env_preferences?.length > 0,
                'Resident Country': !!user.resident_country,
                'Highest Qualification': !!user.highest_qualification,
                'Personal Branding Statement': !!user.personal_branding_statement,
                'Resume': !!user.resume,
                'Work History': user.work_history?.length > 0,
                'Education': user.education?.length > 0,
                'Achievements': user.achievements?.length > 0,
                'Licenses': user.licenses?.length > 0,
                'Hobbies': user.hobbies?.length > 0,
                'Social Links': !!(user.social_links?.linkedin || user.social_links?.github || user.social_links?.portfolio),
                'Emergency Contact': !!(user.emergency_contact?.name && user.emergency_contact?.phone)
            };

            Object.entries(profileFields).forEach(([field, hasValue]) => {
                if (!hasValue) {
                    missingFields.push(field);
                }
            });

            const completedFields = Object.keys(profileFields).length - missingFields.length;
            const completionPercentage = Math.round((completedFields / Object.keys(profileFields).length) * 100);

            return {
                missingFields,
                completionPercentage,
                totalFields: Object.keys(profileFields).length,
                completedFields
            };
        };
        
        // Get users who might be interested in this job
        const potentialUsers = await User.find({
            // Only users with completed profiles
            isProfileCompleted: true,
            // Exclude users who have already applied
            appliedJobs: { $ne: jobId },
            // Exclude users who have saved this job
            savedJobs: { $ne: jobId }
        }).select('_id name email skills_and_capabilities dream_job_title work_history preferred_job_types work_env_preferences messagesFromEmployer resident_country relocation highest_qualification personal_branding_statement resume education achievements licenses hobbies social_links emergency_contact notInterestedJobCategories');
        
        console.log(`📊 Found ${potentialUsers.length} potential users for promotion`);
        
        // Filter out users who have marked this job category as not interested
        const filteredUsers = potentialUsers.filter(user => {
            if (!user.notInterestedJobCategories || user.notInterestedJobCategories.length === 0) {
                return true; // User has no not interested categories
            }
            
            // Check if user has marked this specific subcategory as not interested
            return !user.notInterestedJobCategories.some(category => 
                category.jobSubCategory === job.subcategory
            );
        });
        
        console.log(`📊 After filtering not interested categories: ${filteredUsers.length} users`);
        
        const companyName = job.postedBy.companyName || 'Company';
        const notifiedUsers = [];
        const userAnalysis = [];
        
        // Analyze each user and calculate match scores
        for (const user of filteredUsers) {
            const profileAnalysis = analyzeProfileCompleteness(user);
            
            // Calculate enhanced match score
            const matchScore = calculateEnhancedRecommendationScore(user, job);
            
            userAnalysis.push({
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    skills_and_capabilities: user.skills_and_capabilities,
                    dream_job_title: user.dream_job_title,
                    preferred_job_types: user.preferred_job_types,
                    work_env_preferences: user.work_env_preferences,
                    resident_country: user.resident_country
                },
                matchScore: Math.round(matchScore * 10) / 10,
                profileAnalysis,
                matchReasons: getEnhancedMatchReasons(user, job)
            });
        }

        // Sort users by match score
        userAnalysis.sort((a, b) => b.matchScore - a.matchScore);

        // Show detailed analysis in console
        console.log('\n🏆 TOP MATCHES FOR PROMOTION:');
        userAnalysis.slice(0, 20).forEach((analysis, index) => {
            console.log(`\n${index + 1}. ${analysis.user.name} (${analysis.user.email})`);
            console.log(`   📊 Match Score: ${analysis.matchScore}/100`);
            console.log(`   📈 Profile Completion: ${analysis.profileAnalysis.completionPercentage}%`);
            console.log(`   🎯 Match Reasons: ${analysis.matchReasons.join(', ')}`);
            
            if (analysis.profileAnalysis.missingFields.length > 0) {
                console.log(`   ❌ Missing Fields: ${analysis.profileAnalysis.missingFields.join(', ')}`);
            } else {
                console.log(`   ✅ Profile Complete`);
            }
            
            console.log(`   📍 Location: ${analysis.user.resident_country || 'Not specified'}`);
            console.log(`   💼 Dream Job: ${analysis.user.dream_job_title || 'Not specified'}`);
            console.log(`   🔧 Skills: ${analysis.user.skills_and_capabilities?.slice(0, 5).join(', ') || 'None'}${analysis.user.skills_and_capabilities?.length > 5 ? '...' : ''}`);
        });

        // Show profile completion statistics
        const completionStats = {
            '90-100%': 0,
            '80-89%': 0,
            '70-79%': 0,
            '60-69%': 0,
            '50-59%': 0,
            '40-49%': 0,
            '30-39%': 0,
            '20-29%': 0,
            '10-19%': 0,
            '0-9%': 0
        };

        userAnalysis.forEach(analysis => {
            const completion = analysis.profileAnalysis.completionPercentage;
            if (completion >= 90) completionStats['90-100%']++;
            else if (completion >= 80) completionStats['80-89%']++;
            else if (completion >= 70) completionStats['70-79%']++;
            else if (completion >= 60) completionStats['60-69%']++;
            else if (completion >= 50) completionStats['50-59%']++;
            else if (completion >= 40) completionStats['40-49%']++;
            else if (completion >= 30) completionStats['30-39%']++;
            else if (completion >= 20) completionStats['20-29%']++;
            else if (completion >= 10) completionStats['10-19%']++;
            else completionStats['0-9%']++;
        });

        console.log('\n📊 PROFILE COMPLETION STATISTICS:');
        Object.entries(completionStats).forEach(([range, count]) => {
            if (count > 0) {
                const percentage = Math.round((count / potentialUsers.length) * 100);
                console.log(`   ${range}: ${count} users (${percentage}%)`);
            }
        });

        // Show most common missing fields
        const missingFieldsCount = {};
        userAnalysis.forEach(analysis => {
            analysis.profileAnalysis.missingFields.forEach(field => {
                missingFieldsCount[field] = (missingFieldsCount[field] || 0) + 1;
            });
        });

        const sortedMissingFields = Object.entries(missingFieldsCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        if (sortedMissingFields.length > 0) {
            console.log('\n❌ MOST COMMON MISSING FIELDS:');
            sortedMissingFields.forEach(([field, count]) => {
                const percentage = Math.round((count / potentialUsers.length) * 100);
                console.log(`   ${field}: ${count} users (${percentage}%)`);
            });
        }
        
        // Create promotion message for each matching user
        for (const analysis of userAnalysis) {
            const user = analysis.user;
            const matchScore = analysis.matchScore;
            
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
                
                // Find the user document to update
                const userDoc = potentialUsers.find(u => u._id.toString() === user._id.toString());
                if (userDoc) {
                // Add message to user's messagesFromEmployer array
                    userDoc.messagesFromEmployer.push(promotionMessage);
                    await userDoc.save();
                
                notifiedUsers.push({
                    userId: user._id,
                        name: user.name,
                        email: user.email,
                        matchScore: matchScore,
                        profileCompletion: analysis.profileAnalysis.completionPercentage,
                        missingFields: analysis.profileAnalysis.missingFields
                    });
                }
            }
        }

        console.log(`\n📧 PROMOTION NOTIFICATIONS SENT:`);
        console.log(`   Total Users Analyzed: ${potentialUsers.length}`);
        console.log(`   Users with Match Score > 10: ${userAnalysis.filter(u => u.matchScore > 10).length}`);
        console.log(`   Notifications Sent: ${notifiedUsers.length}`);
        
        if (notifiedUsers.length > 0) {
            console.log('\n📨 NOTIFIED USERS:');
            notifiedUsers.slice(0, 10).forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.name} (${user.email})`);
                console.log(`      📊 Match Score: ${user.matchScore}`);
                console.log(`      📈 Profile Completion: ${user.profileCompletion}%`);
                if (user.missingFields.length > 0) {
                    console.log(`      ❌ Missing: ${user.missingFields.slice(0, 3).join(', ')}${user.missingFields.length > 3 ? '...' : ''}`);
                }
            });
        }
        
        // Update job with promotion status
        await Job.findByIdAndUpdate(jobId, {
            premiumListing: promotionType === 'premium_listing' ? true : job.premiumListing,
            immediateStart: promotionType === 'urgent_hiring' ? true : job.immediateStart,
            promotionType: promotionType,
            promotedAt: new Date()
        });

        console.log('\n✅ ===== PROMOTION ANALYSIS COMPLETE =====\n');
        
        res.json({
            success: true,
            message: `Promotion notifications sent to ${notifiedUsers.length} users`,
            notifiedUsers: notifiedUsers,
            promotionType: promotionType,
            analysis: {
                totalUsersAnalyzed: potentialUsers.length,
                usersWithMatchScore: userAnalysis.filter(u => u.matchScore > 10).length,
                notificationsSent: notifiedUsers.length,
                completionStats,
                mostCommonMissingFields: sortedMissingFields
            }
        });
        
    } catch (error) {
        console.error('Error sending promotion notifications:', error);
        next(error);
    }
};

// Get job categories
export const getJobCategories = async (req, res, next) => {
    try {
        // Define job categories (this could be moved to a separate config file)
        const categories = [
            'Accounting & Finance',
            'Administration',
            'Advertising & Media',
            'Banking & Financial Services',
            'Call Centre',
            'Community Services',
            'Construction',
            'Consulting & Strategy',
            'Customer Service',
            'Design & Architecture',
            'Education & Training',
            'Engineering & Technical',
            'Farming & Agriculture',
            'Government',
            'Healthcare',
            'Hospitality & Tourism',
            'Human Resources',
            'Information Technology',
            'Insurance & Superannuation',
            'Legal Services',
            'Manufacturing',
            'Marketing & Communications',
            'Mining & Resources',
            'Real Estate',
            'Retail',
            'Sales & Marketing',
            'Science & Research',
            'Self Employment',
            'Sport & Recreation',
            'Transport & Logistics',
            'Trades & Services'
        ];
        
        res.status(200).json({
            success: true,
            categories
        });
    } catch (error) {
        next(error);
    }
};

// Get job subcategories based on category
export const getJobSubcategories = async (req, res, next) => {
    try {
        const { category } = req.params;
        
        if (!category) {
            return res.status(400).json({
                success: false,
                message: 'Category is required'
            });
        }
        
        // Define subcategories for each category
        const subcategoriesMap = {
            'Accounting & Finance': [
                'Accountant',
                'Accounts Payable',
                'Accounts Receivable',
                'Bookkeeper',
                'Financial Controller',
                'Financial Analyst',
                'Payroll Officer',
                'Tax Accountant'
            ],
            'Administration': [
                'Administrative Assistant',
                'Office Manager',
                'Receptionist',
                'Personal Assistant',
                'Data Entry',
                'Executive Assistant'
            ],
            'Information Technology': [
                'Software Developer',
                'Web Developer',
                'Data Scientist',
                'DevOps Engineer',
                'System Administrator',
                'Network Engineer',
                'UI/UX Designer',
                'Product Manager',
                'QA Engineer',
                'Mobile Developer'
            ],
            'Sales & Marketing': [
                'Sales Representative',
                'Marketing Manager',
                'Digital Marketing',
                'Business Development',
                'Account Manager',
                'Sales Manager',
                'Marketing Coordinator'
            ],
            'Healthcare': [
                'Registered Nurse',
                'General Practitioner',
                'Physiotherapist',
                'Pharmacist',
                'Medical Receptionist',
                'Healthcare Assistant'
            ]
        };
        
        const subcategories = subcategoriesMap[category] || [];
        
        res.status(200).json({
            success: true,
            subcategories
        });
    } catch (error) {
        next(error);
    }
};

// Get job statistics
export const getJobStatistics = async (req, res, next) => {
    try {
        // Get total jobs count
        const totalJobs = await Job.countDocuments({ status: 'Open' });
        
        // Get jobs by category
        const jobsByCategory = await Job.aggregate([
            { $match: { status: 'Open' } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        // Get jobs by work type
        const jobsByWorkType = await Job.aggregate([
            { $match: { status: 'Open' } },
            { $group: { _id: '$workType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        // Get jobs by location (top locations)
        const jobsByLocation = await Job.aggregate([
            { $match: { status: 'Open' } },
            { $group: { _id: '$jobLocation', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        
        // Get recent jobs (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentJobs = await Job.countDocuments({
            status: 'Open',
            createdAt: { $gte: sevenDaysAgo }
        });
        
        res.status(200).json({
            success: true,
            statistics: {
                totalJobs,
                recentJobs,
                jobsByCategory,
                jobsByWorkType,
                jobsByLocation
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get saved jobs for a user
export const getSavedJobs = async (req, res, next) => {
    try {
        const userId = req.user._id;
        
        // Find user and populate saved jobs
        const user = await User.findById(userId).populate('savedJobs');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Get saved jobs with full details
        const savedJobs = user.savedJobs || [];
        
        res.status(200).json({
            success: true,
            jobs: savedJobs
        });
    } catch (error) {
        next(error);
    }
};

// Save or unsave a job
export const saveJob = async (req, res, next) => {
    try {
        const { jobId } = req.params;
        const { action } = req.body; // 'save' or 'unsave'
        const userId = req.user._id;
        
        if (!jobId || !action) {
            return res.status(400).json({
                success: false,
                message: 'Job ID and action are required'
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
        
        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Initialize savedJobs array if it doesn't exist
        if (!user.savedJobs) {
            user.savedJobs = [];
        }
        
        if (action === 'save') {
            // Add job to saved jobs if not already saved
            if (!user.savedJobs.includes(jobId)) {
                user.savedJobs.push(jobId);
            }
        } else if (action === 'unsave') {
            // Remove job from saved jobs
            user.savedJobs = user.savedJobs.filter(id => id.toString() !== jobId);
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid action. Use "save" or "unsave"'
            });
        }
        
        await user.save();
        
        res.status(200).json({
            success: true,
            message: action === 'save' ? 'Job saved successfully' : 'Job removed from saved jobs',
            savedJobs: user.savedJobs
        });
    } catch (error) {
        next(error);
    }
}; 