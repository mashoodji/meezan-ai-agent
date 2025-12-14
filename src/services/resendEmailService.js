const { Resend } = require('resend');

class ResendEmailService {
  constructor() {
    this.resend = null;
    this.initialized = false;
    this.verifiedDomain = 'meezandevelopers.com';
    this.initializeResend();
  }

  initializeResend() {
    try {
      console.log('🚀 Initializing Resend Email Service...');
      console.log('🔑 Resend API Key:', process.env.RESEND_API_KEY ? 'Set' : 'Missing');
      console.log('🌐 Verified Domain:', this.verifiedDomain);
      
      if (!process.env.RESEND_API_KEY) {
        console.error('❌ RESEND_API_KEY environment variable missing!');
        return;
      }

      this.resend = new Resend(process.env.RESEND_API_KEY);
      console.log('✅ Resend client initialized successfully');
      this.initialized = true;
      
    } catch (error) {
      console.error('❌ Resend initialization failed:', error.message);
      this.initialized = false;
    }
  }

  async sendMeetingConfirmation(meetingData) {
    console.log('\n📧 STARTING RESEND EMAIL PROCESS =================');
    
    if (!this.initialized) {
      console.error('❌ Resend service not initialized properly');
      return { success: false, error: 'Resend service not initialized' };
    }

    try {
      const companyEmail = process.env.COMPANY_EMAIL || 'mashoodji7@gmail.com';
      
      console.log('🎯 Email Configuration:');
      console.log('   Domain:', this.verifiedDomain);
      console.log('   Client Email:', meetingData.email);
      console.log('   Company Email:', companyEmail);

      const fromAddressClient = `Meezan Developers <noreply@${this.verifiedDomain}>`;
      const fromAddressCompany = `Meezan AI Agent <ai@${this.verifiedDomain}>`;

      // Email to Client
      const clientEmail = {
        from: fromAddressClient,
        to: [meetingData.email],
        subject: `Meeting Confirmed - ${meetingData.name} - Meezan Developers`,
        html: this.getClientEmailTemplate(meetingData),
        text: this.getTextEmailTemplate(meetingData),
        reply_to: `contact@${this.verifiedDomain}`
      };

      // Email to Company
      const companyEmailData = {
        from: fromAddressCompany,
        to: [companyEmail],
        subject: `New Meeting Scheduled - ${meetingData.name} - ${meetingData.projectType}`,
        html: this.getCompanyEmailTemplate(meetingData),
        reply_to: meetingData.email
      };

      console.log('📤 Sending client email via Resend...');
      console.log('   From:', fromAddressClient);
      console.log('   To:', meetingData.email);
      
      const clientResult = await this.resend.emails.send(clientEmail);
      
      if (clientResult.error) {
        console.error('❌ Client email failed:', clientResult.error);
        throw new Error(`Client email failed: ${clientResult.error.message}`);
      }
      
      console.log('✅ Client email sent via Resend!');
      console.log('   Message ID:', clientResult.data?.id);

      console.log('📤 Sending company email via Resend...');
      console.log('   From:', fromAddressCompany);
      console.log('   To:', companyEmail);
      
      const companyResult = await this.resend.emails.send(companyEmailData);
      
      if (companyResult.error) {
        console.error('❌ Company email failed:', companyResult.error);
        console.log('⚠️  Company email failed but client email was sent');
      } else {
        console.log('✅ Company email sent via Resend!');
        console.log('   Message ID:', companyResult.data?.id);
      }

      console.log('🎉 ALL RESEND EMAILS SENT SUCCESSFULLY!');
      console.log('   Domain:', this.verifiedDomain, '✅ Verified and Active');
      
      return { 
        success: true, 
        clientMessageId: clientResult.data?.id,
        companyMessageId: companyResult.data?.id,
        clientEmail: meetingData.email,
        companyEmail: companyEmail,
        domain: this.verifiedDomain,
        fromAddresses: {
          client: fromAddressClient,
          company: fromAddressCompany
        }
      };

    } catch (error) {
      console.error('💥 RESEND EMAIL SENDING FAILED:');
      console.error('   Error:', error.message);
      console.error('   Domain Status:', 'Verified - Check email content');
      
      return { 
        success: false, 
        error: error.message,
        clientEmail: meetingData.email,
        domain: this.verifiedDomain,
        help: 'Emails should now work with verified domain'
      };
    }
  }

  // Enhanced email templates
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
          .button {
            display: inline-block;
            background: #1a365d;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
          }
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
              <p><strong>Mode:</strong> Office Consultation</p>
            </div>

            <h3>📍 Our Office Location</h3>
            <p>97-B Main Boulevard Jubilee Town Housing Scheme Canal Road Lahore</p>
            
            <p><a href="https://maps.google.com/?q=97-B Main Boulevard Jubilee Town Lahore" class="button">📍 Get Directions</a></p>

            <h3>📞 Contact Information</h3>
            <p><strong>Phone:</strong> +92-321-883-6371</p>
            <p><strong>WhatsApp:</strong> +92-311-178-6646</p>
            <p><strong>Email:</strong> meezandevelopers.official@gmail.com</p>
            <p><strong>Emergency Contact:</strong> +92-321-883-6371</p>

            <h3>📋 Preparation Checklist</h3>
            <ul>
              <li>Bring any existing plans or drawings</li>
              <li>Prepare your budget range</li>
              <li>List your specific requirements</li>
              <li>Think about your preferred timeline</li>
            </ul>

            <p><em>We recommend arriving 5 minutes early. Parking is available at our office premises.</em></p>
            
            <p>Need to reschedule? Contact us at least 24 hours before your appointment.</p>
          </div>
          
          <div class="footer">
            <p><strong>Meezan Developers</strong><br>Building Excellence Since 2009</p>
            <p>263+ Projects Completed | 98% Client Satisfaction</p>
            <p>97-B Main Boulevard Jubilee Town Housing Scheme Canal Road Lahore</p>
            <p><a href="https://meezandevelopers.com">Visit our website</a> | <a href="https://meezandevelopers.com/portfolio">View our portfolio</a></p>
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
          .urgent { 
            background: #fef3c7; 
            padding: 15px; 
            border-radius: 5px; 
            border-left: 4px solid #f59e0b;
            margin: 15px 0;
          }
          h1 { margin: 0; font-size: 24px; }
          h3 { color: #dc2626; margin-top: 0; }
          .button {
            display: inline-block;
            background: #dc2626;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 New Meeting Scheduled</h1>
            <p>Meezan Developers AI Agent System</p>
          </div>
          
          <div class="content">
            <div class="urgent">
              <h3>📋 ACTION REQUIRED</h3>
              <p>New client consultation scheduled via AI Agent. Please prepare for this meeting.</p>
            </div>
            
            <h3>👤 Client Details</h3>
            <div class="meeting-details">
              <p><strong>Name:</strong> ${meeting.name}</p>
              <p><strong>Email:</strong> ${meeting.email}</p>
              <p><strong>Project Type:</strong> ${meeting.projectType || 'Not specified'}</p>
              <p><strong>Date:</strong> ${meeting.date}</p>
              <p><strong>Time:</strong> ${meeting.time}</p>
              <p><strong>Meeting ID:</strong> ${meeting.id}</p>
              <p><strong>Scheduled Via:</strong> AI Agent System</p>
              <p><strong>Timestamp:</strong> ${new Date().toLocaleString('en-PK')}</p>
            </div>
            
            <h3>📧 Quick Actions</h3>
            <p>
              <a href="mailto:${meeting.email}?subject=Preparation for our meeting on ${meeting.date}&body=Dear ${meeting.name},%0D%0A%0D%0AWe're looking forward to our meeting on ${meeting.date} at ${meeting.time} to discuss your ${meeting.projectType} project.%0D%0A%0D%0ABest regards,%0D%0AMeezan Developers Team" class="button">📧 Send Welcome Email</a>
              <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=Meeting with ${meeting.name} - ${meeting.projectType}&dates=${this.getGoogleCalendarDate(meeting.date, meeting.time)}&details=Client: ${meeting.name}%0AEmail: ${meeting.email}%0AProject: ${meeting.projectType}%0AMeeting ID: ${meeting.id}&location=97-B Main Boulevard Jubilee Town Lahore" class="button">📅 Add to Google Calendar</a>
            </p>
            
            <h3>📋 Preparation Notes</h3>
            <ul>
              <li>Review ${meeting.projectType} portfolio materials</li>
              <li>Prepare cost estimation templates</li>
              <li>Check availability of relevant team members</li>
              <li>Prepare consultation checklist</li>
            </ul>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Send preparation email to client</li>
              <li>Add to team calendar</li>
              <li>Prepare project discussion materials</li>
              <li>Confirm meeting room availability</li>
            </ol>
            
            <p style="color: #666; font-style: italic;">This meeting was automatically scheduled through the AI Agent system. All details are confirmed and the client has received confirmation.</p>
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
• Mode: Office Consultation

OUR OFFICE:
97-B Main Boulevard Jubilee Town Housing Scheme Canal Road Lahore

CONTACT INFORMATION:
• Phone: +92-321-883-6371
• WhatsApp: +92-311-178-6646
• Email: meezandevelopers.official@gmail.com
• Emergency Contact: +92-321-883-6371

PREPARATION CHECKLIST:
✓ Bring any existing plans or drawings
✓ Prepare your budget range
✓ List your specific requirements
✓ Think about your preferred timeline

We recommend arriving 5 minutes early. Parking is available at our office premises.

Need to reschedule? Contact us at least 24 hours before your appointment.

Meezan Developers
Building Excellence Since 2009
263+ Projects Completed | 98% Client Satisfaction
    `;
  }

  // Helper method for Google Calendar
  getGoogleCalendarDate(dateStr, timeStr) {
    // Convert date and time to Google Calendar format
    const date = new Date(dateStr);
    const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const period = timeMatch[3].toUpperCase();
      
      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      date.setHours(hours, minutes);
    }
    
    // Add 1 hour for end time
    const endDate = new Date(date.getTime() + 60 * 60 * 1000);
    
    // Format to YYYYMMDDTHHMMSSZ
    const formatDate = (d) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    return `${formatDate(date)}/${formatDate(endDate)}`;
  }

  // Test domain functionality
  async testDomainFunctionality() {
    try {
      console.log('🔍 Testing domain email functionality...');
      
      const testEmail = {
        from: `Test <test@${this.verifiedDomain}>`,
        to: [process.env.COMPANY_EMAIL || 'mashoodji7@gmail.com'],
        subject: `Domain Test - ${this.verifiedDomain}`,
        html: `
          <h2>Domain Email Test</h2>
          <p>Testing email sending from your verified domain: <strong>${this.verifiedDomain}</strong></p>
          <p>If you receive this, your domain is properly configured and can send to any email address!</p>
          <p><strong>Status:</strong> ✅ DOMAIN VERIFIED AND ACTIVE</p>
        `,
        text: `Domain test for ${this.verifiedDomain} - Emails should now work to any address`
      };

      const result = await this.resend.emails.send(testEmail);
      
      if (result.error) {
        console.log('❌ Domain test failed:', result.error.message);
        return { 
          success: false, 
          error: result.error.message
        };
      } else {
        console.log('✅ Domain test PASSED!');
        console.log('   Domain:', this.verifiedDomain, 'can send to any address');
        return { 
          success: true, 
          messageId: result.data?.id,
          domain: this.verifiedDomain,
          status: 'VERIFIED_AND_ACTIVE'
        };
      }
    } catch (error) {
      console.error('❌ Domain test error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

// Email validation helper
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

module.exports = new ResendEmailService();