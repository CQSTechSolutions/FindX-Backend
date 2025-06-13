import nodemailer from "nodemailer";

async function sendBulkEmailWithBCC(recipients, subject, message) {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Define mail options
    const mailOptions = {
      from: `"FindX" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      bcc: recipients,
      subject: subject,
      html: message,
    };

    // Send mail
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

export { sendBulkEmailWithBCC };


// example call

/*
  import dotenv from 'dotenv';
import { sendBulkEmailWithBCC } from './mail.js';
dotenv.config();

async function main() {
  // Example usage
  const recipients = [
    'shivamgupta11122004@gmail.com',
    'shivamgupta11122004@gmail.com',
    'shivamgupta11122004@gmail.com',
    'somusanpui9@gmail.com',
  ];
  
  const subject = 'Test Bulk Email';
  const message = `
    <h1>Hello World</h1>
    <h2>Welcome to our newsletter!</h2>
    <p>This is a test email sent using Node.js and Nodemailer.</p>
    <p>Thank you for subscribing!</p>
    <br>
    <p>Best regards,<br>Your Company Team</p>
  `;

  console.log('Sending bulk email...');
  await sendBulkEmailWithBCC(recipients, subject, message);
  console.log('Bulk email process completed.');
}

// Run the main function if this file is executed directly

main().catch(console.error);
*/