import mongoose from 'mongoose';
import Message from './models/Message.model.js';
import User from './models/User.js';
import Job from './models/Job.model.js';

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

const testSystemMessages = async () => {
    try {
        await connectDB();

        console.log('\n🔍 Testing System Messages...\n');

        // 1. Check total system messages
        const totalSystemMessages = await Message.countDocuments({ isSystemMessage: true });
        console.log(`📊 Total system messages in database: ${totalSystemMessages}`);

        // 2. Check system messages by type
        const jobNotifications = await Message.countDocuments({ 
            isSystemMessage: true, 
            messageType: 'job_notification' 
        });
        console.log(`📧 Job notification messages: ${jobNotifications}`);

        // 3. Check system messages by visibility
        const visibleMessages = await Message.countDocuments({ 
            isSystemMessage: true, 
            isVisible: true 
        });
        const hiddenMessages = await Message.countDocuments({ 
            isSystemMessage: true, 
            isVisible: false 
        });
        console.log(`👁️ Visible system messages: ${visibleMessages}`);
        console.log(`🙈 Hidden system messages: ${hiddenMessages}`);

        // 4. Check system messages by reply status
        const repliedMessages = await Message.countDocuments({ 
            isSystemMessage: true, 
            hasReplied: true 
        });
        const unreadMessages = await Message.countDocuments({ 
            isSystemMessage: true, 
            hasReplied: false 
        });
        console.log(`✅ Replied system messages: ${repliedMessages}`);
        console.log(`📬 Unread system messages: ${unreadMessages}`);

        // 5. Get recent system messages with details
        const recentSystemMessages = await Message.find({ 
            isSystemMessage: true 
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('to', 'name email')
        .populate('jobId', 'jobTitle companyName');

        console.log('\n📋 Recent System Messages:');
        recentSystemMessages.forEach((msg, index) => {
            console.log(`\n${index + 1}. Message ID: ${msg._id}`);
            console.log(`   To: ${msg.to?.name || 'Unknown'} (${msg.to?.email || 'No email'})`);
            console.log(`   Job: ${msg.jobId?.jobTitle || 'No job title'}`);
            console.log(`   Content: ${msg.content.substring(0, 100)}...`);
            console.log(`   Created: ${msg.createdAt}`);
            console.log(`   Visible: ${msg.isVisible}, Replied: ${msg.hasReplied}`);
            console.log(`   Match Score: ${msg.systemMessageData?.matchScore || 'N/A'}`);
        });

        // 6. Check if there are any users with skills
        const usersWithSkills = await User.countDocuments({ 
            skills_and_capabilities: { $exists: true, $ne: [], $not: { $size: 0 } }
        });
        console.log(`\n👥 Users with skills: ${usersWithSkills}`);

        // 7. Check recent jobs
        const recentJobs = await Job.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('jobTitle companyName createdAt postedBy');

        console.log('\n💼 Recent Jobs:');
        recentJobs.forEach((job, index) => {
            console.log(`\n${index + 1}. Job: ${job.jobTitle}`);
            console.log(`   Company: ${job.companyName || 'No company'}`);
            console.log(`   Created: ${job.createdAt}`);
            console.log(`   Posted By: ${job.postedBy}`);
        });

        // 8. Test the system message service
        console.log('\n🧪 Testing System Message Service...');
        
        // Get a user with skills
        const testUser = await User.findOne({ 
            skills_and_capabilities: { $exists: true, $ne: [], $not: { $size: 0 } }
        });

        if (testUser) {
            console.log(`\n👤 Test User: ${testUser.name} (${testUser.email})`);
            console.log(`   Skills: ${testUser.skills_and_capabilities?.slice(0, 3).join(', ')}...`);
            
            // Get system messages for this user
            const userSystemMessages = await Message.find({ 
                isSystemMessage: true,
                to: testUser._id
            })
            .populate('jobId', 'jobTitle companyName')
            .sort({ createdAt: -1 });

            console.log(`\n📨 System messages for test user: ${userSystemMessages.length}`);
            userSystemMessages.forEach((msg, index) => {
                console.log(`   ${index + 1}. ${msg.jobId?.jobTitle || 'No job'} - ${msg.isVisible ? 'Visible' : 'Hidden'} - ${msg.hasReplied ? 'Replied' : 'Not replied'}`);
            });
        } else {
            console.log('\n❌ No users with skills found for testing');
        }

        console.log('\n✅ System message test completed!');

    } catch (error) {
        console.error('❌ Error testing system messages:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 MongoDB disconnected');
    }
};

// Run the test
testSystemMessages(); 