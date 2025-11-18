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

// Routes
app.use('/api', require('./routes/chat'));

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
      test: '/api/test-email'
    }
  });
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

    const emailService = require('./services/emailService');
    
    const testMeeting = {
      name: "Test Client",
      email: process.env.EMAIL_USER,
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
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    availableEndpoints: {
      'GET /': 'API information',
      'GET /health': 'Health check',
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

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Meezan Developers AI Agent Backend running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📍 Website: https://meezandevelopers.com`);
  console.log(`📍 Health: http://localhost:${PORT}/health`);
  console.log(`📍 Features: Meeting Booking + Email Automation`);
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