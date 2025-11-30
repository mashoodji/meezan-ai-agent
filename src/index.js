const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== SECURITY MIDDLEWARE ====================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Rate limiting - prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limits per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// ==================== SECURE CORS CONFIGURATION ====================

const allowedOrigins = [
  // Production domains
  'https://meezandevelopers.com',
  'https://www.meezandevelopers.com',
  
  // Development
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

// Secure CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, server-side calls)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      // For development, allow local network access with warning
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️  Development - Allowing origin:', origin);
        return callback(null, true);
      }
      
      // In production, block unauthorized origins
      console.log('🚫 Blocked origin:', origin);
      return callback(new Error('CORS policy: Origin not allowed'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept'
  ],
  maxAge: 86400
}));

// Handle pre-flight requests
app.options('*', cors());

// ==================== BODY PARSING & SECURITY ====================

// Body parsing with limits
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '1mb',
  parameterLimit: 10 // Prevent too many parameters
}));

// ==================== REQUEST VALIDATION ====================

// Input validation middleware
const validateInput = (req, res, next) => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /expression\s*\(/gi,
  ];

  const checkObject = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        for (let pattern of suspiciousPatterns) {
          if (pattern.test(obj[key])) {
            return false;
          }
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (!checkObject(obj[key])) return false;
      }
    }
    return true;
  };

  if (req.body && !checkObject(req.body)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input detected'
    });
  }

  next();
};

app.use(validateInput);

// ==================== SECURITY HEADERS ====================

app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove server signature
  res.removeHeader('X-Powered-By');
  
  next();
});

// ==================== LOGGING & MONITORING ====================

// Enhanced request logging
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log('🌐 Request:', {
      method: req.method,
      url: req.url,
      origin: req.headers.origin || 'no-origin',
      ip: req.ip,
      userAgent: req.get('User-Agent')?.substring(0, 50) || 'unknown',
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  });

  next();
});

// ==================== SECURE HEALTH ENDPOINT ====================

app.get('/health', (req, res) => {
  const healthData = {
    status: '✅ Meezan Developers AI Agent - SECURE & OPERATIONAL',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    security: {
      cors: 'Restricted to allowed origins',
      rate_limiting: 'Active',
      sanitization: 'Enabled',
      headers: 'Secure'
    },
    services: {
      website: 'https://meezandevelopers.com',
      ai_agent: 'Operational',
      email_service: process.env.RESEND_API_KEY ? 'Ready' : 'Not Configured',
      calendar: 'Operational'
    }
  };
  
  res.json(healthData);
});

// ==================== SECURE ROOT ENDPOINT ====================

app.get('/', (req, res) => {
  res.json({
    message: '🚀 Meezan Developers AI Agent - SECURE BACKEND',
    version: '2.0.0',
    status: 'operational',
    security: 'Enhanced security measures active',
    endpoints: {
      'GET /health': 'Secure health check',
      'GET /api/network-test': 'Network connectivity test',
      'POST /api/chat': 'AI Agent chat endpoint'
    },
    features: [
      'AI Construction Consultation',
      'Secure Meeting Scheduling',
      'Email Confirmation System',
      'Rate Limited API',
      'Input Sanitization'
    ]
  });
});

// ==================== SECURE NETWORK TEST ====================

app.get('/api/network-test', (req, res) => {
  // Validate origin
  const origin = req.headers.origin;
  if (process.env.NODE_ENV === 'production' && origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied'
    });
  }

  res.json({
    success: true,
    message: '✅ Secure connection established',
    security: {
      rate_limiting: 'Active',
      cors: 'Restricted',
      sanitization: 'Enabled'
    },
    timestamp: new Date().toISOString()
  });
});

// ==================== SECURE SERVICE ENDPOINTS ====================

// Secure email debug endpoint
app.get('/api/debug-email', async (req, res) => {
  // Rate limiting check
  if (process.env.NODE_ENV === 'production') {
    const limiterCheck = require('express-rate-limit');
    const emailLimiter = limiterCheck({
      windowMs: 60 * 1000, // 1 minute
      max: 3, // 3 requests per minute
      message: { success: false, error: 'Too many email tests' }
    });
    
    return emailLimiter(req, res, async () => {
      await handleEmailDebug(req, res);
    });
  }
  
  await handleEmailDebug(req, res);
});

async function handleEmailDebug(req, res) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return res.json({
        success: false,
        message: 'Email service not configured',
        timestamp: new Date().toISOString()
      });
    }

    const resendEmailService = require('./services/resendEmailService');
    
    const testData = {
      name: "Security Test User",
      email: process.env.COMPANY_EMAIL || 'meezandevelopers.official@gmail.com',
      projectType: "Security Test",
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      id: "SEC_TEST_" + Date.now()
    };
    
    const result = await resendEmailService.sendMeetingConfirmation(testData);
    
    res.json({
      success: result.success,
      message: result.success ? '✅ Email service working!' : '❌ Email service failed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Email debug error:', error);
    res.status(500).json({
      success: false,
      error: 'Service temporarily unavailable'
    });
  }
}

// Secure calendar debug endpoint
app.get('/api/debug-calendar', async (req, res) => {
  try {
    const calendarService = require('./services/calendarService');
    
    const availableDates = calendarService.generateAvailableDates();
    
    res.json({
      success: true,
      available_dates: availableDates,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Calendar debug error:', error);
    res.status(500).json({
      success: false,
      error: 'Service temporarily unavailable'
    });
  }
});

// ==================== LOAD SECURE CHAT ROUTES ====================

console.log('🔄 Loading secure AI Agent chat routes...');
try {
  const chatRoutes = require('./routes/chat');
  
  // Apply rate limiting to chat routes
  const chatLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: {
      success: false,
      error: 'Too many chat messages, please wait a moment.'
    }
  });
  
  app.use('/api/chat', chatLimiter, chatRoutes);
  console.log('✅ Secure AI Agent chat routes loaded');
} catch (error) {
  console.error('❌ Failed to load chat routes:', error.message);
}

// ==================== SECURE KEEP-ALIVE SERVICE ====================

function startSecureKeepAlive() {
  if (process.env.NODE_ENV !== 'production' || !process.env.RENDER) {
    console.log('💤 Keep-alive disabled (development mode)');
    return;
  }

  const keepAliveUrl = process.env.RENDER_URL || 'https://meezan-ai-agent.onrender.com';
  
  const pingInterval = setInterval(async () => {
    try {
      const response = await fetch(`${keepAliveUrl}/health`);
      if (response.ok) {
        console.log('🔄 Keep-alive ping:', new Date().toLocaleTimeString());
      }
    } catch (error) {
      // Silent fail - normal during cold starts
    }
  }, 8 * 60 * 1000);

  console.log('✅ Secure keep-alive service started');
  return pingInterval;
}

// Start keep-alive with delay
setTimeout(() => {
  const keepAliveInterval = startSecureKeepAlive();
  
  process.on('SIGTERM', () => {
    clearInterval(keepAliveInterval);
  });
  
  process.on('SIGINT', () => {
    clearInterval(keepAliveInterval);
  });
}, 30000);

// ==================== ERROR HANDLERS ====================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString()
  });
});

// Global error handler - don't leak error details
app.use((error, req, res, next) => {
  console.error('🚨 Security Error:', {
    error: error.message,
    url: req.url,
    method: req.method,
    origin: req.headers.origin,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ==================== SERVER START ====================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 MEEZAN DEVELOPERS - SECURE AI AGENT BACKEND');
  console.log('='.repeat(70));
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'production'}`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`📍 Security: ✅ Enhanced protection active`);
  console.log('\n🔒 SECURITY FEATURES:');
  console.log('   ✅ Rate Limiting');
  console.log('   ✅ CORS Protection');
  console.log('   ✅ Input Sanitization');
  console.log('   ✅ XSS Protection');
  console.log('   ✅ Secure Headers');
  console.log('\n🌐 ALLOWED ORIGINS:');
  allowedOrigins.forEach(origin => console.log(`   ✅ ${origin}`));
  console.log('='.repeat(70) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});

module.exports = app;