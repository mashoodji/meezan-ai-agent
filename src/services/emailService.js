const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      console.log('📧 Initializing email transporter on:', process.env.NODE_ENV);
      console.log('📧 Email User exists:', !!process.env.EMAIL_USER);
      console.log('📧 Email Pass exists:', !!process.env.EMAIL_PASS);
      
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('❌ MISSING: Email credentials in environment variables');
        console.error('❌ EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
        console.error('❌ EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET (hidden)' : 'NOT SET');
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
        // Added connection timeout
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000
      });

      this.verifyTransporter();
    } catch (error) {
      console.error('❌ Email transporter initialization failed:', error.message);
    }
  }

  async verifyTransporter() {
    try {
      if (!this.transporter) {
        console.error('❌ Transporter not initialized - check credentials');
        return false;
      }
      
      await this.transporter.verify();
      console.log('✅ Email transporter verified successfully');
      return true;
    } catch (error) {
      console.error('❌ Email transporter verification failed:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error command:', error.command);
      
      if (error.code === 'EAUTH') {
        console.error('🔐 AUTHENTICATION FAILED - Possible issues:');
        console.error('   • Wrong Gmail password (use App Password, not regular password)');
        console.error('   • 2FA not enabled in Gmail');
        console.error('   • App Password not generated correctly');
      }
      
      return false;
    }
  }

  async sendMeetingConfirmation(meetingData) {
    try {
      console.log('🚀 Starting email send process...');
      
      if (!this.transporter) {
        console.error('❌ Email transporter not available');
        return false;
      }

      // Verify transporter is still working
      const isVerified = await this.verifyTransporter();
      if (!isVerified) {
        console.error('❌ Transporter not verified, cannot send emails');
        return false;
      }

      console.log('📧 Creating email messages...');
      
      // Email to Client
      const clientEmail = {
        from: `"Meezan Developers" <${process.env.EMAIL_FROM}>`,
        to: meetingData.email,
        subject: 'Meeting Confirmed - Meezan Developers',
        html: this.getClientEmailTemplate(meetingData),
        // Add text version as fallback
        text: this.getTextEmailTemplate(meetingData)
      };

      // Email to Company
      const companyEmail = {
        from: `"Meezan Developers AI Agent" <${process.env.EMAIL_FROM}>`,
        to: process.env.EMAIL_FROM,
        subject: `New Meeting Scheduled - ${meetingData.name}`,
        html: this.getCompanyEmailTemplate(meetingData),
        text: `New meeting scheduled with ${meetingData.name} for ${meetingData.projectType} on ${meetingData.date} at ${meetingData.time}`
      };

      console.log('📧 Sending client email...');
      const clientResult = await this.transporter.sendMail(clientEmail);
      console.log('✅ Client email sent successfully');
      console.log('   Message ID:', clientResult.messageId);
      console.log('   Response:', clientResult.response);

      console.log('📧 Sending company email...');
      const companyResult = await this.transporter.sendMail(companyEmail);
      console.log('✅ Company email sent successfully');
      console.log('   Message ID:', companyResult.messageId);
      
      console.log('🎉 All emails sent successfully!');
      return true;
      
    } catch (error) {
      console.error('💥 EMAIL SENDING FAILED:');
      console.error('   Error:', error.message);
      console.error('   Code:', error.code);
      console.error('   Command:', error.command);
      
      if (error.response) {
        console.error('   Response:', error.response);
      }
      
      // Specific error handling
      if (error.code === 'EAUTH') {
        console.error('   🔐 AUTHENTICATION ISSUE:');
        console.error('      • Check if you are using Gmail App Password');
        console.error('      • Enable 2FA in your Gmail account');
        console.error('      • Generate new App Password if needed');
      } else if (error.code === 'ECONNECTION') {
        console.error('   🌐 CONNECTION ISSUE:');
        console.error('      • Check internet connection');
        console.error('      • Gmail might be blocking Render IP');
      } else if (error.code === 'EENVELOPE') {
        console.error('   ✉️ ENVELOPE ISSUE:');
        console.error('      • Check email addresses format');
      }
      
      return false;
    }
  }

  getClientEmailTemplate(meeting) {
    return `... (keep your existing template) ...`;
  }

  getCompanyEmailTemplate(meeting) {
    return `... (keep your existing template) ...`;
  }

  getTextEmailTemplate(meeting) {
    return `... (keep your existing template) ...`;
  }
}

module.exports = new EmailService();