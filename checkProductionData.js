import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Message from './models/Message.model.js';
import Job from './models/Job.model.js';
import Employer from './models/employer.model.js';

dotenv.config();

async function checkProductionData() {
    try {
        console.log('🔍 Checking Production Database');
        console.log('=' .repeat(40));
        
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/findx';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Check for the test user
        console.log('\n👤 Checking for test user...');
        const user = await User.findOne({ email: 'shivamgupta11122004@gmail.com' });
        
        if (user) {
            console.log('✅ User found:');
            console.log(`   Name: ${user.name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Skills: ${user.skills_and_capabilities?.join(', ') || 'No skills'}`);
        } else {
            console.log('❌ User not found in production database');
        }

        // Check for system messages
        console.log('\n🔔 Checking for system messages...');
        const systemMessages = await Message.find({ 
            isSystemMessage: true 
        }).limit(10);
        
        console.log(`📊 Found ${systemMessages.length} system messages total`);
        
        if (systemMessages.length > 0) {
            console.log('\n📨 Sample system messages:');
            systemMessages.slice(0, 3).forEach((msg, index) => {
                console.log(`\n${index + 1}. Message ID: ${msg._id}`);
                console.log(`   To: ${msg.to}`);
                console.log(`   Job ID: ${msg.jobId}`);
                console.log(`   Created: ${new Date(msg.createdAt).toLocaleString()}`);
            });
        }

        // Check for jobs
        console.log('\n📝 Checking for jobs...');
        const jobs = await Job.find({}).limit(5);
        
        console.log(`📊 Found ${jobs.length} jobs total`);
        
        if (jobs.length > 0) {
            console.log('\n📋 Sample jobs:');
            jobs.slice(0, 3).forEach((job, index) => {
                console.log(`\n${index + 1}. Job ID: ${job._id}`);
                console.log(`   Title: ${job.jobTitle}`);
                console.log(`   Skills: ${job.jobSkills?.join(', ') || 'No skills'}`);
                console.log(`   Created: ${new Date(job.createdAt).toLocaleString()}`);
            });
        }

        // Check for employers
        console.log('\n👔 Checking for employers...');
        const employers = await Employer.find({}).limit(5);
        
        console.log(`📊 Found ${employers.length} employers total`);
        
        if (employers.length > 0) {
            console.log('\n📋 Sample employers:');
            employers.slice(0, 3).forEach((employer, index) => {
                console.log(`\n${index + 1}. Company: ${employer.companyName}`);
                console.log(`   Email: ${employer.email}`);
                console.log(`   Industry: ${employer.companyIndustry}`);
            });
        }

        console.log('\n' + '='.repeat(40));
        console.log('🏁 Production data check completed!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

checkProductionData(); 