import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Job from './models/Job.model.js';
import User from './models/User.js';
import Employer from './models/employer.model.js';

dotenv.config();

// Connect to MongoDB - use a default URI if not set
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/findx';
console.log('Connecting to MongoDB:', mongoUri);

mongoose.connect(mongoUri)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

async function testJobApplicationWithQuestions() {
    try {
        console.log('=== TESTING JOB APPLICATION WITH QUESTIONS ===');

        // Find a job with application questions
        const jobWithQuestions = await Job.findOne({
            'applicationQuestions.0': { $exists: true }
        }).populate('postedBy');

        if (!jobWithQuestions) {
            console.log('No job with application questions found. Creating a test job...');
            
            // Create a test employer if needed
            let testEmployer = await Employer.findOne({ email: 'test@employer.com' });
            if (!testEmployer) {
                testEmployer = new Employer({
                    email: 'test@employer.com',
                    password: 'testpassword123',
                    companyName: 'Test Company',
                    firstName: 'Test',
                    lastName: 'Employer'
                });
                await testEmployer.save();
            }

            // Create a test job with questions
            const testJob = new Job({
                jobTitle: 'Test Job with Questions',
                jobDescription: 'This is a test job with application questions',
                jobLocation: 'Remote',
                workType: 'Remote',
                from: 50000,
                to: 80000,
                currency: 'USD',
                jobSalaryType: 'Per Year',
                category: 'Technology',
                subCategory: 'Software Development',
                postedBy: testEmployer._id,
                status: 'Open',
                applicationQuestions: [
                    {
                        question: 'What is your experience level?',
                        options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
                        required: true
                    },
                    {
                        question: 'Are you available for remote work?',
                        options: ['Yes', 'No', 'Partially'],
                        required: false
                    }
                ]
            });
            await testJob.save();
            console.log('Test job created:', testJob._id);
        } else {
            console.log('Found job with questions:', {
                jobId: jobWithQuestions._id,
                jobTitle: jobWithQuestions.jobTitle,
                questionsCount: jobWithQuestions.applicationQuestions?.length || 0
            });
        }

        // Find a test user
        let testUser = await User.findOne({ email: 'test@user.com' });
        if (!testUser) {
            testUser = new User({
                name: 'Test User',
                email: 'test@user.com',
                password: 'testpassword123'
            });
            await testUser.save();
        }

        console.log('Test user:', testUser._id);

        // Simulate applying for the job with questions
        const jobToTest = jobWithQuestions || await Job.findOne({ jobTitle: 'Test Job with Questions' });
        
        if (!jobToTest) {
            console.error('No job found to test');
            return;
        }

        // Check if user has already applied
        const alreadyApplied = jobToTest.applicants.find(
            applicant => applicant.user.toString() === testUser._id.toString()
        );

        if (alreadyApplied) {
            console.log('User has already applied to this job. Removing existing application...');
            jobToTest.applicants = jobToTest.applicants.filter(
                applicant => applicant.user.toString() !== testUser._id.toString()
            );
        }

        // Simulate question responses
        const questionResponses = jobToTest.applicationQuestions.map((question, index) => ({
            questionIndex: index,
            question: question.question,
            selectedOption: question.options[0], // Select first option for each question
            options: question.options
        }));

        console.log('Simulating application with responses:', questionResponses);

        // Add applicant with question responses
        const applicantData = {
            user: testUser._id,
            status: 'Pending',
            questionResponses: jobToTest.applicationQuestions.map((question, index) => ({
                question: question.question,
                selectedOption: questionResponses[index].selectedOption,
                options: question.options
            }))
        };

        jobToTest.applicants.push(applicantData);
        await jobToTest.save();

        console.log('Application submitted successfully!');
        console.log('Job applicants count:', jobToTest.applicants.length);
        console.log('Latest applicant:', jobToTest.applicants[jobToTest.applicants.length - 1]);

        // Test retrieving the job to see if question responses are saved
        const retrievedJob = await Job.findById(jobToTest._id).populate('applicants.user');
        console.log('Retrieved job applicants:', retrievedJob.applicants.map(app => ({
            userId: app.user._id,
            userName: app.user.name,
            hasQuestionResponses: !!app.questionResponses,
            questionResponsesCount: app.questionResponses?.length || 0,
            questionResponses: app.questionResponses
        })));

        console.log('=== TEST COMPLETED SUCCESSFULLY ===');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the test
testJobApplicationWithQuestions(); 