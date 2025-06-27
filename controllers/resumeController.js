import { uploadToCloudinary, deleteFromCloudinary, extractPublicIdFromUrl, forceDeleteFromCloudinary, testCloudinaryConnection } from '../utils/cloudinary.js';
import User from '../models/User.js';

// Upload resume
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

        // Update user with new resume URL
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                resume: downloadUrl, // Store URL with proper extension
                resume_downloadble: true // Set to true by default
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