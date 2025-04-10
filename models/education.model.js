import mongoose from "mongoose";

const educationSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    institute_name: {
        type: String,
        required: true,
    },
    institute_location: {
        type: String,
        required: true,
    },
    year_of_graduation: {
        type: Number,
        required: true,
    },
    grade: {
        type: String,
        required: true,
    },
    internships: {
        type: [String],
        required: true,
    },
    achievements: {
        type: [String],
        required: true,
    }
},{timestamps: true});

const Education = new mongoose.model("Education", educationSchema);
export default Education;