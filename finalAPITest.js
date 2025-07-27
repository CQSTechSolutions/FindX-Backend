import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = 'https://findxserver-cqstechsolutions.vercel.app';
const USER_EMAIL = 'shivamgupta11122004@gmail.com';
const USER_PASSWORD = 'shivam';
const USER_ID = '6880357da3de4290a4af55e3';

async function finalAPITest() {
    try {
        console.log('🌐 Final API Test for Mobile App');
        console.log('=' .repeat(50));
        console.log(`📱 Testing for User ID: ${USER_ID}`);
        
        // Step 1: Login
        console.log('\n🔐 Step 1: Logging in...');
        
        const loginResponse = await axios.post(`${SERVER_URL}/api/auth/login`, {
            email: USER_EMAIL,
            password: USER_PASSWORD
        });

        if (loginResponse.status !== 200) {
            console.log('❌ Login failed');
            return;
        }

        const token = loginResponse.data.token;
        console.log('✅ Login successful');
        console.log(`   Token: ${token.substring(0, 20)}...`);

        // Step 2: Test system messages API
        console.log('\n🔔 Step 2: Testing system messages API...');
        
        const messagesResponse = await axios.get(
            `${SERVER_URL}/api/messages/user/${USER_ID}/system-messages?includeReplied=true&limit=20&skip=0`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ API call successful');
        console.log(`   Status: ${messagesResponse.status}`);
        console.log(`   Messages count: ${messagesResponse.data.messages?.length || 0}`);
        
        if (messagesResponse.data.messages && messagesResponse.data.messages.length > 0) {
            console.log('\n📨 Messages found:');
            messagesResponse.data.messages.forEach((message, index) => {
                console.log(`\n${index + 1}. Message Details:`);
                console.log(`   Message ID: ${message._id}`);
                console.log(`   Job Title: ${message.systemMessageData?.jobTitle || 'Unknown'}`);
                console.log(`   Company: ${message.systemMessageData?.companyName || 'Unknown'}`);
                console.log(`   Match Score: ${message.systemMessageData?.matchScore || 'N/A'}%`);
                console.log(`   Visible: ${message.isVisible}`);
                console.log(`   Created: ${new Date(message.createdAt).toLocaleString()}`);
            });
        } else {
            console.log('⚠️ No messages returned from API');
        }

        console.log('\n' + '='.repeat(50));
        console.log('🏁 Final API test completed!');
        
        if (messagesResponse.data.messages && messagesResponse.data.messages.length > 0) {
            console.log('✅ SUCCESS: Notifications are available for the mobile app');
            console.log('📱 The mobile app should now display notifications');
        } else {
            console.log('❌ ISSUE: No notifications found for the mobile app');
        }

    } catch (error) {
        console.error('❌ API test failed:', error.response?.data?.message || error.message);
    }
}

finalAPITest(); 