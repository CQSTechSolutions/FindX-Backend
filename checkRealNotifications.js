import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Import models
import User from './models/User.js';
import Message from './models/Message.model.js';
import Job from './models/Job.model.js';
import Employer from './models/employer.model.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/findx';

async function checkRealNotifications() {
    try {
        console.log('🔍 Checking Real Notifications in Database');
        console.log('=' .repeat(50));
        
        // Connect to database
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to database');

        const userId = '6880357da3de4290a4af55e3';

        // Step 1: Check if user exists
        console.log('\n👤 Step 1: Checking user...');
        const user = await User.findById(userId);
        if (!user) {
            console.log('❌ User not found');
            return;
        }
        console.log('✅ User found:', {
            email: user.email,
            name: user.name,
            skills: user.skills?.length || 0
        });

        // Step 2: Check all system messages for this user
        console.log('\n📨 Step 2: Checking all system messages...');
        const allMessages = await Message.find({
            to: userId,
            isSystemMessage: true
        }).populate('jobId');

        console.log(`📊 Found ${allMessages.length} system messages for user`);
        
        allMessages.forEach((msg, index) => {
            console.log(`\n📧 Message ${index + 1}:`);
            console.log(`   ID: ${msg._id}`);
            console.log(`   Content: ${msg.content?.substring(0, 100)}...`);
            console.log(`   Created: ${msg.createdAt}`);
            console.log(`   Job ID: ${msg.jobId?._id || 'No job'}`);
            console.log(`   Job Title: ${msg.jobId?.jobTitle || 'No job title'}`);
            console.log(`   Company: ${msg.jobId?.companyName || 'No company'}`);
            console.log(`   From: ${msg.from}`);
            console.log(`   From Model: ${msg.fromModel}`);
            console.log(`   Is System Message: ${msg.isSystemMessage}`);
            console.log(`   Is Visible: ${msg.isVisible}`);
            console.log(`   Has Replied: ${msg.hasReplied}`);
        });

        // Step 3: Check what the API query would return
        console.log('\n🔍 Step 3: Testing API query...');
        
        // Test the exact query used by the API
        const apiQuery = {
            to: userId,
            isSystemMessage: true
        };
        
        console.log('🔍 API Query:', JSON.stringify(apiQuery, null, 2));
        
        const apiResults = await Message.find(apiQuery)
            .populate('jobId', 'jobTitle companyName jobLocation workType')
            .sort({ createdAt: -1 })
            .limit(20)
            .skip(0);

        console.log(`📊 API Query returned ${apiResults.length} messages`);
        
        apiResults.forEach((msg, index) => {
            console.log(`\n📧 API Result ${index + 1}:`);
            console.log(`   ID: ${msg._id}`);
            console.log(`   Content: ${msg.content?.substring(0, 100)}...`);
            console.log(`   Job: ${msg.jobId?.jobTitle || 'No job'} at ${msg.jobId?.companyName || 'No company'}`);
        });

        // Step 4: Check if there are any jobs
        console.log('\n💼 Step 4: Checking jobs...');
        const jobs = await Job.find({}).limit(5);
        console.log(`📊 Found ${jobs.length} jobs in database`);
        
        jobs.forEach((job, index) => {
            console.log(`\n💼 Job ${index + 1}:`);
            console.log(`   ID: ${job._id}`);
            console.log(`   Title: ${job.jobTitle}`);
            console.log(`   Company: ${job.companyName}`);
            console.log(`   Created: ${job.createdAt}`);
        });

        // Step 5: Check employers
        console.log('\n🏢 Step 5: Checking employers...');
        const employers = await Employer.find({}).limit(5);
        console.log(`📊 Found ${employers.length} employers in database`);
        
        employers.forEach((emp, index) => {
            console.log(`\n🏢 Employer ${index + 1}:`);
            console.log(`   ID: ${emp._id}`);
            console.log(`   Company: ${emp.companyName}`);
            console.log(`   Email: ${emp.email}`);
        });

        console.log('\n' + '='.repeat(50));
        console.log('🏁 Analysis Complete!');
        
        if (allMessages.length > 0 && apiResults.length === 0) {
            console.log('❌ ISSUE: Messages exist but API query returns 0');
            console.log('🔧 This indicates the backend deployment needs updating');
        } else if (allMessages.length === 0) {
            console.log('❌ ISSUE: No system messages found for user');
            console.log('🔧 Need to create notifications for this user');
        } else {
            console.log('✅ Messages found and API should work');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
    }
}

checkRealNotifications(); 