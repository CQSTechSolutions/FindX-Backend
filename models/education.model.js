import mongoose from "mongoose";

const educationSchema = new mongoose.Schema(
	{
		user_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		institute_name: {
			type: String,
			required: true,
		},
		course_name: {
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
		course_highlight: {
			type: String,
			required: true,
		},
	},
	{ timestamps: true },
);

const Education = new mongoose.model("Education", educationSchema);
export default Education;
