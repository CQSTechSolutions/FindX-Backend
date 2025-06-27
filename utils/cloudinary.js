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
export const uploadToCloudinary = async (fileBuffer, fileName, resourceType = 'raw') => {
    try {
        return new Promise((resolve, reject) => {
            // Create a clean filename without special characters but preserve extension
            const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
            const timestamp = Date.now();
            
            // Extract file extension
            const fileExtension = cleanFileName.split('.').pop().toLowerCase();
            const fileNameWithoutExt = cleanFileName.replace(/\.[^/.]+$/, '');
            
            // Create public_id with extension for proper file type handling
            const publicId = `findx/resumes/${timestamp}_${fileNameWithoutExt}`;
            
            console.log('Uploading to Cloudinary:');
            console.log('- Original filename:', fileName);
            console.log('- Clean filename:', cleanFileName);
            console.log('- File extension:', fileExtension);
            console.log('- Public ID:', publicId);
            
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: resourceType,
                    public_id: publicId,
                    format: fileExtension, // Preserve original file format
                    use_filename: false, // Use our custom public_id
                    unique_filename: false, // We're handling uniqueness with timestamp
                    overwrite: true, // Allow overwriting if same public_id exists
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else {
                        console.log('Upload successful:');
                        console.log('- Public ID:', result.public_id);
                        console.log('- Format:', result.format);
                        console.log('- Resource Type:', result.resource_type);
                        console.log('- Secure URL:', result.secure_url);
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
        
        // Try deleting as 'raw' resource type first (for documents)
        let result = await cloudinary.uploader.destroy(publicId, {
            resource_type: 'raw'
        });
        
        console.log('Cloudinary delete result (raw):', result);
        
        // If deletion failed, try as 'image' resource type
        if (result.result !== 'ok') {
            console.log('Raw deletion failed, trying as image resource type...');
            result = await cloudinary.uploader.destroy(publicId, {
                resource_type: 'image'
            });
            console.log('Cloudinary delete result (image):', result);
        }
        
        // If still failed, try without specifying resource type
        if (result.result !== 'ok') {
            console.log('Image deletion failed, trying without resource type...');
            result = await cloudinary.uploader.destroy(publicId);
            console.log('Cloudinary delete result (auto):', result);
        }
        
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
            console.log('Invalid or non-Cloudinary URL:', cloudinaryUrl);
            return null;
        }

        console.log('Extracting public_id from URL:', cloudinaryUrl);

        // URL format: https://res.cloudinary.com/cloud_name/resource_type/upload/v1234567890/folder/subfolder/public_id.extension
        // or: https://res.cloudinary.com/cloud_name/resource_type/upload/folder/subfolder/public_id.extension
        const urlParts = cloudinaryUrl.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        
        if (uploadIndex === -1 || uploadIndex >= urlParts.length - 1) {
            console.log('Invalid Cloudinary URL format - no upload segment:', cloudinaryUrl);
            return null;
        }

        // Get everything after 'upload/'
        const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
        console.log('Path after upload:', pathAfterUpload);
        
        // Remove version number if present (starts with 'v' followed by numbers)
        let publicIdWithExtension = pathAfterUpload;
        if (pathAfterUpload.match(/^v\d+\//)) {
            publicIdWithExtension = pathAfterUpload.substring(pathAfterUpload.indexOf('/') + 1);
            console.log('Removed version, new path:', publicIdWithExtension);
        }
        
        // For raw files, we need to keep the extension in the public_id for proper deletion
        // But for the public_id extraction, we should remove it for consistency
        let publicId = publicIdWithExtension;
        
        // Check if this looks like our format (timestamp_filename)
        if (publicIdWithExtension.includes('_')) {
            // Remove file extension (everything after the last dot)
            publicId = publicIdWithExtension.replace(/\.[^/.]+$/, '');
        }
        
        console.log('Final extracted public_id:', publicId);
        return publicId;
    } catch (error) {
        console.error('Error extracting public_id from URL:', error);
        return null;
    }
};

// Test Cloudinary connection and deletion
export const testCloudinaryConnection = async () => {
    try {
        console.log('Testing Cloudinary connection...');
        console.log('Cloudinary config:', {
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Not set',
            api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Not set'
        });
        
        // Test by getting account details
        const result = await cloudinary.api.ping();
        console.log('Cloudinary ping result:', result);
        return { success: true, result };
    } catch (error) {
        console.error('Cloudinary connection test failed:', error);
        return { success: false, error: error.message };
    }
};

// Force delete with multiple attempts and different methods
export const forceDeleteFromCloudinary = async (publicId) => {
    try {
        console.log('Force deleting from Cloudinary:', publicId);
        
        const resourceTypes = ['raw', 'image', 'video'];
        let deleteSuccess = false;
        let lastResult = null;
        
        for (const resourceType of resourceTypes) {
            try {
                console.log(`Attempting deletion with resource_type: ${resourceType}`);
                const result = await cloudinary.uploader.destroy(publicId, {
                    resource_type: resourceType
                });
                
                console.log(`Delete result for ${resourceType}:`, result);
                lastResult = result;
                
                if (result.result === 'ok') {
                    console.log(`Successfully deleted with resource_type: ${resourceType}`);
                    deleteSuccess = true;
                    break;
                }
            } catch (error) {
                console.log(`Failed to delete with resource_type ${resourceType}:`, error.message);
            }
        }
        
        // If all resource types failed, try without specifying resource type
        if (!deleteSuccess) {
            try {
                console.log('Attempting deletion without resource_type specification');
                const result = await cloudinary.uploader.destroy(publicId);
                console.log('Delete result (no resource_type):', result);
                lastResult = result;
                
                if (result.result === 'ok') {
                    console.log('Successfully deleted without resource_type specification');
                    deleteSuccess = true;
                }
            } catch (error) {
                console.log('Failed to delete without resource_type:', error.message);
            }
        }
        
        return { success: deleteSuccess, result: lastResult };
    } catch (error) {
        console.error('Force delete failed:', error);
        return { success: false, error: error.message };
    }
};

export default cloudinary; 