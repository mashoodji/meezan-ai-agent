const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendMeetingConfirmation(meetingData) {
    try {
      // Email to Client
      const clientEmail = {
        from: process.env.EMAIL_FROM,
        to: meetingData.email,
        subject: 'Meeting Confirmed - Meezan Developers',
        html: this.getClientEmailTemplate(meetingData)
      };

      // Email to Company
      const companyEmail = {
        from: process.env.EMAIL_FROM,
        to: process.env.EMAIL_FROM, // Sends to company email
        subject: `New Meeting Scheduled - ${meetingData.name}`,
        html: this.getCompanyEmailTemplate(meetingData)
      };

      // Send both emails
      await this.transporter.sendMail(clientEmail);
      await this.transporter.sendMail(companyEmail);
      
      console.log('✅ Emails sent successfully');
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
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
          </div>

          <h3>📍 Our Office:</h3>
          <p>97-B Main Boulevard Jubilee Town Housing Scheme Canal Road Lahore</p>

          <h3>📞 Contact Information:</h3>
          <p><strong>Phone:</strong> +92-321-883-6371</p>
          <p><strong>WhatsApp:</strong> +92-311-178-6646</p>
          <p><strong>Email:</strong> mashoodji7@gmail.com</p>

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
            <p><strong>Phone:</strong> ${meeting.phone || 'Not provided'}</p>
            <p><strong>Date:</strong> ${meeting.date}</p>
            <p><strong>Time:</strong> ${meeting.time}</p>
            <p><strong>Project Type:</strong> ${meeting.projectType || 'Not specified'}</p>
            <p><strong>Additional Info:</strong> ${meeting.additionalInfo || 'None provided'}</p>
          </div>
          
          <p><strong>Meeting ID:</strong> ${meeting.id}</p>
          <p><strong>Scheduled Via:</strong> Meezan Developers</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString('en-PK')}</p>
          
          <p style="color: #666; font-style: italic;">This meeting was automatically scheduled through the Agent.</p>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();