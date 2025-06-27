import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload file to Cloudinary
export const uploadToCloudinary = async (fileBuffer, fileName, resourceType = 'auto') => {
    try {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: resourceType,
                    public_id: `resumes/${Date.now()}_${fileName}`,
                    folder: 'findx/resumes',
                    use_filename: true,
                    unique_filename: true,
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else {
                        resolve(result);
                    }
                }
            );

            uploadStream.end(fileBuffer);
        });
    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        throw error;
    }
};

// Delete file from Cloudinary
export const deleteFromCloudinary = async (publicId) => {
    try {
        console.log('Attempting to delete from Cloudinary with public_id:', publicId);
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: 'raw' // Specify resource type for documents
        });
        console.log('Cloudinary delete result:', result);
        return result;
    } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        throw error;
    }
};

// Helper function to extract public_id from Cloudinary URL
export const extractPublicIdFromUrl = (cloudinaryUrl) => {
    try {
        if (!cloudinaryUrl || !cloudinaryUrl.includes('cloudinary')) {
            return null;
        }

        // URL format: https://res.cloudinary.com/cloud_name/resource_type/upload/v1234567890/folder/public_id.extension
        const urlParts = cloudinaryUrl.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        
        if (uploadIndex === -1 || uploadIndex >= urlParts.length - 1) {
            console.log('Invalid Cloudinary URL format:', cloudinaryUrl);
            return null;
        }

        // Get everything after 'upload/' and before the file extension
        const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
        
        // Remove version number if present (starts with 'v' followed by numbers)
        let publicIdWithExtension = pathAfterUpload;
        if (pathAfterUpload.match(/^v\d+\//)) {
            publicIdWithExtension = pathAfterUpload.substring(pathAfterUpload.indexOf('/') + 1);
        }
        
        // Remove file extension
        const publicId = publicIdWithExtension.split('.')[0];
        
        console.log('Extracted public_id:', publicId, 'from URL:', cloudinaryUrl);
        return publicId;
    } catch (error) {
        console.error('Error extracting public_id from URL:', error);
        return null;
    }
};

export default cloudinary; 