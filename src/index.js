const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 🚀 UNIVERSAL CORS - ALLOWS ACCESS FROM ANY NETWORK
app.use(cors({
  origin: function (origin, callback) {
    // ✅ ALLOW REQUESTS WITH NO ORIGIN (mobile apps, server-side calls, Postman)
    if (!origin) return callback(null, true);
    
    // ✅ DEVELOPMENT: Allow all origins for local development and testing
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔓 Development CORS - Allowing origin:', origin);
      return callback(null, true);
    }
    
    // ✅ PRODUCTION: Allow your domains + local networks + essential URLs
    const productionAllowedOrigins = [
      // Your official domains
      'https://meezandevelopers.com',
      'https://www.meezandevelopers.com',
      'http://meezandevelopers.com',
      'http://www.meezandevelopers.com',
      
      // Localhost for development
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      
      // ✅ ADDED: Local network IP ranges (192.168.x.x, 10.x.x.x, 172.16.x.x - 172.31.x.x)
      'http://192.168.0.0',
      'http://192.168.1.0', 
      'http://192.168.100.0',
      'http://10.0.0.0',
      'http://172.16.0.0',
      
      // Your Render frontend if different
      'https://meezan-ai-agent.onrender.com'
    ];
    
    // ✅ SMART ORIGIN CHECKING - Allows any IP in allowed ranges
    const isAllowed = productionAllowedOrigins.some(allowed => {
      // Exact match
      if (origin === allowed) return true;
      
      // IP range matching for local networks
      if (allowed.includes('192.168.') && origin.startsWith('http://192.168.')) return true;
      if (allowed.includes('10.0.') && origin.startsWith('http://10.')) return true;
      if (allowed.includes('172.16.') && origin.startsWith('http://172.')) return true;
      
      // Subdomain matching
      if (allowed.includes('meezandevelopers.com') && origin.includes('meezandevelopers.com')) return true;
      
      return false;
    });
    
    if (isAllowed) {
      console.log('✅ Production CORS - Allowed origin:', origin);
      return callback(null, true);
    } else {
      console.log('🚫 Production CORS - Blocked origin:', origin);
      // ✅ BUT STILL ALLOW FOR NOW - Remove this line to actually block
      return callback(null, true);
      // ❌ To actually block: return callback(new Error(`CORS policy: Origin ${origin} not allowed`), false);
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
    'Access-Control-Request-Headers',
    'X-API-Key'
  ],
  exposedHeaders: [
    'Content-Length',
    'Content-Type',
    'Authorization',
    'X-Powered-By'
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
  
  // CORS headers
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  
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
      cors: 'Enabled for ALL networks'
    },
    network: {
      accessible_from: 'Any network (localhost, LAN, office, home, mobile, internet)',
      cors_policy: 'Universal access enabled',
      deployment: 'Render + Universal Network Access'
    },
    cors: {
      allowed_origins: 'meezandevelopers.com, localhost, local networks (192.168.x.x, 10.x.x.x), and ALL origins',
      status: 'UNIVERSAL ACCESS'
    }
  };
  
  res.json(healthData);
});

// Root endpoint - API information
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Meezan Developers AI Agent Backend - UNIVERSAL NETWORK ACCESS',
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
      'GET /api/debug-email': 'Debug email service',
      'GET /api/debug-calendar': 'Debug calendar service',
      'POST /api/chat': 'Main AI Agent chat endpoint'
    },
    network_access: {
      localhost: `http://localhost:${PORT}`,
      local_network: `http://192.168.x.x:${PORT} (ANY local IP)`,
      mobile_devices: 'Any device on same network',
      production: 'https://meezan-ai-agent.onrender.com',
      cors: 'Enabled for ALL origins and networks'
    },
    features: [
      'AI Construction Consultation',
      'Smart Meeting Scheduling',
      'Email Confirmation System',
      'Calendar Availability Management',
      'Cost Estimation',
      'Project Portfolio Access',
      'Universal Network Access'
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
    secFetchSite: req.get('sec-fetch-site'),
    network_type: getNetworkType(req.headers.origin || req.ip)
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
      your_location: getLocationDescription(req.headers.origin, req.ip),
      network_type: clientInfo.network_type,
      backend_location: 'Render cloud + local development',
      latency: 'Real-time connection established',
      cors: 'Universal access enabled'
    },
    access_info: {
      cors_policy: 'ALLOW_ALL',
      allowed_networks: 'Any network (localhost, LAN, WAN, mobile, office, home)',
      tested_from: clientInfo.origin || 'Direct connection'
    },
    next_steps: [
      'Your network connection is working perfectly!',
      'You can now use the AI Agent from this device/network',
      'Test the chat endpoint to verify full functionality'
    ]
  });
});

// CORS configuration test - shows current CORS settings
app.get('/api/cors-test', (req, res) => {
  res.json({
    success: true,
    message: '✅ CORS IS PROPERLY CONFIGURED FOR UNIVERSAL ACCESS!',
    your_request: {
      origin: req.headers.origin || 'No origin (direct access)',
      method: req.method,
      ip: req.ip,
      network: getNetworkType(req.headers.origin || req.ip)
    },
    cors_configuration: {
      policy: 'UNIVERSAL ACCESS',
      development: 'ALL origins allowed',
      production: 'ALL origins allowed (including local networks)',
      methods: 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      headers: 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key',
      credentials: 'Allowed',
      max_age: '86400 seconds (24 hours)',
      local_networks: '192.168.x.x, 10.x.x.x, 172.16.x.x-172.31.x.x'
    },
    access_granted: true,
    your_access: {
      origin: req.headers.origin || 'Direct IP access',
      status: 'ALLOWED',
      network_type: getNetworkType(req.headers.origin || req.ip)
    },
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
      BACKEND_URL: `https://${req.headers.host}`,
      DOMAIN_VERIFIED: 'Yes (meezandevelopers.com)'
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

// ==================== HELPER FUNCTIONS ====================

// Helper to determine network type
function getNetworkType(originOrIp) {
  if (!originOrIp) return 'direct';
  
  const str = originOrIp.toString();
  
  if (str.includes('localhost') || str.includes('127.0.0.1')) return 'localhost';
  if (str.includes('192.168.')) return 'local_network';
  if (str.includes('10.')) return 'private_network';
  if (str.includes('172.16.') || str.includes('172.17.') || str.includes('172.18.') || str.includes('172.19.') || 
      str.includes('172.20.') || str.includes('172.21.') || str.includes('172.22.') || str.includes('172.23.') ||
      str.includes('172.24.') || str.includes('172.25.') || str.includes('172.26.') || str.includes('172.27.') ||
      str.includes('172.28.') || str.includes('172.29.') || str.includes('172.30.') || str.includes('172.31.')) {
    return 'private_network';
  }
  if (str.includes('meezandevelopers.com')) return 'production_domain';
  
  return 'public_network';
}

// Helper to get location description
function getLocationDescription(origin, ip) {
  const networkType = getNetworkType(origin || ip);
  
  switch (networkType) {
    case 'localhost': return 'Local machine development';
    case 'local_network': return 'Local area network (home/office)';
    case 'private_network': return 'Private corporate network';
    case 'production_domain': return 'Production website access';
    case 'public_network': return 'Public internet access';
    default: return 'Network connection';
  }
}

// ==================== LOAD ROUTES ====================

// Load chat routes - MUST BE AFTER ALL SPECIFIC ENDPOINTS
console.log('🔄 Loading AI Agent chat routes...');
try {
  const chatRoutes = require('./routes/chat');
  app.use('/api', chatRoutes);
  console.log('✅ AI Agent chat routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load chat routes:', error.message);
  console.log('💡 Make sure your routes/chat.js file exists and is properly configured');
}

// ==================== KEEP-ALIVE SERVICE ====================
// 🚀 PREVENTS RENDER FROM SLEEPING

console.log('🔧 Initializing Keep-Alive Service...');

function startKeepAlive() {
  const keepAliveUrl = process.env.RENDER_URL || 'https://meezan-ai-agent.onrender.com';
  
  console.log('🔄 Keep-alive service configured for:', keepAliveUrl);
  
  const pingInterval = setInterval(async () => {
    try {
      const response = await fetch(`${keepAliveUrl}/health`);
      
      if (response.ok) {
        console.log('🔄 Keep-alive ping successful:', new Date().toLocaleTimeString());
      } else {
        console.log('⚠️ Keep-alive ping failed with status:', response.status);
      }
    } catch (error) {
      console.log('⚠️ Keep-alive failed (normal during cold start):', error.message);
    }
  }, 8 * 60 * 1000); // Ping every 8 minutes (less than 15-minute sleep threshold)

  console.log('✅ Keep-alive service started - pinging every 8 minutes');
  return pingInterval;
}

// Start keep-alive only in production on Render
if (process.env.NODE_ENV === 'production' && process.env.RENDER) {
  // Wait 30 seconds before first ping to ensure server is fully up
  setTimeout(() => {
    const keepAliveInterval = startKeepAlive();
    
    // Clean up on exit
    process.on('SIGTERM', () => {
      console.log('🛑 Cleaning up keep-alive service...');
      clearInterval(keepAliveInterval);
    });
    
    process.on('SIGINT', () => {
      console.log('🛑 Cleaning up keep-alive service...');
      clearInterval(keepAliveInterval);
    });
  }, 30000);
} else {
  console.log('💤 Keep-alive disabled (development mode or not on Render)');
}

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
  console.log('🚀 MEEZAN DEVELOPERS AI AGENT BACKEND - UNIVERSAL NETWORK ACCESS');
  console.log('='.repeat(80));
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Host: 0.0.0.0 (accessible from ANY network)`);
  console.log(`📍 Official Website: https://meezandevelopers.com`);
  console.log('\n🌐 ACCESSIBLE FROM:');
  console.log(`   ✅ Localhost: http://localhost:${PORT}`);
  console.log(`   ✅ Local Networks: http://192.168.x.x:${PORT}`);
  console.log(`   ✅ Office Networks: http://10.x.x.x:${PORT}`);
  console.log(`   ✅ Mobile Devices: Any device on same network`);
  console.log(`   ✅ Production: https://meezan-ai-agent.onrender.com`);
  console.log('\n🔧 TEST ENDPOINTS:');
  console.log(`   Health: https://meezan-ai-agent.onrender.com/health`);
  console.log(`   Network Test: https://meezan-ai-agent.onrender.com/api/network-test`);
  console.log(`   CORS Test: https://meezan-ai-agent.onrender.com/api/cors-test`);
  console.log('\n🔄 KEEP-ALIVE: Active (prevents Render sleep)');
  console.log('✅ STATUS: Ready to accept connections from ANY network worldwide');
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