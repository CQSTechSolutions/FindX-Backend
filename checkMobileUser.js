import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Message from './models/Message.model.js';
import Job from './models/Job.model.js';
import Employer from './models/employer.model.js';
import systemMessageService from './services/systemMessageService.js';

dotenv.config();

// The user ID from the mobile app logs
const MOBILE_USER_ID = '6880357da3de4290a4af55e3';

async function checkMobileUser() {
    try {
        console.log('🔍 Checking Mobile App User');
        console.log('=' .repeat(50));
        
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/findx';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Step 1: Find the mobile app user
        console.log('\n👤 Step 1: Finding mobile app user...');
        const user = await User.findById(MOBILE_USER_ID);
        
        if (!user) {
            console.log('❌ Mobile app user not found with ID:', MOBILE_USER_ID);
            console.log('   This user might not exist in the database');
            return;
        }
        
        console.log('✅ Mobile app user found:');
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   User ID: ${user._id}`);
        console.log(`   Skills: ${user.skills_and_capabilities?.join(', ') || 'No skills listed'}`);

        // Step 2: Check for existing system messages
        console.log('\n🔔 Step 2: Checking for existing system messages...');
        
        const existingMessages = await Message.find({
            isSystemMessage: true,
            to: user._id
        }).populate('jobId', 'jobTitle companyName jobSkills').sort({ createdAt: -1 });

        console.log(`📊 Found ${existingMessages.length} existing system messages for this user`);

        if (existingMessages.length > 0) {
            console.log('\n📨 Existing Messages:');
            existingMessages.forEach((message, index) => {
                console.log(`\n${index + 1}. Message Details:`);
                console.log(`   Message ID: ${message._id}`);
                console.log(`   Job: ${message.jobId?.jobTitle || 'Unknown'}`);
                console.log(`   Company: ${message.jobId?.companyName || 'Unknown'}`);
                console.log(`   Match Score: ${message.systemMessageData?.matchScore || 'N/A'}%`);
                console.log(`   Visible: ${message.isVisible}`);
                console.log(`   Created: ${new Date(message.createdAt).toLocaleString()}`);
            });
        }

        // Step 3: Update user skills if needed
        console.log('\n🔧 Step 3: Checking and updating user skills...');
        
        if (!user.skills_and_capabilities || user.skills_and_capabilities.length === 0) {
            console.log('⚠️ User has no skills. Adding skills...');
            user.skills_and_capabilities = ['React', 'JavaScript', 'TypeScript', 'Node.js', 'MongoDB', 'Express.js', 'Frontend Development', 'Web Development'];
            await user.save();
            console.log('✅ Updated user with skills');
        } else {
            console.log('✅ User already has skills');
        }

        // Step 4: Create a test job and notification
        console.log('\n📝 Step 4: Creating test job and notification...');
        
        // Find or create test employer
        let employer = await Employer.findOne({ email: 'employer1@company.com' });
        if (!employer) {
            employer = new Employer({
                companyName: 'Test Company',
                email: 'employer1@company.com',
                password: 'shivam',
                companyDescription: 'A test company for testing job notifications',
                companyWebsite: 'https://testcompany.com',
                companyLogo: 'https://example.com/logo.png',
                companyIndustry: 'Technology',
                companySize: 50,
                companyLocation: 'Sydney, Australia',
                EmployerName: 'Test Employer',
                EmployerDesignation: 'HR Manager',
                EmployerPhone: '+1234567890'
            });
            await employer.save();
            console.log('✅ Created test employer');
        }

        // Create a job that matches the user's skills
        const matchingJob = new Job({
            jobTitle: 'Senior React Developer - Mobile Test',
            jobDescription: 'We are looking for a skilled React developer to join our team. This is a test job for the mobile app user.',
            jobLocation: 'Sydney, NSW',
            workspaceOption: 'Hybrid',
            category: 'Technology',
            subcategory: 'Software Development',
            workType: 'Full-time',
            payType: 'Annual salary',
            from: 80000,
            to: 120000,
            currency: 'AUD',
            jobSalaryType: 'Per Annum',
            jobSkills: ['React', 'JavaScript', 'TypeScript', 'Node.js', 'Frontend Development'],
            postedBy: employer._id,
            status: 'Open',
            applicationQuestions: [
                {
                    question: 'How many years of React experience do you have?',
                    type: 'text',
                    required: true
                }
            ]
        });
        
        await matchingJob.save();
        console.log('✅ Created matching job');
        console.log(`   Job ID: ${matchingJob._id}`);
        console.log(`   Title: ${matchingJob.jobTitle}`);
        console.log(`   Skills: ${matchingJob.jobSkills.join(', ')}`);

        // Step 5: Create notification for this specific user
        console.log('\n🔔 Step 5: Creating notification for mobile app user...');
        
        try {
            // Calculate match score
            const userSkills = user.skills_and_capabilities || [];
            const jobSkills = matchingJob.jobSkills || [];
            
            const matchingSkills = userSkills.filter(skill => 
                jobSkills.some(jobSkill => 
                    jobSkill.toLowerCase().includes(skill.toLowerCase()) ||
                    skill.toLowerCase().includes(jobSkill.toLowerCase())
                )
            );
            
            const matchScore = jobSkills.length > 0 ? 
                Math.round((matchingSkills.length / jobSkills.length) * 100) : 0;
            
            console.log(`📊 Match calculation:`);
            console.log(`   User Skills: ${userSkills.join(', ')}`);
            console.log(`   Job Skills: ${jobSkills.join(', ')}`);
            console.log(`   Matching Skills: ${matchingSkills.join(', ')}`);
            console.log(`   Match Score: ${matchScore}%`);

            if (matchScore >= 30) {
                // Create system message directly
                const systemMessage = new Message({
                    from: null,
                    to: user._id,
                    fromModel: 'System',
                    toModel: 'User',
                    content: `Hi ${user.name}! We found a great job opportunity that matches your skills. Check out the Senior React Developer position at Test Company - it's an 80% match with your profile!`,
                    jobId: matchingJob._id,
                    messageType: 'job_notification',
                    isSystemMessage: true,
                    isVisible: false,
                    requiresReply: true,
                    systemMessageData: {
                        jobTitle: matchingJob.jobTitle,
                        companyName: employer.companyName,
                        matchScore: matchScore,
                        matchReasons: matchingSkills,
                        actionUrl: `/job-details/${matchingJob._id}`
                    }
                });

                await systemMessage.save();
                console.log('✅ Created system message notification');
                console.log(`   Message ID: ${systemMessage._id}`);
                console.log(`   Match Score: ${matchScore}%`);
                console.log(`   Visible: ${systemMessage.isVisible}`);
            } else {
                console.log('⚠️ Match score too low for notification');
            }

        } catch (error) {
            console.log('❌ Error creating notification:', error.message);
        }

        // Step 6: Verify notification was created
        console.log('\n🔍 Step 6: Verifying notification creation...');
        
        const newMessages = await Message.find({
            isSystemMessage: true,
            to: user._id,
            jobId: matchingJob._id
        });

        console.log(`📊 Found ${newMessages.length} new system messages for this job`);

        if (newMessages.length > 0) {
            console.log('✅ Notification created successfully!');
            newMessages.forEach((msg, index) => {
                console.log(`\n${index + 1}. New Notification Details:`);
                console.log(`   Message ID: ${msg._id}`);
                console.log(`   Match Score: ${msg.systemMessageData?.matchScore || 'N/A'}%`);
                console.log(`   Visible: ${msg.isVisible}`);
                console.log(`   Created: ${new Date(msg.createdAt).toLocaleString()}`);
            });
        } else {
            console.log('❌ No notification created');
        }

        console.log('\n' + '='.repeat(50));
        console.log('🏁 Mobile user check completed!');
        
        console.log('\n💡 Next steps:');
        console.log('   1. Refresh the mobile app notifications screen');
        console.log('   2. Check if the notification appears');
        console.log('   3. Monitor the debug logs for API responses');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

checkMobileUser(); 