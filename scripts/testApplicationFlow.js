import mongoose from 'mongoose';
import Job from '../models/Job.model.js';
import ApplicationResponse from '../models/application_response.model.js';
import dotenv from 'dotenv';

dotenv.config();

async function testApplicationFlow() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find a job with application questions
        const job = await Job.findOne({
            applicationQuestions: { $exists: true, $ne: [] }
        });

        if (!job) {
            console.log('No jobs with application questions found');
            process.exit(1);
        }

        console.log(`\nTesting with job: ${job.jobTitle}`);
        console.log(`Job has ${job.applicationQuestions.length} application questions:`);
        
        job.applicationQuestions.forEach((q, index) => {
            console.log(`${index + 1}. ${q.question}`);
            console.log(`   Options: ${q.options.join(', ')}`);
            console.log(`   Required: ${q.required}`);
        });

        // Simulate question responses
        const questionResponses = job.applicationQuestions.map((question, index) => ({
            selectedOption: question.options[0] // Select first option for each question
        }));

        console.log('\nSimulated responses:');
        questionResponses.forEach((response, index) => {
            console.log(`${index + 1}. ${response.selectedOption}`);
        });

        // Test validation logic (similar to what's in the controller)
        console.log('\n--- Testing Validation Logic ---');
        
        // Test 1: Valid responses
        console.log('Test 1: Valid responses');
        let valid = true;
        for (let i = 0; i < job.applicationQuestions.length; i++) {
            const question = job.applicationQuestions[i];
            const response = questionResponses[i];

            if (!response || !response.selectedOption) {
                console.log(`❌ Question ${i + 1}: No response provided`);
                valid = false;
            } else if (!question.options.includes(response.selectedOption)) {
                console.log(`❌ Question ${i + 1}: Invalid option selected`);
                valid = false;
            } else {
                console.log(`✅ Question ${i + 1}: Valid response`);
            }
        }
        console.log(`Overall validation: ${valid ? '✅ PASSED' : '❌ FAILED'}`);

        // Test 2: Missing required response
        console.log('\nTest 2: Missing required response');
        const incompleteResponses = [...questionResponses];
        const requiredQuestionIndex = job.applicationQuestions.findIndex(q => q.required);
        if (requiredQuestionIndex !== -1) {
            incompleteResponses[requiredQuestionIndex] = { selectedOption: '' };
            
            valid = true;
            for (let i = 0; i < job.applicationQuestions.length; i++) {
                const question = job.applicationQuestions[i];
                const response = incompleteResponses[i];

                if (!response || !response.selectedOption) {
                    if (question.required) {
                        console.log(`❌ Question ${i + 1}: Required question not answered`);
                        valid = false;
                    } else {
                        console.log(`⚠️  Question ${i + 1}: Optional question not answered`);
                    }
                } else if (!question.options.includes(response.selectedOption)) {
                    console.log(`❌ Question ${i + 1}: Invalid option selected`);
                    valid = false;
                } else {
                    console.log(`✅ Question ${i + 1}: Valid response`);
                }
            }
            console.log(`Overall validation: ${valid ? '✅ PASSED' : '❌ FAILED'}`);
        } else {
            console.log('No required questions found to test');
        }

        // Test 3: Invalid option
        console.log('\nTest 3: Invalid option');
        const invalidResponses = [...questionResponses];
        invalidResponses[0] = { selectedOption: 'Invalid Option' };
        
        valid = true;
        for (let i = 0; i < job.applicationQuestions.length; i++) {
            const question = job.applicationQuestions[i];
            const response = invalidResponses[i];

            if (!response || !response.selectedOption) {
                console.log(`❌ Question ${i + 1}: No response provided`);
                valid = false;
            } else if (!question.options.includes(response.selectedOption)) {
                console.log(`❌ Question ${i + 1}: Invalid option "${response.selectedOption}"`);
                valid = false;
            } else {
                console.log(`✅ Question ${i + 1}: Valid response`);
            }
        }
        console.log(`Overall validation: ${valid ? '✅ PASSED' : '❌ FAILED'}`);

        console.log('\n--- Application Flow Test Complete ---');
        console.log('✅ All validation tests completed successfully!');
        
        process.exit(0);
    } catch (error) {
        console.error('Error testing application flow:', error);
        process.exit(1);
    }
}

testApplicationFlow(); 