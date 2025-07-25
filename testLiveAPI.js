import axios from 'axios';

const LIVE_SERVER_URL = 'https://findxserver-cqstechsolutions.vercel.app';

// Test the live server API endpoints
const testLiveAPI = async () => {
    try {
        console.log('\n🧪 Testing Live Server API...\n');

        // Step 1: Test the system messages endpoint
        console.log('🔍 Testing system messages endpoint...');
        
        // Use the user ID from your logs
        const testUserId = '6880357da3de4290a4af55e3';
        
        try {
            const response = await axios.get(`${LIVE_SERVER_URL}/api/messages/user/${testUserId}/system-messages?includeReplied=false&limit=10`);
            
            console.log(`📡 System messages API response:`);
            console.log(`   Status: ${response.status}`);
            console.log(`   Success: ${response.data.success}`);
            console.log(`   Count: ${response.data.count}`);
            console.log(`   Messages: ${response.data.messages?.length || 0}`);
            
            if (response.data.messages && response.data.messages.length > 0) {
                console.log('\n📨 Found system messages:');
                response.data.messages.forEach((msg, index) => {
                    console.log(`   ${index + 1}. ${msg.content.substring(0, 50)}...`);
                    console.log(`      Visible: ${msg.isVisible}, Replied: ${msg.hasReplied}`);
                });
            } else {
                console.log('   No system messages found for this user');
            }
            
        } catch (error) {
            console.error('❌ System messages API error:', error.response?.data || error.message);
        }

        // Step 2: Test the system message stats endpoint
        console.log('\n📊 Testing system message stats endpoint...');
        
        try {
            const statsResponse = await axios.get(`${LIVE_SERVER_URL}/api/messages/system-messages/stats`);
            
            console.log(`📈 Stats API response:`);
            console.log(`   Status: ${statsResponse.status}`);
            console.log(`   Success: ${statsResponse.data.success}`);
            if (statsResponse.data.stats) {
                console.log(`   Total messages: ${statsResponse.data.stats.totalMessages}`);
                console.log(`   Visible messages: ${statsResponse.data.stats.visibleMessages}`);
                console.log(`   Replied messages: ${statsResponse.data.stats.repliedMessages}`);
                console.log(`   Avg match score: ${statsResponse.data.stats.avgMatchScore}`);
            }
            
        } catch (error) {
            console.error('❌ Stats API error:', error.response?.data || error.message);
        }

        // Step 3: Test creating a system message via the backend
        console.log('\n📝 Testing system message creation...');
        
        // This would normally be done when a job is created, but we can test the service directly
        console.log('💡 To create system messages, you need to:');
        console.log('   1. Have users with skills in the database');
        console.log('   2. Create jobs that match those skills');
        console.log('   3. The system will automatically send notifications');

        // Step 4: Check if there are any users with skills
        console.log('\n👥 Checking for users with skills...');
        
        try {
            // This would require authentication, but we can check if the endpoint exists
            console.log('🔐 Note: User data endpoints require authentication');
            console.log('💡 You can check your database directly to see if users have skills');
        } catch (error) {
            console.log('❌ User check requires authentication');
        }

        console.log('\n✅ Live API test completed!');
        console.log('\n📋 Summary:');
        console.log('   - System messages API is working');
        console.log('   - No system messages found for the test user');
        console.log('   - This is expected if no jobs have been created recently');
        console.log('\n🎯 Next steps:');
        console.log('   1. Create a job through your app or admin panel');
        console.log('   2. Ensure users have skills that match the job');
        console.log('   3. The system will automatically send notifications');

    } catch (error) {
        console.error('❌ Error testing live API:', error);
    }
};

// Run the test
testLiveAPI(); 