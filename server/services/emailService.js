const nodemailer = require('nodemailer');

// Email configuration
const EMAIL_USER = process.env.EMAIL_USER || 'bhandarikamal9815@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS || 'mvli pmdj azul cwvb';

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

// Verify transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error('Email service error:', error);
  } else {
    console.log('Email service is ready to send messages');
  }
});

// Send OTP email
const sendOTPEmail = async (email, otpCode) => {
  try {
    const mailOptions = {
      from: `"Driplytics" <${EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset OTP - Driplytics',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4F46E5;">Password Reset Request</h2>
          <p>You have requested to reset your password for your Driplytics account.</p>
          <p>Your OTP (One-Time Password) is:</p>
          <div style="background-color: #F3F4F6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #4F46E5; font-size: 32px; letter-spacing: 5px; margin: 0;">${otpCode}</h1>
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you did not request this password reset, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
          <p style="color: #6B7280; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    throw error;
  }
};

// Send Price Alert email
const sendAlertEmail = async (email, alertData) => {
  try {
    const { username, sneakerName, targetPrice, predictedPrice, alertType, direction, phoneNumber } = alertData;
    const arrowIcon = alertType === 'below' ? '\ud83d\udcc9' : '\ud83d\udcc8';
    const actionColor = alertType === 'below' ? '#10B981' : '#F59E0B';
    const actionText = alertType === 'below' ? 'BUY OPPORTUNITY' : 'SELL SIGNAL';

    const phoneSection = phoneNumber ? `
            <div style="background: #0f172a; border-radius: 8px; padding: 12px; margin-bottom: 16px; text-align: center;">
              <p style="color: #9CA3AF; font-size: 11px; margin: 0 0 4px;">ALERT CONTACT</p>
              <p style="color: #818CF8; font-size: 14px; font-weight: bold; margin: 0;">📱 ${phoneNumber}</p>
            </div>
    ` : '';

    const mailOptions = {
      from: `"Driplytics Alerts" <${EMAIL_USER}>`,
      to: email,
      subject: `${arrowIcon} Price Alert: ${sneakerName} - Driplytics`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #fff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #818CF8; margin: 0;">Driplytics</h1>
            <p style="color: #9CA3AF; font-size: 14px;">Price Alert Notification</p>
          </div>
          
          <div style="background: #16213e; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #334155;">
            <p style="color: #9CA3AF; margin: 0 0 8px;">Hi ${username},</p>
            <h2 style="color: #fff; margin: 0 0 16px; font-size: 18px;">${arrowIcon} Your price alert has been triggered!</h2>
            
            <div style="background: #0f172a; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <p style="color: #9CA3AF; font-size: 12px; margin: 0 0 4px;">SNEAKER</p>
              <p style="color: #fff; font-size: 16px; font-weight: bold; margin: 0;">${sneakerName}</p>
            </div>
            
            <table style="width: 100%; margin-bottom: 16px;" cellpadding="0" cellspacing="8">
              <tr>
                <td style="background: #0f172a; border-radius: 8px; padding: 12px; text-align: center; width: 50%;">
                  <p style="color: #9CA3AF; font-size: 11px; margin: 0 0 4px;">TARGET PRICE</p>
                  <p style="color: #fff; font-size: 20px; font-weight: bold; margin: 0;">$${targetPrice}</p>
                </td>
                <td style="background: #0f172a; border-radius: 8px; padding: 12px; text-align: center; width: 50%;">
                  <p style="color: #9CA3AF; font-size: 11px; margin: 0 0 4px;">PREDICTED PRICE</p>
                  <p style="color: ${actionColor}; font-size: 20px; font-weight: bold; margin: 0;">$${predictedPrice.toFixed(2)}</p>
                </td>
              </tr>
            </table>
            
            <div style="background: ${actionColor}22; border: 1px solid ${actionColor}44; border-radius: 8px; padding: 12px; text-align: center;">
              <p style="color: ${actionColor}; font-weight: bold; font-size: 14px; margin: 0;">${actionText}</p>
              <p style="color: #9CA3AF; font-size: 12px; margin: 4px 0 0;">Price has ${direction} your target of $${targetPrice}</p>
            </div>

            ${phoneSection}
          </div>
          
          <p style="color: #6B7280; font-size: 11px; text-align: center;">This alert has been automatically disabled. Re-enable it from your dashboard.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Alert email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending alert email:', error);
    throw error;
  }
};

module.exports = {
  sendOTPEmail,
  sendAlertEmail
};

