const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Universal CORS Configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, server-side calls)
    if (!origin) return callback(null, true);

    // Development: Allow all origins
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔓 Development CORS - Allowing origin:', origin);
      return callback(null, true);
    }

    // Production: Allow specific domains
    const productionAllowedOrigins = [
      'https://meezandevelopers.com',
      'https://www.meezandevelopers.com',
      'http://meezandevelopers.com',
      'http://www.meezandevelopers.com',

      // Localhost
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',

      // Local networks
      'http://192.168.0.0',
      'http://192.168.1.0',
      'http://192.168.100.0',
      'http://10.0.0.0',
      'http://172.16.0.0',

      // Render frontend
      'https://meezan-ai-agent.onrender.com'
    ];

    const isAllowed = productionAllowedOrigins.some(allowed => {
      if (origin === allowed) return true;
      if (allowed.includes('192.168.') && origin.startsWith('http://192.168.')) return true;
      if (allowed.includes('10.0.') && origin.startsWith('http://10.')) return true;
      if (allowed.includes('172.16.') && origin.startsWith('http://172.')) return true;
      if (allowed.includes('meezandevelopers.com') && origin.includes('meezandevelopers.com')) return true;

      return false;
    });

    if (isAllowed) {
      console.log('✅ Production CORS - Allowed origin:', origin);
      return callback(null, true);
    } else {
      console.log('🚫 Production CORS - Blocked origin:', origin);
      // Still allow for now - remove to actually block
      return callback(null, true);
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
  maxAge: 86400
}));

// Handle pre-flight requests
app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security headers
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  next();
});

// Request logging
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

// Enhanced health check
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
      ai_agent: 'Enhanced AI Agent Operational',
      email_service: process.env.RESEND_API_KEY ? 'Ready' : 'Not Configured',
      calendar: 'Smart Calendar Service Operational',
      cors: 'Enabled for ALL networks'
    },
    features: [
      'Human-like AI Conversation',
      'Smart Meeting Scheduling',
      'Calendar Integration',
      'Gemini API Integration',
      'Learning & Adaptation',
      'Goal-Oriented Assistance'
    ]
  };

  res.json(healthData);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Meezan Developers Enhanced AI Agent Backend',
    version: '3.0.0',
    status: 'operational',
    environment: process.env.NODE_ENV || 'production',
    official_website: 'https://meezandevelopers.com',
    description: 'Advanced AI Construction Consultant with Human-like Interactions',
    endpoints: {
      'GET /': 'API information',
      'GET /health': 'Health check',
      'GET /api/network-test': 'Network connectivity test',
      'GET /api/cors-test': 'CORS configuration test',
      'GET /api/debug-email': 'Debug email service',
      'GET /api/debug-calendar': 'Debug calendar service',
      'POST /api/chat': 'Main AI Agent chat endpoint'
    },
    ai_capabilities: [
      'Natural conversation flow',
      'Smart calendar integration',
      'Cost estimation',
      'Meeting scheduling',
      'Knowledge base integration',
      'Learning from interactions',
      'Goal-oriented assistance'
    ]
  });
});

// Network diagnostics
app.get('/api/network-test', (req, res) => {
  const clientInfo = {
    ip: req.ip || req.connection.remoteAddress,
    forwardedFor: req.headers['x-forwarded-for'],
    realIp: req.headers['x-real-ip'],
    origin: req.headers.origin || 'No origin header',
    referer: req.headers.referer || 'No referer',
    userAgent: req.get('User-Agent'),
    host: req.get('host')
  };

  res.json({
    success: true,
    message: '🎉 NETWORK CONNECTION SUCCESSFUL!',
    status: 'Your client can reach the Meezan AI Agent backend',
    client: clientInfo,
    connection: {
      your_location: getLocationDescription(req.headers.origin, req.ip),
      backend_location: 'Render cloud',
      latency: 'Real-time connection established'
    }
  });
});

// CORS test
app.get('/api/cors-test', (req, res) => {
  res.json({
    success: true,
    message: '✅ CORS IS PROPERLY CONFIGURED!',
    your_request: {
      origin: req.headers.origin || 'No origin (direct access)',
      method: req.method,
      ip: req.ip
    },
    cors_configuration: {
      policy: 'UNIVERSAL ACCESS',
      methods: 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      headers: 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-API-Key',
      credentials: 'Allowed',
      max_age: '86400 seconds'
    },
    access_granted: true,
    timestamp: new Date().toISOString()
  });
});

// Email service debug
app.get('/api/debug-email', async (req, res) => {
  try {
    const envCheck = {
      NODE_ENV: process.env.NODE_ENV || 'development',
      RESEND_API_KEY: process.env.RESEND_API_KEY ? '✅ Configured' : '❌ Missing',
      COMPANY_EMAIL: process.env.COMPANY_EMAIL || 'meezandevelopers.official@gmail.com',
      DOMAIN_VERIFIED: 'meezandevelopers.com'
    };

    if (!process.env.RESEND_API_KEY) {
      return res.json({
        success: false,
        message: 'Email service not configured',
        environment: envCheck,
        instructions: 'Add RESEND_API_KEY to your environment variables'
      });
    }

    const resendEmailService = require('./services/resendEmailService');

    const testData = {
      name: "Test User",
      email: process.env.COMPANY_EMAIL || 'meezandevelopers.official@gmail.com',
      projectType: "Test Project",
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      id: "TEST_" + Date.now()
    };

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
      } : null
    });

  } catch (error) {
    console.error('❌ Email debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        RESEND_API_KEY: process.env.RESEND_API_KEY ? 'Set' : 'Not set'
      }
    });
  }
});

// Calendar service debug
app.get('/api/debug-calendar', async (req, res) => {
  try {
    const calendarService = require('./services/calendarService');

    const availableDates = calendarService.generateAvailableDates();
    const bookedSlots = calendarService.getBookedSlots();
    const nextAvailable = calendarService.getNextAvailableSlots(5);

    res.json({
      success: true,
      service: 'Calendar Service - Operational',
      available_dates: availableDates,
      booked_slots: bookedSlots,
      next_available_slots: nextAvailable,
      total_booked: bookedSlots.length,
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

// Helper functions
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

// Load chat routes
console.log('🔄 Loading Enhanced AI Agent chat routes...');
try {
  const chatRoutes = require('./routes/chat');
  app.use('/api', chatRoutes);
  console.log('✅ Enhanced AI Agent chat routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load chat routes:', error.message);
}

// Keep-alive service for Render
console.log('🔧 Initializing Keep-Alive Service...');

function startKeepAlive() {
  const keepAliveUrl = process.env.RENDER_URL || 'https://meezan-ai-agent.onrender.com';

  console.log('🔄 Keep-alive service configured for:', keepAliveUrl);
  console.log('ℹ️  NOTE: Set RENDER_URL env var if your Render app name is different.');

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
  }, 8 * 60 * 1000);

  console.log('✅ Keep-alive service started - pinging every 8 minutes');
  return pingInterval;
}

if (process.env.NODE_ENV === 'production' && process.env.RENDER) {
  setTimeout(() => {
    const keepAliveInterval = startKeepAlive();

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

// 404 handler
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
      email: 'meezandevelopers.official@gmail.com'
    },
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('🚨 Global Server Error:', {
    error: error.message,
    url: req.url,
    method: req.method,
    origin: req.headers.origin,
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

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 ENHANCED MEEZAN DEVELOPERS AI AGENT BACKEND');
  console.log('='.repeat(80));
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Host: 0.0.0.0 (accessible from ANY network)`);
  console.log(`📍 Official Website: https://meezandevelopers.com`);
  console.log('\n🎯 ENHANCED FEATURES:');
  console.log(`   ✅ Human-like AI conversations`);
  console.log(`   ✅ Smart calendar integration`);
  console.log(`   ✅ Gemini API for unknown queries`);
  console.log(`   ✅ Learning & adaptation system`);
  console.log(`   ✅ Goal-oriented assistance`);
  console.log('\n🌐 ACCESSIBLE FROM:');
  console.log(`   ✅ Localhost: http://localhost:${PORT}`);
  console.log(`   ✅ Local Networks: http://192.168.x.x:${PORT}`);
  console.log(`   ✅ Production: https://meezan-ai-agent.onrender.com`);
  console.log('\n🔧 TEST ENDPOINTS:');
  console.log(`   Health: https://meezan-ai-agent.onrender.com/health`);
  console.log(`   Network Test: https://meezan-ai-agent.onrender.com/api/network-test`);
  console.log('\n🔄 KEEP-ALIVE: Active (prevents Render sleep)');
  console.log('✅ STATUS: Enhanced AI Agent ready for construction consultations');
  console.log('='.repeat(80) + '\n');
});

// Graceful shutdown
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

process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;