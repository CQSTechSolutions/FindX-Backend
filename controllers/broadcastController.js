import User from '../models/User.js';
import Employer from '../models/employer.model.js';
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

    console.log('🔍 User emails:', userEmails);
    console.log('🔍 Job data:', jobData);
    
    // Fetch employer data to get company information
    let employerData = null;
    let companyName = 'Our Company';
    let companyLogo = '';
    let companyWebsite = '';
    let companyIndustry = '';
    
    if (jobData.postedBy) {
      try {
        employerData = await Employer.findById(jobData.postedBy).select('companyName companyLogo companyWebsite companyIndustry');
        if (employerData) {
          companyName = employerData.companyName || 'Our Company';
          companyLogo = employerData.companyLogo || '';
          companyWebsite = employerData.companyWebsite || '';
          companyIndustry = employerData.companyIndustry || '';
        }
      } catch (error) {
        console.error('❌ Error fetching employer data:', error);
      }
    }
    
    // Prepare job alert email content with exact job title
    const exactJobTitle = jobData.jobTitle || 'Job Position';
    const jobLocation = jobData.jobLocation || 'Location not specified';
    const workType = jobData.workType || 'Work type not specified';
    const workspaceOption = jobData.workspaceOption || 'Work environment not specified';
    
    // Enhanced salary formatting
    let salaryRange = 'Competitive salary';
    if (jobData.from && jobData.to) {
      const currency = jobData.currency || 'AUD';
      const salaryType = jobData.jobSalaryType || 'Per Year';
      salaryRange = `${currency} ${jobData.from.toLocaleString()} - ${jobData.to.toLocaleString()} ${salaryType}`;
    } else if (jobData.from) {
      const currency = jobData.currency || 'AUD';
      const salaryType = jobData.jobSalaryType || 'Per Year';
      salaryRange = `From ${currency} ${jobData.from.toLocaleString()} ${salaryType}`;
    }

    // Get job skills for email content
    const jobSkills = jobData.jobSkills && jobData.jobSkills.length > 0 ? 
      jobData.jobSkills.join(', ') : 'Skills not specified';
    
    // Get job description (truncated if too long)
    const jobDescription = jobData.jobDescription || jobData.jobSummary || 'No description available';
    const truncatedDescription = jobDescription.length > 200 ? 
      jobDescription.substring(0, 200) + '...' : jobDescription;

    // Create job alert email content with exact title
    const title = `💼 New Job Alert: "${exactJobTitle}" at ${companyName}`;
    const body = `
🎯 Perfect Match! This job matches your profile and preferences.

📋 Job Title: "${exactJobTitle}"
🏢 Company: ${companyName}
📍 Location: ${jobLocation}
💼 Work Type: ${workType}
🏠 Work Environment: ${workspaceOption}
💰 Salary Range: ${salaryRange}
🔧 Required Skills: ${jobSkills}

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

    // Create enhanced HTML email template for job alert
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
                max-width: 650px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f8fafc;
            }
            .container {
                background: white;
                border-radius: 16px;
                padding: 40px;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
                border: 1px solid #e5e7eb;
            }
            .header {
                text-align: center;
                border-bottom: 3px solid #10B981;
                padding-bottom: 25px;
                margin-bottom: 35px;
                position: relative;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #10B981;
                margin-bottom: 15px;
                text-shadow: 0 2px 4px rgba(16, 185, 129, 0.1);
            }
            .match-badge {
                background: linear-gradient(135deg, #10B981, #059669);
                color: white;
                padding: 10px 20px;
                border-radius: 25px;
                font-size: 14px;
                font-weight: 600;
                display: inline-block;
                margin-bottom: 20px;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            }
            .company-section {
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 25px;
                padding: 20px;
                background: linear-gradient(135deg, #F0FDF4, #DCFCE7);
                border-radius: 12px;
                border: 1px solid #BBF7D0;
            }
            .company-logo {
                width: 60px;
                height: 60px;
                border-radius: 12px;
                margin-right: 15px;
                object-fit: cover;
                border: 2px solid #10B981;
            }
            .company-info h3 {
                margin: 0 0 5px 0;
                color: #065F46;
                font-size: 18px;
                font-weight: 700;
            }
            .company-info p {
                margin: 0;
                color: #047857;
                font-size: 14px;
            }
            .job-title {
                font-size: 24px;
                font-weight: bold;
                color: #1F2937;
                margin-bottom: 25px;
                text-align: center;
                background: linear-gradient(135deg, #F3F4F6, #E5E7EB);
                padding: 20px;
                border-radius: 12px;
                border-left: 5px solid #10B981;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            .job-description {
                background: #F9FAFB;
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                border-left: 4px solid #D1D5DB;
                font-style: italic;
                color: #6B7280;
            }
            .job-details {
                background: linear-gradient(135deg, #F9FAFB, #F3F4F6);
                padding: 25px;
                border-radius: 12px;
                margin: 25px 0;
                border: 1px solid #E5E7EB;
            }
            .detail-row {
                display: flex;
                margin-bottom: 15px;
                align-items: center;
                padding: 8px 0;
            }
            .detail-label {
                font-weight: 700;
                color: #374151;
                min-width: 140px;
                margin-right: 20px;
                font-size: 15px;
            }
            .detail-value {
                color: #1F2937;
                flex: 1;
                font-weight: 500;
                font-size: 15px;
            }
            .skills-section {
                background: linear-gradient(135deg, #EFF6FF, #DBEAFE);
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
                border: 1px solid #BFDBFE;
            }
            .skills-title {
                font-weight: 700;
                color: #1E40AF;
                margin-bottom: 10px;
                font-size: 16px;
            }
            .skills-list {
                color: #1E3A8A;
                font-weight: 500;
            }
            .cta-section {
                text-align: center;
                margin: 30px 0;
                padding: 25px;
                background: linear-gradient(135deg, #F0FDF4, #DCFCE7);
                border-radius: 12px;
                border: 1px solid #BBF7D0;
            }
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #10B981, #059669);
                color: white;
                padding: 16px 32px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 700;
                font-size: 16px;
                margin: 10px 0;
                text-align: center;
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                transition: all 0.3s ease;
            }
            .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
            }
            .footer {
                margin-top: 35px;
                padding-top: 25px;
                border-top: 2px solid #E5E7EB;
                font-size: 14px;
                color: #6B7280;
                text-align: center;
                background: #F9FAFB;
                padding: 20px;
                border-radius: 10px;
            }
            .footer p {
                margin: 5px 0;
            }
            .highlight {
                background: linear-gradient(135deg, #FEF3C7, #FDE68A);
                padding: 15px;
                border-radius: 8px;
                border-left: 4px solid #F59E0B;
                margin: 20px 0;
            }
            .highlight p {
                margin: 0;
                color: #92400E;
                font-weight: 600;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">FindX</div>
                <div class="match-badge">🎯 Perfect Match Alert</div>
            </div>
            
            ${companyLogo ? `
            <div class="company-section">
                <img src="${companyLogo}" alt="${companyName}" class="company-logo" onerror="this.style.display='none'">
                <div class="company-info">
                    <h3>${companyName}</h3>
                    ${companyIndustry ? `<p>${companyIndustry}</p>` : ''}
                    ${companyWebsite ? `<p>${companyWebsite}</p>` : ''}
                </div>
            </div>
            ` : `
            <div class="company-section">
                <div class="company-info">
                    <h3>${companyName}</h3>
                    ${companyIndustry ? `<p>${companyIndustry}</p>` : ''}
                </div>
            </div>
            `}
            
            <div class="job-title">"${exactJobTitle}"</div>
            
            <div class="highlight">
                <p>🎯 This job perfectly matches your profile and preferences!</p>
            </div>
            
            ${truncatedDescription !== 'No description available' ? `
            <div class="job-description">
                <strong>Job Description:</strong><br>
                ${truncatedDescription}
            </div>
            ` : ''}
            
            <div class="job-details">
                <div class="detail-row">
                    <span class="detail-label">🏢 Company:</span>
                    <span class="detail-value">${companyName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">📍 Location:</span>
                    <span class="detail-value">${jobLocation}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">💼 Work Type:</span>
                    <span class="detail-value">${workType}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">🏠 Environment:</span>
                    <span class="detail-value">${workspaceOption}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">💰 Salary:</span>
                    <span class="detail-value">${salaryRange}</span>
                </div>
            </div>
            
            <div class="skills-section">
                <div class="skills-title">🔧 Required Skills:</div>
                <div class="skills-list">${jobSkills}</div>
            </div>
            
            <div class="cta-section">
                <h3 style="margin: 0 0 15px 0; color: #065F46;">Ready to Apply?</h3>
                <a href="${process.env.CLIENT_URL || 'https://findx.com'}/job-details/${jobData._id}" class="cta-button">
                    🚀 View Job Details & Apply Now
                </a>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #047857;">
                    Don't miss this opportunity - apply today!
                </p>
            </div>
            
            <div class="footer">
                <p><strong>Why you received this email:</strong> This job matches your profile and preferences.</p>
                <p>© 2024 FindX. All rights reserved.</p>
                <p>FindX - Your Gateway to Career Success</p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Create enhanced plain text version
    const textContent = `
FindX 💼 - New Job Alert

🎯 PERFECT MATCH ALERT!

Job Title: "${exactJobTitle}"
Company: ${companyName}
${companyIndustry ? `Industry: ${companyIndustry}` : ''}
${companyWebsite ? `Website: ${companyWebsite}` : ''}

📋 JOB DETAILS:
Location: ${jobLocation}
Work Type: ${workType}
Work Environment: ${workspaceOption}
Salary: ${salaryRange}

🔧 REQUIRED SKILLS:
${jobSkills}

${truncatedDescription !== 'No description available' ? `
📝 JOB DESCRIPTION:
${truncatedDescription}
` : ''}

🚀 READY TO APPLY?
// TODO: Add a link to the application job apply page
View Job Details & Apply: ${process.env.CLIENT_URL || 'https://findx.com'}/job-details/${jobData._id}

Don't miss this opportunity - apply today!

---
Why you received this email: This job matches your profile and preferences.
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