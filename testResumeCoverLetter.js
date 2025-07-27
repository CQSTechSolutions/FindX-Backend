import mongoose from 'mongoose';
import Job from './models/Job.model.js';
import User from './models/User.js';

// Test script to verify resume and cover letter functionality
async function testResumeCoverLetter() {
    try {
        console.log('🧪 Testing Resume and Cover Letter functionality...');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/findx');
        console.log('✅ Connected to database');
        
        // Create a test user with resume and cover letter
        const testUser = new User({
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
            resumes: [{
                name: 'Test Resume.pdf',
                url: 'https://example.com/resume.pdf',
                isPrimary: true,
                coverLetter: 'This is a test cover letter for the job application.'
            }],
            cover_letter: 'This is a test cover letter for the job application.'
        });
        
        await testUser.save();
        console.log('✅ Created test user with resume and cover letter');
        
        // Create a test job
        const testJob = new Job({
            jobTitle: 'Test Job',
            jobDescription: 'Test job description',
            jobLocation: 'Test Location',
            workspaceOption: 'Remote',
            category: 'Technology',
            subcategory: 'Software Development',
            workType: 'Full-time',
            payType: 'Monthly salary',
            currency: 'USD',
            from: 5000,
            to: 8000,
            postedBy: '507f1f77bcf86cd799439011', // Mock employer ID
            applicationQuestions: [
                {
                    question: 'Do you have experience with React?',
                    options: ['Yes', 'No'],
                    required: true
                }
            ]
        });
        
        await testJob.save();
        console.log('✅ Created test job with application questions');
        
        // Test applying for the job with resume and cover letter
        const applicationData = {
            user: testUser._id,
            status: 'Pending',
            selectedResume: {
                resumeId: testUser.resumes[0]._id,
                resumeName: testUser.resumes[0].name,
                resumeUrl: testUser.resumes[0].url
            },
            selectedCoverLetter: testUser.cover_letter,
            questionResponses: [
                {
                    question: 'Do you have experience with React?',
                    selectedOption: 'Yes',
                    options: ['Yes', 'No']
                }
            ]
        };
        
        testJob.applicants.push(applicationData);
        await testJob.save();
        console.log('✅ Applied for job with resume and cover letter');
        
        // Verify the application was saved correctly
        const savedJob = await Job.findById(testJob._id).populate('applicants.user');
        const savedApplication = savedJob.applicants[0];
        
        console.log('📋 Application Details:');
        console.log('- User:', savedApplication.user.name);
        console.log('- Status:', savedApplication.status);
        console.log('- Resume:', savedApplication.selectedResume);
        console.log('- Cover Letter:', savedApplication.selectedCoverLetter ? 'Included' : 'Not included');
        console.log('- Question Responses:', savedApplication.questionResponses.length);
        
        if (savedApplication.selectedResume && savedApplication.selectedCoverLetter) {
            console.log('✅ SUCCESS: Resume and cover letter are properly saved in the application!');
        } else {
            console.log('❌ FAILED: Resume and cover letter are not properly saved');
        }
        
        // Cleanup
        await User.findByIdAndDelete(testUser._id);
        await Job.findByIdAndDelete(testJob._id);
        console.log('✅ Cleaned up test data');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('✅ Disconnected from database');
    }
}

// Run the test
testResumeCoverLetter(); 