import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Message from './models/Message.model.js';

dotenv.config();

const USER_ID = '6880357da3de4290a4af55e3';

async function directDatabaseTest() {
    try {
        console.log('🔍 Direct Database Test');
        console.log('=' .repeat(50));
        console.log(`📱 Testing User ID: ${USER_ID}`);
        
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/findx';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Step 1: Check if user exists
        console.log('\n👤 Step 1: Checking user...');
        
        const user = await User.findById(USER_ID);
        if (!user) {
            console.log('❌ User not found');
            return;
        }
        
        console.log('✅ User found:');
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);

        // Step 2: Check all system messages for this user
        console.log('\n🔔 Step 2: Checking all system messages...');
        
        const allSystemMessages = await Message.find({
            to: USER_ID,
            isSystemMessage: true
        });

        console.log(`📊 Found ${allSystemMessages.length} system messages for user`);

        if (allSystemMessages.length > 0) {
            console.log('\n📨 System Messages:');
            allSystemMessages.forEach((msg, index) => {
                console.log(`\n${index + 1}. Message Details:`);
                console.log(`   Message ID: ${msg._id}`);
                console.log(`   Job ID: ${msg.jobId}`);
                console.log(`   Content: ${msg.content.substring(0, 100)}...`);
                console.log(`   Visible: ${msg.isVisible}`);
                console.log(`   Has Replied: ${msg.hasReplied}`);
                console.log(`   Created: ${new Date(msg.createdAt).toLocaleString()}`);
                console.log(`   System Message Data:`, msg.systemMessageData);
            });
        }

        // Step 3: Test the exact query that the API uses
        console.log('\n🔍 Step 3: Testing API query...');
        
        const apiQuery = {
            to: USER_ID,
            isSystemMessage: true,
            hasReplied: false
        };
        
        console.log('🔍 API Query:', apiQuery);
        
        const apiResults = await Message.find(apiQuery);
        console.log(`📊 API Query Results: ${apiResults.length} messages`);

        // Step 4: Test without hasReplied filter
        console.log('\n🔍 Step 4: Testing without hasReplied filter...');
        
        const noFilterQuery = {
            to: USER_ID,
            isSystemMessage: true
        };
        
        const noFilterResults = await Message.find(noFilterQuery);
        console.log(`📊 No Filter Results: ${noFilterResults.length} messages`);

        // Step 5: Check if messages have hasReplied field
        if (allSystemMessages.length > 0) {
            console.log('\n🔍 Step 5: Checking hasReplied field...');
            allSystemMessages.forEach((msg, index) => {
                console.log(`Message ${index + 1}: hasReplied = ${msg.hasReplied}`);
            });
        }

        console.log('\n' + '='.repeat(50));
        console.log('🏁 Direct database test completed!');
        
        if (allSystemMessages.length > 0) {
            console.log('✅ Messages exist in database');
            console.log('🔍 The issue might be with the API query or deployment');
        } else {
            console.log('❌ No messages found in database');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
}

directDatabaseTest(); 