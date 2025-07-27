import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = 'https://findxserver-cqstechsolutions.vercel.app';
const USER_ID = '6880357da3de4290a4af55e3';

async function testBackendVersion() {
    try {
        console.log('🔍 Testing Backend Version');
        console.log('=' .repeat(50));
        console.log(`🌐 Server URL: ${SERVER_URL}`);
        
        // Step 1: Login
        console.log('\n🔐 Step 1: Logging in...');
        
        const loginResponse = await axios.post(`${SERVER_URL}/api/auth/login`, {
            email: 'shivamgupta11122004@gmail.com',
            password: 'shivam'
        });

        if (loginResponse.status !== 200) {
            console.log('❌ Login failed');
            return;
        }

        const token = loginResponse.data.token;
        console.log('✅ Login successful');

        // Step 2: Test with includeReplied=false (old behavior)
        console.log('\n🔍 Step 2: Testing with includeReplied=false...');
        
        const response1 = await axios.get(
            `${SERVER_URL}/api/messages/user/${USER_ID}/system-messages?includeReplied=false&limit=20&skip=0`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ API call successful');
        console.log(`   Status: ${response1.status}`);
        console.log(`   Messages count: ${response1.data.messages?.length || 0}`);
        console.log(`   Response: ${JSON.stringify(response1.data, null, 2)}`);

        // Step 3: Test with includeReplied=true (should show all messages)
        console.log('\n🔍 Step 3: Testing with includeReplied=true...');
        
        const response2 = await axios.get(
            `${SERVER_URL}/api/messages/user/${USER_ID}/system-messages?includeReplied=true&limit=20&skip=0`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ API call successful');
        console.log(`   Status: ${response2.status}`);
        console.log(`   Messages count: ${response2.data.messages?.length || 0}`);
        console.log(`   Response: ${JSON.stringify(response2.data, null, 2)}`);

        // Step 4: Test without any query parameters
        console.log('\n🔍 Step 4: Testing without query parameters...');
        
        const response3 = await axios.get(
            `${SERVER_URL}/api/messages/user/${USER_ID}/system-messages`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ API call successful');
        console.log(`   Status: ${response3.status}`);
        console.log(`   Messages count: ${response3.data.messages?.length || 0}`);
        console.log(`   Response: ${JSON.stringify(response3.data, null, 2)}`);

        console.log('\n' + '='.repeat(50));
        console.log('🏁 Backend version test completed!');
        
        if (response1.data.messages?.length > 0 || response2.data.messages?.length > 0 || response3.data.messages?.length > 0) {
            console.log('✅ SUCCESS: Backend is using updated code');
            console.log('📱 Mobile app should now show notifications');
        } else {
            console.log('❌ ISSUE: Backend is still using old code');
            console.log('🚀 Need to redeploy backend to Vercel');
        }

    } catch (error) {
        console.error('❌ API test failed:', error.response?.data?.message || error.message);
    }
}

testBackendVersion(); 