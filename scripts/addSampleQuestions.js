import mongoose from 'mongoose';
import Job from '../models/Job.model.js';
import dotenv from 'dotenv';

dotenv.config();

const sampleQuestions = [
    {
        question: "What is your experience level with this type of role?",
        options: ["Beginner (0-1 years)", "Intermediate (2-4 years)", "Advanced (5+ years)", "Expert (10+ years)"],
        required: true
    },
    {
        question: "Are you available to start immediately?",
        options: ["Yes, immediately", "Within 1 week", "Within 2 weeks", "Within 1 month"],
        required: true
    },
    {
        question: "What is your preferred work arrangement?",
        options: ["Full-time only", "Part-time only", "Either full-time or part-time", "Contract work preferred"],
        required: false
    },
    {
        question: "Do you have reliable transportation?",
        options: ["Yes, I have my own vehicle", "Yes, I use public transport", "Yes, I work remotely", "No, but I can arrange transport"],
        required: true
    }
];

async function addSampleQuestions() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find all jobs that don't have application questions
        const jobs = await Job.find({
            $or: [
                { applicationQuestions: { $exists: false } },
                { applicationQuestions: { $size: 0 } }
            ]
        });

        console.log(`Found ${jobs.length} jobs without application questions`);

        // Add sample questions to each job
        for (const job of jobs) {
            // Randomly select 2-3 questions for each job
            const numQuestions = Math.floor(Math.random() * 2) + 2; // 2 or 3 questions
            const selectedQuestions = sampleQuestions
                .sort(() => 0.5 - Math.random())
                .slice(0, numQuestions);

            // Use updateOne to avoid validation issues with existing jobs
            await Job.updateOne(
                { _id: job._id },
                { $set: { applicationQuestions: selectedQuestions } }
            );
            
            console.log(`Added ${numQuestions} questions to job: ${job.jobTitle}`);
        }

        console.log('Sample questions added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error adding sample questions:', error);
        process.exit(1);
    }
}

addSampleQuestions(); 