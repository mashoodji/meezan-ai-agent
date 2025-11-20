const express = require('express');
const axios = require('axios');
const router = express.Router();
const knowledge = require('../data/knowledge.json');

// Import services
const calendarService = require('../services/calendarService');

// Store conversation contexts in memory
const conversationContexts = new Map();
const meetingStates = new Map();
const requestCounts = new Map();

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60000 // 1 minute
};

// Conversation states for better context management
const conversationStates = {
  INITIAL: 'initial',
  SERVICE_INQUIRY: 'service_inquiry',
  COST_DISCUSSION: 'cost_discussion',
  MEETING_BOOKING: 'meeting_booking',
  PROJECT_DETAILS: 'project_details',
  PORTFOLIO_REVIEW: 'portfolio_review',
  COST_TYPE_SELECTION: 'cost_type_selection'
};

// Updated calculator URL for production
const CALCULATOR_URL = 'https://meezandevelopers.com/construction-cost';

// Enhanced system prompt for AI Agent with context awareness
const systemPrompt = `You are an AI Construction Consultant Agent for Meezan Developers.

COMPANY INFORMATION:
- Name: ${knowledge.company.name}
- Experience: ${knowledge.company.yearsExperience}
- Phone: ${knowledge.company.contact.phone}
- WhatsApp: ${knowledge.company.contact.whatsapp}
- Email: ${knowledge.company.contact.email}
- Address: ${knowledge.company.contact.address}

KEY SERVICES:
${knowledge.services.map(service => `• ${service.name}: ${service.description}`).join('\n')}

PROJECT PORTFOLIO:
- Total Projects: ${knowledge.projectPortfolio.totalCompleted}
- Residential: ${knowledge.projectPortfolio.residential}
- Commercial: ${knowledge.projectPortfolio.commercial}
- Industrial: ${knowledge.projectPortfolio.industrial}
- Religious: ${knowledge.projectPortfolio.religious}
- Infrastructure: ${knowledge.projectPortfolio.infrastructure}
- Educational: ${knowledge.projectPortfolio.educational}
- Roads: ${knowledge.projectPortfolio.roads}

CONSTRUCTION COSTS:
- Residential: ${knowledge.constructionCosts.residential.greyStructure} (Grey Structure)
- Commercial: ${knowledge.constructionCosts.commercial.basic} (Basic)
- Industrial: ${knowledge.constructionCosts.industrial.basic} (Basic)

COMPANY STATS:
- Projects Completed: ${knowledge.company.stats.projectsCompleted}
- Team Members: ${knowledge.company.stats.teamMembers}
- Industry Awards: ${knowledge.company.stats.industryAwards}

RESPONSE GUIDELINES:
- Be professional but friendly and concise
- Keep responses short and scannable (2-4 lines max for initial responses)
- Use company information from above for accurate responses
- For cost estimates, use the construction costs data provided
- When user asks about specific project costs, provide COST ESTIMATES not portfolio
- Mention that final costs depend on specific requirements
- Always recommend consultation for accurate pricing
- Use bullet points only when necessary
- MAINTAIN CONVERSATION CONTEXT - remember what the user was previously asking about
- If user asks follow-up questions, continue the previous topic naturally

IMPORTANT: When user asks about scheduling meetings, consultations, appointments, or calls, DO NOT provide generic responses. The system will handle meeting booking automatically.

Always respond helpfully and offer relevant suggestions based on construction context and conversation history.`;

// Special prompt for cost estimation
const costEstimationPrompt = `You are a construction cost expert in Pakistan. Provide current market construction cost estimates for different project types.

Use this actual cost data from Meezan Developers:

RESIDENTIAL CONSTRUCTION:
- Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}
- Finished: ${knowledge.constructionCosts.residential.finished}
- Premium: ${knowledge.constructionCosts.residential.premium}

COMMERCIAL CONSTRUCTION:
- Basic: ${knowledge.constructionCosts.commercial.basic}
- Standard: ${knowledge.constructionCosts.commercial.standard}
- Premium: ${knowledge.constructionCosts.commercial.premium}

INDUSTRIAL CONSTRUCTION:
- Basic: ${knowledge.constructionCosts.industrial.basic}
- Standard: ${knowledge.constructionCosts.industrial.standard}
- Premium: ${knowledge.constructionCosts.industrial.premium}

COST FACTORS:
${knowledge.constructionCosts.costFactors.map(factor => `- ${factor}`).join('\n')}

COMPANY INFORMATION:
- Name: ${knowledge.company.name}
- Experience: ${knowledge.company.yearsExperience}
- Projects Completed: ${knowledge.projectPortfolio.totalCompleted}
- Contact: ${knowledge.company.contact.phone}

IMPORTANT: When user asks about specific project costs (like "industrial projects cost", "residential construction price", etc.), provide COST ESTIMATES, not portfolio information.

Always mention that these are estimates and final costs require detailed consultation with Meezan Developers.`;

// ==================== ENHANCED HELPER FUNCTIONS ====================

// Input sanitization
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  // Remove potentially harmful characters and limit length
  return input.trim().replace(/[<>]/g, '').slice(0, 500);
}

// Rate limiting function
function isRateLimited(sessionId) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.windowMs;
  
  const requests = requestCounts.get(sessionId) || [];
  const recentRequests = requests.filter(time => time > windowStart);
  
  if (recentRequests.length >= RATE_LIMIT.maxRequests) {
    return true;
  }
  
  recentRequests.push(now);
  requestCounts.set(sessionId, recentRequests);
  return false;
}

// Enhanced Gemini API caller with better error handling
async function callGeminiAPI(promptConfig, fallbackResponse) {
  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await axios.post(apiUrl, promptConfig, { 
      timeout: 10000,
      headers: { 
        'Content-Type': 'application/json',
      }
    });
    
    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.data.candidates[0].content.parts[0].text.trim();
    }
    throw new Error('Invalid response format from Gemini API');
  } catch (error) {
    console.error('❌ Gemini API Error:', error.response?.data || error.message);
    return fallbackResponse;
  }
}

// Initialize enhanced context with conversation history
function initializeContext(sessionId) {
  const context = {
    sessionId,
    lastTopic: null,
    lastService: null,
    lastCostQuery: null,
    state: conversationStates.INITIAL,
    projectDetails: {
      type: null,
      area: null,
      budget: null,
      timeline: null
    },
    conversationHistory: [],
    interactionCount: 0,
    lastInteraction: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
  
  conversationContexts.set(sessionId, context);
  return context;
}

// Enhanced conversation logging
function logConversation(sessionId, userMessage, response, context) {
  console.log('💬 Conversation Log:', {
    sessionId: sessionId.substring(0, 12) + '...',
    userMessage: userMessage.substring(0, 80) + (userMessage.length > 80 ? '...' : ''),
    responseType: response.action || 'general',
    context: {
      lastTopic: context.lastTopic,
      state: context.state,
      interactionCount: context.interactionCount
    },
    timestamp: new Date().toISOString()
  });
}

// Enhanced response formatter
function formatResponse(reply, suggestions = [], action = null, details = null, sessionId = null) {
  const response = {
    success: true,
    reply,
    suggestions,
    timestamp: new Date().toISOString()
  };
  
  if (action) response.action = action;
  if (details) response.details = details;
  if (sessionId) response.sessionId = sessionId;
  
  return response;
}

// Enhanced follow-up question detection
function isFollowUpQuestion(userMessage, context) {
  if (!context.lastTopic || context.interactionCount < 2) return false;

  const followUpIndicators = [
    'no i want', 'i want to know', 'tell me about', 'what about', 'how about',
    'can you', 'could you', 'please', 'actually', 'but', 'however',
    'more', 'detail', 'specific', 'explain', 'elaborate', 'what is the',
    'give me', 'show me', 'i need'
  ];

  const isFollowUp = followUpIndicators.some(indicator => 
    userMessage.includes(indicator)
  );

  // Also consider short messages as follow-ups if we have context
  const isShortMessage = userMessage.split(' ').length <= 8;
  const isClarification = userMessage.includes('?') || userMessage.includes('this') || userMessage.includes('that');
  
  return isFollowUp || (isShortMessage && context.lastTopic && !isGreeting(userMessage)) || isClarification;
}

// Enhanced meeting request detection
function isMeetingRequest(userMessage) {
  const meetingKeywords = [
    'meeting', 'schedule', 'appointment', 'book', 'consultation', 
    'call', 'meet', 'arrange', 'set up', 'plan a meeting', 
    'schedule a call', 'book appointment', 'arrange meeting',
    'set up meeting', 'plan consultation', 'schedule consultation',
    'book consultation', 'arrange consultation', 'set up consultation',
    'meet with', 'call with', 'talk to', 'speak with', 'discuss project',
    'discuss construction', 'project discussion', 'construction meeting',
    'want to meet', 'need to meet', 'like to schedule', 'would like to book',
    'set up a call', 'arrange a meeting', 'plan a call', 'schedule meeting',
    'book a meeting', 'make appointment', 'set appointment'
  ];

  // Check for exact matches or partial matches
  return meetingKeywords.some(keyword => userMessage.includes(keyword));
}

// ==================== ENHANCED ROUTE HANDLERS ====================

router.post('/chat', async (req, res) => {
  try {
    let { message, sessionId } = req.body;
    
    // Enhanced input validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        reply: "Please provide a valid message."
      });
    }
    
    // Sanitize inputs
    message = sanitizeInput(message);
    sessionId = sessionId || 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Rate limiting check
    if (isRateLimited(sessionId)) {
      return res.status(429).json({
        success: false,
        reply: "⏳ Please wait a moment before sending another message. For immediate assistance, call " + knowledge.company.contact.phone
      });
    }

    console.log('🤖 AI Agent Processing:', message);
    const userMessage = message.toLowerCase().trim();
    
    // Get or initialize context with enhanced structure
    const context = conversationContexts.get(sessionId) || initializeContext(sessionId);

    // Update interaction tracking
    context.lastInteraction = new Date().toISOString();
    context.interactionCount = (context.interactionCount || 0) + 1;
    context.conversationHistory.push({ 
      user: message, 
      timestamp: new Date().toISOString(),
      type: 'user_input'
    });

    // Keep conversation history manageable
    if (context.conversationHistory.length > 10) {
      context.conversationHistory = context.conversationHistory.slice(-8);
    }

    // Check if user is in the middle of meeting booking - THIS MUST BE FIRST
    const meetingState = meetingStates.get(sessionId);
    if (meetingState && meetingState.step > 0) {
      console.log('🔄 Continuing meeting flow, step:', meetingState.step);
      return await handleMeetingBooking(req, res, sessionId, userMessage, context);
    }

    // ENHANCED: Check for follow-up questions about previous topic
    if (isFollowUpQuestion(userMessage, context)) {
      console.log('🔄 Handling follow-up question about:', context.lastTopic);
      return await handleFollowUpQuestion(req, res, sessionId, message, userMessage, context);
    }

    // Handle specific button clicks
    if (userMessage.includes('calculate cost') || userMessage.includes('cost calculator')) {
      return await handleCostCalculator(res, sessionId, context);
    }

    if (userMessage.includes('get cost estimate') || userMessage.includes('cost estimate')) {
      return await handleCostEstimate(req, res, sessionId, message, context);
    }

    // Handle greetings and natural conversation
    if (isGreeting(userMessage)) {
      return await handleGreeting(req, res, sessionId, userMessage, context);
    }

    // Check if user wants to know about the AI
    if (isAboutQuery(userMessage)) {
      return await handleAboutQuery(res, sessionId, context);
    }

    // Check if user asks about portfolio
    if (isPortfolioQuery(userMessage)) {
      return await handlePortfolioQuery(res, sessionId, context);
    }

    // Check if user asks about services or projects
    if (isServiceQuery(userMessage)) {
      return await handleServiceQuery(res, sessionId, userMessage, context);
    }

    // Check if user asks about costs - UPDATED FLOW
    if (isCostQuery(userMessage)) {
      return await handleCostQuery(req, res, sessionId, message, context);
    }

    // ENHANCED: Check if this is a meeting request - IMPROVED DETECTION
    if (isMeetingRequest(userMessage)) {
      console.log('🎯 Meeting request detected:', userMessage);
      return await handleMeetingBooking(req, res, sessionId, userMessage, context);
    }

    // Enhanced general query handler
    return await handleGeneralQuery(req, res, sessionId, message, userMessage, context);

  } catch (error) {
    console.error('❌ AI Agent Error:', error);
    
    return res.json({ 
      success: true,
      reply: `I'd be happy to help! Please call ${knowledge.company.contact.phone} for immediate assistance.`,
      suggestions: ["Schedule meeting", "Our services", "Cost estimation"]
    });
  }
});

// NEW: Handle follow-up questions with context awareness
async function handleFollowUpQuestion(req, res, sessionId, originalMessage, userMessage, context) {
  const lastTopic = context.lastTopic;
  const lastService = context.lastService;

  console.log('🔍 Follow-up detected. Last topic:', lastTopic, 'Last service:', lastService);

  // If user was asking about a service and now wants cost
  if (lastService && (userMessage.includes('cost') || userMessage.includes('price') || userMessage.includes('estimate') || userMessage.includes('how much'))) {
    console.log('💰 Providing cost for service:', lastService);
    return await provideServiceCostEstimate(res, sessionId, lastService, originalMessage, context);
  }

  // If user was in cost options and now clarifies
  if (lastTopic === 'cost options' && (userMessage.includes('estimate') || userMessage.includes('get cost'))) {
    return await handleCostEstimate(req, res, sessionId, context.lastCostQuery || originalMessage, context);
  }

  if (lastTopic === 'cost options' && (userMessage.includes('calculate') || userMessage.includes('calculator'))) {
    return await handleCostCalculator(res, sessionId, context);
  }

  // If user was selecting cost type and now chooses one
  if (lastTopic === 'cost type selection') {
    return await handleSpecificCostSelection(req, res, sessionId, originalMessage, userMessage, context);
  }

  // If user wants more details about a service
  if (lastService && (userMessage.includes('more') || userMessage.includes('detail') || userMessage.includes('explain'))) {
    return await provideServiceDetails(res, sessionId, lastService, context);
  }

  // Default to general query with enhanced context
  return await handleGeneralQuery(req, res, sessionId, originalMessage, userMessage, context);
}

// UPDATED: Enhanced cost query handler - ASKS FOR SPECIFIC COST TYPE FIRST
async function handleCostQuery(req, res, sessionId, originalMessage, context) {
  const costTypeResponse = `💰 **Construction Cost Estimation**\n\nI'd be happy to provide cost estimates! Which type of construction project are you interested in?`;

  // Update context
  context.lastTopic = 'cost type selection';
  context.lastCostQuery = originalMessage;
  context.state = conversationStates.COST_TYPE_SELECTION;

  const response = formatResponse(
    costTypeResponse,
    ["🏠 Residential", "🏢 Commercial", "🏭 Industrial", "📊 All Costs", "🔗 Cost Calculator"],
    'cost_type_selection',
    null,
    sessionId
  );
  
  logConversation(sessionId, originalMessage, response, context);
  return res.json(response);
}

// NEW: Handle specific cost type selection
async function handleSpecificCostSelection(req, res, sessionId, originalMessage, userMessage, context) {
  let costResponse;
  let selectedType = '';

  if (userMessage.includes('residential') || userMessage.includes('house') || userMessage.includes('home') || userMessage.includes('🏠')) {
    selectedType = 'residential';
    costResponse = `🏠 **Residential Construction Costs**\n\n${knowledge.company.name} current rates for residential projects:\n\n• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}\n• Finished: ${knowledge.constructionCosts.residential.finished}\n• Premium: ${knowledge.constructionCosts.residential.premium}\n\n*Costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*\n\nFor accurate pricing, use our cost calculator or schedule a consultation.`;
  } 
  else if (userMessage.includes('commercial') || userMessage.includes('office') || userMessage.includes('business') || userMessage.includes('🏢')) {
    selectedType = 'commercial';
    costResponse = `🏢 **Commercial Construction Costs**\n\n${knowledge.company.name} current rates for commercial projects:\n\n• Basic: ${knowledge.constructionCosts.commercial.basic}\n• Standard: ${knowledge.constructionCosts.commercial.standard}\n• Premium: ${knowledge.constructionCosts.commercial.premium}\n\n*Costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*\n\nFor accurate pricing, use our cost calculator or schedule a consultation.`;
  }
  else if (userMessage.includes('industrial') || userMessage.includes('factory') || userMessage.includes('warehouse') || userMessage.includes('🏭')) {
    selectedType = 'industrial';
    costResponse = `🏭 **Industrial Construction Costs**\n\n${knowledge.company.name} current rates for industrial projects:\n\n• Basic: ${knowledge.constructionCosts.industrial.basic}\n• Standard: ${knowledge.constructionCosts.industrial.standard}\n• Premium: ${knowledge.constructionCosts.industrial.premium}\n\n*Costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*\n\nFor accurate pricing, use our cost calculator or schedule a consultation.`;
  }
  else if (userMessage.includes('all') || userMessage.includes('overview') || userMessage.includes('📊')) {
    selectedType = 'all';
    costResponse = `💰 **Construction Cost Overview**\n\n${knowledge.company.name} Current Market Rates:\n\n🏠 **Residential:**\n• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}\n• Finished: ${knowledge.constructionCosts.residential.finished}\n• Premium: ${knowledge.constructionCosts.residential.premium}\n\n🏢 **Commercial:**\n• Basic: ${knowledge.constructionCosts.commercial.basic}\n• Standard: ${knowledge.constructionCosts.commercial.standard}\n• Premium: ${knowledge.constructionCosts.commercial.premium}\n\n🏭 **Industrial:**\n• Basic: ${knowledge.constructionCosts.industrial.basic}\n• Standard: ${knowledge.constructionCosts.industrial.standard}\n• Premium: ${knowledge.constructionCosts.industrial.premium}\n\n*All costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*`;
  }
  else if (userMessage.includes('calculator') || userMessage.includes('calculate') || userMessage.includes('🔗')) {
    return await handleCostCalculator(res, sessionId, context);
  }
  else {
    // If user says something else, show the cost type selection again
    return await handleCostQuery(req, res, sessionId, originalMessage, context);
  }

  // Update context
  context.lastTopic = 'cost estimation';
  context.lastService = selectedType;
  context.state = conversationStates.COST_DISCUSSION;

  const response = formatResponse(
    costResponse,
    ["Calculate Cost", "Schedule Consultation", "Get Detailed Quote", "Other Cost Types"],
    'cost_estimation',
    { costType: selectedType },
    sessionId
  );
  
  logConversation(sessionId, originalMessage, response, context);
  return res.json(response);
}

// NEW: Provide cost estimates for specific services
async function provideServiceCostEstimate(res, sessionId, serviceType, originalMessage, context) {
  let costResponse;

  if (serviceType.includes('commercial')) {
    costResponse = `🏢 **Commercial Construction Costs**\n\n${knowledge.company.name} current rates for commercial projects:\n\n• Basic: ${knowledge.constructionCosts.commercial.basic}\n• Standard: ${knowledge.constructionCosts.commercial.standard}\n• Premium: ${knowledge.constructionCosts.commercial.premium}\n\n*Costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*\n\nFor accurate pricing, use our cost calculator or schedule a consultation.`;
  } else if (serviceType.includes('residential')) {
    costResponse = `🏠 **Residential Construction Costs**\n\n${knowledge.company.name} current rates for residential projects:\n\n• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}\n• Finished: ${knowledge.constructionCosts.residential.finished}\n• Premium: ${knowledge.constructionCosts.residential.premium}\n\n*Costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*\n\nFor accurate pricing, use our cost calculator or schedule a consultation.`;
  } else if (serviceType.includes('industrial')) {
    costResponse = `🏭 **Industrial Construction Costs**\n\n${knowledge.company.name} current rates for industrial projects:\n\n• Basic: ${knowledge.constructionCosts.industrial.basic}\n• Standard: ${knowledge.constructionCosts.industrial.standard}\n• Premium: ${knowledge.constructionCosts.industrial.premium}\n\n*Costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*\n\nFor accurate pricing, use our cost calculator or schedule a consultation.`;
  } else {
    // General cost response
    costResponse = getCostFallbackResponse(originalMessage);
  }

  // Update context
  context.lastTopic = 'cost estimation';
  context.lastService = serviceType;
  context.state = conversationStates.COST_DISCUSSION;

  const response = formatResponse(
    costResponse,
    ["Calculate Cost", "Schedule Consultation", "Get Detailed Quote"],
    'cost_estimation',
    { serviceType },
    sessionId
  );
  
  logConversation(sessionId, originalMessage, response, context);
  return res.json(response);
}

// NEW: Provide detailed service information
async function provideServiceDetails(res, sessionId, serviceType, context) {
  const service = knowledge.services.find(s => 
    s.name.toLowerCase().includes(serviceType)
  );

  let detailsResponse;
  if (service) {
    detailsResponse = `🏗️ **${service.name} - Detailed Information**\n\n${service.description}\n\n**Key Features:**\n• Professional project management\n• Quality materials and workmanship\n• Timely completion\n• Compliance with building codes\n\nWe have completed ${getServiceProjectCount(service.name)} ${service.name.toLowerCase()} projects.`;
  } else {
    detailsResponse = `🏗️ **${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} Construction**\n\nWe have extensive experience in ${serviceType} projects with ${getServiceProjectCount(serviceType)} completed.\n\nOur team ensures quality construction with professional project management and timely completion.`;
  }

  const response = formatResponse(
    detailsResponse,
    [`Cost for ${serviceType}`, `Schedule ${serviceType} consultation`, "View similar projects"],
    'service_details',
    { serviceType },
    sessionId
  );
  
  return res.json(response);
}

// Enhanced cost calculator handler
async function handleCostCalculator(res, sessionId, context) {
  const calculatorResponse = `🔗 **Cost Calculator**\n\nFor detailed and accurate cost calculations, I recommend using our online cost calculator.\n\nIt will give you the most accurate estimate for your specific project based on:\n• Project type\n• Area requirements\n• Location factors\n• Quality preferences\n\nGet personalized pricing for your construction project!`;

  // Update context
  context.lastTopic = 'cost calculator';
  context.state = conversationStates.COST_DISCUSSION;

  const response = formatResponse(
    calculatorResponse,
    ["Get Cost Estimate", "Schedule Consultation", "Our Services"],
    'redirect_calculator',
    { redirectUrl: CALCULATOR_URL },
    sessionId
  );
  
  return res.json(response);
}

// Enhanced cost estimate handler (for direct cost estimate requests)
async function handleCostEstimate(req, res, sessionId, originalMessage, context) {
  try {
    const promptConfig = {
      contents: [{
        parts: [{
          text: `${costEstimationPrompt}\n\nUser is asking about construction costs. They asked: "${originalMessage}"\n\nProvide a concise but helpful cost estimate response (3-5 lines max) using the actual cost data above. Focus on providing COST INFORMATION, not portfolio statistics.\n\nResponse:`
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 200,
        topP: 0.8,
        topK: 40
      }
    };

    const costResponse = await callGeminiAPI(
      promptConfig, 
      getCostFallbackResponse(originalMessage)
    );

    // Update context
    context.lastTopic = 'cost estimation';
    context.state = conversationStates.COST_DISCUSSION;

    const response = formatResponse(
      costResponse,
      ["Calculate Cost", "Schedule Consultation", "Get Detailed Quote"],
      'cost_estimation',
      null,
      sessionId
    );
    
    logConversation(sessionId, originalMessage, response, context);
    return res.json(response);

  } catch (error) {
    console.error('❌ Cost Estimation Error:', error);
    
    const fallbackCostResponse = getCostFallbackResponse(originalMessage);
    const response = formatResponse(
      fallbackCostResponse,
      ["Calculate Cost", "Schedule Consultation", "Get Detailed Quote"],
      'cost_estimation_fallback',
      null,
      sessionId
    );
    
    return res.json(response);
  }
}

// Enhanced portfolio handler
async function handlePortfolioQuery(res, sessionId, context) {
  const portfolioResponse = `🏗️ **${knowledge.company.name} Project Portfolio**\n\nWith ${knowledge.company.yearsExperience} of experience, we've successfully delivered:\n\n📊 Project Statistics:\n• ${knowledge.projectPortfolio.totalCompleted} - Total Projects\n• ${knowledge.projectPortfolio.residential} - Residential Projects\n• ${knowledge.projectPortfolio.commercial} - Commercial Projects\n• ${knowledge.projectPortfolio.industrial} - Industrial Projects\n• ${knowledge.projectPortfolio.religious} - Religious Buildings\n• ${knowledge.projectPortfolio.infrastructure} - Infrastructure Projects\n• ${knowledge.projectPortfolio.educational} - Educational Facilities\n• ${knowledge.projectPortfolio.roads} - Road Projects\n\nWant to see specific project types or schedule a consultation?`;

  // Update context
  context.lastTopic = 'portfolio';
  context.state = conversationStates.PORTFOLIO_REVIEW;

  const response = formatResponse(
    portfolioResponse,
    ["Residential projects", "Commercial projects", "Schedule consultation"],
    'portfolio_view',
    null,
    sessionId
  );
  
  return res.json(response);
}

// Enhanced greeting handler
async function handleGreeting(req, res, sessionId, userMessage, context) {
  let reply;
  
  if (context.interactionCount <= 1) {
    reply = `Hello! Welcome to ${knowledge.company.name}. With ${knowledge.company.yearsExperience} of construction experience and ${knowledge.projectPortfolio.totalCompleted} projects completed, how can I assist with your construction project today?`;
  } else {
    const previousTopic = context.lastTopic ? ` regarding ${context.lastTopic}` : '';
    reply = `Hello again! How can I help you today${previousTopic}?`;
  }

  const response = formatResponse(
    reply,
    ["Schedule meeting", "Our services", "Cost estimation"],
    'greeting',
    null,
    sessionId
  );
  
  logConversation(sessionId, userMessage, response, context);
  return res.json(response);
}

// Enhanced about query handler
async function handleAboutQuery(res, sessionId, context) {
  const aboutResponse = `I'm an AI Construction Consultant for ${knowledge.company.name}! 🤖\n\nI help with scheduling meetings, cost estimates, project guidance, and answering construction questions.\n\n${knowledge.company.name} has ${knowledge.company.yearsExperience} of experience with ${knowledge.projectPortfolio.totalCompleted} projects completed.\n\nHow can I assist you today?`;

  const response = formatResponse(
    aboutResponse,
    ["Schedule meeting", "Cost estimation", "Our services"],
    'about_info',
    null,
    sessionId
  );
  
  return res.json(response);
}

// Enhanced service query handler
async function handleServiceQuery(res, sessionId, userMessage, context) {
  let reply;
  let specificService = null;

  // Check for specific service types
  const serviceKeywords = {
    'residential': ['house', 'home', 'residential', 'villa', 'apartment'],
    'commercial': ['commercial', 'office', 'business', 'shop', 'mall'],
    'industrial': ['industrial', 'factory', 'warehouse', 'manufacturing'],
    'religious': ['mosque', 'church', 'temple', 'religious'],
    'infrastructure': ['road', 'bridge', 'infrastructure', 'highway'],
    'educational': ['school', 'college', 'university', 'educational'],
    'healthcare': ['hospital', 'clinic', 'medical', 'healthcare'],
    'sports': ['sports', 'stadium', 'recreational', 'gym'],
    'renovation': ['renovation', 'remodel', 'upgrade', 'renovate'],
    'project management': ['project management', 'project oversight', 'timeline', 'budget']
  };

  // Find if user is asking about a specific service
  for (const [serviceType, keywords] of Object.entries(serviceKeywords)) {
    if (keywords.some(keyword => userMessage.includes(keyword))) {
      specificService = knowledge.services.find(service => 
        service.name.toLowerCase().includes(serviceType)
      );
      break;
    }
  }

  if (specificService) {
    reply = `🏗️ **${specificService.name}**\n${specificService.description}\n\nWe have extensive experience in ${specificService.name.toLowerCase()} with ${getServiceProjectCount(specificService.name)} completed.\n\nWant to know about costs or schedule a consultation for your ${specificService.name.toLowerCase()} project?`;
  } else {
    // General services overview
    const topServices = knowledge.services.slice(0, 5);
    reply = `🏗️ **${knowledge.company.name} Services**\n\nWe offer comprehensive construction services including:\n${topServices.map(service => `• ${service.name}`).join('\n')}\n\nWith ${knowledge.company.yearsExperience} experience and ${knowledge.projectPortfolio.totalCompleted} projects completed.\n\nWhich specific service interests you?`;
  }

  // Update context with service information
  context.lastTopic = 'our services';
  context.lastService = specificService ? specificService.name.toLowerCase() : null;
  context.state = conversationStates.SERVICE_INQUIRY;

  const suggestions = specificService ? 
    [`Cost for ${specificService.name}`, `Schedule ${specificService.name} consultation`, "View portfolio"] :
    ["Residential projects", "Commercial projects", "Industrial projects"];

  const response = formatResponse(
    reply,
    suggestions,
    'service_info',
    { specificService: specificService?.name },
    sessionId
  );
  
  return res.json(response);
}

// Enhanced general query handler with context awareness
async function handleGeneralQuery(req, res, sessionId, message, userMessage, context) {
  // Enhanced context detection
  if (userMessage.includes('build') || userMessage.includes('construct') || userMessage.includes('project')) {
    context.lastTopic = 'construction projects';
    context.state = conversationStates.PROJECT_DETAILS;
  } else if (userMessage.includes('time') || userMessage.includes('duration')) {
    context.lastTopic = 'project timeline';
  } else if (userMessage.includes('material') || userMessage.includes('quality')) {
    context.lastTopic = 'construction materials';
  } else if (userMessage.includes('cost') || userMessage.includes('price') || userMessage.includes('estimate')) {
    context.lastTopic = 'cost estimation';
    context.state = conversationStates.COST_DISCUSSION;
  }

  // Enhanced prompt with conversation context
  const contextPrompt = context.lastTopic ? 
    `Previous conversation was about: ${context.lastTopic}. Current user message: ${message}` : 
    `User message: ${message}`;

  const promptConfig = {
    contents: [{
      parts: [{
        text: `${systemPrompt}\n\nCONVERSATION CONTEXT: ${contextPrompt}\n\nKeep response concise (2-4 lines max). Maintain conversation flow naturally.\n\nAI:`
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 200,
      topP: 0.8,
      topK: 40
    }
  };

  try {
    const aiResponse = await callGeminiAPI(
      promptConfig,
      getSmartFallbackResponse(userMessage, context)
    );

    const response = formatResponse(
      aiResponse,
      getRelevantSuggestions(userMessage, context),
      'general_response',
      null,
      sessionId
    );
    
    logConversation(sessionId, message, response, context);
    return res.json(response);

  } catch (error) {
    console.error('General Query Error:', error);
    
    const fallbackResponse = getSmartFallbackResponse(userMessage, context);
    const response = formatResponse(
      fallbackResponse,
      getRelevantSuggestions(userMessage, context),
      'fallback_response',
      null,
      sessionId
    );
    
    return res.json(response);
  }
}

// ==================== ENHANCED HELPER FUNCTIONS ====================

// Enhanced helper functions with better detection
function isGreeting(message) {
  const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'hola', 'salam'];
  return greetings.some(greeting => message.includes(greeting));
}

function isAboutQuery(message) {
  const aboutKeywords = ['who are you', 'what are you', 'tell me about you', 'about yourself', 'your role', 'what do you do'];
  return aboutKeywords.some(keyword => message.includes(keyword));
}

function isPortfolioQuery(message) {
  const portfolioKeywords = ['portfolio', 'projects', 'work', 'completed projects', 'experience', 'statistics', 'completed work'];
  const costWords = ['cost', 'price', 'estimate', 'budget', 'how much'];
  const hasCostWords = costWords.some(word => message.includes(word));
  
  return portfolioKeywords.some(keyword => message.includes(keyword)) && !hasCostWords;
}

function isServiceQuery(message) {
  const serviceKeywords = ['service', 'services', 'what do you do', 'offer', 'provide', 'build', 'construct', 'develop'];
  return serviceKeywords.some(keyword => message.includes(keyword));
}

function isCostQuery(message) {
  const costKeywords = ['cost', 'price', 'how much', 'estimate', 'budget', 'pricing', 'rate', 'charges', 'quotation', 'investment'];
  
  const projectCostPatterns = [
    'industrial.*cost', 'residential.*cost', 'commercial.*cost',
    'industrial.*price', 'residential.*price', 'commercial.*price',
    'industrial.*estimate', 'residential.*estimate', 'commercial.*estimate',
    'how much.*industrial', 'how much.*residential', 'how much.*commercial',
    'what.*cost.*industrial', 'what.*price.*residential', 'how much to build'
  ];
  
  const hasCostKeywords = costKeywords.some(keyword => message.includes(keyword));
  const hasProjectCostPattern = projectCostPatterns.some(pattern => 
    new RegExp(pattern).test(message)
  );
  
  return hasCostKeywords || hasProjectCostPattern;
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function getServiceProjectCount(serviceName) {
  const serviceMap = {
    'residential construction': knowledge.projectPortfolio.residential,
    'commercial construction': knowledge.projectPortfolio.commercial,
    'industrial construction': knowledge.projectPortfolio.industrial,
    'religious buildings': knowledge.projectPortfolio.religious,
    'roads & infrastructure': `${knowledge.projectPortfolio.infrastructure} infrastructure & ${knowledge.projectPortfolio.roads} roads`,
    'educational facilities': knowledge.projectPortfolio.educational
  };
  
  const key = serviceName.toLowerCase();
  return serviceMap[key] || knowledge.projectPortfolio.totalCompleted + ' total';
}

function getCostFallbackResponse(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('industrial') || lowerMessage.includes('factory') || lowerMessage.includes('warehouse')) {
    return `🏭 **Industrial Construction Costs**\n\n${knowledge.company.name} current rates for industrial projects:\n\n• Basic: ${knowledge.constructionCosts.industrial.basic}\n• Standard: ${knowledge.constructionCosts.industrial.standard}\n• Premium: ${knowledge.constructionCosts.industrial.premium}\n\n*Costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*\n\nFor accurate pricing, use our cost calculator or schedule a consultation.`;
  }
  
  if (lowerMessage.includes('residential') || lowerMessage.includes('house') || lowerMessage.includes('home')) {
    return `🏠 **Residential Construction Costs**\n\n${knowledge.company.name} current rates for residential projects:\n\n• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}\n• Finished: ${knowledge.constructionCosts.residential.finished}\n• Premium: ${knowledge.constructionCosts.residential.premium}\n\n*Costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*\n\nFor accurate pricing, use our cost calculator or schedule a consultation.`;
  }
  
  if (lowerMessage.includes('commercial') || lowerMessage.includes('office') || lowerMessage.includes('business')) {
    return `🏢 **Commercial Construction Costs**\n\n${knowledge.company.name} current rates for commercial projects:\n\n• Basic: ${knowledge.constructionCosts.commercial.basic}\n• Standard: ${knowledge.constructionCosts.commercial.standard}\n• Premium: ${knowledge.constructionCosts.commercial.premium}\n\n*Costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*\n\nFor accurate pricing, use our cost calculator or schedule a consultation.`;
  }
  
  return `💰 **Construction Cost Overview**\n\n${knowledge.company.name} Current Rates:\n\n🏠 Residential: ${knowledge.constructionCosts.residential.greyStructure} (Grey Structure)\n🏢 Commercial: ${knowledge.constructionCosts.commercial.basic} (Basic)\n🏭 Industrial: ${knowledge.constructionCosts.industrial.basic} (Basic)\n\n*Costs depend on: ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}*\n\nFor precise calculations, use our cost calculator or schedule a consultation.`;
}

function getSmartFallbackResponse(userMessage, context) {
  // Use context to provide better fallback responses
  if (context.lastTopic === 'our services' && (userMessage.includes('cost') || userMessage.includes('price'))) {
    return `I'd be happy to provide cost estimates for ${context.lastService || 'that service'}! Would you like me to give you current market rates or use our cost calculator for precise estimates?`;
  }
  
  if (userMessage.includes('cost') || userMessage.includes('price') || userMessage.includes('estimate')) {
    return `I can help with construction costs! You can use our cost calculator for precise estimates or I can provide general market rates. Which would you prefer?`;
  }
  
  if (userMessage.includes('project') || userMessage.includes('build')) {
    return `${knowledge.company.name} handles residential, commercial, and industrial projects. ${knowledge.projectPortfolio.totalCompleted} projects completed. Tell me about your project!`;
  }
  
  if (userMessage.includes('service')) {
    return `We offer construction services for residential, commercial, industrial, and specialized projects. Which type interests you?`;
  }
  
  if (userMessage.includes('portfolio')) {
    return `We've completed ${knowledge.projectPortfolio.totalCompleted} projects. Want to see specific types or schedule a consultation?`;
  }

  if (context.lastTopic) {
    return `Regarding ${context.lastTopic}, would you like more details or should I help with something else?`;
  }

  return `I can help with construction projects, cost estimates, and scheduling meetings. What do you need?`;
}

function getRelevantSuggestions(userMessage, context) {
  if (userMessage.includes('meeting') || userMessage.includes('schedule')) {
    return [];
  }

  // Context-aware suggestions
  if (context.lastTopic === 'our services' && context.lastService) {
    return [`Cost for ${context.lastService}`, `Schedule ${context.lastService} consultation`, "View portfolio"];
  }
  
  if (context.lastTopic === 'cost estimation') {
    return ["Calculate Cost", "Schedule Consultation", "Get Detailed Quote", "Other Cost Types"];
  }
  
  if (userMessage.includes('cost') || userMessage.includes('price')) {
    return ["🏠 Residential Cost", "🏢 Commercial Cost", "🏭 Industrial Cost", "🔗 Cost Calculator"];
  }
  
  if (userMessage.includes('portfolio') || userMessage.includes('work')) {
    return ["Residential projects", "Commercial projects", "Schedule consultation"];
  }
  
  if (userMessage.includes('residential') || userMessage.includes('house')) {
    return ["House construction cost", "Schedule consultation", "View portfolio"];
  }
  
  if (userMessage.includes('commercial') || userMessage.includes('business')) {
    return ["Commercial project cost", "Schedule consultation", "View portfolio"];
  }
  
  if (userMessage.includes('service')) {
    return ["Residential projects", "Commercial projects", "Cost estimation"];
  }
  
  return ["Schedule meeting", "Our services", "Cost estimation"];
}

// ==================== COMPLETE MEETING HANDLER ====================

async function handleMeetingBooking(req, res, sessionId, userMessage, context) {
  let meetingState = meetingStates.get(sessionId) || {
    step: 0,
    data: {},
    createdAt: new Date().toISOString()
  };

  console.log('📅 Meeting State - Step:', meetingState.step, 'Message:', userMessage);

  // Update context
  context.lastTopic = 'meeting booking';
  context.state = conversationStates.MEETING_BOOKING;

  // Step 0: Start meeting booking
  if (meetingState.step === 0) {
    meetingState.step = 1;
    meetingStates.set(sessionId, meetingState);
    
    return res.json(formatResponse(
      `I'd be happy to schedule a meeting with our construction experts at ${knowledge.company.name}! What's your name?`,
      [],
      'get_name',
      null,
      sessionId
    ));
  }

  // Step 1: Get name - FIXED: Use the actual message from request body
  if (meetingState.step === 1) {
    // Use req.body.message instead of userMessage (which is lowercase)
    const userName = req.body.message.trim();
    meetingState.data.name = userName;
    meetingState.step = 2;
    meetingStates.set(sessionId, meetingState);
    
    return res.json(formatResponse(
      `Nice to meet you, ${userName}! What's your email address for the meeting confirmation?`,
      [],
      'get_email',
      null,
      sessionId
    ));
  }

  // Step 2: Get email - FIXED: Use the actual message from request body
  if (meetingState.step === 2) {
    const userEmail = req.body.message.trim();
    
    if (!isValidEmail(userEmail)) {
      return res.json(formatResponse(
        "Please provide a valid email address (e.g., name@example.com)",
        ["Try again", "Call instead"],
        'get_email',
        null,
        sessionId
      ));
    }

    meetingState.data.email = userEmail;
    meetingState.step = 3;
    meetingStates.set(sessionId, meetingState);
    
    return res.json(formatResponse(
      "Great! What type of project are you planning?",
      ["Residential", "Commercial", "Industrial", "General Consultation"],
      'get_project_type',
      null,
      sessionId
    ));
  }

  // Step 3: Get project type - FIXED: Use the actual message from request body
  if (meetingState.step === 3) {
    const projectType = req.body.message.trim();
    meetingState.data.projectType = projectType;
    meetingState.step = 4;
    meetingStates.set(sessionId, meetingState);

    // Generate available dates
    const availableDates = calendarService.generateAvailableDates();
    
    const dateSuggestions = availableDates.map(date => date.display);
    
    return res.json(formatResponse(
      `Perfect! For your ${projectType} project, which date works best for you?`,
      dateSuggestions,
      'get_date',
      { availableDates },
      sessionId
    ));
  }

  // Step 4: Get date - FIXED: Use the actual message from request body
  if (meetingState.step === 4) {
    const selectedDate = req.body.message.trim();
    meetingState.data.date = selectedDate;
    meetingState.step = 5;
    meetingStates.set(sessionId, meetingState);

    // Generate available times
    const availableTimes = calendarService.generateAvailableTimes();
    const timeSuggestions = availableTimes.map(time => time.display);
    
    return res.json(formatResponse(
      "Great choice! What time works best for you?",
      timeSuggestions,
      'get_time',
      { availableTimes },
      sessionId
    ));
  }

  // Step 5: Get time and confirm booking - FIXED: Use the actual message from request body
  if (meetingState.step === 5) {
    const selectedTime = req.body.message.trim();
    meetingState.data.time = selectedTime;
    
    // Generate meeting ID
    meetingState.data.id = 'MTG_' + Date.now();
    meetingState.data.timestamp = new Date().toISOString();

    // Show confirmation before sending email
    meetingState.step = 6;
    meetingStates.set(sessionId, meetingState);

    return res.json(formatResponse(
      `📅 **Meeting Confirmed!**\n\nHere are your meeting details:\n\n• **Name:** ${meetingState.data.name}\n• **Email:** ${meetingState.data.email}\n• **Date:** ${meetingState.data.date}\n• **Time:** ${meetingState.data.time}\n• **Project:** ${meetingState.data.projectType}\n• **Meeting ID:** ${meetingState.data.id}\n\nShall I send the confirmation email to ${meetingState.data.email}?`,
      ["Yes, send confirmation", "No, cancel meeting"],
      'confirm_email_sending',
      { meeting: meetingState.data },
      sessionId
    ));
  }

  // Step 6: Send confirmation emails USING RESEND
  if (meetingState.step === 6) {
    const userResponse = userMessage.toLowerCase();
    
    if (userResponse.includes('yes') || userResponse.includes('send') || userResponse.includes('confirm')) {
      try {
        console.log('📧 Attempting to send confirmation email via Resend...');
        
        const emailResult = await resendEmailService.sendMeetingConfirmation(meetingState.data);
        
        if (emailResult.success) {
          console.log('✅ Resend email sent successfully!');
          console.log('   Client Message ID:', emailResult.clientMessageId);
          console.log('   Company Message ID:', emailResult.companyMessageId);
          
          meetingStates.delete(sessionId);
          
          return res.json(formatResponse(
            `✅ **Meeting Successfully Booked!**\n\nWe've sent a confirmation email to ${meetingState.data.email}. Our team will contact you shortly.\n\nMeeting ID: ${meetingState.data.id}`,
            ["Schedule another meeting", "View our services", "Get cost estimate"],
            'meeting_completed',
            { 
              meetingId: meetingState.data.id, 
              emailSent: true,
              messageIds: {
                client: emailResult.clientMessageId,
                company: emailResult.companyMessageId
              }
            },
            sessionId
          ));
        } else {
          console.log('⚠️ Resend email failed:', emailResult.error);
          meetingStates.delete(sessionId);
          
          return res.json(formatResponse(
            `✅ **Meeting Booked!**\n\nYour meeting has been scheduled for ${meetingState.data.date} at ${meetingState.data.time}. \n\nMeeting ID: ${meetingState.data.id}\n\nOur team will contact you to confirm.`,
            ["Schedule another meeting", "View our services", "Get cost estimate"],
            'meeting_completed_fallback',
            { meetingId: meetingState.data.id, emailSent: false },
            sessionId
          ));
        }
      } catch (error) {
        console.error('❌ Email process error:', error);
        meetingStates.delete(sessionId);
        
        return res.json(formatResponse(
          `✅ **Meeting Booked!**\n\nYour meeting has been scheduled. Our team will contact you shortly.\n\nMeeting ID: ${meetingState.data.id}`,
          ["Schedule another meeting", "View our services", "Get cost estimate"],
          'meeting_completed_fallback',
          { meetingId: meetingState.data.id, emailSent: false },
          sessionId
        ));
      }
    } else {
      // User canceled
      meetingStates.delete(sessionId);
      return res.json(formatResponse(
        "Meeting booking canceled.",
        ["Schedule meeting", "Our services", "Cost estimation"],
        'meeting_canceled',
        null,
        sessionId
      ));
    }
  }
}


// ==================== CLEANUP AND MAINTENANCE ====================

// Session cleanup interval (runs every hour)
setInterval(() => {
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  let cleanedCount = 0;
  for (const [sessionId, context] of conversationContexts.entries()) {
    if (now - new Date(context.lastInteraction).getTime() > twentyFourHours) {
      conversationContexts.delete(sessionId);
      cleanedCount++;
    }
  }
  
  // Clean up old meeting states
  for (const [sessionId, meetingState] of meetingStates.entries()) {
    if (now - new Date(meetingState.createdAt || now).getTime() > twentyFourHours) {
      meetingStates.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} old sessions`);
  }
}, 60 * 60 * 1000); // Run every hour

// Clear meeting state endpoint
router.post('/clear-meeting', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && meetingStates.has(sessionId)) {
    meetingStates.delete(sessionId);
    console.log('🧹 Cleared meeting state for session:', sessionId);
  }
  res.json({ success: true });
});

// Clear conversation context endpoint
router.post('/clear-context', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && conversationContexts.has(sessionId)) {
    conversationContexts.delete(sessionId);
    console.log('🧹 Cleared conversation context for session:', sessionId);
  }
  res.json({ success: true });
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    activeSessions: conversationContexts.size,
    activeMeetings: meetingStates.size,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Get conversation stats
router.get('/stats', (req, res) => {
  res.json({
    totalSessions: conversationContexts.size,
    totalMeetings: meetingStates.size,
    rateLimitStats: Object.fromEntries(requestCounts.entries()),
    serverTime: new Date().toISOString()
  });
});

module.exports = router;