import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Job from './models/Job.model.js';
import Employer from './models/employer.model.js';
import systemMessageService from './services/systemMessageService.js';

dotenv.config();

const TEST_USER_EMAIL = 'shivamgupta11122004@gmail.com';
const TEST_EMPLOYER_EMAIL = 'employer1@company.com';

async function fixUserSkills() {
    try {
        console.log('🔧 Fixing User Skills and Creating Matching Job');
        console.log('=' .repeat(50));
        
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/findx';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Step 1: Find and update the test user
        console.log('\n👤 Step 1: Finding and updating test user...');
        const user = await User.findOne({ email: TEST_USER_EMAIL });
        
        if (!user) {
            console.log('❌ Test user not found. Creating new user...');
            const newUser = new User({
                name: 'Shivam Gupta',
                email: TEST_USER_EMAIL,
                password: 'shivam',
                skills_and_capabilities: ['React', 'JavaScript', 'TypeScript', 'Node.js', 'MongoDB', 'Express.js', 'Frontend Development', 'Web Development']
            });
            await newUser.save();
            console.log('✅ Created new user with skills');
        } else {
            console.log('✅ Test user found');
            console.log(`   Name: ${user.name}`);
            console.log(`   Current Skills: ${user.skills_and_capabilities?.join(', ') || 'No skills'}`);
            
            // Update user skills if they're missing
            if (!user.skills_and_capabilities || user.skills_and_capabilities.length === 0) {
                user.skills_and_capabilities = ['React', 'JavaScript', 'TypeScript', 'Node.js', 'MongoDB', 'Express.js', 'Frontend Development', 'Web Development'];
                await user.save();
                console.log('✅ Updated user with skills');
            } else {
                console.log('✅ User already has skills');
            }
        }

        // Step 2: Find or create test employer
        console.log('\n👔 Step 2: Finding or creating test employer...');
        let employer = await Employer.findOne({ email: TEST_EMPLOYER_EMAIL });
        
        if (!employer) {
            console.log('❌ Test employer not found. Creating new employer...');
            employer = new Employer({
                companyName: 'Test Company',
                email: TEST_EMPLOYER_EMAIL,
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
            console.log('✅ Created new employer');
        } else {
            console.log('✅ Test employer found');
            console.log(`   Company: ${employer.companyName}`);
        }

        // Step 3: Create a job that matches the user's skills
        console.log('\n📝 Step 3: Creating matching job...');
        
        const matchingJob = new Job({
            jobTitle: 'Senior React Developer - Notification Test',
            jobDescription: 'We are looking for a skilled React developer to join our team. This is a test job to verify the notification system.',
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
                },
                {
                    question: 'What is your experience with TypeScript?',
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

        // Step 4: Trigger the notification system
        console.log('\n🔔 Step 4: Triggering notification system...');
        
        try {
            // Find users that match this job
            const users = await User.find({
                skills_and_capabilities: { $exists: true, $ne: [] }
            });

            console.log(`📊 Found ${users.length} users with skills`);

            if (users.length > 0) {
                // Calculate match scores for each user
                const matchedUsers = users.map(user => {
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
                    
                    return {
                        user,
                        score: matchScore,
                        matchDetails: matchingSkills
                    };
                }).filter(match => match.score >= 30); // Only users with 30%+ match

                console.log(`📊 Found ${matchedUsers.length} users with 30%+ match`);

                if (matchedUsers.length > 0) {
                    // Send notifications to matched users
                    await systemMessageService.sendJobNotificationMessages(matchingJob, matchedUsers);
                    console.log('✅ Notification system triggered successfully');
                } else {
                    console.log('⚠️ No users matched with sufficient score');
                }
            } else {
                console.log('⚠️ No users with skills found');
            }
        } catch (error) {
            console.log('⚠️ Notification system error:', error.message);
        }

        // Step 5: Check if notification was created
        console.log('\n🔍 Step 5: Checking for created notification...');
        
        const Message = mongoose.model('Message');
        const systemMessages = await Message.find({
            isSystemMessage: true,
            to: user._id,
            jobId: matchingJob._id
        });

        console.log(`📊 Found ${systemMessages.length} system messages for this job`);

        if (systemMessages.length > 0) {
            console.log('✅ Notification created successfully!');
            systemMessages.forEach((msg, index) => {
                console.log(`\n${index + 1}. Notification Details:`);
                console.log(`   Message ID: ${msg._id}`);
                console.log(`   Match Score: ${msg.systemMessageData?.matchScore || 'N/A'}%`);
                console.log(`   Visible: ${msg.isVisible}`);
                console.log(`   Created: ${new Date(msg.createdAt).toLocaleString()}`);
            });
        } else {
            console.log('❌ No notification created');
        }

        console.log('\n' + '='.repeat(50));
        console.log('🏁 Fix completed!');
        console.log('\n💡 Next steps:');
        console.log('   1. Test the mobile app to see if notifications appear');
        console.log('   2. Check the debug logs in the mobile app');
        console.log('   3. Verify the API call is working correctly');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

fixUserSkills(); 