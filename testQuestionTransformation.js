import mongoose from 'mongoose';
import Job from './models/Job.model.js';
import Employer from './models/employer.model.js';
import dotenv from 'dotenv';

dotenv.config();

// Test the question transformation logic
async function testQuestionTransformation() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Create a test employer if it doesn't exist
        let testEmployer = await Employer.findOne({ email: 'test@employer.com' });
        if (!testEmployer) {
            testEmployer = new Employer({
                companyName: 'Test Company',
                email: 'test@employer.com',
                password: 'testpassword123'
            });
            await testEmployer.save();
            console.log('Test employer created:', testEmployer._id);
        }

        // Simulate the data format that FindX-Employer sends
        const jobData = {
            jobTitle: 'Test Job with Questions',
            jobLocation: 'Sydney, NSW',
            workspaceOption: 'On-site',
            category: 'Technology',
            subcategory: 'Software Development',
            workType: 'Full-time',
            payType: 'Salary',
            currency: 'AUD',
            from: 80000,
            to: 120000,
            jobDescription: 'This is a test job with application questions.',
            postedBy: testEmployer._id,
            
            // Questions data in FindX-Employer format
            jobQuestions: [
                'What is your experience level?',
                'Are you available for remote work?',
                'Do you have experience with React?'
            ],
            selectedOptions: {
                'What is your experience level?': ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
                'Are you available for remote work?': ['Yes', 'No', 'Partially'],
                'Do you have experience with React?': ['Yes', 'No', 'Some experience']
            },
            mandatoryQuestions: [
                'What is your experience level?',
                'Do you have experience with React?'
            ]
        };

        console.log('=== TESTING QUESTION TRANSFORMATION ===');
        console.log('Input data:', {
            jobQuestions: jobData.jobQuestions,
            selectedOptions: jobData.selectedOptions,
            mandatoryQuestions: jobData.mandatoryQuestions
        });

        // Apply the transformation logic (same as in createJob)
        if (jobData.jobQuestions && jobData.jobQuestions.length > 0) {
            console.log('Transforming job questions to application questions format...');
            
            jobData.applicationQuestions = jobData.jobQuestions.map(question => {
                const options = jobData.selectedOptions && jobData.selectedOptions[question] 
                    ? jobData.selectedOptions[question] 
                    : [];
                const required = jobData.mandatoryQuestions && jobData.mandatoryQuestions.includes(question);
                
                return {
                    question: question,
                    options: options,
                    required: required
                };
            });
            
            console.log('Transformed application questions:', {
                count: jobData.applicationQuestions.length,
                questions: jobData.applicationQuestions
            });
        } else {
            jobData.applicationQuestions = [];
            console.log('No job questions provided, setting applicationQuestions to empty array');
        }

        // Create the job in the database
        const job = new Job(jobData);
        await job.save();

        console.log('=== JOB CREATED SUCCESSFULLY ===');
        console.log('Job ID:', job._id);
        console.log('Job Title:', job.jobTitle);
        console.log('Application Questions Count:', job.applicationQuestions?.length || 0);
        console.log('Application Questions:', job.applicationQuestions);

        // Verify the transformation worked
        const retrievedJob = await Job.findById(job._id);
        console.log('=== VERIFICATION ===');
        console.log('Retrieved job application questions:', retrievedJob.applicationQuestions);

        // Test the application flow
        console.log('=== TESTING APPLICATION FLOW ===');
        const hasQuestions = retrievedJob.applicationQuestions && 
                           Array.isArray(retrievedJob.applicationQuestions) && 
                           retrievedJob.applicationQuestions.length > 0;
        
        console.log('Has questions:', hasQuestions);
        console.log('Questions count:', retrievedJob.applicationQuestions?.length || 0);

        if (hasQuestions) {
            console.log('✅ SUCCESS: Job has application questions and should route to questions screen');
        } else {
            console.log('❌ FAILURE: Job has no application questions');
        }

        // Clean up
        await Job.findByIdAndDelete(job._id);
        console.log('Test job cleaned up');

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the test
testQuestionTransformation(); 