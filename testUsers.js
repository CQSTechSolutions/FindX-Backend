import mongoose from 'mongoose';
import User from './models/User.js';

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

const testUsers = async () => {
    try {
        await connectDB();

        console.log('\n🔍 Testing Users...\n');

        // 1. Check total users
        const totalUsers = await User.countDocuments();
        console.log(`📊 Total users in database: ${totalUsers}`);

        // 2. Check users with skills
        const usersWithSkills = await User.countDocuments({ 
            skills_and_capabilities: { $exists: true, $ne: [], $not: { $size: 0 } }
        });
        console.log(`👥 Users with skills: ${usersWithSkills}`);

        // 3. Check users without skills
        const usersWithoutSkills = await User.countDocuments({
            $or: [
                { skills_and_capabilities: { $exists: false } },
                { skills_and_capabilities: [] },
                { skills_and_capabilities: { $size: 0 } }
            ]
        });
        console.log(`👤 Users without skills: ${usersWithoutSkills}`);

        // 4. Get all users with their skills
        const allUsers = await User.find()
            .select('name email skills_and_capabilities dream_job_title createdAt')
            .sort({ createdAt: -1 })
            .limit(10);

        console.log('\n📋 Recent Users:');
        allUsers.forEach((user, index) => {
            console.log(`\n${index + 1}. User: ${user.name} (${user.email})`);
            console.log(`   Created: ${user.createdAt}`);
            console.log(`   Dream Job: ${user.dream_job_title || 'Not set'}`);
            console.log(`   Skills: ${user.skills_and_capabilities?.length || 0} skills`);
            if (user.skills_and_capabilities && user.skills_and_capabilities.length > 0) {
                console.log(`   Skill List: ${user.skills_and_capabilities.slice(0, 5).join(', ')}${user.skills_and_capabilities.length > 5 ? '...' : ''}`);
            } else {
                console.log(`   Skill List: No skills`);
            }
        });

        // 5. Check users with specific skill patterns
        const usersWithReact = await User.countDocuments({
            skills_and_capabilities: { $regex: /react/i }
        });
        console.log(`\n⚛️ Users with React skills: ${usersWithReact}`);

        const usersWithJavaScript = await User.countDocuments({
            skills_and_capabilities: { $regex: /javascript/i }
        });
        console.log(`📜 Users with JavaScript skills: ${usersWithJavaScript}`);

        const usersWithPython = await User.countDocuments({
            skills_and_capabilities: { $regex: /python/i }
        });
        console.log(`🐍 Users with Python skills: ${usersWithPython}`);

        // 6. Check profile completion
        const completedProfiles = await User.countDocuments({
            isProfileCompleted: true
        });
        console.log(`✅ Users with completed profiles: ${completedProfiles}`);

        const incompleteProfiles = await User.countDocuments({
            $or: [
                { isProfileCompleted: false },
                { isProfileCompleted: { $exists: false } }
            ]
        });
        console.log(`❌ Users with incomplete profiles: ${incompleteProfiles}`);

        console.log('\n✅ User test completed!');

    } catch (error) {
        console.error('❌ Error testing users:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 MongoDB disconnected');
    }
};

// Run the test
testUsers(); 