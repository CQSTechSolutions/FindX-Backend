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
            
            // For raw files, include the extension in the public_id for proper deletion later
            const publicId = resourceType === 'raw' 
                ? `findx/resumes/${timestamp}_${fileNameWithoutExt}.${fileExtension}`
                : `findx/resumes/${timestamp}_${fileNameWithoutExt}`;
            
            console.log('Uploading to Cloudinary:');
            console.log('- Original filename:', fileName);
            console.log('- Clean filename:', cleanFileName);
            console.log('- File extension:', fileExtension);
            console.log('- Public ID:', publicId);
            console.log('- Resource type:', resourceType);
            
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: resourceType,
                    public_id: publicId,
                    format: fileExtension, // Preserve original file format
                    use_filename: false, // Use our custom public_id
                    unique_filename: false, // We're handling uniqueness with timestamp
                    overwrite: true, // Allow overwriting if same public_id exists
                    folder: null, // Folder is included in public_id
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
        
        // Check if the publicId indicates a raw file (has file extension)
        const isRawFile = /\.[a-zA-Z0-9]+$/.test(publicId);
        console.log('Is raw file (has extension):', isRawFile);
        
        let result;
        
        if (isRawFile) {
            // For raw files, try raw resource type first
            console.log('Attempting to delete as raw file...');
            try {
                result = await cloudinary.uploader.destroy(publicId, {
                    resource_type: 'raw'
                });
                console.log('Raw file deletion result:', result);
            } catch (error) {
                console.error('Error deleting raw file:', error);
                result = { result: 'error', error };
            }
        } else {
            // For non-raw files, try image first
            console.log('Attempting to delete as image...');
            try {
                result = await cloudinary.uploader.destroy(publicId, {
                    resource_type: 'image'
                });
                console.log('Image deletion result:', result);
            } catch (error) {
                console.error('Error deleting image:', error);
                result = { result: 'error', error };
            }
        }
        
        // If initial attempt failed, try other resource types
        if (result.result !== 'ok') {
            console.log('Initial deletion attempt failed, trying alternative resource types...');
            
            const resourceTypes = isRawFile ? ['image', 'auto'] : ['raw', 'auto'];
            
            for (const resourceType of resourceTypes) {
                try {
                    console.log(`Attempting deletion with resource_type: ${resourceType}`);
                    result = await cloudinary.uploader.destroy(publicId, 
                        resourceType === 'auto' ? {} : { resource_type: resourceType }
                    );
                    console.log(`Deletion result for ${resourceType}:`, result);
                    
                    if (result.result === 'ok') {
                        console.log(`Successfully deleted with resource_type: ${resourceType}`);
                        break;
                    }
                } catch (error) {
                    console.error(`Error deleting with resource_type ${resourceType}:`, error);
                }
            }
        }
        
        return result;
    } catch (error) {
        console.error('Error in deleteFromCloudinary:', error);
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

        // For raw files (like resumes), we need to KEEP the extension in the public_id
        // Check if the URL contains /raw/ to determine if it's a raw file
        const isRawFile = urlParts.includes('raw');
        
        if (isRawFile) {
            // Keep the extension for raw files
            console.log('Raw file detected, keeping extension in public_id:', publicIdWithExtension);
            return publicIdWithExtension;
        } else {
            // For non-raw files (images, etc.), remove the extension
            const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, '');
            console.log('Non-raw file, removed extension. Final public_id:', publicId);
            return publicId;
        }
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