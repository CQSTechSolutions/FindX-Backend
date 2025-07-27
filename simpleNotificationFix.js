import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Message from './models/Message.model.js';
import Job from './models/Job.model.js';
import Employer from './models/employer.model.js';

dotenv.config();

async function simpleNotificationFix() {
    try {
        console.log('🔧 Simple Notification Fix');
        console.log('=' .repeat(50));
        
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/findx';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Step 1: Find the user
        console.log('\n👤 Step 1: Finding user...');
        
        const user = await User.findOne({ email: 'shivamgupta11122004@gmail.com' });
        
        if (!user) {
            console.log('❌ User not found');
            return;
        }
        
        console.log('✅ Found user:');
        console.log(`   ID: ${user._id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Skills: ${user.skills_and_capabilities?.join(', ') || 'No skills'}`);

        // Step 2: Create a test job
        console.log('\n📝 Step 2: Creating test job...');
        
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
        }

        const matchingJob = new Job({
            jobTitle: 'Senior React Developer - Simple Test',
            jobDescription: 'We are looking for a skilled React developer to join our team.',
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
            status: 'Open'
        });
        
        await matchingJob.save();
        console.log('✅ Created job');

        // Step 3: Create notification
        console.log('\n🔔 Step 3: Creating notification...');
        
        const systemMessage = new Message({
            from: null,
            to: user._id,
            fromModel: 'System',
            toModel: 'User',
            content: `Hi ${user.name}! We found a great job opportunity that matches your skills. Check out the Senior React Developer position at Test Company!`,
            jobId: matchingJob._id,
            messageType: 'job_notification',
            isSystemMessage: true,
            isVisible: false,
            requiresReply: true,
            systemMessageData: {
                jobTitle: matchingJob.jobTitle,
                companyName: employer.companyName,
                matchScore: 80,
                matchReasons: ['React', 'JavaScript', 'TypeScript', 'Node.js'],
                actionUrl: `/job-details/${matchingJob._id}`
            }
        });

        await systemMessage.save();
        console.log('✅ Created notification');

        // Step 4: Verify
        console.log('\n🔍 Step 4: Verifying...');
        
        const messages = await Message.find({
            isSystemMessage: true,
            to: user._id
        });

        console.log(`📊 Found ${messages.length} notifications for user`);

        console.log('\n💡 User ID for mobile app:', user._id);
        console.log('📱 Refresh the mobile app notifications screen');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

simpleNotificationFix(); 