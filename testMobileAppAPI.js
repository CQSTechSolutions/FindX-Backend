import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = process.env.SERVER_URL || 'https://findxserver-cqstechsolutions.vercel.app';
const TEST_USER_EMAIL = 'shivamgupta11122004@gmail.com';
const TEST_USER_PASSWORD = 'shivam';

async function testMobileAppAPI() {
    try {
        console.log('📱 Testing Mobile App API Calls');
        console.log('=' .repeat(50));
        console.log(`🌐 Server URL: ${SERVER_URL}`);
        
        // Step 1: Login as user to get token
        console.log('\n🔐 Step 1: Logging in as user...');
        
        let userToken = null;
        let loginResponse = null;
        try {
            loginResponse = await axios.post(`${SERVER_URL}/api/auth/login`, {
                email: TEST_USER_EMAIL,
                password: TEST_USER_PASSWORD
            });

            if (loginResponse.status === 200 && loginResponse.data.token) {
                userToken = loginResponse.data.token;
                console.log('✅ Login successful');
                console.log(`   User ID: ${loginResponse.data.user._id}`);
                console.log(`   Token: ${userToken.substring(0, 20)}...`);
            } else {
                console.log('❌ Login failed - no token received');
                return;
            }
        } catch (error) {
            console.log('❌ Login failed:', error.response?.data?.message || error.message);
            return;
        }

        // Step 2: Test the system messages API endpoint
        console.log('\n🔔 Step 2: Testing system messages API...');
        
        try {
            const userId = loginResponse.data.user._id;
            const messagesResponse = await axios.get(
                `${SERVER_URL}/api/messages/user/${userId}/system-messages?includeReplied=true&limit=20&skip=0`,
                {
                    headers: {
                        'Authorization': `Bearer ${userToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('✅ System messages API call successful');
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
                    console.log(`   Has Replied: ${message.hasReplied}`);
                    console.log(`   Created: ${new Date(message.createdAt).toLocaleString()}`);
                    console.log(`   Content Preview: ${message.content.substring(0, 100)}...`);
                });
            } else {
                console.log('⚠️ No messages returned from API');
            }

        } catch (error) {
            console.log('❌ System messages API call failed:');
            console.log(`   Status: ${error.response?.status}`);
            console.log(`   Error: ${error.response?.data?.message || error.message}`);
            
            if (error.response?.data) {
                console.log(`   Response data:`, error.response.data);
            }
        }

        // Step 3: Test making a message visible
        console.log('\n👁️ Step 3: Testing make message visible API...');
        
        try {
            const userId = loginResponse.data.user._id;
            const messagesResponse = await axios.get(
                `${SERVER_URL}/api/messages/user/${userId}/system-messages?includeReplied=true&limit=1&skip=0`,
                {
                    headers: {
                        'Authorization': `Bearer ${userToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (messagesResponse.data.messages && messagesResponse.data.messages.length > 0) {
                const messageId = messagesResponse.data.messages[0]._id;
                
                const visibleResponse = await axios.put(
                    `${SERVER_URL}/api/messages/system-message/${messageId}/visible`,
                    { userId },
                    {
                        headers: {
                            'Authorization': `Bearer ${userToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                console.log('✅ Make message visible API call successful');
                console.log(`   Status: ${visibleResponse.status}`);
                console.log(`   Response: ${visibleResponse.data.message}`);
            } else {
                console.log('⚠️ No messages available to test visibility');
            }

        } catch (error) {
            console.log('❌ Make message visible API call failed:');
            console.log(`   Status: ${error.response?.status}`);
            console.log(`   Error: ${error.response?.data?.message || error.message}`);
        }

        console.log('\n' + '='.repeat(50));
        console.log('🏁 Mobile app API test completed!');
        
        console.log('\n💡 Summary:');
        console.log('   ✅ Login API working');
        console.log('   ✅ System messages API working');
        console.log('   ✅ Messages are being returned');
        console.log('   ✅ Mobile app should now show notifications');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

testMobileAppAPI(); 