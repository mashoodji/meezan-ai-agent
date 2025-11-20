const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced CORS for production
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://meezandevelopers.com',
  'https://www.meezandevelopers.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ==================== ALL ROUTES MUST BE DEFINED HERE ====================

// Enhanced health check
app.get('/health', (req, res) => {
  res.json({ 
    status: '✅ Meezan Developers AI Agent Backend Running',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    port: PORT,
    website: 'https://meezandevelopers.com',
    features: ['Meeting Booking', 'Email Automation', 'Cost Estimation'],
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Meezan Developers AI Agent Backend',
    version: '1.0.0',
    status: 'operational',
    website: 'https://meezandevelopers.com',
    endpoints: {
      health: '/health',
      chat: '/api/chat',
      debug: '/api/debug-email'
    }
  });
});

// ✅ DEBUG ENDPOINT - MUST BE BEFORE CHAT ROUTES
app.get('/api/debug-email', async (req, res) => {
  try {
    console.log('🔧 Debugging Resend email service on deployed backend...');
    
    // Check environment variables
    const envCheck = {
      RESEND_API_KEY: process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing',
      COMPANY_EMAIL: process.env.COMPANY_EMAIL ? '✅ Set' : '❌ Missing',
      NODE_ENV: process.env.NODE_ENV || 'not set'
    };
    
    console.log('Environment Check:', envCheck);
    
    const resendEmailService = require('./services/resendEmailService');
    
    // Test with simple data
    const testData = {
      name: "Test User",
      email: process.env.COMPANY_EMAIL || 'meezandevelopers.official@gmail.com',
      projectType: "Test Project",
      date: "2024-01-01",
      time: "2:00 PM",
      id: "DEBUG_" + Date.now()
    };
    
    console.log('📧 Testing Resend email send...');
    const result = await resendEmailService.sendMeetingConfirmation(testData);
    
    res.json({
      success: result.success,
      environment: envCheck,
      message: result.success ? 'Resend email test passed' : 'Resend email test failed',
      error: result.error,
      messageIds: {
        client: result.clientMessageId,
        company: result.companyMessageId
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      environment: {
        RESEND_API_KEY: process.env.RESEND_API_KEY ? 'Set' : 'Not set',
        COMPANY_EMAIL: process.env.COMPANY_EMAIL ? 'Set' : 'Not set',
        NODE_ENV: process.env.NODE_ENV || 'not set'
      }
    });
  }
});

// Test email endpoint (disabled in production)
app.get('/api/test-email', async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Test endpoint disabled in production'
      });
    }

    const resendEmailService = require('./services/resendEmailService');
    
    const testMeeting = {
      name: "Test Client",
      email: process.env.COMPANY_EMAIL,
      projectType: "Residential Construction",
      date: new Date().toDateString(),
      time: "2:00 PM",
      id: "TEST_" + Date.now()
    };
    
    const result = await resendEmailService.sendMeetingConfirmation(testMeeting);
    
    res.json({ 
      success: result.success,
      message: result.success ? 'Test emails sent successfully via Resend' : 'Email sending failed',
      error: result.error
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Routes - MUST BE AFTER ALL SPECIFIC ENDPOINTS
app.use('/api', require('./routes/chat'));

// ==================== ERROR HANDLERS (MUST BE LAST) ====================

// 404 handler - MUST BE THE LAST ROUTE
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    availableEndpoints: {
      'GET /': 'API information',
      'GET /health': 'Health check',
      'GET /api/debug-email': 'Debug email service',
      'POST /api/chat': 'Chat with AI agent'
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

// ==================== SERVER START ====================

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Meezan Developers AI Agent Backend running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📍 Website: https://meezandevelopers.com`);
  console.log(`📍 Health: http://localhost:${PORT}/health`);
  console.log(`📍 Debug: http://localhost:${PORT}/api/debug-email`);
  console.log(`📍 Features: Meeting Booking + Email Automation`);
  console.log(`📍 Email Service: Resend`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Process terminated');
    process.exit(0);
  });
});

module.exports = app;