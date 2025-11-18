const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      console.log('🚀 Initializing Email Service on:', process.env.NODE_ENV);
      console.log('📧 Email User:', process.env.EMAIL_USER ? 'Set' : 'Missing');
      console.log('📧 Email Pass:', process.env.EMAIL_PASS ? 'Set' : 'Missing');
      
      // Check if required environment variables exist
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ CRITICAL: Email environment variables missing!');
        console.error('   EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
        console.error('   EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');
        return;
      }

      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        secure: true,
        tls: {
          rejectUnauthorized: false
        },
        // Render-specific settings
        pool: true,
        maxConnections: 1,
        maxMessages: 5
      });

      console.log('✅ Email transporter created');
      this.initialized = true;
      
    } catch (error) {
      console.error('❌ Email transporter initialization failed:', error.message);
      this.initialized = false;
    }
  }

  async verifyTransporter() {
    if (!this.initialized || !this.transporter) {
      console.error('❌ Transporter not initialized properly');
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('✅ Email transporter verified - ready to send emails');
      return true;
    } catch (error) {
      console.error('❌ Email transporter verification failed:');
      console.error('   Error:', error.message);
      console.error('   Code:', error.code);
      
      if (error.code === 'EAUTH') {
        console.error('   🔐 AUTHENTICATION FAILED');
        console.error('   💡 Make sure:');
        console.error('      • You are using Gmail App Password (not regular password)');
        console.error('      • 2FA is enabled in your Gmail account');
        console.error('      • App Password is generated for "Mail"');
      }
      
      return false;
    }
  }

  async sendMeetingConfirmation(meetingData) {
    console.log('📧 Starting email send process on Render...');
    
    if (!this.initialized) {
      console.error('❌ Email service not initialized - check environment variables');
      return false;
    }

    // Verify transporter before sending
    const isVerified = await this.verifyTransporter();
    if (!isVerified) {
      console.error('❌ Cannot send emails - transporter not verified');
      return false;
    }

    try {
      console.log('🎯 Sending emails to:', {
        client: meetingData.email,
        company: process.env.EMAIL_FROM
      });

      // Email to Client
      const clientEmail = {
        from: `"Meezan Developers" <${process.env.EMAIL_FROM}>`,
        to: meetingData.email,
        subject: 'Meeting Confirmed - Meezan Developers',
        html: this.getClientEmailTemplate(meetingData),
        text: this.getTextEmailTemplate(meetingData)
      };

      // Email to Company
      const companyEmail = {
        from: `"Meezan Developers AI Agent" <${process.env.EMAIL_FROM}>`,
        to: process.env.EMAIL_FROM,
        subject: `New Meeting Scheduled - ${meetingData.name}`,
        html: this.getCompanyEmailTemplate(meetingData),
        text: `New meeting: ${meetingData.name} - ${meetingData.projectType} on ${meetingData.date} at ${meetingData.time}`
      };

      console.log('📤 Sending client email...');
      const clientResult = await this.transporter.sendMail(clientEmail);
      console.log('✅ Client email sent - Message ID:', clientResult.messageId);

      console.log('📤 Sending company email...');
      const companyResult = await this.transporter.sendMail(companyEmail);
      console.log('✅ Company email sent - Message ID:', companyResult.messageId);
      
      console.log('🎉 ALL EMAILS SENT SUCCESSFULLY FROM RENDER!');
      return true;

    } catch (error) {
      console.error('💥 EMAIL SENDING FAILED ON RENDER:');
      console.error('   Error:', error.message);
      console.error('   Code:', error.code);
      console.error('   Stack:', error.stack);
      
      if (error.response) {
        console.error('   Response:', error.response);
      }
      
      // Specific error handling for common issues
      if (error.code === 'EAUTH') {
        console.error('   🔐 AUTHENTICATION ERROR');
        console.error('   💡 Solution:');
        console.error('      1. Go to Google Account > Security');
        console.error('      2. Enable 2-Factor Authentication');
        console.error('      3. Generate App Password for "Mail"');
        console.error('      4. Use that App Password in Render environment variables');
      } else if (error.code === 'ECONNECTION') {
        console.error('   🌐 CONNECTION ERROR - Gmail might be blocking Render IP');
      }
      
      return false;
    }
  }

  getClientEmailTemplate(meeting) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a365d; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 20px; background: #f8fafc; border-radius: 0 0 10px 10px; }
          .meeting-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #1a365d; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Meeting Confirmed!</h1>
          <p>Meezan Developers - Construction Experts</p>
        </div>
        
        <div class="content">
          <p>Dear <strong>${meeting.name}</strong>,</p>
          <p>Your meeting with Meezan Developers has been scheduled successfully. We look forward to discussing your construction project!</p>
          
          <div class="meeting-details">
            <h3>📅 Meeting Details:</h3>
            <p><strong>Date:</strong> ${meeting.date}</p>
            <p><strong>Time:</strong> ${meeting.time}</p>
            <p><strong>Duration:</strong> 60 minutes</p>
            <p><strong>Type:</strong> Construction Consultation</p>
            <p><strong>Project:</strong> ${meeting.projectType || 'General Discussion'}</p>
            <p><strong>Meeting ID:</strong> ${meeting.id}</p>
          </div>

          <h3>📍 Our Office:</h3>
          <p>97-B Main Boulevard Jubilee Town Housing Scheme Canal Road Lahore</p>

          <h3>📞 Contact Information:</h3>
          <p><strong>Phone:</strong> +92-321-883-6371</p>
          <p><strong>WhatsApp:</strong> +92-311-178-6646</p>
          <p><strong>Email:</strong> meezandevelopers.official@gmail.com</p>

          <p><em>We recommend arriving 5 minutes early. Please bring any project plans or documents you'd like to discuss.</em></p>
        </div>
        
        <div class="footer">
          <p><strong>Meezan Developers</strong><br>Building Excellence Since 2009</p>
          <p>97-B Main Boulevard Jubilee Town Housing Scheme Canal Road Lahore</p>
        </div>
      </body>
      </html>
    `;
  }

  getCompanyEmailTemplate(meeting) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { padding: 20px; background: #fef2f2; border-radius: 0 0 10px 10px; }
          .meeting-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #dc2626; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔔 New Meeting Scheduled</h1>
          <p>Meezan Developers Booking System</p>
        </div>
        
        <div class="content">
          <h3>👤 Client Details:</h3>
          <div class="meeting-details">
            <p><strong>Name:</strong> ${meeting.name}</p>
            <p><strong>Email:</strong> ${meeting.email}</p>
            <p><strong>Date:</strong> ${meeting.date}</p>
            <p><strong>Time:</strong> ${meeting.time}</p>
            <p><strong>Project Type:</strong> ${meeting.projectType || 'Not specified'}</p>
            <p><strong>Meeting ID:</strong> ${meeting.id}</p>
          </div>
          
          <p><strong>Scheduled Via:</strong> AI Agent System</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString('en-PK')}</p>
          
          <p style="color: #666; font-style: italic;">This meeting was automatically scheduled through the AI Agent.</p>
        </div>
      </body>
      </html>
    `;
  }

  getTextEmailTemplate(meeting) {
    return `
Meeting Confirmed - Meezan Developers

Dear ${meeting.name},

Your meeting with Meezan Developers has been scheduled successfully.

MEETING DETAILS:
Date: ${meeting.date}
Time: ${meeting.time}
Duration: 60 minutes
Type: Construction Consultation
Project: ${meeting.projectType || 'General Discussion'}
Meeting ID: ${meeting.id}

OUR OFFICE:
97-B Main Boulevard Jubilee Town Housing Scheme Canal Road Lahore

CONTACT INFORMATION:
Phone: +92-321-883-6371
WhatsApp: +92-311-178-6646
Email: meezandevelopers.official@gmail.com

We recommend arriving 5 minutes early. Please bring any project plans or documents.

Meezan Developers
Building Excellence Since 2009
    `;
  }
}

module.exports = new EmailService();