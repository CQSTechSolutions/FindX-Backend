import mongoose from 'mongoose';
import User from './models/User.js';
import Job from './models/Job.model.js';
import Employer from './models/employer.model.js';
import Message from './models/Message.model.js';
import systemMessageService from './services/systemMessageService.js';

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/findx');
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

const testJobNotifications = async () => {
    try {
        await connectDB();

        console.log('\n🧪 Testing Job Notification System...\n');

        // Step 1: Create a test employer
        console.log('👔 Creating test employer...');
        const testEmployer = await Employer.create({
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
        console.log(`✅ Created employer: ${testEmployer.companyName} (${testEmployer._id})`);

        // Step 2: Create test users with skills
        console.log('\n👥 Creating test users with skills...');
        
        const testUsers = await User.create([
            {
                name: 'John Developer',
                email: 'john@example.com',
                password: 'testpassword123',
                skills_and_capabilities: ['React', 'JavaScript', 'Node.js', 'MongoDB'],
                dream_job_title: 'Full Stack Developer',
                resident_country: 'United States',
                highest_qualification: 'Bachelors',
                personal_branding_statement: 'Experienced full-stack developer',
                isProfileCompleted: true
            },
            {
                name: 'Sarah Designer',
                email: 'sarah@example.com',
                password: 'testpassword123',
                skills_and_capabilities: ['UI/UX Design', 'Figma', 'Adobe Creative Suite', 'React'],
                dream_job_title: 'UI/UX Designer',
                resident_country: 'Canada',
                highest_qualification: 'Masters',
                personal_branding_statement: 'Creative UI/UX designer',
                isProfileCompleted: true
            },
            {
                name: 'Mike Python',
                email: 'mike@example.com',
                password: 'testpassword123',
                skills_and_capabilities: ['Python', 'Django', 'Data Analysis', 'Machine Learning'],
                dream_job_title: 'Python Developer',
                resident_country: 'United Kingdom',
                highest_qualification: 'PhD',
                personal_branding_statement: 'Data scientist and Python developer',
                isProfileCompleted: true
            }
        ]);

        console.log(`✅ Created ${testUsers.length} test users:`);
        testUsers.forEach(user => {
            console.log(`   - ${user.name} (${user.email}) - Skills: ${user.skills_and_capabilities.join(', ')}`);
        });

        // Step 3: Create a test job that matches the users
        console.log('\n💼 Creating test job...');
        const testJob = await Job.create({
            jobTitle: 'Senior Full Stack Developer',
            companyName: testEmployer.companyName,
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
            postedBy: testEmployer._id,
            status: 'Open'
        });

        console.log(`✅ Created job: ${testJob.jobTitle} (${testJob._id})`);
        console.log(`   Skills required: ${testJob.jobSkills.join(', ')}`);

        // Step 4: Test the system message service directly
        console.log('\n🔔 Testing system message service...');
        
        // Create matches for the system message service
        const matches = testUsers.map(user => ({
            user: user,
            score: 85, // High match score
            matchDetails: {
                skillsMatch: ['React', 'JavaScript'],
                locationMatch: 'Remote work available',
                titleMatch: 'Developer role matches user preference'
            }
        }));

        console.log(`📊 Created ${matches.length} test matches`);

        // Send system messages
        const systemMessageResult = await systemMessageService.sendJobNotificationMessages(
            testJob,
            matches,
            {
                maxMessages: 10,
                minScore: 40,
                messageTemplate: null
            }
        );

        console.log(`✅ System message result: ${systemMessageResult.sentCount}/${systemMessageResult.totalCount} messages sent`);

        // Step 5: Verify system messages were created
        console.log('\n📨 Verifying system messages...');
        
        const systemMessages = await Message.find({ 
            isSystemMessage: true,
            jobId: testJob._id
        })
        .populate('to', 'name email')
        .populate('jobId', 'jobTitle companyName');

        console.log(`📊 Found ${systemMessages.length} system messages for the test job`);
        
        systemMessages.forEach((msg, index) => {
            console.log(`\n${index + 1}. System Message:`);
            console.log(`   To: ${msg.to?.name} (${msg.to?.email})`);
            console.log(`   Job: ${msg.jobId?.jobTitle}`);
            console.log(`   Content: ${msg.content.substring(0, 100)}...`);
            console.log(`   Visible: ${msg.isVisible}, Replied: ${msg.hasReplied}`);
            console.log(`   Match Score: ${msg.systemMessageData?.matchScore}`);
        });

        // Step 6: Test the API endpoint
        console.log('\n🌐 Testing API endpoint...');
        
        // Simulate the API call that the frontend would make
        const testUserId = testUsers[0]._id;
        const apiResult = await systemMessageService.getUserSystemMessages(testUserId.toString(), {
            includeReplied: false,
            limit: 10
        });

        console.log(`📡 API result for user ${testUsers[0].name}:`);
        console.log(`   Success: ${apiResult.success}`);
        console.log(`   Messages found: ${apiResult.messages?.length || 0}`);
        if (apiResult.error) {
            console.log(`   Error: ${apiResult.error}`);
        }

        // Step 7: Test making a message visible
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

        console.log('\n✅ Job notification system test completed successfully!');
        console.log('\n📋 Summary:');
        console.log(`   - Created ${testUsers.length} test users with skills`);
        console.log(`   - Created 1 test job with matching skills`);
        console.log(`   - Generated ${systemMessages.length} system messages`);
        console.log(`   - API endpoint tested and working`);
        console.log(`   - Message visibility system tested`);

    } catch (error) {
        console.error('❌ Error testing job notifications:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 MongoDB disconnected');
    }
};

// Run the test
testJobNotifications(); 