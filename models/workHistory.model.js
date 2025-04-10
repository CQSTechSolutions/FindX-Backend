import mongoose from "mongoose";

const workHistorySchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "Please provide a user ID"],
    },
    past_job_title: {
        type: String,
        required: [true, "Please provide a past job title"],
    },
    past_company_name: {
        type: String,
        required: [true, "Please provide a past company name"],
    },
    past_job_location: {
        type: String,
        required: [true, "Please provide a past job location"],
    },
    past_job_start_date: {
        type: Date,
        required: [true, "Please provide a past job start date"],
    },
    past_job_end_date: {
        type: Date,
        required: [true, "Please provide a past job end date"],
    },
    past_employment_type: {
        type: String,
        enum: ["Full-time", "Part-time", "Contract", "Internship", "Remote"],
        required: [true, "Please provide a past employment type"]
    },
    past_job_leave_reason: {
        type: String,
        required: true
    },
    past_job_refrence_person: {
        type: string,
        required: [true, "Please provide past job refrence."]
    },
    NoticePeriod: {
        type: String,
        required: [true, "Please provide a notice period"]
    }
});

const WorkHistory = mongoose.model("WorkHistory", workHistorySchema);
export default WorkHistory;