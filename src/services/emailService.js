const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      console.log('🚀 Initializing Email Service...');
      console.log('📧 Email:', process.env.EMAIL_USER);
      console.log('🔑 Password set:', !!process.env.EMAIL_PASS);
      
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ Email credentials missing!');
        return;
      }

      // WORKING Gmail configuration
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        // Important settings for Gmail
        requireTLS: true,
        tls: {
          rejectUnauthorized: false
        },
        // Connection settings
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        // Debugging
        debug: true,
        logger: true
      });

      console.log('✅ Email transporter created successfully');
      this.initialized = true;
      
    } catch (error) {
      console.error('❌ Email transporter initialization failed:', error.message);
      this.initialized = false;
    }
  }

  async verifyTransporter() {
    if (!this.initialized || !this.transporter) {
      console.error('❌ Transporter not initialized');
      return false;
    }

    try {
      console.log('🔍 Verifying email transporter...');
      await this.transporter.verify();
      console.log('✅ Email transporter verified successfully');
      return true;
    } catch (error) {
      console.error('❌ Email transporter verification failed:');
      console.error('   Error:', error.message);
      console.error('   Code:', error.code);
      
      if (error.code === 'EAUTH') {
        console.error('🔐 AUTHENTICATION FAILED - Check:');
        console.error('   • Gmail App Password (not regular password)');
        console.error('   • 2FA enabled in Gmail');
        console.error('   • Correct 16-character App Password');
      } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
        console.error('🌐 CONNECTION FAILED - Try:');
        console.error('   • Different network');
        console.error('   • Check firewall settings');
        console.error('   • Wait and retry');
      }
      
      return false;
    }
  }

  async sendMeetingConfirmation(meetingData) {
    console.log('\n📧 STARTING EMAIL PROCESS =================');
    
    if (!this.initialized) {
      console.error('❌ Email service not initialized properly');
      return false;
    }

    // Always verify before sending
    const isVerified = await this.verifyTransporter();
    if (!isVerified) {
      console.error('❌ Cannot send emails - transporter not verified');
      return false;
    }

    try {
      console.log('🎯 Preparing to send emails...');
      console.log('   To Client:', meetingData.email);
      console.log('   To Company:', process.env.EMAIL_FROM);

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
        text: `New meeting scheduled with ${meetingData.name} for ${meetingData.projectType}`
      };

      console.log('📤 Sending client email...');
      const clientResult = await this.transporter.sendMail(clientEmail);
      console.log('✅ Client email sent!');
      console.log('   Message ID:', clientResult.messageId);
      console.log('   Response:', clientResult.response);

      console.log('📤 Sending company email...');
      const companyResult = await this.transporter.sendMail(companyEmail);
      console.log('✅ Company email sent!');
      console.log('   Message ID:', companyResult.messageId);

      console.log('🎉 ALL EMAILS SENT SUCCESSFULLY!');
      return true;

    } catch (error) {
      console.error('💥 EMAIL SENDING FAILED:');
      console.error('   Error:', error.message);
      console.error('   Code:', error.code);
      console.error('   Full Error:', error);
      
      if (error.response) {
        console.error('   Response:', error.response);
      }
      
      return false;
    }
  }

  getClientEmailTemplate(meeting) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header { 
            background: #1a365d; 
            color: white; 
            padding: 30px 20px; 
            text-align: center; 
          }
          .content { 
            padding: 30px; 
          }
          .meeting-details { 
            background: #f8fafc; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #1a365d; 
          }
          .footer { 
            text-align: center; 
            padding: 20px; 
            color: #666; 
            font-size: 14px;
            background: #f8f9fa;
          }
          h1 { margin: 0; font-size: 28px; }
          h3 { color: #1a365d; margin-top: 0; }
          .highlight { color: #1a365d; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Meeting Confirmed!</h1>
            <p>Meezan Developers - Construction Experts</p>
          </div>
          
          <div class="content">
            <p>Dear <span class="highlight">${meeting.name}</span>,</p>
            <p>Your meeting with Meezan Developers has been scheduled successfully. We look forward to discussing your construction project!</p>
            
            <div class="meeting-details">
              <h3>📅 Meeting Details</h3>
              <p><strong>Date:</strong> ${meeting.date}</p>
              <p><strong>Time:</strong> ${meeting.time}</p>
              <p><strong>Duration:</strong> 60 minutes</p>
              <p><strong>Project Type:</strong> ${meeting.projectType || 'General Discussion'}</p>
              <p><strong>Meeting ID:</strong> ${meeting.id}</p>
            </div>

            <h3>📍 Our Office</h3>
            <p>97-B Main Boulevard Jubilee Town Housing Scheme Canal Road Lahore</p>

            <h3>📞 Contact Information</h3>
            <p><strong>Phone:</strong> +92-321-883-6371</p>
            <p><strong>WhatsApp:</strong> +92-311-178-6646</p>
            <p><strong>Email:</strong> meezandevelopers.official@gmail.com</p>

            <p><em>We recommend arriving 5 minutes early. Please bring any project plans or documents you'd like to discuss.</em></p>
          </div>
          
          <div class="footer">
            <p><strong>Meezan Developers</strong><br>Building Excellence Since 2009</p>
            <p>97-B Main Boulevard Jubilee Town Housing Scheme Canal Road Lahore</p>
          </div>
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
        <meta charset="utf-8">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header { 
            background: #dc2626; 
            color: white; 
            padding: 25px 20px; 
            text-align: center; 
          }
          .content { 
            padding: 25px; 
          }
          .meeting-details { 
            background: #fef2f2; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #dc2626; 
          }
          h1 { margin: 0; font-size: 24px; }
          h3 { color: #dc2626; margin-top: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 New Meeting Scheduled</h1>
            <p>Meezan Developers AI Agent System</p>
          </div>
          
          <div class="content">
            <h3>👤 Client Details</h3>
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
        </div>
      </body>
      </html>
    `;
  }

  getTextEmailTemplate(meeting) {
    return `
MEETING CONFIRMED - MEEZAN DEVELOPERS

Dear ${meeting.name},

Your meeting with Meezan Developers has been scheduled successfully!

MEETING DETAILS:
• Date: ${meeting.date}
• Time: ${meeting.time} 
• Duration: 60 minutes
• Project: ${meeting.projectType || 'General Discussion'}
• Meeting ID: ${meeting.id}

OUR OFFICE:
97-B Main Boulevard Jubilee Town Housing Scheme Canal Road Lahore

CONTACT INFORMATION:
• Phone: +92-321-883-6371
• WhatsApp: +92-311-178-6646
• Email: meezandevelopers.official@gmail.com

We recommend arriving 5 minutes early. Please bring any project plans or documents.

Meezan Developers
Building Excellence Since 2009
    `;
  }
}

module.exports = new EmailService();