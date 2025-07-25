import mongoose from 'mongoose';
import User from './models/User.js';
import Job from './models/Job.model.js';
import Employer from './models/employer.model.js';
import Message from './models/Message.model.js';

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

const cleanupTest = async () => {
    try {
        await connectDB();

        console.log('\n🧹 Cleaning up test data...\n');

        // Delete test users
        const deletedUsers = await User.deleteMany({
            email: { $in: ['john@example.com', 'sarah@example.com', 'mike@example.com'] }
        });
        console.log(`🗑️ Deleted ${deletedUsers.deletedCount} test users`);

        // Delete test employer
        const deletedEmployers = await Employer.deleteMany({
            email: 'employer@testtech.com'
        });
        console.log(`🗑️ Deleted ${deletedEmployers.deletedCount} test employers`);

        // Delete test jobs
        const deletedJobs = await Job.deleteMany({
            companyName: 'Test Tech Company'
        });
        console.log(`🗑️ Deleted ${deletedJobs.deletedCount} test jobs`);

        // Delete test messages
        const deletedMessages = await Message.deleteMany({
            isSystemMessage: true
        });
        console.log(`🗑️ Deleted ${deletedMessages.deletedCount} test system messages`);

        console.log('\n✅ Cleanup completed!');

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 MongoDB disconnected');
    }
};

// Run the cleanup
cleanupTest(); 