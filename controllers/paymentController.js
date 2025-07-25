import Stripe from 'stripe';
import Payment from '../models/Payment.model.js';
import Job from '../models/Job.model.js';
import Employer from '../models/employer.model.js';
import User from '../models/User.js';
import ErrorResponse from '../utils/errorResponse.js';
import mongoose from 'mongoose';
import { sendJobAlertEmails } from './broadcastController.js';

// Initialize Stripe with error handling
let stripe;
try {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_your_stripe_secret_key_here') {
        console.warn('⚠️  STRIPE_SECRET_KEY not configured. Payment functionality will be disabled.');
        console.warn('   Please set your Stripe secret key in the .env file');
        stripe = null;
    } else {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        console.log('✅ Stripe initialized successfully');
    }
} catch (error) {
    console.error('❌ Failed to initialize Stripe:', error.message);
    stripe = null;
}

// Pricing configuration matching frontend
const PRICING_CONFIG = {
    STANDARD: {
        id: 'Standard',
        name: 'Standard Listing',
        price: 4900, // $49.00 in cents (early bird)
        regularPrice: 19900, // $199.00 in cents
    },
    NOTIFICATION_PACKAGES: {
        Boosted100App: { id: 'Boosted100App', name: 'Boosted 100 - App Only', price: 4900 },
        Boosted100Email: { id: 'Boosted100Email', name: 'Boosted 100 - Email Only', price: 4900 },
        Boosted100Both: { id: 'Boosted100Both', name: 'Boosted 100 - Both', price: 6900, savings: 2900 },
        Boosted250App: { id: 'Boosted250App', name: 'Boosted 250 - App Only', price: 9900 },
        Boosted250Email: { id: 'Boosted250Email', name: 'Boosted 250 - Email Only', price: 9900 },
        Boosted250Both: { id: 'Boosted250Both', name: 'Boosted 250 - Both', price: 12900, savings: 6900 },
        Boosted500App: { id: 'Boosted500App', name: 'Boosted 500 - App Only', price: 14900 },
        Boosted500Email: { id: 'Boosted500Email', name: 'Boosted 500 - Email Only', price: 14900 },
        Boosted500Both: { id: 'Boosted500Both', name: 'Boosted 500 - Both', price: 18900, savings: 10900 },
        Boosted750App: { id: 'Boosted750App', name: 'Boosted 750 - App Only', price: 19900 },
        Boosted750Email: { id: 'Boosted750Email', name: 'Boosted 750 - Email Only', price: 19900 },
        Boosted750Both: { id: 'Boosted750Both', name: 'Boosted 750 - Both', price: 24900, savings: 14900 },
        Boosted1000App: { id: 'Boosted1000App', name: 'Boosted 1000 - App Only', price: 24900 },
        Boosted1000Email: { id: 'Boosted1000Email', name: 'Boosted 1000 - Email Only', price: 24900 },
        Boosted1000Both: { id: 'Boosted1000Both', name: 'Boosted 1000 - Both', price: 29900, savings: 19900 }
    },
    ADD_ONS: {
        immediateStart: { id: 'immediateStart', name: 'Immediate Start Badge', price: 1900 },
        referenceCheck: { id: 'referenceCheck', name: 'Reference Check Access', price: 1900 }
    }
};

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
                score = 60;
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
        console.log('\n🎯 ===== PAYMENT PERFECT JOB MATCHING ANALYSIS =====');
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

        console.log('\n✅ ===== PAYMENT SKILLS-BASED ANALYSIS COMPLETE =====\n');

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

// Helper function to check if Stripe is available
const checkStripeAvailable = () => {
    if (!stripe) {
        throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.');
    }
};

// Create payment intent for job posting
export const createJobPostingPayment = async (req, res) => {
    try {
        checkStripeAvailable();
        
        const { planId, amount, employerId, jobData, addOns = [], packageId, candidateCount, notificationType } = req.body;

        // Validate input
        if (!planId || !amount || !employerId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: planId, amount, employerId'
            });
        }

        // Convert employerId to ObjectId if it's a valid string
        let objectIdEmployerId = employerId;
        if (typeof employerId === 'string' && mongoose.Types.ObjectId.isValid(employerId)) {
            objectIdEmployerId = new mongoose.Types.ObjectId(employerId);
        }

        console.log('Creating payment for employer:', objectIdEmployerId);

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'aud',
            metadata: {
                type: 'job_posting',
                planId: planId,
                employerId: employerId,
                jobTitle: jobData?.title || 'Job Posting'
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Store payment record in database
        const paymentRecord = new Payment({
            employerId: objectIdEmployerId,
            stripePaymentIntentId: paymentIntent.id,
            amount: amount,
            type: 'job_posting',
            planId: planId,
            status: 'pending',
            jobData: jobData,
            addOns: addOns,
            packageId: packageId,
            candidateCount: candidateCount,
            notificationType: notificationType,
            metadata: {
                stripeCustomerId: paymentIntent.customer,
                paymentMethodTypes: paymentIntent.payment_method_types
            }
        });

        await paymentRecord.save();
        console.log('Payment record saved:', paymentRecord._id);

        res.json({
            success: true,
            client_secret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: amount,
            paymentRecordId: paymentRecord._id
        });

    } catch (error) {
        console.error('Error creating job posting payment:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create payment intent',
            error: error.message
        });
    }
};

// Create payment intent for notification packages
export const createNotificationPayment = async (req, res) => {
    try {
        checkStripeAvailable();
        
        const { packageId, amount, employerId, jobId, candidateCount, notificationType } = req.body;

        // Validate input
        if (!packageId || !amount || !employerId || !jobId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Create payment intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'aud',
            metadata: {
                type: 'notification_package',
                packageId: packageId,
                employerId: employerId,
                jobId: jobId
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        // Store payment record in database
        const paymentRecord = new Payment({
            employerId: employerId,
            jobId: jobId,
            stripePaymentIntentId: paymentIntent.id,
            amount: amount,
            type: 'notification_package',
            packageId: packageId,
            candidateCount: candidateCount,
            notificationType: notificationType,
            status: 'pending',
            metadata: {
                stripeCustomerId: paymentIntent.customer,
                paymentMethodTypes: paymentIntent.payment_method_types
            }
        });

        await paymentRecord.save();

        res.json({
            success: true,
            client_secret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: amount,
            paymentRecordId: paymentRecord._id
        });

    } catch (error) {
        console.error('Error creating notification payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment intent',
            error: error.message
        });
    }
};

// Confirm payment success
export const confirmPaymentSuccess = async (req, res) => {
    try {
        checkStripeAvailable();
        
        const { paymentIntentId } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({
                success: false,
                message: 'Payment intent ID is required'
            });
        }

        // Get payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({
                success: false,
                message: 'Payment has not succeeded'
            });
        }

        // Update payment record in database
        const paymentRecord = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
        if (paymentRecord) {
            paymentRecord.status = 'completed';
            paymentRecord.completedAt = new Date();
            paymentRecord.stripeCustomerId = paymentIntent.customer;
            paymentRecord.metadata = {
                ...paymentRecord.metadata,
                paymentMethod: paymentIntent.payment_method,
                receiptUrl: paymentIntent.charges?.data[0]?.receipt_url
            };
            await paymentRecord.save();

            // Auto-create job if this is a job posting payment and job data exists
            let createdJob = null;
            if (paymentRecord.type === 'job_posting' && paymentRecord.jobData && paymentRecord.employerId) {
                try {
                    // Get employer details for fallback logo
                    const employer = await Employer.findById(paymentRecord.employerId);
                    
                    // Debug: Log the original job data
                    console.log('🔍 Original job data from payment:', paymentRecord.jobData);
                    
                    // Prepare job data with validation and fallbacks
                    const jobData = {
                        ...paymentRecord.jobData,
                        postedBy: paymentRecord.employerId,
                        isPaid: true,
                        status: 'Open',
                        // Use employer's company logo as fallback if no logo provided
                        companyLogo: paymentRecord.jobData.companyLogo || (employer && employer.companyLogo ? employer.companyLogo : ''),
                        // Ensure required fields have fallback values - handle both 'title' and 'jobTitle' fields
                        jobTitle: paymentRecord.jobData.jobTitle || paymentRecord.jobData.title || 'Job Posting',
                        jobDescription: paymentRecord.jobData.jobDescription || 'Job description will be provided',
                        jobLocation: paymentRecord.jobData.jobLocation || paymentRecord.jobData.location || 'Location TBD',
                        workspaceOption: paymentRecord.jobData.workspaceOption || 'On-site',
                        category: paymentRecord.jobData.category || 'General',
                        subcategory: paymentRecord.jobData.subcategory || 'Other',
                        workType: paymentRecord.jobData.workType || 'Full-time',
                        payType: paymentRecord.jobData.payType || 'Monthly salary',
                        currency: paymentRecord.jobData.currency || 'AUD',
                        from: Number(paymentRecord.jobData.from) || 0,
                        to: Number(paymentRecord.jobData.to) || 0,
                                            // Process array fields using the same logic as the job creation endpoint
                    jobSkills: (() => {
                        const data = paymentRecord.jobData.jobSkills;
                        if (Array.isArray(data)) {
                            return data.map(item => item.trim()).filter(item => item.length > 0);
                        } else if (typeof data === 'string') {
                            return data.split(',').map(item => item.trim()).filter(item => item.length > 0);
                        }
                        return [];
                    })(),
                    jobKeywords: (() => {
                        const data = paymentRecord.jobData.jobKeywords;
                        if (Array.isArray(data)) {
                            return data.map(item => item.trim()).filter(item => item.length > 0);
                        } else if (typeof data === 'string') {
                            return data.split(',').map(item => item.trim()).filter(item => item.length > 0);
                        }
                        return [];
                    })(),
                    sellingPoints: (() => {
                        const data = paymentRecord.jobData.sellingPoints;
                        if (Array.isArray(data)) {
                            return data.map(item => item.trim()).filter(item => item.length > 0);
                        } else if (typeof data === 'string') {
                            return data.split(',').map(item => item.trim()).filter(item => item.length > 0);
                        }
                        return [];
                    })(),
                    shortDescription: (() => {
                        const data = paymentRecord.jobData.shortDescription;
                        if (Array.isArray(data)) {
                            return data.map(item => item.trim()).filter(item => item.length > 0);
                        } else if (typeof data === 'string') {
                            return data.split(',').map(item => item.trim()).filter(item => item.length > 0);
                        }
                        return [];
                    })(),
                    jobQuestions: (() => {
                        const data = paymentRecord.jobData.jobQuestions;
                        if (Array.isArray(data)) {
                            return data.map(item => item.trim()).filter(item => item.length > 0);
                        } else if (typeof data === 'string') {
                            return data.split(',').map(item => item.trim()).filter(item => item.length > 0);
                        }
                        return [];
                    })(),
                    mandatoryQuestions: (() => {
                        const data = paymentRecord.jobData.mandatoryQuestions;
                        if (Array.isArray(data)) {
                            return data.map(item => item.trim()).filter(item => item.length > 0);
                        } else if (typeof data === 'string') {
                            return data.split(',').map(item => item.trim()).filter(item => item.length > 0);
                        }
                        return [];
                    })(),
                        selectedOptions: paymentRecord.jobData.selectedOptions || {},
                        // Premium features
                        premiumListing: Boolean(paymentRecord.jobData.premiumListing),
                        immediateStart: Boolean(paymentRecord.jobData.immediateStart),
                        referencesRequired: Boolean(paymentRecord.jobData.referencesRequired),
                        notificationOption: paymentRecord.jobData.notificationOption || 'both',
                        showShortDescription: Boolean(paymentRecord.jobData.showShortDescription),
                        showSalaryOnAd: Boolean(paymentRecord.jobData.showSalaryOnAd !== false), // Default to true
                        jobSalaryType: paymentRecord.jobData.jobSalaryType || 'Per Month'
                    };

                    // Debug: Log the processed job data
                    console.log('🔍 Processed job data:', jobData);

                    // Validate required fields before creating job
                    const requiredFields = ['jobTitle', 'jobDescription', 'jobLocation', 'workspaceOption', 'category', 'subcategory', 'workType', 'payType', 'currency'];
                    const missingFields = requiredFields.filter(field => !jobData[field]);
                    
                    // Special validation for numeric fields
                    if (typeof jobData.from !== 'number' || typeof jobData.to !== 'number') {
                        missingFields.push('from', 'to');
                    }
                    
                    // Validate that 'to' is greater than 'from' for salary range
                    if (jobData.from >= jobData.to) {
                        console.error('Invalid salary range: from >= to');
                        throw new Error('Invalid salary range: "to" amount must be greater than "from" amount');
                    }
                    
                    if (missingFields.length > 0) {
                        console.error('Missing required job fields:', missingFields);
                        throw new Error(`Missing required job fields: ${missingFields.join(', ')}`);
                    }

                                        // Create the job with email alert flag to prevent duplicate emails
                    const jobDataWithFlag = {
                        ...jobData,
                        skipEmailAlerts: true // Prevent duplicate emails from direct job creation
                    };
                    createdJob = await Job.create(jobDataWithFlag);
                    console.log('Auto-created job after payment:', createdJob._id);
                    
                    // Find similar users after job creation
                    console.log('🚀 Job auto-created after payment, now finding similar users...');
                    const userMatches = await findSimilarUsers(jobData);
                    
                     // Send job alert emails to matched users (ONLY from payment flow)
                     if (userMatches.matches && userMatches.matches.length > 0) {
                         console.log(`📧 Sending BCC job alert emails to ${userMatches.matches.length} users with skills for job: ${jobData.jobTitle}`);
                         // Extract user objects from the matches (which contain user, score, matchDetails)
                         const matchedUsers = userMatches.matches.map(match => match.user);
                         const emailResult = await sendJobAlertEmails(createdJob, matchedUsers);
                         console.log(`✅ BCC emails sent successfully: ${emailResult.sentCount}/${emailResult.totalCount} recipients`);
                     }
                    
                    // Update payment record with job ID
                    paymentRecord.jobId = createdJob._id;
                    await paymentRecord.save();
                } catch (jobCreationError) {
                    console.error('Error auto-creating job after payment:', jobCreationError);
                    // Don't fail the payment confirmation, just log the error
                }
            }

            res.json({
                success: true,
                message: 'Payment confirmed successfully',
                paymentIntent: paymentIntent,
                paymentRecord: paymentRecord,
                createdJob: createdJob ? {
                    _id: createdJob._id,
                    jobTitle: createdJob.jobTitle,
                    status: createdJob.status
                } : null
            });
        } else {
            res.json({
                success: true,
                message: 'Payment confirmed successfully',
                paymentIntent: paymentIntent,
                paymentRecord: null
            });
        }

    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm payment',
            error: error.message
        });
    }
};

// Handle payment failure
export const handlePaymentFailure = async (req, res) => {
    try {
        const { paymentIntentId, errorMessage } = req.body;

        // Update payment record in database
        const paymentRecord = await Payment.findOne({ stripePaymentIntentId: paymentIntentId });
        if (paymentRecord) {
            paymentRecord.status = 'failed';
            paymentRecord.failedAt = new Date();
            paymentRecord.failureReason = errorMessage;
            await paymentRecord.save();
        }

        res.json({
            success: true,
            message: 'Payment failure recorded',
            paymentRecord: paymentRecord
        });

    } catch (error) {
        console.error('Error handling payment failure:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to handle payment failure',
            error: error.message
        });
    }
};

// Get payment history for employer
export const getPaymentHistory = async (req, res) => {
    try {
        const { employerId } = req.params;
        const { page = 1, limit = 10, status, type } = req.query;

        // Convert employerId to ObjectId if it's a valid MongoDB ObjectId string
        let queryEmployerId = employerId;
        if (mongoose.Types.ObjectId.isValid(employerId)) {
            queryEmployerId = new mongoose.Types.ObjectId(employerId);
        }

        // Build query
        const query = { employerId: queryEmployerId };
        if (status) query.status = status;
        if (type) query.type = type;

        console.log('Payment history query:', query);

        // Execute query with pagination
        const payments = await Payment.find(query)
            .populate('jobId', 'title')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        console.log('Found payments:', payments.length);

        // Get total count
        const total = await Payment.countDocuments(query);

        // Calculate summary statistics
        const totalSpent = await Payment.aggregate([
            { $match: { employerId: queryEmployerId, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const statusCounts = await Payment.aggregate([
            { $match: { employerId: queryEmployerId } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            payments,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total,
                limit: parseInt(limit)
            },
            summary: {
                totalSpent: totalSpent[0]?.total || 0,
                statusCounts: statusCounts.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {})
            }
        });

    } catch (error) {
        console.error('Error getting payment history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get payment history',
            error: error.message
        });
    }
};

// Get invoice for specific payment
export const getInvoice = async (req, res) => {
    try {
        const { invoiceId } = req.params;

        const payment = await Payment.findById(invoiceId)
            .populate('employerId', 'companyName EmployerEmail')
            .populate('jobId', 'title');

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        // Format invoice data
        const invoice = {
            id: payment._id,
            invoiceNumber: `INV-${payment._id.toString().slice(-8).toUpperCase()}`,
            paymentIntentId: payment.stripePaymentIntentId,
            date: payment.completedAt || payment.createdAt,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            type: payment.type,
            company: payment.employerId,
            job: payment.jobId,
            planId: payment.planId,
            packageId: payment.packageId,
            addOns: payment.addOns,
            metadata: payment.metadata
        };

        res.json({
            success: true,
            invoice
        });

    } catch (error) {
        console.error('Error getting invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get invoice',
            error: error.message
        });
    }
};

// Create setup intent
export const createSetupIntent = async (req, res) => {
    try {
        checkStripeAvailable();
        
        const setupIntent = await stripe.setupIntents.create({
            payment_method_types: ['card'],
        });

        res.json({
            success: true,
            client_secret: setupIntent.client_secret
        });

    } catch (error) {
        console.error('Error creating setup intent:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create setup intent',
            error: error.message
        });
    }
};

// Get payment methods (placeholder)
export const getPaymentMethods = async (req, res) => {
    try {
        res.json({
            success: true,
            paymentMethods: []
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get payment methods',
            error: error.message
        });
    }
};

// Handle Stripe webhooks
export const handleStripeWebhook = async (req, res) => {
    try {
        checkStripeAvailable();
        
        const sig = req.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        } catch (err) {
            console.error('Webhook signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        // Handle the event
        switch (event.type) {
            case 'payment_intent.succeeded':
                const paymentIntentSucceeded = event.data.object;
                console.log('Payment succeeded:', paymentIntentSucceeded.id);
                
                // Update payment record
                await Payment.findOneAndUpdate(
                    { stripePaymentIntentId: paymentIntentSucceeded.id },
                    { 
                        status: 'completed',
                        completedAt: new Date(),
                        metadata: {
                            paymentMethod: paymentIntentSucceeded.payment_method,
                            receiptUrl: paymentIntentSucceeded.charges?.data[0]?.receipt_url
                        }
                    }
                );
                break;
            
            case 'payment_intent.payment_failed':
                const paymentIntentFailed = event.data.object;
                console.log('Payment failed:', paymentIntentFailed.id);
                
                // Update payment record
                await Payment.findOneAndUpdate(
                    { stripePaymentIntentId: paymentIntentFailed.id },
                    { 
                        status: 'failed',
                        failedAt: new Date(),
                        failureReason: paymentIntentFailed.last_payment_error?.message || 'Payment failed'
                    }
                );
                break;
            
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });

    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to handle webhook',
            error: error.message
        });
    }
}; 