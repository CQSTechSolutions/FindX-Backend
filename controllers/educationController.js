import Education from '../models/education.model.js';
import ErrorResponse from '../utils/errorResponse.js';

// Get all education records for a user
export const getUserEducation = async (req, res, next) => {
  try {
    const education = await Education.find({ user_id: req.user.id });
    res.status(200).json({
      success: true,
      data: education
    });
  } catch (error) {
    next(error);
  }
};

// Add a new education record
export const addEducation = async (req, res, next) => {
  try {
    const { institute_name, course_name, year_of_graduation, grade, course_highlight } = req.body;

    const education = await Education.create({
      user_id: req.user.id,
      institute_name,
      course_name,
      year_of_graduation,
      grade,
      course_highlight
    });

    res.status(201).json({
      success: true,
      data: education
    });
  } catch (error) {
    next(error);
  }
};

// Update an education record
export const updateEducation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { institute_name, course_name, year_of_graduation, grade, course_highlight } = req.body;

    let education = await Education.findById(id);

    if (!education) {
      return next(new ErrorResponse(`Education record not found with id of ${id}`, 404));
    }

    // Check if the education record belongs to the user
    if (education.user_id.toString() !== req.user.id) {
      return next(new ErrorResponse(`User not authorized to update this education record`, 401));
    }

    education = await Education.findByIdAndUpdate(
      id,
      { institute_name, course_name, year_of_graduation, grade, course_highlight },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: education
    });
  } catch (error) {
    next(error);
  }
};

// Delete an education record
export const deleteEducation = async (req, res, next) => {
  try {
    const { id } = req.params;

    let education = await Education.findById(id);

    if (!education) {
      return next(new ErrorResponse(`Education record not found with id of ${id}`, 404));
    }

    // Check if the education record belongs to the user
    if (education.user_id.toString() !== req.user.id) {
      return next(new ErrorResponse(`User not authorized to delete this education record`, 401));
    }

    await education.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
}; 