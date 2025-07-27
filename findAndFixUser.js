import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Message from './models/Message.model.js';
import Job from './models/Job.model.js';
import Employer from './models/employer.model.js';

dotenv.config();

async function findAndFixUser() {
    try {
        console.log('🔍 Finding and Fixing User for Notifications');
        console.log('=' .repeat(50));
        
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/findx';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Step 1: Find all users in the database
        console.log('\n👥 Step 1: Finding all users in database...');
        
        const allUsers = await User.find({}).limit(10);
        console.log(`📊 Found ${allUsers.length} users in database`);
        
        if (allUsers.length === 0) {
            console.log('❌ No users found in database');
            return;
        }

        console.log('\n📋 Users found:');
        allUsers.forEach((user, index) => {
            console.log(`\n${index + 1}. User Details:`);
            console.log(`   ID: ${user._id}`);
            console.log(`   Name: ${user.name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Skills: ${user.skills_and_capabilities?.join(', ') || 'No skills'}`);
        });

        // Step 2: Find the user that matches the mobile app email
        console.log('\n🔍 Step 2: Looking for user with email: shivamgupta11122004@gmail.com');
        
        const targetUser = await User.findOne({ email: 'shivamgupta11122004@gmail.com' });
        
        if (!targetUser) {
            console.log('❌ User with email shivamgupta11122004@gmail.com not found');
            console.log('💡 Creating new user with this email...');
            
            const newUser = new User({
                name: 'Shivam Gupta',
                email: 'shivamgupta11122004@gmail.com',
                password: 'shivam',
                skills_and_capabilities: ['React', 'JavaScript', 'TypeScript', 'Node.js', 'MongoDB', 'Express.js', 'Frontend Development', 'Web Development']
            });
            
            await newUser.save();
            console.log('✅ Created new user with email shivamgupta11122004@gmail.com');
            console.log(`   User ID: ${newUser._id}`);
            
            // Use the first user if target user doesn't exist
            const userToUse = newUser;
        } else {
            console.log('✅ Found user with email shivamgupta11122004@gmail.com');
            console.log(`   User ID: ${targetUser._id}`);
            console.log(`   Skills: ${targetUser.skills_and_capabilities?.join(', ') || 'No skills'}`);
            
            // Update skills if needed
            if (!targetUser.skills_and_capabilities || targetUser.skills_and_capabilities.length === 0) {
                targetUser.skills_and_capabilities = ['React', 'JavaScript', 'TypeScript', 'Node.js', 'MongoDB', 'Express.js', 'Frontend Development', 'Web Development'];
                await targetUser.save();
                console.log('✅ Updated user with skills');
            }
            
            const userToUse = targetUser;
        }

        // Step 3: Create a test job
        console.log('\n📝 Step 3: Creating test job...');
        
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
            jobTitle: 'Senior React Developer - Final Test',
            jobDescription: 'We are looking for a skilled React developer to join our team. This is a final test job for notifications.',
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

        // Step 4: Create notification for the user
        console.log('\n🔔 Step 4: Creating notification...');
        
        const userToUse = targetUser || newUser;
        const userSkills = userToUse.skills_and_capabilities || [];
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
                to: userToUse._id,
                fromModel: 'System',
                toModel: 'User',
                content: `Hi ${userToUse.name}! We found a great job opportunity that matches your skills. Check out the Senior React Developer position at Test Company - it's a ${matchScore}% match with your profile!`,
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
            console.log(`   User ID: ${userToUse._id}`);
            console.log(`   Match Score: ${matchScore}%`);
        } else {
            console.log('⚠️ Match score too low for notification');
        }

        // Step 5: Verify notification was created
        console.log('\n🔍 Step 5: Verifying notification creation...');
        
        const newMessages = await Message.find({
            isSystemMessage: true,
            to: userToUse._id,
            jobId: matchingJob._id
        });

        console.log(`📊 Found ${newMessages.length} system messages for this user and job`);

        if (newMessages.length > 0) {
            console.log('✅ Notification created successfully!');
            newMessages.forEach((msg, index) => {
                console.log(`\n${index + 1}. Notification Details:`);
                console.log(`   Message ID: ${msg._id}`);
                console.log(`   User ID: ${msg.to}`);
                console.log(`   Match Score: ${msg.systemMessageData?.matchScore || 'N/A'}%`);
                console.log(`   Visible: ${msg.isVisible}`);
                console.log(`   Created: ${new Date(msg.createdAt).toLocaleString()}`);
            });
        } else {
            console.log('❌ No notification created');
        }

        console.log('\n' + '='.repeat(50));
        console.log('🏁 User fix completed!');
        
        console.log('\n💡 Important Information:');
        console.log(`   User ID to use in mobile app: ${userToUse._id}`);
        console.log(`   User Email: ${userToUse.email}`);
        console.log(`   User Password: shivam`);
        
        console.log('\n📱 Next steps:');
        console.log('   1. Make sure mobile app is logged in with: shivamgupta11122004@gmail.com / shivam');
        console.log('   2. Refresh the notifications screen');
        console.log('   3. Check if the notification appears');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

findAndFixUser(); 