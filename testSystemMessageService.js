import mongoose from 'mongoose';
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

const testSystemMessageService = async () => {
    try {
        await connectDB();

        console.log('\n🧪 Testing System Message Service...\n');

        // Step 1: Check if there are any existing system messages
        const existingMessages = await Message.countDocuments({ isSystemMessage: true });
        console.log(`📊 Existing system messages: ${existingMessages}`);

        // Step 2: Test the getUserSystemMessages function
        console.log('\n🔍 Testing getUserSystemMessages function...');
        
        // Create a mock user ID (this would normally come from a real user)
        const mockUserId = new mongoose.Types.ObjectId();
        
        try {
            const result = await systemMessageService.getUserSystemMessages(mockUserId.toString(), {
                includeReplied: false,
                limit: 10
            });
            
            console.log(`📡 getUserSystemMessages result:`);
            console.log(`   Success: ${result.success}`);
            console.log(`   Messages: ${result.messages?.length || 0}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        } catch (error) {
            console.log(`❌ getUserSystemMessages error: ${error.message}`);
        }

        // Step 3: Test creating a system message manually
        console.log('\n📝 Testing manual system message creation...');
        
        const testSystemMessage = new Message({
            from: new mongoose.Types.ObjectId(), // Use a dummy ObjectId for system messages
            to: mockUserId,
            content: 'This is a test system message for job notifications.',
            fromModel: 'System',
            toModel: 'User',
            jobId: new mongoose.Types.ObjectId(), // Mock job ID
            messageType: 'job_notification',
            isSystemMessage: true,
            isVisible: false,
            requiresReply: true,
            hasReplied: false,
            systemMessageData: {
                jobTitle: 'Test Job',
                companyName: 'Test Company',
                matchScore: 85,
                matchReasons: ['Skills match', 'Location match'],
                actionUrl: '/job-details/test'
            }
        });

        const savedMessage = await testSystemMessage.save();
        console.log(`✅ Created test system message: ${savedMessage._id}`);

        // Step 4: Test retrieving the created message
        console.log('\n📨 Testing message retrieval...');
        
        const retrievedMessages = await Message.find({ 
            isSystemMessage: true,
            to: mockUserId
        });

        console.log(`📊 Retrieved ${retrievedMessages.length} system messages for test user`);
        retrievedMessages.forEach((msg, index) => {
            console.log(`   ${index + 1}. ${msg.content.substring(0, 50)}...`);
            console.log(`      Visible: ${msg.isVisible}, Replied: ${msg.hasReplied}`);
        });

        // Step 5: Test making message visible
        console.log('\n👁️ Testing message visibility...');
        
        const visibilityResult = await systemMessageService.makeMessageVisible(
            savedMessage._id.toString(),
            mockUserId.toString()
        );

        console.log(`📱 Visibility result: ${visibilityResult.success}`);
        if (visibilityResult.error) {
            console.log(`   Error: ${visibilityResult.error}`);
        }

        // Step 6: Test marking message as replied
        console.log('\n✅ Testing mark as replied...');
        
        const replyResult = await systemMessageService.markMessageAsReplied(
            savedMessage._id.toString(),
            mockUserId.toString()
        );

        console.log(`📝 Reply result: ${replyResult.success}`);
        if (replyResult.error) {
            console.log(`   Error: ${replyResult.error}`);
        }

        // Step 7: Test replying to system message (function doesn't exist in service)
        console.log('\n💬 Testing reply to system message...');
        console.log('⚠️ replyToSystemMessage function not implemented in service yet');

        // Step 8: Test system message stats
        console.log('\n📊 Testing system message stats...');
        
        const statsResult = await systemMessageService.getSystemMessageStats();
        console.log(`📈 Stats result: ${statsResult.success}`);
        if (statsResult.stats) {
            console.log(`   Total messages: ${statsResult.stats.totalMessages}`);
            console.log(`   Visible messages: ${statsResult.stats.visibleMessages}`);
            console.log(`   Replied messages: ${statsResult.stats.repliedMessages}`);
        }

        console.log('\n✅ System message service test completed!');

    } catch (error) {
        console.error('❌ Error testing system message service:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 MongoDB disconnected');
    }
};

// Run the test
testSystemMessageService(); 