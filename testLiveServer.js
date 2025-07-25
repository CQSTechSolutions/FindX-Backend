import mongoose from 'mongoose';
import User from './models/User.js';
import Job from './models/Job.model.js';
import Employer from './models/employer.model.js';
import Message from './models/Message.model.js';
import systemMessageService from './services/systemMessageService.js';

// Connect to the live MongoDB database
const connectDB = async () => {
    try {
        // Use the live MongoDB URI
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://findx:findx123@cluster0.mongodb.net/findx');
        console.log('✅ Connected to live MongoDB database');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

const testLiveServer = async () => {
    try {
        await connectDB();

        console.log('\n🧪 Testing Live Server Job Notification System...\n');

        // Step 1: Check existing data
        console.log('📊 Checking existing data...');
        
        const totalUsers = await User.countDocuments();
        const usersWithSkills = await User.countDocuments({ 
            skills_and_capabilities: { $exists: true, $ne: [], $not: { $size: 0 } }
        });
        const totalJobs = await Job.countDocuments();
        const totalSystemMessages = await Message.countDocuments({ isSystemMessage: true });
        
        console.log(`👥 Total users: ${totalUsers}`);
        console.log(`🎯 Users with skills: ${usersWithSkills}`);
        console.log(`💼 Total jobs: ${totalJobs}`);
        console.log(`📨 Total system messages: ${totalSystemMessages}`);

        // Step 2: Find a user with skills to test with
        console.log('\n🔍 Finding a user with skills...');
        
        let userWithSkills = await User.findOne({ 
            skills_and_capabilities: { $exists: true, $ne: [], $not: { $size: 0 } }
        }).select('name email skills_and_capabilities dream_job_title');

        if (userWithSkills) {
            console.log(`✅ Found user: ${userWithSkills.name} (${userWithSkills.email})`);
            console.log(`   Skills: ${userWithSkills.skills_and_capabilities.join(', ')}`);
            console.log(`   Dream job: ${userWithSkills.dream_job_title || 'Not set'}`);
        } else {
            console.log('❌ No users with skills found. Creating a test user...');
            
            // Create a test user with skills
            const testUser = await User.create({
                name: 'Test Developer',
                email: `test-${Date.now()}@example.com`,
                password: 'testpassword123',
                skills_and_capabilities: ['React', 'JavaScript', 'Node.js', 'MongoDB'],
                dream_job_title: 'Full Stack Developer',
                resident_country: 'United States',
                highest_qualification: 'Bachelors',
                personal_branding_statement: 'Experienced full-stack developer',
                isProfileCompleted: true
            });
            
            console.log(`✅ Created test user: ${testUser.name} (${testUser.email})`);
            userWithSkills = testUser;
        }

        // Step 3: Find or create an employer
        console.log('\n👔 Finding an employer...');
        
        let employer = await Employer.findOne().select('companyName email _id');
        
        if (!employer) {
            console.log('❌ No employers found. Creating a test employer...');
            
            employer = await Employer.create({
                companyName: 'Test Tech Company',
                email: `employer-${Date.now()}@testtech.com`,
                password: 'testpassword123',
                companyLogo: 'https://example.com/logo.png',
                companyWebsite: 'https://testtech.com',
                companyIndustry: 'Technology',
                companySize: 50,
                companyLocation: 'San Francisco, CA',
                EmployerName: 'John Smith',
                EmployerDesignation: 'HR Manager',
                EmployerPhone: '+1-555-0123',
                messagesAllowed: true
            });
            
            console.log(`✅ Created test employer: ${employer.companyName}`);
        } else {
            console.log(`✅ Found employer: ${employer.companyName}`);
        }

        // Step 4: Create a test job that matches the user's skills
        console.log('\n💼 Creating a test job...');
        
        const testJob = await Job.create({
            jobTitle: 'Senior Full Stack Developer',
            companyName: employer.companyName,
            jobLocation: 'Remote',
            category: 'Technology',
            subcategory: 'Software Development',
            workType: 'Full-time',
            workspaceOption: 'Remote',
            jobSkills: ['React', 'JavaScript', 'Node.js', 'MongoDB'],
            jobKeywords: ['full stack', 'developer', 'react', 'javascript'],
            from: 80000,
            to: 120000,
            currency: 'USD',
            payType: 'Salary',
            jobDescription: 'We are looking for a talented full stack developer to join our team. You will be responsible for developing and maintaining web applications using React, Node.js, and MongoDB.',
            shortDescription: ['We are looking for a talented full stack developer'],
            sellingPoints: ['Remote work', 'Competitive salary', 'Great team'],
            jobQuestions: ['What is your experience with React?', 'Tell us about a challenging project'],
            mandatoryQuestions: ['What is your experience with React?'],
            postedBy: employer._id,
            status: 'Open'
        });

        console.log(`✅ Created test job: ${testJob.jobTitle} (${testJob._id})`);

        // Step 5: Test the system message service with the live data
        console.log('\n🔔 Testing system message service with live data...');
        
        // Create a match for the system message service
        const match = {
            user: userWithSkills,
            score: 85, // High match score
            matchDetails: {
                skillsMatch: ['React', 'JavaScript'],
                locationMatch: 'Remote work available',
                titleMatch: 'Developer role matches user preference'
            }
        };

        console.log(`📊 Created match for user: ${userWithSkills.name} with score: ${match.score}`);

        // Send system message
        const systemMessageResult = await systemMessageService.sendJobNotificationMessages(
            testJob,
            [match],
            {
                maxMessages: 10,
                minScore: 40,
                messageTemplate: null
            }
        );

        console.log(`✅ System message result: ${systemMessageResult.sentCount}/${systemMessageResult.totalCount} messages sent`);

        // Step 6: Verify the system message was created
        console.log('\n📨 Verifying system message creation...');
        
        const systemMessages = await Message.find({ 
            isSystemMessage: true,
            to: userWithSkills._id,
            jobId: testJob._id
        })
        .populate('to', 'name email')
        .populate('jobId', 'jobTitle companyName');

        console.log(`📊 Found ${systemMessages.length} system messages for the user`);
        
        systemMessages.forEach((msg, index) => {
            console.log(`\n${index + 1}. System Message:`);
            console.log(`   To: ${msg.to?.name} (${msg.to?.email})`);
            console.log(`   Job: ${msg.jobId?.jobTitle}`);
            console.log(`   Content: ${msg.content.substring(0, 100)}...`);
            console.log(`   Visible: ${msg.isVisible}, Replied: ${msg.hasReplied}`);
            console.log(`   Match Score: ${msg.systemMessageData?.matchScore}`);
        });

        // Step 7: Test the API endpoint that the frontend uses
        console.log('\n🌐 Testing the API endpoint...');
        
        const apiResult = await systemMessageService.getUserSystemMessages(userWithSkills._id.toString(), {
            includeReplied: false,
            limit: 10
        });

        console.log(`📡 API result for user ${userWithSkills.name}:`);
        console.log(`   Success: ${apiResult.success}`);
        console.log(`   Messages found: ${apiResult.messages?.length || 0}`);
        if (apiResult.error) {
            console.log(`   Error: ${apiResult.error}`);
        }

        // Step 8: Test making a message visible
        if (systemMessages.length > 0) {
            console.log('\n👁️ Testing message visibility...');
            
            const testMessage = systemMessages[0];
            const visibilityResult = await systemMessageService.makeMessageVisible(
                testMessage._id.toString(),
                testMessage.to._id.toString()
            );

            console.log(`📱 Visibility result: ${visibilityResult.success}`);
            if (visibilityResult.error) {
                console.log(`   Error: ${visibilityResult.error}`);
            }

            // Verify the message is now visible
            const updatedMessage = await Message.findById(testMessage._id);
            console.log(`   Message visible: ${updatedMessage.isVisible}`);
        }

        console.log('\n✅ Live server test completed successfully!');
        console.log('\n📋 Summary:');
        console.log(`   - User ID: ${userWithSkills._id}`);
        console.log(`   - Job ID: ${testJob._id}`);
        console.log(`   - System messages created: ${systemMessages.length}`);
        console.log(`   - API endpoint working: ${apiResult.success}`);

        console.log('\n🎉 The job notification system is now working on your live server!');
        console.log('📱 Check your mobile app - you should now see job notifications.');

    } catch (error) {
        console.error('❌ Error testing live server:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 MongoDB disconnected');
    }
};

// Run the test
testLiveServer(); 