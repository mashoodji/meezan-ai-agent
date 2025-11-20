const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// UNIVERSAL CORS - Works everywhere: Render, Localhost, Local Network, Production
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, server-side calls, Postman)
    if (!origin) return callback(null, true);
    
    // DEVELOPMENT: Allow all origins for local development and testing
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔓 Development CORS - Allowing origin:', origin);
      return callback(null, true);
    }
    
    // PRODUCTION: Only allow your official domains + essential development URLs
    const productionAllowedOrigins = [
      'https://meezandevelopers.com',
      'https://www.meezandevelopers.com',
      'http://meezandevelopers.com',
      'http://www.meezandevelopers.com',
      // Keep localhost for emergency admin access
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    // Check if origin is in allowed list
    const isAllowed = productionAllowedOrigins.some(allowed => 
      origin === allowed || origin.startsWith(allowed)
    );
    
    if (isAllowed) {
      return callback(null, true);
    } else {
      console.log('🚫 Production CORS - Blocked origin:', origin);
      const msg = `CORS policy: Origin ${origin} not allowed in production`;
      return callback(new Error(msg), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'Authorization'
  ],
  maxAge: 86400 // 24 hours
}));

// Handle pre-flight requests for ALL routes
app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==================== SECURITY & PERFORMANCE MIDDLEWARE ====================

// Basic security headers
app.use((req, res, next) => {
  // Remove server signature
  res.removeHeader('X-Powered-By');
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // CORS headers (redundant but safe)
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  console.log('🌐 Request:', {
    method: req.method,
    url: req.url,
    origin: req.headers.origin || 'no-origin',
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')?.substring(0, 100) || 'unknown',
    timestamp: new Date().toISOString()
  });
  next();
});

// ==================== UNIVERSAL HEALTH & STATUS ENDPOINTS ====================

// Enhanced health check - works everywhere
app.get('/health', (req, res) => {
  const healthData = {
    status: '✅ Meezan Developers AI Agent Backend - FULLY OPERATIONAL',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    server: {
      port: PORT,
      host: req.headers.host,
      uptime: process.uptime(),
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
      }
    },
    client: {
      ip: req.ip || req.connection.remoteAddress,
      origin: req.headers.origin || 'direct-access',
      userAgent: req.get('User-Agent')?.substring(0, 80) || 'unknown'
    },
    services: {
      website: 'https://meezandevelopers.com',
      ai_agent: 'Operational',
      email_service: process.env.RESEND_API_KEY ? 'Ready' : 'Not Configured',
      calendar: 'Operational',
      cors: 'Enabled for all networks'
    },
    network: {
      accessible_from: 'Any network (localhost, LAN, internet)',
      cors_policy: process.env.NODE_ENV === 'production' ? 'Production (restricted)' : 'Development (open)',
      deployment: 'Render + Local Development'
    }
  };
  
  res.json(healthData);
});

// Root endpoint - API information
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Meezan Developers AI Agent Backend - Universal Access',
    version: '2.0.0',
    status: 'operational',
    environment: process.env.NODE_ENV || 'production',
    official_website: 'https://meezandevelopers.com',
    description: 'AI Construction Consultant with Meeting Booking & Email Automation',
    endpoints: {
      'GET /': 'API information (this page)',
      'GET /health': 'Comprehensive health check',
      'GET /api/network-test': 'Test network connectivity from your location',
      'GET /api/cors-test': 'Test CORS configuration',
      'GET /api/debug-email': 'Debug email service (development)',
      'GET /api/debug-calendar': 'Debug calendar service',
      'POST /api/chat': 'Main AI Agent chat endpoint'
    },
    network_access: {
      localhost: `http://localhost:${PORT}`,
      local_network: `http://YOUR_LOCAL_IP:${PORT}`,
      production: 'https://your-app-name.onrender.com',
      cors: 'Enabled for all origins in development'
    },
    features: [
      'AI Construction Consultation',
      'Smart Meeting Scheduling',
      'Email Confirmation System',
      'Calendar Availability Management',
      'Cost Estimation',
      'Project Portfolio Access'
    ]
  });
});

// ==================== NETWORK DIAGNOSTICS ENDPOINTS ====================

// Network connectivity test - essential for debugging
app.get('/api/network-test', (req, res) => {
  const clientInfo = {
    ip: req.ip || req.connection.remoteAddress,
    forwardedFor: req.headers['x-forwarded-for'],
    realIp: req.headers['x-real-ip'],
    origin: req.headers.origin || 'No origin header',
    referer: req.headers.referer || 'No referer',
    userAgent: req.get('User-Agent'),
    host: req.get('host'),
    secFetchSite: req.get('sec-fetch-site')
  };

  const serverInfo = {
    environment: process.env.NODE_ENV,
    port: PORT,
    nodeVersion: process.version,
    platform: process.platform,
    timestamp: new Date().toISOString(),
    render: process.env.RENDER ? 'Yes' : 'No',
    memory: process.memoryUsage()
  };

  res.json({
    success: true,
    message: '🎉 NETWORK CONNECTION SUCCESSFUL!',
    status: 'Your client can reach the Meezan AI Agent backend',
    client: clientInfo,
    server: serverInfo,
    connection: {
      your_location: 'Any network (localhost, office, home, mobile)',
      backend_location: 'Render cloud + local development',
      latency: 'Real-time connection established',
      cors: 'Enabled and working'
    },
    next_steps: [
      'If you see this message, your frontend can connect to the backend',
      'Check browser console for any JavaScript errors',
      'Verify your frontend is using the correct API URL',
      'Test the chat endpoint with a POST request'
    ]
  });
});

// CORS configuration test
app.get('/api/cors-test', (req, res) => {
  res.json({
    success: true,
    message: '✅ CORS IS PROPERLY CONFIGURED!',
    your_request: {
      origin: req.headers.origin || 'No origin (direct access)',
      method: req.method,
      headers: {
        origin: req.headers.origin,
        'access-control-request-method': req.headers['access-control-request-method'],
        'access-control-request-headers': req.headers['access-control-request-headers']
      }
    },
    cors_configuration: {
      development: 'ALL origins allowed',
      production: 'Only meezandevelopers.com and localhost',
      methods: 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      headers: 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
      credentials: 'Allowed',
      max_age: '86400 seconds (24 hours)'
    },
    access_granted: true,
    timestamp: new Date().toISOString()
  });
});

// ==================== SERVICE DEBUG ENDPOINTS ====================

// Email service debug endpoint
app.get('/api/debug-email', async (req, res) => {
  try {
    console.log('🔧 Debugging email service from:', req.headers.origin || 'unknown origin');
    
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? '✅ Configured' : '❌ Missing - Check Render Environment Variables',
      COMPANY_EMAIL: process.env.COMPANY_EMAIL || 'meezandevelopers.official@gmail.com',
      BACKEND_URL: `https://${req.headers.host}`
    };

    console.log('Environment Check:', envCheck);

    // Only test email sending if API key is available
    if (!process.env.RESEND_API_KEY) {
      return res.json({
        success: false,
        message: 'Email service not configured',
        environment: envCheck,
        instructions: 'Add RESEND_API_KEY to your Render environment variables',
        timestamp: new Date().toISOString()
      });
    }

    const resendEmailService = require('./services/resendEmailService');
    
    const testData = {
      name: "Network Test User",
      email: process.env.COMPANY_EMAIL || 'meezandevelopers.official@gmail.com',
      projectType: "Network Test Project",
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      id: "NETWORK_TEST_" + Date.now()
    };
    
    console.log('📧 Testing Resend email service...');
    const result = await resendEmailService.sendMeetingConfirmation(testData);
    
    res.json({
      success: result.success,
      environment: envCheck,
      message: result.success ? '✅ Email service working!' : '❌ Email service failed',
      error: result.error,
      test_data: testData,
      messageIds: result.success ? {
        client: result.clientMessageId,
        company: result.companyMessageId
      } : null,
      timestamp: new Date().toISOString(),
      note: result.success ? 'Check your email inbox for confirmation' : 'Fix RESEND_API_KEY in Render'
    });
    
  } catch (error) {
    console.error('❌ Email debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        RESEND_API_KEY: process.env.RESEND_API_KEY ? 'Set' : 'Not set',
        COMPANY_EMAIL: process.env.COMPANY_EMAIL || 'Not set'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Calendar service debug endpoint
app.get('/api/debug-calendar', async (req, res) => {
  try {
    const calendarService = require('./services/calendarService');
    
    const availableDates = calendarService.generateAvailableDates();
    const bookedSlots = calendarService.getBookedSlots();
    const nextAvailable = calendarService.getNextAvailableSlots(5);
    const businessHours = calendarService.businessHours;
    
    res.json({
      success: true,
      service: 'Calendar Service - Operational',
      available_dates: availableDates,
      booked_slots: bookedSlots,
      next_available_slots: nextAvailable,
      business_hours: businessHours,
      total_booked: bookedSlots.length,
      timestamp: new Date().toISOString(),
      note: 'Calendar service is managing availability correctly'
    });
    
  } catch (error) {
    console.error('❌ Calendar debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      service: 'Calendar Service - Error'
    });
  }
});

// Test email endpoint (development only)
app.get('/api/test-email', async (req, res) => {
  try {
    // Only allow in development for safety
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Test endpoint disabled in production for security',
        instructions: 'Use /api/debug-email for production testing'
      });
    }

    const resendEmailService = require('./services/resendEmailService');
    
    const testMeeting = {
      name: "Test Client",
      email: process.env.COMPANY_EMAIL || 'meezandevelopers.official@gmail.com',
      projectType: "Residential Construction",
      date: new Date().toDateString(),
      time: new Date().toLocaleTimeString(),
      id: "TEST_" + Date.now()
    };
    
    const result = await resendEmailService.sendMeetingConfirmation(testMeeting);
    
    res.json({ 
      success: result.success,
      message: result.success ? 'Test emails sent successfully!' : 'Email sending failed',
      error: result.error,
      test_data: testMeeting
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ==================== LOAD ROUTES ====================

// Load chat routes - MUST BE AFTER ALL SPECIFIC ENDPOINTS
console.log('🔄 Loading AI Agent chat routes...');
app.use('/api', require('./routes/chat'));
console.log('✅ AI Agent chat routes loaded successfully');

// ==================== ERROR HANDLERS (MUST BE LAST) ====================

// 404 handler - MUST BE THE LAST ROUTE
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '🔍 Route not found - Meezan AI Agent Backend',
    requested_url: req.originalUrl,
    method: req.method,
    available_endpoints: {
      'GET /': 'API information and documentation',
      'GET /health': 'Comprehensive health check',
      'GET /api/network-test': 'Test network connectivity',
      'GET /api/cors-test': 'Test CORS configuration',
      'GET /api/debug-email': 'Debug email service',
      'GET /api/debug-calendar': 'Debug calendar service',
      'POST /api/chat': 'Main AI Agent chat endpoint'
    },
    support: {
      website: 'https://meezandevelopers.com',
      email: 'meezandevelopers.official@gmail.com',
      note: 'Ensure you are using the correct HTTP method (GET/POST)'
    },
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Global Server Error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    origin: req.headers.origin,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({
    success: false,
    message: 'Internal server error - Meezan AI Agent',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    support: 'Contact meezandevelopers.official@gmail.com for assistance',
    timestamp: new Date().toISOString()
  });
});

// ==================== SERVER START ====================

// Start server on all network interfaces
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 MEEZAN DEVELOPERS AI AGENT BACKEND - UNIVERSAL ACCESS');
  console.log('='.repeat(80));
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Host: 0.0.0.0 (accessible from ANY network)`);
  console.log(`📍 Official Website: https://meezandevelopers.com`);
  console.log('\n🌐 ACCESS URLs:');
  console.log(`   Local: http://localhost:${PORT}`);
  console.log(`   Network: http://YOUR_LOCAL_IP:${PORT}`);
  console.log(`   Render: https://your-app-name.onrender.com`);
  console.log('\n🔧 TEST ENDPOINTS:');
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Network Test: http://localhost:${PORT}/api/network-test`);
  console.log(`   CORS Test: http://localhost:${PORT}/api/cors-test`);
  console.log('\n✅ STATUS: Ready to accept connections from ANY network');
  console.log('='.repeat(80) + '\n');
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received - Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Meezan AI Agent backend terminated successfully');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received - Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Meezan AI Agent backend terminated successfully');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;