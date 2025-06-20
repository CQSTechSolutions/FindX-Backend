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

// Send broadcast email to all users
export const sendBroadcastEmail = async (req, res) => {
  try {
    console.log('🚀 Broadcast email request received:', { 
      title: req.body.title, 
      type: req.body.type,
      bodyLength: req.body.body?.length 
    });
    
    const { title, body, type } = req.body;

    // Validate required fields
    if (!title || !body) {
      console.log('❌ Validation failed: Missing title or body');
      return res.status(400).json({
        success: false,
        message: 'Title and body are required'
      });
    }

    // Get all users with their emails
    const users = await User.find({}, 'email name').lean();
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No users found'
      });
    }

    // Extract emails for BCC
    const userEmails = users.map(user => user.email);

    // Create transporter
    const transporter = createTransporter();

    // Get message type emoji and styling
    const getTypeInfo = (messageType) => {
      const types = {
        general: { emoji: '📢', color: '#3B82F6', label: 'General Announcement' },
        job_alert: { emoji: '💼', color: '#10B981', label: 'New Job Alert' },
        urgent: { emoji: '🚨', color: '#EF4444', label: 'Urgent Update' },
        maintenance: { emoji: '🔧', color: '#F59E0B', label: 'Maintenance Notice' },
        promotion: { emoji: '🎉', color: '##8B5CF6', label: 'Promotion/Event' }
      };
      return types[messageType] || types.general;
    };

    const typeInfo = getTypeInfo(type);

    // Create HTML email template
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
                color: #1f2937;
                margin-bottom: 10px;
            }
            .type-badge {
                display: inline-block;
                padding: 6px 12px;
                border-radius: 20px;
                background-color: ${typeInfo.color};
                color: white;
                font-size: 12px;
                font-weight: 600;
                margin-bottom: 20px;
            }
            .title {
                font-size: 28px;
                font-weight: bold;
                color: #1f2937;
                margin-bottom: 20px;
                text-align: center;
            }
            .content {
                font-size: 16px;
                line-height: 1.8;
                color: #4b5563;
                margin-bottom: 30px;
            }
            .footer {
                border-top: 1px solid #e5e7eb;
                padding-top: 20px;
                text-align: center;
                color: #6b7280;
                font-size: 14px;
            }
            .app-link {
                display: inline-block;
                margin-top: 20px;
                padding: 12px 24px;
                background-color: #3B82F6;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
            }
            .app-link:hover {
                background-color: #2563EB;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">FindX ${typeInfo.emoji}</div>
                <div class="type-badge">${typeInfo.label}</div>
            </div>
            
            <h1 class="title">${title}</h1>
            
            <div class="content">
                ${body.replace(/\n/g, '<br>')}
            </div>
            
            <div style="text-align: center;">
                <a href="#" class="app-link">Open FindX App</a>
            </div>
            
            <div class="footer">
                <p>This message was sent to all FindX users.</p>
                <p>© ${new Date().getFullYear()} FindX. All rights reserved.</p>
                <p style="font-size: 12px; margin-top: 15px; color: #9ca3af;">
                    FindX - Your Gateway to Career Success
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Create plain text version
    const textContent = `
FindX ${typeInfo.emoji} - ${typeInfo.label}

${title}

${body}

---
This message was sent to all FindX users.
© ${new Date().getFullYear()} FindX. All rights reserved.
FindX - Your Gateway to Career Success
    `;

    // Email options
    const mailOptions = {
      from: {
        name: 'FindX Team',
        address: process.env.SMTP_USER
      },
      to: process.env.SMTP_USER, // Send to yourself as the main recipient
      bcc: userEmails, // All users in BCC to protect privacy
      subject: `${typeInfo.emoji} ${title}`,
      text: textContent,
      html: htmlTemplate,
      // Add headers to prevent replies going to all users  
      headers: {
        'Reply-To': process.env.SMTP_USER,
        'List-Unsubscribe': `<mailto:unsubscribe@findx.com>`,
      }
    };

    // Send email
    await transporter.sendMail(mailOptions);

    // Log the broadcast (you might want to store this in a database)
    console.log(`Broadcast email sent to ${userEmails.length} users`);
    console.log(`Subject: ${title}`);
    console.log(`Type: ${type}`);
    console.log(`Sent at: ${new Date().toISOString()}`);

    res.status(200).json({
      success: true,
      message: 'Broadcast email sent successfully',
      sentCount: userEmails.length,
      recipients: userEmails.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Broadcast email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send broadcast email',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
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