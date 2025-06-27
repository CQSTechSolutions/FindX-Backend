import { uploadToCloudinary, deleteFromCloudinary, extractPublicIdFromUrl } from '../utils/cloudinary.js';
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
                const publicId = extractPublicIdFromUrl(user.resume);
                if (publicId) {
                    console.log('Attempting to delete old resume with public_id:', publicId);
                    const deleteResult = await deleteFromCloudinary(publicId);
                    console.log('Successfully deleted old resume from Cloudinary:', deleteResult);
                } else {
                    console.log('Could not extract public_id from URL:', user.resume);
                }
            } catch (deleteError) {
                console.log('Error deleting old resume:', deleteError);
                // Continue with upload even if delete fails
            }
        }

        // Upload new resume to Cloudinary
        console.log('Uploading new resume:', req.file.originalname, 'Size:', req.file.size, 'bytes');
        const result = await uploadToCloudinary(
            req.file.buffer,
            req.file.originalname,
            'raw' // Use 'raw' for documents like PDF, DOC, etc.
        );
        console.log('New resume uploaded successfully. URL:', result.secure_url);

        // Update user with new resume URL
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                resume: result.secure_url,
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
            resumeUrl: result.secure_url
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
                const publicId = extractPublicIdFromUrl(user.resume);
                if (publicId) {
                    console.log('Attempting to delete resume with public_id:', publicId);
                    const deleteResult = await deleteFromCloudinary(publicId);
                    console.log('Successfully deleted resume from Cloudinary:', deleteResult);
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