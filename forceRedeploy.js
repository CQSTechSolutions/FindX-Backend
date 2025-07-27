import fs from 'fs';
import path from 'path';

// Add a comment to force redeployment
const systemMessageServicePath = './services/systemMessageService.js';

console.log('🚀 Force Redeploying Backend...');
console.log('=' .repeat(50));

try {
    // Read the current file
    const currentContent = fs.readFileSync(systemMessageServicePath, 'utf8');
    
    // Add a deployment timestamp comment
    const timestamp = new Date().toISOString();
    const deploymentComment = `\n// DEPLOYMENT TIMESTAMP: ${timestamp} - Force redeploy for notification system fix\n`;
    
    // Add the comment at the top of the file
    const updatedContent = deploymentComment + currentContent;
    
    // Write back to file
    fs.writeFileSync(systemMessageServicePath, updatedContent);
    
    console.log('✅ Added deployment timestamp to systemMessageService.js');
    console.log(`📅 Timestamp: ${timestamp}`);
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('1. Commit and push this change to trigger Vercel deployment');
    console.log('2. Wait for deployment to complete (usually 2-3 minutes)');
    console.log('3. Test the API endpoint again');
    console.log('');
    console.log('📋 Commands to run:');
    console.log('git add .');
    console.log('git commit -m "Force redeploy: Fix notification system API queries"');
    console.log('git push origin main');
    console.log('');
    console.log('🔍 After deployment, test with:');
    console.log('node testBackendVersion.js');
    
} catch (error) {
    console.error('❌ Error:', error.message);
} 