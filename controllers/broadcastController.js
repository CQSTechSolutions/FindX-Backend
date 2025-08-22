import dotenv from "dotenv";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import Employer from "../models/employer.model.js";

dotenv.config();

// Create nodemailer transporter
export const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
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
    const usersWithEmails = await User.countDocuments({
      email: { $exists: true, $ne: null },
    });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        usersWithEmails,
        emailDeliveryRate:
          usersWithEmails > 0
            ? ((usersWithEmails / totalUsers) * 100).toFixed(1)
            : 0,
      },
    });
  } catch (error) {
    console.error("Broadcast stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get broadcast statistics",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
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
      message: "Email configuration is valid",
    });
  } catch (error) {
    console.error("Email config test error:", error);
    res.status(500).json({
      success: false,
      message: "Email configuration is invalid",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Email configuration error",
    });
  }
};

// Send job alert emails to matched users using BCC (efficient approach)
export const sendJobAlertEmails = async (
  jobData,
  userEmails,
  maxEmails = null
) => {
  try {
    // Security validations
    if (!jobData || !userEmails || !Array.isArray(userEmails)) {
      console.error("❌ Invalid parameters provided to sendJobAlertEmails");
      return {
        success: false,
        error: "Invalid parameters provided",
        sentCount: 0,
        totalCount: 0
      };
    }

    // Rate limiting check - prevent sending too many emails at once
    const MAX_EMAILS_PER_REQUEST = 1000; // Maximum emails per request
    if (userEmails.length > MAX_EMAILS_PER_REQUEST) {
      console.error(`❌ Too many emails requested: ${userEmails.length} (max: ${MAX_EMAILS_PER_REQUEST})`);
      return {
        success: false,
        error: `Too many emails requested. Maximum allowed: ${MAX_EMAILS_PER_REQUEST}`,
        sentCount: 0,
        totalCount: userEmails.length
      };
    }

    console.log(
      "📧 Sending job alert emails to",
      userEmails.length,
      "matched users"
    );

    if (userEmails.length === 0) {
      console.log("⚠️ No matched users to send emails to");
      return { success: true, sentCount: 0, totalCount: 0 };
    }

    // Extract emails for BCC
    // const matchedUsers = userEmails.map((user) => user.email);

    console.log("🔍 User emails:", userEmails);
    console.log("🔍 Job data:", jobData);

    // Fetch employer data to get company information
    let employerData = null;
    let companyName = "Our Company";
    let companyLogo = "";
    let companyWebsite = "";
    let companyIndustry = "";

    if (jobData.postedBy) {
      try {
        employerData = await Employer.findById(jobData.postedBy).select(
          "companyName companyLogo companyWebsite companyIndustry"
        );
        if (employerData) {
          companyName = employerData.companyName || "Our Company";
          companyLogo = employerData.companyLogo || "";
          companyWebsite = employerData.companyWebsite || "";
          companyIndustry = employerData.companyIndustry || "";
        }
      } catch (error) {
        console.error("❌ Error fetching employer data:", error);
      }
    }

    // Validate required job data
    if (!jobData.jobTitle || !jobData._id) {
      console.error("❌ Missing required job data (jobTitle or _id)");
      return {
        success: false,
        error: "Missing required job information",
        sentCount: 0,
        totalCount: validUserEmails.length
      };
    }

    // Prepare job alert email content with exact job title
    const exactJobTitle = jobData.jobTitle || "Job Position";
    const jobLocation = jobData.jobLocation || "Location not specified";
    const workType = jobData.workType || "Work type not specified";
    const workspaceOption =
      jobData.workspaceOption || "Work environment not specified";

    // Enhanced salary formatting
    let salaryRange = "Competitive salary";
    if (jobData.from && jobData.to) {
      const currency = jobData.currency || "AUD";
      const salaryType = jobData.jobSalaryType || "Per Year";
      salaryRange = `${currency} ${jobData.from.toLocaleString()} - ${jobData.to.toLocaleString()} ${salaryType}`;
    } else if (jobData.from) {
      const currency = jobData.currency || "AUD";
      const salaryType = jobData.jobSalaryType || "Per Year";
      salaryRange = `From ${currency} ${jobData.from.toLocaleString()} ${salaryType}`;
    }

    // Get job skills for email content
    const jobSkills =
      jobData.jobSkills && jobData.jobSkills.length > 0
        ? jobData.jobSkills.join(", ")
        : "Skills not specified";

    // Get job description (truncated if too long)
    const jobDescription =
      jobData.jobDescription ||
      jobData.jobSummary ||
      "No description available";
    const truncatedDescription =
      jobDescription.length > 200
        ? jobDescription.substring(0, 200) + "..."
        : jobDescription;

    // Create job alert email content with exact title
    const title = `💼 New Job Alert: "${exactJobTitle}" at ${companyName}`;

    // Use the provided matched users directly (they already have email addresses)
    let validUserEmails = userEmails.filter(
      (email) => email && email.trim() !== ""
    );

    // Email validation function
    const isValidEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email) && email.length <= 254; // RFC 5321 limit
    };

    // Filter out invalid email addresses
    const originalCount = validUserEmails.length;
    validUserEmails = validUserEmails.filter(email => isValidEmail(email));
    const invalidEmails = originalCount - validUserEmails.length;
    
    if (invalidEmails > 0) {
      console.log(`⚠️ Filtered out ${invalidEmails} invalid email addresses`);
    }

    // Limit emails if maxEmails parameter is provided
    if (maxEmails && maxEmails > 0 && validUserEmails.length > maxEmails) {
      console.log(
        `📧 Limiting emails to ${maxEmails} out of ${validUserEmails.length} matched users`
      );
      validUserEmails = validUserEmails.slice(0, maxEmails);
    }

    if (validUserEmails.length === 0) {
      console.log("⚠️ No valid email addresses found in matched users");
      return { success: true, sentCount: 0 };
    }

    // Create transporter
    const transporter = createTransporter();

    // Validate SMTP configuration
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error("❌ SMTP configuration missing");
      return {
        success: false,
        error: "Email service not configured",
        sentCount: 0,
        totalCount: validUserEmails.length
      };
    }

    // Test SMTP connection before sending
    try {
      await transporter.verify();
      console.log("✅ SMTP connection verified successfully");
    } catch (verifyError) {
      console.error("❌ SMTP connection failed:", verifyError);
      return {
        success: false,
        error: "Email service connection failed",
        sentCount: 0,
        totalCount: validUserEmails.length
      };
    }
      
    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 25px;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
        }
        .alert-badge {
            background: #28a745;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
        }
        .job-title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-left: 4px solid #007bff;
            border-radius: 4px;
        }
        .section {
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
        }
        .section-title {
            font-weight: bold;
            color: #007bff;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .detail-row {
            margin: 8px 0;
        }
        .detail-label {
            font-weight: bold;
            color: #555;
        }
        .cta-button {
            display: inline-block;
            background: #007bff;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
            margin: 15px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">FindX</div>
            <div class="alert-badge">🎯 Perfect Match Alert</div>
        </div>
        
        <div class="job-title">"${exactJobTitle}"</div>
        
        <div class="section">
            <div class="section-title">🏢 Company Information</div>
            <div class="detail-row">
                <span class="detail-label">Company:</span> ${companyName}
            </div>
            ${
              companyIndustry
                ? `<div class="detail-row"><span class="detail-label">Industry:</span> ${companyIndustry}</div>`
                : ""
            }
            ${
              companyWebsite
                ? `<div class="detail-row"><span class="detail-label">Website:</span> ${companyWebsite}</div>`
                : ""
            }
        </div>
        
        <div class="section">
            <div class="section-title">📋 Job Details</div>
            <div class="detail-row">
                <span class="detail-label">Location:</span> ${jobLocation}
            </div>
            <div class="detail-row">
                <span class="detail-label">Work Type:</span> ${workType}
            </div>
            <div class="detail-row">
                <span class="detail-label">Environment:</span> ${workspaceOption}
            </div>
            <div class="detail-row">
                <span class="detail-label">Salary:</span> ${salaryRange}
            </div>
        </div>
            
        ${
          jobSkills && `
        <div class="section">
            <div class="section-title">🔧 Required Skills</div>
            <div>${jobSkills}</div>
        </div>
        `
        }

        ${
          truncatedDescription !== "No description available"
            ? `
        <div class="section">
            <div class="section-title">📝 Job Description</div>
            <div>${truncatedDescription}</div>
        </div>
        `
            : ""
        }
        
        <div class="footer">
            <p><strong>Why you received this email:</strong> This job matches your profile and preferences.</p>
            <p>© 2025 FindX. All rights reserved.</p>
            <p>FindX - Your Gateway to Career Success</p>
        </div>
    </div>
</body>
</html>
    `;

    // Email options using BCC (efficient approach)
    const BCC_LIMIT = 500; // BCC limit per email
    const totalEmails = validUserEmails.length;
    const batches = Math.ceil(totalEmails / BCC_LIMIT);

    console.log(
      `📧 Sending emails in ${batches} batch(es) of max ${BCC_LIMIT} recipients each`
    );
    console.log(
      `📊 Total recipients: ${totalEmails}, Batches needed: ${batches}`
    );

    let totalSentCount = 0;
    let failedEmails = [];
    let batchErrors = [];

    // Send emails in batches
    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const startIndex = batchIndex * BCC_LIMIT;
      const endIndex = Math.min(startIndex + BCC_LIMIT, totalEmails);
      const batchEmails = validUserEmails.slice(startIndex, endIndex);

      console.log(
        `📧 Sending batch ${batchIndex + 1}/${batches} with ${
          batchEmails.length
        } recipients`
      );

      try {
        const mailOptions = {
          from: {
            name: "FindX Job Alerts",
            address: process.env.SMTP_USER,
          },
          to: process.env.SMTP_USER, // Send to yourself as the main recipient
          bcc: batchEmails, // Batch of users in BCC
          subject: title,
          html: htmlTemplate,
          // Add headers to prevent replies going to all users
          headers: {
            "Reply-To": process.env.SMTP_USER,
            "List-Unsubscribe": `<mailto:unsubscribe@findx.com>`,
          },
        };

        // Send email using BCC for this batch
        await transporter.sendMail(mailOptions);

        totalSentCount += batchEmails.length;
        console.log(
          `✅ Batch ${batchIndex + 1}/${batches} sent successfully to ${
            batchEmails.length
          } recipients`
        );

        // Add a small delay between batches to avoid rate limiting
        if (batchIndex < batches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
        }
      } catch (batchError) {
        console.error(
          `❌ Error sending batch ${batchIndex + 1}/${batches}:`,
          batchError
        );
        batchErrors.push({
          batchIndex: batchIndex + 1,
          error: batchError.message,
          recipients: batchEmails.length,
        });
        failedEmails.push(...batchEmails);
      }
    }

    console.log(`📧 Email sending complete:`);
    console.log(`✅ Successfully sent: ${totalSentCount}/${totalEmails} emails`);
    console.log(`❌ Failed batches: ${batchErrors.length}`);
    console.log(`📊 Subject: ${title}`);
    console.log(`📅 Sent at: ${new Date().toISOString()}`);

    if (batchErrors.length > 0) {
      console.log(`⚠️ Batch errors:`, batchErrors);
    }

    return {
      success: totalSentCount > 0,
      sentCount: totalSentCount,
      totalCount: totalEmails,
      failedEmails: failedEmails,
      batchErrors: batchErrors,
      batchesSent: batches - batchErrors.length,
      totalBatches: batches
    };
  } catch (error) {
    console.error("❌ Error sending job alert emails:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
