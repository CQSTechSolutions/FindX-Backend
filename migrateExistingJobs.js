import mongoose from 'mongoose';
import Job from './models/Job.model.js';
import dotenv from 'dotenv';

dotenv.config();

// Migration script to fix existing jobs with missing applicationQuestions
async function migrateExistingJobs() {
    try {
        // Connect to MongoDB
        await mongoose.connect("mongodb+srv://cqstechsolutionsofficial:Ah73u34C2TNAYiFa@cluster0.xln8z.mongodb.net/findx?retryWrites=true&w=majority&appName=Cluster0");
        console.log('Connected to MongoDB');

        // Find jobs that have jobQuestions but no applicationQuestions
        const jobsToMigrate = await Job.find({
            $and: [
                { 'jobQuestions.0': { $exists: true } }, // Has jobQuestions
                { 'applicationQuestions.0': { $exists: false } } // No applicationQuestions
            ]
        });

        console.log(`Found ${jobsToMigrate.length} jobs to migrate`);

        if (jobsToMigrate.length === 0) {
            console.log('No jobs need migration');
            return;
        }

        let migratedCount = 0;
        let errorCount = 0;

        for (const job of jobsToMigrate) {
            try {
                console.log(`\n--- Migrating job: ${job.jobTitle} (${job._id}) ---`);
                console.log('Current jobQuestions:', job.jobQuestions);
                console.log('Current selectedOptions:', job.selectedOptions);
                console.log('Current mandatoryQuestions:', job.mandatoryQuestions);

                // Transform jobQuestions to applicationQuestions
                if (job.jobQuestions && job.jobQuestions.length > 0) {
                    const applicationQuestions = job.jobQuestions.map(question => {
                        const options = job.selectedOptions && job.selectedOptions[question] 
                            ? job.selectedOptions[question] 
                            : [];
                        const required = job.mandatoryQuestions && job.mandatoryQuestions.includes(question);
                        
                        // Ensure options is always an array and has at least one option
                        let finalOptions = options;
                        if (!finalOptions || finalOptions.length === 0) {
                            // If no options provided, create default options
                            finalOptions = ['Yes', 'No'];
                            console.log(`No options provided for question "${question}", using default options:`, finalOptions);
                        }
                        
                        return {
                            question: question,
                            options: finalOptions,
                            required: required
                        };
                    });

                    // Update the job with the transformed applicationQuestions
                    await Job.findByIdAndUpdate(job._id, {
                        applicationQuestions: applicationQuestions
                    });

                    console.log('✅ Migrated successfully');
                    console.log('New applicationQuestions:', applicationQuestions);
                    migratedCount++;
                } else {
                    // Set empty array if no questions
                    await Job.findByIdAndUpdate(job._id, {
                        applicationQuestions: []
                    });
                    console.log('✅ Set empty applicationQuestions array');
                    migratedCount++;
                }

            } catch (error) {
                console.error(`❌ Error migrating job ${job._id}:`, error.message);
                errorCount++;
            }
        }

        console.log(`\n=== MIGRATION COMPLETE ===`);
        console.log(`Total jobs processed: ${jobsToMigrate.length}`);
        console.log(`Successfully migrated: ${migratedCount}`);
        console.log(`Errors: ${errorCount}`);

        // Verify migration
        const jobsWithQuestions = await Job.find({
            'applicationQuestions.0': { $exists: true }
        });

        console.log(`\n=== VERIFICATION ===`);
        console.log(`Jobs with applicationQuestions: ${jobsWithQuestions.length}`);

        // Show sample of migrated jobs
        const sampleJobs = await Job.find({
            'applicationQuestions.0': { $exists: true }
        }).limit(3);

        console.log('\nSample migrated jobs:');
        sampleJobs.forEach(job => {
            console.log(`- ${job.jobTitle}: ${job.applicationQuestions.length} questions`);
        });

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the migration
migrateExistingJobs(); 