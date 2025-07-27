import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Message from './models/Message.model.js';

dotenv.config();

const TEST_USER_EMAIL = 'shivamgupta11122004@gmail.com';

async function checkUserNotifications() {
    try {
        console.log('🔍 Checking User Notifications in Production');
        console.log('=' .repeat(50));
        
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/findx';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Find the test user
        console.log('\n👤 Step 1: Finding test user...');
        const user = await User.findOne({ email: TEST_USER_EMAIL });
        
        if (!user) {
            console.log('❌ Test user not found in production database');
            console.log('   Email: ' + TEST_USER_EMAIL);
            return;
        }
        
        console.log('✅ Test user found:');
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   User ID: ${user._id}`);
        console.log(`   Skills: ${user.skills_and_capabilities?.join(', ') || 'No skills listed'}`);

        // Check for system messages for this specific user
        console.log('\n🔔 Step 2: Checking for system messages for this user...');
        
        const userSystemMessages = await Message.find({
            isSystemMessage: true,
            to: user._id
        }).populate('jobId', 'jobTitle companyName jobSkills').sort({ createdAt: -1 });

        console.log(`📊 Found ${userSystemMessages.length} system messages for this user`);

        if (userSystemMessages.length === 0) {
            console.log('\n⚠️ No system messages found for this user. Possible reasons:');
            console.log('   1. No jobs match this user\'s skills');
            console.log('   2. User has no skills listed in profile');
            console.log('   3. Notification system hasn\'t been triggered');
            
            if (!user.skills_and_capabilities || user.skills_and_capabilities.length === 0) {
                console.log('\n💡 SOLUTION: User has no skills listed!');
                console.log('   This is likely why no notifications are being generated.');
                console.log('   The user needs to add skills to their profile.');
            }
        } else {
            console.log('\n📨 System Messages Found for User:');
            userSystemMessages.forEach((message, index) => {
                console.log(`\n${index + 1}. Message Details:`);
                console.log(`   Message ID: ${message._id}`);
                console.log(`   Job: ${message.jobId?.jobTitle || 'Unknown'}`);
                console.log(`   Company: ${message.jobId?.companyName || 'Unknown'}`);
                console.log(`   Job Skills: ${message.jobId?.jobSkills?.join(', ') || 'No skills'}`);
                console.log(`   Match Score: ${message.systemMessageData?.matchScore || 'N/A'}%`);
                console.log(`   Visible: ${message.isVisible}`);
                console.log(`   Has Replied: ${message.hasReplied}`);
                console.log(`   Created: ${new Date(message.createdAt).toLocaleString()}`);
                
                if (message.systemMessageData?.matchReasons && message.systemMessageData.matchReasons.length > 0) {
                    console.log(`   Match Reasons: ${message.systemMessageData.matchReasons.join(', ')}`);
                }
                
                console.log(`   Content Preview: ${message.content.substring(0, 100)}...`);
            });
        }

        // Check if there are any jobs that could match this user's skills
        console.log('\n📝 Step 3: Checking for jobs that could match user skills...');
        
        const Job = mongoose.model('Job');
        const allJobs = await Job.find({ status: 'Open' }).limit(10);
        
        console.log(`📊 Found ${allJobs.length} open jobs in database`);
        
        if (allJobs.length > 0 && user.skills_and_capabilities && user.skills_and_capabilities.length > 0) {
            console.log('\n🔍 Checking job matches with user skills:');
            console.log(`   User Skills: ${user.skills_and_capabilities.join(', ')}`);
            
            allJobs.forEach((job, index) => {
                const jobSkills = job.jobSkills || [];
                const matchingSkills = user.skills_and_capabilities.filter(skill => 
                    jobSkills.some(jobSkill => 
                        jobSkill.toLowerCase().includes(skill.toLowerCase()) ||
                        skill.toLowerCase().includes(jobSkill.toLowerCase())
                    )
                );
                
                console.log(`\n${index + 1}. Job: ${job.jobTitle}`);
                console.log(`   Job Skills: ${jobSkills.join(', ')}`);
                console.log(`   Matching Skills: ${matchingSkills.length > 0 ? matchingSkills.join(', ') : 'None'}`);
                console.log(`   Match Score: ${matchingSkills.length > 0 ? Math.round((matchingSkills.length / jobSkills.length) * 100) : 0}%`);
            });
        }

        console.log('\n' + '='.repeat(50));
        console.log('🏁 User notification check completed!');
        
        if (userSystemMessages.length > 0) {
            console.log('✅ User has system messages in production database');
            console.log('🔍 The issue might be with the mobile app API call or authentication');
        } else {
            console.log('❌ No system messages found for this user');
            if (!user.skills_and_capabilities || user.skills_and_capabilities.length === 0) {
                console.log('💡 FIX: User needs to add skills to their profile');
            } else {
                console.log('💡 FIX: Create jobs that match the user\'s skills');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

checkUserNotifications(); 