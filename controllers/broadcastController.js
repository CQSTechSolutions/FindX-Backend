import User from '../models/User.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create nodemailer transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER, // Your email
      pass: process.env.SMTP_PASS, // Your email password or app password
    },
  });
};


// Get broadcast statistics
export const getBroadcastStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const usersWithEmails = await User.countDocuments({ email: { $exists: true, $ne: null } });
    
    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        usersWithEmails,
        emailDeliveryRate: usersWithEmails > 0 ? ((usersWithEmails / totalUsers) * 100).toFixed(1) : 0
      }
    });
  } catch (error) {
    console.error('Broadcast stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get broadcast statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Test email configuration
export const testEmailConfig = async (req, res) => {
  try {
    const transporter = createTransporter();
    
    // Verify the connection configuration
    await transporter.verify();
    
    res.status(200).json({
      success: true,
      message: 'Email configuration is valid'
    });
  } catch (error) {
    console.error('Email config test error:', error);
    res.status(500).json({
      success: false,
      message: 'Email configuration is invalid',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Email configuration error'
    });
  }
};

// Send job alert emails to matched users using BCC (efficient approach)
export const sendJobAlertEmails = async (jobData, matchedUsers) => {
  try {
    console.log('📧 Sending job alert emails to', matchedUsers.length, 'matched users');
    
    if (matchedUsers.length === 0) {
      console.log('⚠️ No matched users to send emails to');
      return { success: true, sentCount: 0 };
    }

    // Extract emails for BCC
    const userEmails = matchedUsers.map(user => user.email);

    // Prepare job alert email content
    const jobTitle = jobData.jobTitle;
    const companyName = jobData.companyName || jobData.postedBy?.companyName || 'Our Company';
    const jobLocation = jobData.jobLocation;
    const workType = jobData.workType;
    const workspaceOption = jobData.workspaceOption;
    const salaryRange = jobData.from && jobData.to ? 
      `${jobData.currency} ${jobData.from.toLocaleString()} - ${jobData.to.toLocaleString()}` : 
      'Competitive salary';

    // Create job alert email content
    const title = `💼 New Job Alert: ${jobTitle} at ${companyName}`;
    const body = `
🎯 Perfect Match! This job matches your profile and preferences.

Company: ${companyName}
Location: ${jobLocation}
Work Type: ${workType}
Work Environment: ${workspaceOption}
Salary Range: ${salaryRange}

View Job Details & Apply: ${process.env.CLIENT_URL || 'https://findx.com'}/job-details/${jobData._id}

You received this email because this job matches your profile and preferences.
    `;

    // Use the provided matched users directly (they already have email addresses)
    const validUserEmails = userEmails.filter(email => email && email.trim() !== '');
    
    if (validUserEmails.length === 0) {
      console.log('⚠️ No valid email addresses found in matched users');
      return { success: true, sentCount: 0 };
    }

    // Create transporter
    const transporter = createTransporter();

    // Get message type emoji and styling for job alerts
    const typeInfo = {
      emoji: '💼',
      color: '#10B981',
      label: 'New Job Alert'
    };

    // Create HTML email template for job alert
    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8fafc;
            }
            .container {
                background: white;
                border-radius: 12px;
                padding: 30px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            .header {
                text-align: center;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 20px;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 24px;
                font-weight: bold;
                color: #3B82F6;
                margin-bottom: 10px;
            }
            .job-alert-badge {
                background: linear-gradient(135deg, #10B981, #059669);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                display: inline-block;
                margin-bottom: 20px;
            }
            .job-title {
                font-size: 24px;
                font-weight: bold;
                color: #1F2937;
                margin-bottom: 15px;
            }
            .job-details {
                background: #f9fafb;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
            }
            .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                padding-bottom: 10px;
                border-bottom: 1px solid #e5e7eb;
            }
            .detail-row:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }
            .detail-label {
                font-weight: 600;
                color: #6B7280;
            }
            .detail-value {
                color: #1F2937;
            }
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #3B82F6, #2563EB);
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                margin: 20px 0;
                text-align: center;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                color: #6B7280;
                font-size: 14px;
            }
            .match-info {
                background: #EFF6FF;
                border: 1px solid #BFDBFE;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">FindX</div>
                <div class="job-alert-badge">💼 New Job Alert</div>
            </div>
            
            <div class="job-title">${jobTitle}</div>
            
            <div class="match-info">
                <p><strong>🎯 Perfect Match!</strong> This job matches your profile and preferences.</p>
            </div>
            
            <div class="job-details">
                <div class="detail-row">
                    <span class="detail-label">Company:</span>
                    <span class="detail-value">${companyName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">${jobLocation}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Work Type:</span>
                    <span class="detail-value">${workType}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Work Environment:</span>
                    <span class="detail-value">${workspaceOption}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Salary Range:</span>
                    <span class="detail-value">${salaryRange}</span>
                </div>
            </div>
            
            <div style="text-align: center;">
                <a href="${process.env.CLIENT_URL || 'https://findx.com'}/job-details/${jobData._id}" class="cta-button">
                    View Job Details & Apply
                </a>
            </div>
            
            <div class="footer">
                <p>You received this email because this job matches your profile and preferences.</p>
                <p>© 2024 FindX. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Create plain text version
    const textContent = `
FindX 💼 - New Job Alert

${jobTitle} at ${companyName}

🎯 Perfect Match! This job matches your profile and preferences.

Company: ${companyName}
Location: ${jobLocation}
Work Type: ${workType}
Work Environment: ${workspaceOption}
Salary Range: ${salaryRange}

View Job Details & Apply: ${process.env.CLIENT_URL || 'https://findx.com'}/job-details/${jobData._id}

---
You received this email because this job matches your profile and preferences.
© 2024 FindX. All rights reserved.
FindX - Your Gateway to Career Success
    `;

    // Email options using BCC (efficient approach)
    const mailOptions = {
      from: {
        name: 'FindX Job Alerts',
        address: process.env.SMTP_USER
      },
      to: process.env.SMTP_USER, // Send to yourself as the main recipient
      bcc: validUserEmails, // All matched users in BCC to protect privacy
      subject: title,
      text: textContent,
      html: htmlTemplate,
      // Add headers to prevent replies going to all users  
      headers: {
        'Reply-To': process.env.SMTP_USER,
        'List-Unsubscribe': `<mailto:unsubscribe@findx.com>`,
      }
    };

    // Send email using BCC (single email to all users)
    await transporter.sendMail(mailOptions);

    console.log(`📧 Job alert email sent to ${validUserEmails.length} users via BCC`);
    console.log(`Subject: ${title}`);
    console.log(`Sent at: ${new Date().toISOString()}`);

    return {
      success: true,
      sentCount: validUserEmails.length,
      totalCount: validUserEmails.length,
      failedEmails: [] // BCC approach doesn't provide individual failure tracking
    };

  } catch (error) {
    console.error('❌ Error sending job alert emails:', error);
    return {
      success: false,
      error: error.message
    };
  }
}; 