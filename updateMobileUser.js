import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Message from './models/Message.model.js';
import Job from './models/Job.model.js';
import Employer from './models/employer.model.js';

dotenv.config();

// The actual user ID from mobile app logs
const MOBILE_USER_ID = '6880357da3de4290a4af55e3';

async function updateMobileUser() {
    try {
        console.log('🔧 Updating Mobile App User and Creating Notifications');
        console.log('=' .repeat(50));
        console.log(`📱 Mobile User ID: ${MOBILE_USER_ID}`);
        
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/findx';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Step 1: Find the existing user with the email
        console.log('\n👤 Step 1: Finding existing user...');
        
        const existingUser = await User.findOne({ email: 'shivamgupta11122004@gmail.com' });
        
        if (!existingUser) {
            console.log('❌ No user found with email shivamgupta11122004@gmail.com');
            return;
        }
        
        console.log('✅ Found existing user:');
        console.log(`   Current ID: ${existingUser._id}`);
        console.log(`   Name: ${existingUser.name}`);
        console.log(`   Email: ${existingUser.email}`);
        console.log(`   Skills: ${existingUser.skills_and_capabilities?.join(', ') || 'No skills'}`);

        // Step 2: Update the user's ID to match the mobile app
        console.log('\n🔄 Step 2: Updating user ID to match mobile app...');
        
        // First, delete the existing user
        await User.findByIdAndDelete(existingUser._id);
        console.log('✅ Deleted existing user');
        
        // Create new user with the mobile app ID
        const mobileUser = new User({
            _id: MOBILE_USER_ID,
            name: 'Shivam Gupta',
            email: 'shivamgupta11122004@gmail.com',
            password: 'shivam',
            skills_and_capabilities: ['React', 'JavaScript', 'TypeScript', 'Node.js', 'MongoDB', 'Express.js', 'Frontend Development', 'Web Development']
        });
        
        await mobileUser.save();
        console.log('✅ Created user with mobile app ID');
        console.log(`   New ID: ${mobileUser._id}`);

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
            jobTitle: 'Senior React Developer - Mobile User Test',
            jobDescription: 'We are looking for a skilled React developer to join our team. This is a test job specifically for the mobile app user.',
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

        // Step 4: Create notification for the mobile app user
        console.log('\n🔔 Step 4: Creating notification for mobile app user...');
        
        const userSkills = mobileUser.skills_and_capabilities || [];
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
                to: mobileUser._id,
                fromModel: 'System',
                toModel: 'User',
                content: `Hi ${mobileUser.name}! We found a great job opportunity that matches your skills. Check out the Senior React Developer position at Test Company - it's a ${matchScore}% match with your profile!`,
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
            console.log(`   User ID: ${mobileUser._id}`);
            console.log(`   Match Score: ${matchScore}%`);
        } else {
            console.log('⚠️ Match score too low for notification');
        }

        // Step 5: Verify notification was created
        console.log('\n🔍 Step 5: Verifying notification creation...');
        
        const newMessages = await Message.find({
            isSystemMessage: true,
            to: mobileUser._id,
            jobId: matchingJob._id
        });

        console.log(`📊 Found ${newMessages.length} system messages for mobile app user`);

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

        // Step 6: Test API call to verify it works
        console.log('\n🌐 Step 6: Testing API call...');
        
        const allMessages = await Message.find({
            isSystemMessage: true,
            to: mobileUser._id
        });

        console.log(`📊 Total system messages for mobile user: ${allMessages.length}`);

        console.log('\n' + '='.repeat(50));
        console.log('🏁 Mobile user update completed!');
        
        console.log('\n💡 Important Information:');
        console.log(`   Mobile User ID: ${mobileUser._id}`);
        console.log(`   User Email: ${mobileUser.email}`);
        console.log(`   User Password: shivam`);
        console.log(`   Notification Count: ${allMessages.length}`);
        
        console.log('\n📱 Next steps:');
        console.log('   1. The mobile app should now show notifications');
        console.log('   2. Refresh the notifications screen');
        console.log('   3. Check if the notification appears');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

updateMobileUser(); 