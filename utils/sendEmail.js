import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  }
});

const sendEmail = async (options) => {
  const message = {
    from: `${process.env.FROM_EMAIL}`,
    to: options.email,
    subject: options.subject,
    text: options.message, 
    html: options.html 
  };

  await transporter.sendMail(message);
};

export default sendEmail;