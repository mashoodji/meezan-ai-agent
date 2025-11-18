const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api', require('./routes/chat'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: '✅ AI Agent Backend Running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    features: ['Meeting Booking', 'Email Automation', 'Cost Estimation']
  });
});

// Test email endpoint
app.get('/api/test-email', async (req, res) => {
  try {
    const emailService = require('./services/emailService');
    
    const testMeeting = {
      name: "Test Client",
      email: process.env.EMAIL_USER, // Send to yourself for testing
      projectType: "Residential Construction",
      date: new Date().toDateString(),
      time: "2:00 PM"
    };
    
    const result = await emailService.sendMeetingConfirmation(testMeeting);
    
    res.json({ 
      success: result,
      message: result ? 'Test emails sent successfully' : 'Email sending failed'
    });
  } catch (error) {
    res.json({ 
      success: false,
      error: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AI Agent Backend running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`📍 Health: http://localhost:${PORT}/health`);
  console.log(`📍 Features: Meeting Booking + Email Automation`);
});