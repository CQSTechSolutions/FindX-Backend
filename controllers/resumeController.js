import User from "../models/User.js";
import {
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  forceDeleteFromCloudinary,
  testCloudinaryConnection,
  uploadToCloudinary,
} from "../utils/cloudinary.js";

// Upload resume (single resume - for backward compatibility)
export const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const userId = req.user._id;

    // Find the user
    const user = await User.findById(userId).select(
      "-password -passwordResetOtp -passwordResetExpire"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user already has maximum number of resumes (10)
    if (user.resumes && user.resumes.length >= 10) {
      return res.status(400).json({
        success: false,
        message:
          "Maximum limit of 10 resumes reached. Please delete some resumes before uploading a new one.",
      });
    }

    // Delete existing resume from Cloudinary if it exists
    if (user.resume && user.resume.includes("cloudinary")) {
      try {
        console.log("Found existing resume URL:", user.resume);
        const publicId = extractPublicIdFromUrl(user.resume);
        if (publicId) {
          console.log(
            "Attempting to delete old resume with public_id:",
            publicId
          );

          // Try regular deletion first
          let deleteResult = await deleteFromCloudinary(publicId);

          // If regular deletion failed, try force deletion
          if (deleteResult.result !== "ok") {
            console.log(
              "Regular deletion failed, attempting force deletion..."
            );
            const forceResult = await forceDeleteFromCloudinary(publicId);
            if (forceResult.success) {
              console.log("Force deletion successful:", forceResult.result);
            } else {
              console.log("Force deletion also failed:", forceResult.error);
            }
          } else {
            console.log(
              "Successfully deleted old resume from Cloudinary:",
              deleteResult
            );
          }
        } else {
          console.log("Could not extract public_id from URL:", user.resume);
        }
      } catch (deleteError) {
        console.log("Error deleting old resume:", deleteError);
        // Continue with upload even if delete fails
      }
    }

    // Upload new resume to Cloudinary
    console.log(
      "Uploading new resume:",
      req.file.originalname,
      "Size:",
      req.file.size,
      "bytes",
      "Type:",
      req.file.mimetype
    );
    const result = await uploadToCloudinary(
      req.file.buffer,
      req.file.originalname,
      "raw" // Use 'raw' for documents like PDF, DOC, etc.
    );
    console.log("New resume uploaded successfully. URL:", result.secure_url);

    // Extract file extension from original filename
    const fileExtension = req.file.originalname.split(".").pop().toLowerCase();

    // Create a proper download URL with correct file extension
    let downloadUrl = result.secure_url;

    // For raw files, ensure the URL has the correct extension for proper download
    if (!downloadUrl.includes(`.${fileExtension}`)) {
      // If Cloudinary URL doesn't include extension, we'll modify it for downloads
      const urlParts = downloadUrl.split("/");
      const lastPart = urlParts[urlParts.length - 1];
      if (!lastPart.includes(".")) {
        urlParts[urlParts.length - 1] = `${lastPart}.${fileExtension}`;
        downloadUrl = urlParts.join("/");
      }
    }

    console.log("Final download URL:", downloadUrl);

    // Create new resume object for multiple resumes array
    const newResume = {
      name: req.file.originalname,
      url: downloadUrl,
      size: req.file.size,
      type: req.file.mimetype,
      extension: fileExtension,
      uploadedAt: new Date(),
      isPrimary: !user.resumes || user.resumes.length === 0, // First resume is primary
    };

    // Update user with new resume (both single and multiple resume fields)
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        resume: downloadUrl, // Keep single resume field for backward compatibility
        $push: { resumes: newResume }, // Add to multiple resumes array
      },
      {
        new: true,
        select: "-password -passwordResetOtp -passwordResetExpire",
      }
    );

    res.json({
      success: true,
      message: "Resume uploaded successfully",
      resumeUrl: downloadUrl,
      fileInfo: {
        originalName: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        extension: fileExtension,
      },
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error uploading resume:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload resume",
    });
  }
};

// Upload multiple resume (new function for multiple resumes)
export const uploadMultipleResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const userId = req.user._id;

    // Find the user
    const user = await User.findById(userId).select(
      "-password -passwordResetOtp -passwordResetExpire"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user already has maximum number of resumes (10)
    if (user.resumes && user.resumes.length >= 10) {
      return res.status(400).json({
        success: false,
        message:
          "Maximum limit of 10 resumes reached. Please delete some resumes before uploading a new one.",
      });
    }

    // Upload new resume to Cloudinary
    console.log(
      "Uploading new resume:",
      req.file.originalname,
      "Size:",
      req.file.size,
      "bytes",
      "Type:",
      req.file.mimetype
    );
    const result = await uploadToCloudinary(
      req.file.buffer,
      req.file.originalname,
      "raw" // Use 'raw' for documents like PDF, DOC, etc.
    );
    console.log("New resume uploaded successfully. URL:", result.secure_url);

    // Extract file extension from original filename
    const fileExtension = req.file.originalname.split(".").pop().toLowerCase();

    // Create a proper download URL with correct file extension
    let downloadUrl = result.secure_url;

    // For raw files, ensure the URL has the correct extension for proper download
    if (!downloadUrl.includes(`.${fileExtension}`)) {
      // If Cloudinary URL doesn't include extension, we'll modify it for downloads
      const urlParts = downloadUrl.split("/");
      const lastPart = urlParts[urlParts.length - 1];
      if (!lastPart.includes(".")) {
        urlParts[urlParts.length - 1] = `${lastPart}.${fileExtension}`;
        downloadUrl = urlParts.join("/");
      }
    }

    console.log("Final download URL:", downloadUrl);

    // Create new resume object for multiple resumes array
    const newResume = {
      name: req.file.originalname,
      url: downloadUrl,
      size: req.file.size,
      type: req.file.mimetype,
      extension: fileExtension,
      uploadedAt: new Date(),
      isPrimary: !user.resumes || user.resumes.length === 0, // First resume is primary
    };

    // Update user with new resume in multiple resumes array
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $push: { resumes: newResume }, // Add to multiple resumes array
      },
      {
        new: true,
        select: "-password -passwordResetOtp -passwordResetExpire",
      }
    );

    res.json({
      success: true,
      message: "Resume uploaded successfully",
      user: updatedUser,
      resumeUrl: downloadUrl,
      fileInfo: {
        originalName: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype,
        extension: fileExtension,
        cloudinaryPublicId: result.public_id,
      },
    });
  } catch (error) {
    console.error("Resume upload error:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading resume",
    });
  }
};

// Delete resume
export const deleteResume = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find the user
    const user = await User.findById(userId).select(
      "-password -passwordResetOtp -passwordResetExpire"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete from Cloudinary if it exists
    if (user.resume && user.resume.includes("cloudinary")) {
      try {
        console.log("Found resume URL to delete:", user.resume);
        const publicId = extractPublicIdFromUrl(user.resume);
        if (publicId) {
          console.log("Attempting to delete resume with public_id:", publicId);

          // Try regular deletion first
          let deleteResult = await deleteFromCloudinary(publicId);

          // If regular deletion failed, try force deletion
          if (deleteResult.result !== "ok") {
            console.log(
              "Regular deletion failed, attempting force deletion..."
            );
            const forceResult = await forceDeleteFromCloudinary(publicId);
            if (forceResult.success) {
              console.log("Force deletion successful:", forceResult.result);
            } else {
              console.log("Force deletion also failed:", forceResult.error);
            }
          } else {
            console.log(
              "Successfully deleted resume from Cloudinary:",
              deleteResult
            );
          }
        } else {
          console.log("Could not extract public_id from URL:", user.resume);
        }
      } catch (deleteError) {
        console.log("Error deleting resume from Cloudinary:", deleteError);
        // Continue with database update even if Cloudinary delete fails
      }
    }

    // Update user to remove resume
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        resume: "",
      },
      {
        new: true,
        select: "-password -passwordResetOtp -passwordResetExpire",
      }
    );

    res.json({
      success: true,
      message: "Resume deleted successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Resume delete error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting resume",
    });
  }
};

// Test Cloudinary connection - for debugging
export const testCloudinary = async (req, res) => {
  try {
    console.log("Testing Cloudinary connection...");
    const connectionTest = await testCloudinaryConnection();

    if (connectionTest.success) {
      res.json({
        success: true,
        message: "Cloudinary connection successful",
        data: connectionTest.result,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Cloudinary connection failed",
        error: connectionTest.error,
      });
    }
  } catch (error) {
    console.error("Test Cloudinary error:", error);
    res.status(500).json({
      success: false,
      message: "Error testing Cloudinary connection",
      error: error.message,
    });
  }
};

// Get all resumes for a user
export const getResumes = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select("resumes");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      resumes: user.resumes || [],
    });
  } catch (error) {
    console.error("Error getting resumes:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get resumes",
    });
  }
};

// Delete a specific resume
export const deleteResumeById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { resumeId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Find the resume to delete
    const resumeToDelete = user.resumes.find(
      (resume) => resume._id.toString() === resumeId
    );
    if (!resumeToDelete) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    // Delete from Cloudinary
    if (resumeToDelete.url && resumeToDelete.url.includes("cloudinary")) {
      try {
        const publicId = extractPublicIdFromUrl(resumeToDelete.url);
        if (publicId) {
          await deleteFromCloudinary(publicId);
        }
      } catch (deleteError) {
        console.log("Error deleting resume from Cloudinary:", deleteError);
      }
    }

    // Remove from user's resumes array
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $pull: { resumes: { _id: resumeId } },
      },
      {
        new: true,
        select: "-password -passwordResetOtp -passwordResetExpire",
      }
    );

    res.json({
      success: true,
      message: "Resume deleted successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error deleting resume:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete resume",
    });
  }
};

// Set a resume as primary
export const setPrimaryResume = async (req, res) => {
  try {
    const userId = req.user._id;
    const { resumeId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Find the resume to set as primary
    const resumeToSetPrimary = user.resumes.find(
      (resume) => resume._id.toString() === resumeId
    );
    if (!resumeToSetPrimary) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    // First, set all resumes to not primary
    await User.findByIdAndUpdate(userId, {
      $set: {
        "resumes.$[].isPrimary": false,
      },
    });

    // Then, set the specific resume as primary
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "resumes.$[resume].isPrimary": true,
        },
      },
      {
        arrayFilters: [{ "resume._id": resumeId }],
        new: true,
        select: "-password -passwordResetOtp -passwordResetExpire",
      }
    );

    res.json({
      success: true,
      message: "Primary resume updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error setting primary resume:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set primary resume",
    });
  }
};

// Update cover letter for a specific resume
export const updateCoverLetter = async (req, res) => {
  try {
    const userId = req.user._id;
    const { resumeId } = req.params;
    const { coverLetter } = req.body;

    if (!coverLetter || typeof coverLetter !== "string") {
      return res.status(400).json({
        success: false,
        message: "Cover letter content is required and must be a string",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const resume = user.resumes.find((r) => r._id.toString() === resumeId);
    if (!resume) {
      return res
        .status(404)
        .json({ success: false, message: "Resume not found" });
    }

    // Update the cover letter for the specific resume
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          "resumes.$[resume].coverLetter": coverLetter,
          "resumes.$[resume].coverLetterUpdatedAt": new Date(),
        },
      },
      {
        arrayFilters: [{ "resume._id": resumeId }],
        new: true,
        select: "-password -passwordResetOtp -passwordResetExpire",
      }
    );

    res.json({
      success: true,
      message: "Cover letter updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating cover letter:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update cover letter" });
  }
};

// Get cover letter for a specific resume
export const getCoverLetter = async (req, res) => {
  try {
    const userId = req.user._id;
    const { resumeId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const resume = user.resumes.find((r) => r._id.toString() === resumeId);
    if (!resume) {
      return res
        .status(404)
        .json({ success: false, message: "Resume not found" });
    }

    res.json({
      success: true,
      coverLetter: resume.coverLetter || "",
      coverLetterUpdatedAt: resume.coverLetterUpdatedAt || null,
    });
  } catch (error) {
    console.error("Error getting cover letter:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to get cover letter" });
  }
};
