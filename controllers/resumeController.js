import { uploadToCloudinary, deleteFromCloudinary, extractPublicIdFromUrl, forceDeleteFromCloudinary, testCloudinaryConnection } from '../utils/cloudinary.js';
import User from '../models/User.js';

// Upload resume (single resume - for backward compatibility)
export const uploadResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const userId = req.user._id;
        
        // Find the user
        const user = await User.findById(userId).select('-password -passwordResetOtp -passwordResetExpire');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user already has maximum number of resumes (10)
        if (user.resumes && user.resumes.length >= 10) {
            return res.status(400).json({
                success: false,
                message: 'Maximum limit of 10 resumes reached. Please delete some resumes before uploading a new one.'
            });
        }

        // Delete existing resume from Cloudinary if it exists
        if (user.resume && user.resume.includes('cloudinary')) {
            try {
                console.log('Found existing resume URL:', user.resume);
                const publicId = extractPublicIdFromUrl(user.resume);
                if (publicId) {
                    console.log('Attempting to delete old resume with public_id:', publicId);
                    
                    // Try regular deletion first
                    let deleteResult = await deleteFromCloudinary(publicId);
                    
                    // If regular deletion failed, try force deletion
                    if (deleteResult.result !== 'ok') {
                        console.log('Regular deletion failed, attempting force deletion...');
                        const forceResult = await forceDeleteFromCloudinary(publicId);
                        if (forceResult.success) {
                            console.log('Force deletion successful:', forceResult.result);
                        } else {
                            console.log('Force deletion also failed:', forceResult.error);
                        }
                    } else {
                        console.log('Successfully deleted old resume from Cloudinary:', deleteResult);
                    }
                } else {
                    console.log('Could not extract public_id from URL:', user.resume);
                }
            } catch (deleteError) {
                console.log('Error deleting old resume:', deleteError);
                // Continue with upload even if delete fails
            }
        }

        // Upload new resume to Cloudinary
        console.log('Uploading new resume:', req.file.originalname, 'Size:', req.file.size, 'bytes', 'Type:', req.file.mimetype);
        const result = await uploadToCloudinary(
            req.file.buffer,
            req.file.originalname,
            'raw' // Use 'raw' for documents like PDF, DOC, etc.
        );
        console.log('New resume uploaded successfully. URL:', result.secure_url);

        // Extract file extension from original filename
        const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
        
        // Create a proper download URL with correct file extension
        let downloadUrl = result.secure_url;
        
        // For raw files, ensure the URL has the correct extension for proper download
        if (!downloadUrl.includes(`.${fileExtension}`)) {
            // If Cloudinary URL doesn't include extension, we'll modify it for downloads
            const urlParts = downloadUrl.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            if (!lastPart.includes('.')) {
                urlParts[urlParts.length - 1] = `${lastPart}.${fileExtension}`;
                downloadUrl = urlParts.join('/');
            }
        }

        console.log('Final download URL:', downloadUrl);

        // Create new resume object for multiple resumes array
        const newResume = {
            name: req.file.originalname,
            url: downloadUrl,
            size: req.file.size,
            type: req.file.mimetype,
            extension: fileExtension,
            uploadedAt: new Date(),
            isPrimary: !user.resumes || user.resumes.length === 0, // First resume is primary
            isDownloadable: true
        };

        // Update user with new resume (both single and multiple resume fields)
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                resume: downloadUrl, // Keep single resume field for backward compatibility
                resume_downloadble: true,
                $push: { resumes: newResume } // Add to multiple resumes array
            },
            { 
                new: true,
                select: '-password -passwordResetOtp -passwordResetExpire'
            }
        );

        res.json({
            success: true,
            message: 'Resume uploaded successfully',
            resumeUrl: downloadUrl,
            fileInfo: {
                originalName: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype,
                extension: fileExtension
            },
            user: updatedUser
        });
    } catch (error) {
        console.error('Error uploading resume:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload resume'
        });
    }
};

// Upload multiple resume (new function for multiple resumes)
export const uploadMultipleResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const userId = req.user._id;
        
        // Find the user
        const user = await User.findById(userId).select('-password -passwordResetOtp -passwordResetExpire');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user already has maximum number of resumes (10)
        if (user.resumes && user.resumes.length >= 10) {
            return res.status(400).json({
                success: false,
                message: 'Maximum limit of 10 resumes reached. Please delete some resumes before uploading a new one.'
            });
        }

        // Upload new resume to Cloudinary
        console.log('Uploading new resume:', req.file.originalname, 'Size:', req.file.size, 'bytes', 'Type:', req.file.mimetype);
        const result = await uploadToCloudinary(
            req.file.buffer,
            req.file.originalname,
            'raw' // Use 'raw' for documents like PDF, DOC, etc.
        );
        console.log('New resume uploaded successfully. URL:', result.secure_url);

        // Extract file extension from original filename
        const fileExtension = req.file.originalname.split('.').pop().toLowerCase();
        
        // Create a proper download URL with correct file extension
        let downloadUrl = result.secure_url;
        
        // For raw files, ensure the URL has the correct extension for proper download
        if (!downloadUrl.includes(`.${fileExtension}`)) {
            // If Cloudinary URL doesn't include extension, we'll modify it for downloads
            const urlParts = downloadUrl.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            if (!lastPart.includes('.')) {
                urlParts[urlParts.length - 1] = `${lastPart}.${fileExtension}`;
                downloadUrl = urlParts.join('/');
            }
        }

        console.log('Final download URL:', downloadUrl);

        // Create new resume object for multiple resumes array
        const newResume = {
            name: req.file.originalname,
            url: downloadUrl,
            size: req.file.size,
            type: req.file.mimetype,
            extension: fileExtension,
            uploadedAt: new Date(),
            isPrimary: !user.resumes || user.resumes.length === 0, // First resume is primary
            isDownloadable: true
        };

        // Update user with new resume in multiple resumes array
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $push: { resumes: newResume } // Add to multiple resumes array
            },
            { 
                new: true,
                select: '-password -passwordResetOtp -passwordResetExpire'
            }
        );

        res.json({
            success: true,
            message: 'Resume uploaded successfully',
            user: updatedUser,
            resumeUrl: downloadUrl,
            fileInfo: {
                originalName: req.file.originalname,
                size: req.file.size,
                type: req.file.mimetype,
                extension: fileExtension,
                cloudinaryPublicId: result.public_id
            }
        });

    } catch (error) {
        console.error('Resume upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading resume'
        });
    }
};

// Delete resume
export const deleteResume = async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Find the user
        const user = await User.findById(userId).select('-password -passwordResetOtp -passwordResetExpire');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Delete from Cloudinary if it exists
        if (user.resume && user.resume.includes('cloudinary')) {
            try {
                console.log('Found resume URL to delete:', user.resume);
                const publicId = extractPublicIdFromUrl(user.resume);
                if (publicId) {
                    console.log('Attempting to delete resume with public_id:', publicId);
                    
                    // Try regular deletion first
                    let deleteResult = await deleteFromCloudinary(publicId);
                    
                    // If regular deletion failed, try force deletion
                    if (deleteResult.result !== 'ok') {
                        console.log('Regular deletion failed, attempting force deletion...');
                        const forceResult = await forceDeleteFromCloudinary(publicId);
                        if (forceResult.success) {
                            console.log('Force deletion successful:', forceResult.result);
                        } else {
                            console.log('Force deletion also failed:', forceResult.error);
                        }
                    } else {
                        console.log('Successfully deleted resume from Cloudinary:', deleteResult);
                    }
                } else {
                    console.log('Could not extract public_id from URL:', user.resume);
                }
            } catch (deleteError) {
                console.log('Error deleting resume from Cloudinary:', deleteError);
                // Continue with database update even if Cloudinary delete fails
            }
        }

        // Update user to remove resume
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                resume: '',
                resume_downloadble: false
            },
            { 
                new: true,
                select: '-password -passwordResetOtp -passwordResetExpire'
            }
        );

        res.json({
            success: true,
            message: 'Resume deleted successfully',
            user: updatedUser
        });

    } catch (error) {
        console.error('Resume delete error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting resume'
        });
    }
};

// Update resume visibility
export const updateResumeVisibility = async (req, res) => {
    try {
        const userId = req.user._id;
        const { visible } = req.body;

        if (typeof visible !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Visibility must be a boolean value'
            });
        }

        // Update user resume visibility
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { resume_downloadble: visible },
            { 
                new: true,
                select: '-password -passwordResetOtp -passwordResetExpire'
            }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Resume visibility updated successfully',
            user: updatedUser
        });

    } catch (error) {
        console.error('Resume visibility update error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating resume visibility'
        });
    }
};

// Test Cloudinary connection - for debugging
export const testCloudinary = async (req, res) => {
    try {
        console.log('Testing Cloudinary connection...');
        const connectionTest = await testCloudinaryConnection();
        
        if (connectionTest.success) {
            res.json({
                success: true,
                message: 'Cloudinary connection successful',
                data: connectionTest.result
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Cloudinary connection failed',
                error: connectionTest.error
            });
        }
    } catch (error) {
        console.error('Test Cloudinary error:', error);
        res.status(500).json({
            success: false,
            message: 'Error testing Cloudinary connection',
            error: error.message
        });
    }
};

// Get all resumes for a user
export const getResumes = async (req, res) => {
    try {
        const userId = req.user._id;
        
        const user = await User.findById(userId).select('resumes');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            resumes: user.resumes || []
        });
    } catch (error) {
        console.error('Error getting resumes:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get resumes'
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
                message: 'User not found'
            });
        }

        // Find the resume to delete
        const resumeToDelete = user.resumes.find(resume => resume._id.toString() === resumeId);
        if (!resumeToDelete) {
            return res.status(404).json({
                success: false,
                message: 'Resume not found'
            });
        }

        // Delete from Cloudinary
        if (resumeToDelete.url && resumeToDelete.url.includes('cloudinary')) {
            try {
                const publicId = extractPublicIdFromUrl(resumeToDelete.url);
                if (publicId) {
                    await deleteFromCloudinary(publicId);
                }
            } catch (deleteError) {
                console.log('Error deleting resume from Cloudinary:', deleteError);
            }
        }

        // Remove from user's resumes array
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $pull: { resumes: { _id: resumeId } }
            },
            { 
                new: true,
                select: '-password -passwordResetOtp -passwordResetExpire'
            }
        );

        res.json({
            success: true,
            message: 'Resume deleted successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error deleting resume:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete resume'
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
                message: 'User not found'
            });
        }

        // Find the resume to set as primary
        const resumeToSetPrimary = user.resumes.find(resume => resume._id.toString() === resumeId);
        if (!resumeToSetPrimary) {
            return res.status(404).json({
                success: false,
                message: 'Resume not found'
            });
        }

        // Update all resumes to set isPrimary to false, then set the selected one to true
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    'resumes.$[].isPrimary': false,
                    [`resumes.$[resume].isPrimary`]: true
                }
            },
            {
                arrayFilters: [{ 'resume._id': resumeId }],
                new: true,
                select: '-password -passwordResetOtp -passwordResetExpire'
            }
        );

        res.json({
            success: true,
            message: 'Primary resume updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error setting primary resume:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to set primary resume'
        });
    }
};

// Update resume visibility for multiple resumes
export const updateResumeVisibilityById = async (req, res) => {
    try {
        const userId = req.user._id;
        const { resumeId } = req.params;
        const { isDownloadable } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find the resume to update
        const resumeToUpdate = user.resumes.find(resume => resume._id.toString() === resumeId);
        if (!resumeToUpdate) {
            return res.status(404).json({
                success: false,
                message: 'Resume not found'
            });
        }

        // Update the resume's downloadability
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                $set: {
                    [`resumes.$[resume].isDownloadable`]: isDownloadable
                }
            },
            {
                arrayFilters: [{ 'resume._id': resumeId }],
                new: true,
                select: '-password -passwordResetOtp -passwordResetExpire'
            }
        );

        res.json({
            success: true,
            message: 'Resume visibility updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error updating resume visibility:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update resume visibility'
        });
    }
};