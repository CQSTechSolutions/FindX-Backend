import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Message from './models/Message.model.js';

dotenv.config();

const USER_EMAIL = 'shivamgupta11122004@gmail.com';

async function testProductionNotifications() {
    try {
        console.log('🔍 Testing Production Notifications');
        console.log('=' .repeat(50));
        
        // Connect to MongoDB (production database)
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/findx';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Step 1: Find the test user
        console.log('\n👤 Step 1: Finding test user...');
        const user = await User.findOne({ email: USER_EMAIL });
        
        if (!user) {
            console.log('❌ Test user not found in production database');
            console.log('   This means the user needs to be created in production');
            return;
        }
        
        console.log('✅ Test user found');
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   User ID: ${user._id}`);
        console.log(`   Skills: ${user.skills_and_capabilities?.join(', ') || 'No skills listed'}`);

        // Step 2: Check for system messages
        console.log('\n🔔 Step 2: Checking for system messages...');
        
        const systemMessages = await Message.find({
            isSystemMessage: true,
            to: user._id
        }).populate('jobId', 'jobTitle companyName').sort({ createdAt: -1 });

        console.log(`📊 Found ${systemMessages.length} system messages for user`);

        if (systemMessages.length === 0) {
            console.log('\n⚠️ No system messages found. This could mean:');
            console.log('   1. No jobs have been posted that match this user\'s profile');
            console.log('   2. The user\'s profile doesn\'t have enough skills');
            console.log('   3. The notification system hasn\'t been triggered');
            console.log('   4. The user needs to be created in production first');
            
            // Check if user has skills
            if (user.skills_and_capabilities && user.skills_and_capabilities.length > 0) {
                console.log(`\n📋 User has skills: ${user.skills_and_capabilities.join(', ')}`);
            } else {
                console.log('\n📋 User has no skills listed - this is likely the issue!');
            }
        } else {
            console.log('\n📨 System Messages Found:');
            systemMessages.forEach((message, index) => {
                console.log(`\n${index + 1}. Message Details:`);
                console.log(`   Message ID: ${message._id}`);
                console.log(`   Job: ${message.jobId?.jobTitle || 'Unknown'}`);
                console.log(`   Company: ${message.jobId?.companyName || 'Unknown'}`);
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

        // Step 3: Check for any jobs in the database
        console.log('\n📝 Step 3: Checking for jobs in database...');
        
        const Job = mongoose.model('Job');
        const jobs = await Job.find({}).sort({ createdAt: -1 }).limit(5);
        
        console.log(`📊 Found ${jobs.length} total jobs in database`);
        
        if (jobs.length > 0) {
            console.log('\n📋 Recent Jobs:');
            jobs.forEach((job, index) => {
                console.log(`\n${index + 1}. Job Details:`);
                console.log(`   Job ID: ${job._id}`);
                console.log(`   Title: ${job.jobTitle}`);
                console.log(`   Company: ${job.companyName || 'Unknown'}`);
                console.log(`   Skills: ${job.jobSkills?.join(', ') || 'No skills listed'}`);
                console.log(`   Created: ${new Date(job.createdAt).toLocaleString()}`);
                console.log(`   Status: ${job.status}`);
            });
        } else {
            console.log('❌ No jobs found in database');
        }

        // Step 4: Check if there are any employers
        console.log('\n👔 Step 4: Checking for employers...');
        
        const Employer = mongoose.model('Employer');
        const employers = await Employer.find({}).limit(5);
        
        console.log(`📊 Found ${employers.length} employers in database`);
        
        if (employers.length > 0) {
            console.log('\n📋 Employers:');
            employers.forEach((employer, index) => {
                console.log(`\n${index + 1}. Employer Details:`);
                console.log(`   Company: ${employer.companyName}`);
                console.log(`   Email: ${employer.email}`);
                console.log(`   Industry: ${employer.companyIndustry}`);
            });
        } else {
            console.log('❌ No employers found in database');
        }

        console.log('\n' + '='.repeat(50));
        console.log('🏁 Production Test completed!');
        
        if (systemMessages.length > 0) {
            console.log('✅ System messages exist in production database');
            console.log('🔍 The issue might be with the mobile app API call or authentication');
        } else {
            console.log('❌ No system messages found in production database');
            console.log('💡 To fix this:');
            console.log('   1. Create a job in production that matches the user\'s skills');
            console.log('   2. Ensure the user has skills listed in their profile');
            console.log('   3. Test the notification system in production');
        }

    } catch (error) {
        console.error('❌ Production test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

// Run the test
testProductionNotifications(); 