const express = require('express');
const axios = require('axios');
const router = express.Router();
const knowledge = require('../data/knowledge.json');

// Import services
const resendEmailService = require('../services/resendEmailService');
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

// AI Agent Personality Configuration
const AGENT_PERSONALITY = {
  name: "Meezan AI Consultant",
  tone: "professional yet friendly",
  expertise: "construction and project planning",
  traits: ["helpful", "knowledgeable", "efficient", "personable"]
};

// AI Agent Response Styles
const RESPONSE_STYLES = {
  greeting: [
    "Hello! I'm your AI construction consultant at Meezan Developers. With our {yearsExperience} of experience and {totalCompleted} projects completed, I'm here to help bring your construction vision to life! What project are you thinking about?",
    "Welcome to Meezan Developers! I'm your AI construction specialist. We've successfully delivered {totalCompleted} projects over {yearsExperience}. How can I assist with your construction plans today?",
    "Hi there! I'm the AI consultant for Meezan Developers. We combine {yearsExperience} of construction expertise with modern technology to help clients like you. What construction project are you considering?"
  ],
  meeting_start: [
    "I'd be delighted to schedule a consultation with our construction experts! Let's find the perfect time to discuss your project. First, what should I call you?",
    "Excellent! Our construction specialists would love to learn about your project. Let's get you booked in. May I have your name to get started?",
    "Perfect timing! I can arrange a meeting with our team who have handled {totalCompleted} projects. To personalize your consultation, what's your name?"
  ],
  project_type: [
    "That's exciting! {name}, what type of construction project are you planning? Residential, commercial, or perhaps something else?",
    "Great! To connect you with the right experts, {name}, could you tell me what kind of project you have in mind?",
    "Wonderful, {name}! Our team specializes in various project types. Are you thinking residential, commercial, industrial, or another type of construction?"
  ],
  date_selection: [
    "I've checked our specialists' calendar for 2025. For your {projectType} project, here are the available consultation slots. Which works best for your schedule?",
    "Our construction experts have availability in November 2025. For your {projectType} project, which of these dates fits your timeline?",
    "I found some great slots with our {projectType} specialists in late 2025. When would you prefer to meet and discuss your project in detail?"
  ],
  date_confirmation: [
    "Excellent choice! Now, what time on {date} works best for your {projectType} consultation?",
    "Great! I have several time slots available on {date} for your {projectType} project. Which time suits you?",
    "Perfect! Let's pick a time on {date} for your {projectType} discussion. What works for your schedule?"
  ]
};

// Enhanced system prompt for AI Agent with personality
const systemPrompt = `You are an AI Construction Consultant Agent for Meezan Developers. You have a professional yet friendly personality.

PERSONALITY TRAITS:
- Helpful and knowledgeable about construction
- Efficient but personable
- Proactive in offering solutions
- Maintains natural conversation flow
- Shows genuine interest in client projects

COMPANY EXPERTISE:
- ${knowledge.company.yearsExperience} years in construction industry
- ${knowledge.projectPortfolio.totalCompleted} projects completed
- Specialized in residential, commercial, and industrial construction
- Team of ${knowledge.company.stats.teamMembers} construction experts

RESPONSE GUIDELINES:
- Sound like a knowledgeable construction professional, not a robot
- Use natural, conversational language
- Show enthusiasm for construction projects
- Provide specific, actionable advice
- Maintain context throughout conversation
- Be concise but warm and engaging
- Use construction industry terminology appropriately
- Offer proactive suggestions based on project type

IMPORTANT: When discussing meetings, make it feel like you're personally arranging the consultation with our team, not just processing a form.`;

// Special prompt for cost estimation with personality
const costEstimationPrompt = `You are a construction cost expert at Meezan Developers with ${knowledge.company.yearsExperience} of industry experience. Provide helpful, accurate cost guidance.

CONSTRUCTION COST EXPERTISE:
- Deep knowledge of Pakistan construction market
- Understanding of material costs and labor rates
- Experience with ${knowledge.projectPortfolio.totalCompleted} projects
- Knowledge of quality standards and building codes

RESPONSE STYLE:
- Sound like a seasoned construction professional
- Provide realistic, practical cost advice
- Explain factors that affect pricing
- Offer guidance on budget planning
- Be transparent about cost variables

Always position yourself as Meezan Developers' construction expert, not just an AI.`;

// ==================== AI AGENT HELPER FUNCTIONS ====================

// Natural response generator
function generateNaturalResponse(type, variables = {}) {
  const templates = RESPONSE_STYLES[type] || [variables.default || "I'd be happy to help with that!"];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // Replace variables in template
  return template.replace(/{(\w+)}/g, (match, key) => {
    return variables[key] || knowledge[key] || match;
  });
}

// Intelligent input sanitization
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
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

// Enhanced Gemini API caller with personality
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

// Initialize AI Agent context
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
    createdAt: new Date().toISOString(),
    clientName: null // Track client name for personalization
  };
  
  conversationContexts.set(sessionId, context);
  return context;
}

// AI Agent conversation logging
function logConversation(sessionId, userMessage, response, context) {
  console.log('🤖 AI Agent Conversation:', {
    sessionId: sessionId.substring(0, 12) + '...',
    userMessage: userMessage.substring(0, 80) + (userMessage.length > 80 ? '...' : ''),
    responseType: response.action || 'general',
    context: {
      lastTopic: context.lastTopic,
      state: context.state,
      interactionCount: context.interactionCount,
      clientName: context.clientName
    },
    timestamp: new Date().toISOString()
  });
}

// Enhanced response formatter for AI Agent
function formatResponse(reply, suggestions = [], action = null, details = null, sessionId = null) {
  const response = {
    success: true,
    reply,
    suggestions,
    timestamp: new Date().toISOString(),
    agent: AGENT_PERSONALITY.name
  };
  
  if (action) response.action = action;
  if (details) response.details = details;
  if (sessionId) response.sessionId = sessionId;
  
  return response;
}

// Intelligent follow-up detection
function isFollowUpQuestion(userMessage, context) {
  if (!context.lastTopic || context.interactionCount < 2) return false;

  const followUpIndicators = [
    'more about', 'tell me', 'explain', 'what about', 'how about',
    'can you', 'could you', 'actually', 'specifically',
    'regarding', 'concerning', 'related to', 'building on'
  ];

  const isFollowUp = followUpIndicators.some(indicator => 
    userMessage.includes(indicator)
  );

  // Consider context and conversation flow
  const hasContext = context.lastTopic && context.interactionCount > 1;
  const isEngaged = userMessage.split(' ').length > 3;
  
  return isFollowUp || (hasContext && isEngaged);
}

// Natural meeting request detection
function isMeetingRequest(userMessage) {
  const meetingKeywords = [
    'meeting', 'schedule', 'appointment', 'consultation', 
    'discuss my project', 'talk to expert', 'meet with team',
    'book a consultation', 'arrange meeting', 'set up call',
    'project discussion', 'construction meeting', 'site visit',
    'planning session', 'design consultation'
  ];

  return meetingKeywords.some(keyword => userMessage.includes(keyword));
}

// ==================== AI AGENT ROUTE HANDLERS ====================

router.post('/chat', async (req, res) => {
  try {
    let { message, sessionId } = req.body;
    
    // Enhanced input validation with natural response
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        reply: "I'd love to help! Could you please tell me what you're looking for regarding your construction project?"
      });
    }
    
    // Sanitize inputs
    message = sanitizeInput(message);
    sessionId = sessionId || 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Rate limiting check
    if (isRateLimited(sessionId)) {
      return res.status(429).json({
        success: false,
        reply: "I'm helping several clients right now. Please give me a moment, or feel free to call our team directly at " + knowledge.company.contact.phone + " for immediate assistance."
      });
    }

    console.log('🤖 AI Agent Processing:', message);
    const userMessage = message.toLowerCase().trim();
    
    // Get or initialize context with AI Agent structure
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

    // Check if user is in the middle of meeting booking
    const meetingState = meetingStates.get(sessionId);
    if (meetingState && meetingState.step > 0) {
      console.log('🤖 AI Agent continuing meeting flow, step:', meetingState.step);
      return await handleMeetingBooking(req, res, sessionId, userMessage, context);
    }

    // Intelligent follow-up question handling
    if (isFollowUpQuestion(userMessage, context)) {
      console.log('🤖 AI Agent handling follow-up about:', context.lastTopic);
      return await handleFollowUpQuestion(req, res, sessionId, message, userMessage, context);
    }

    // Handle specific intents with natural responses
    if (userMessage.includes('calculate cost') || userMessage.includes('cost calculator')) {
      return await handleCostCalculator(res, sessionId, context);
    }

    if (userMessage.includes('get cost estimate') || userMessage.includes('cost estimate')) {
      return await handleCostEstimate(req, res, sessionId, message, context);
    }

    // Natural greeting handling
    if (isGreeting(userMessage)) {
      return await handleGreeting(req, res, sessionId, userMessage, context);
    }

    // AI Agent self-awareness
    if (isAboutQuery(userMessage)) {
      return await handleAboutQuery(res, sessionId, context);
    }

    // Portfolio with context
    if (isPortfolioQuery(userMessage)) {
      return await handlePortfolioQuery(res, sessionId, context);
    }

    // Service inquiries with expertise
    if (isServiceQuery(userMessage)) {
      return await handleServiceQuery(res, sessionId, userMessage, context);
    }

    // Cost discussions with professional insight
    if (isCostQuery(userMessage)) {
      return await handleCostQuery(req, res, sessionId, message, context);
    }

    // Natural meeting request handling
    if (isMeetingRequest(userMessage)) {
      console.log('🤖 AI Agent detected meeting request:', userMessage);
      return await handleMeetingBooking(req, res, sessionId, userMessage, context);
    }

    // Intelligent general query handler
    return await handleGeneralQuery(req, res, sessionId, message, userMessage, context);

  } catch (error) {
    console.error('❌ AI Agent Error:', error);
    
    return res.json({ 
      success: true,
      reply: `I'd be delighted to help with your construction project! For detailed assistance, you can also reach our construction team at ${knowledge.company.contact.phone}.`,
      suggestions: ["Schedule consultation", "Our construction services", "Cost estimation"],
      agent: AGENT_PERSONALITY.name
    });
  }
});

// AI Agent follow-up handler
async function handleFollowUpQuestion(req, res, sessionId, originalMessage, userMessage, context) {
  const lastTopic = context.lastTopic;
  const lastService = context.lastService;

  console.log('🤖 AI Agent follow-up detected:', lastTopic, lastService);

  // If user was asking about a service and now wants cost
  if (lastService && (userMessage.includes('cost') || userMessage.includes('price') || userMessage.includes('estimate') || userMessage.includes('how much'))) {
    console.log('🤖 AI Agent providing cost for service:', lastService);
    return await provideServiceCostEstimate(res, sessionId, lastService, originalMessage, context);
  }

  // Enhanced context handling
  if (lastTopic === 'cost options' && (userMessage.includes('estimate') || userMessage.includes('get cost'))) {
    return await handleCostEstimate(req, res, sessionId, context.lastCostQuery || originalMessage, context);
  }

  if (lastTopic === 'cost options' && (userMessage.includes('calculate') || userMessage.includes('calculator'))) {
    return await handleCostCalculator(res, sessionId, context);
  }

  // Intelligent cost type selection
  if (lastTopic === 'cost type selection') {
    return await handleSpecificCostSelection(req, res, sessionId, originalMessage, userMessage, context);
  }

  // Service details with expertise
  if (lastService && (userMessage.includes('more') || userMessage.includes('detail') || userMessage.includes('explain'))) {
    return await provideServiceDetails(res, sessionId, lastService, context);
  }

  // Default to intelligent general query
  return await handleGeneralQuery(req, res, sessionId, originalMessage, userMessage, context);
}

// AI Agent cost query handler
async function handleCostQuery(req, res, sessionId, originalMessage, context) {
  const costTypeResponse = `As a construction cost specialist, I'd be happy to provide detailed estimates! Which type of project are you considering?`;

  // Update context
  context.lastTopic = 'cost type selection';
  context.lastCostQuery = originalMessage;
  context.state = conversationStates.COST_TYPE_SELECTION;

  const response = formatResponse(
    costTypeResponse,
    ["🏠 Residential Project", "🏢 Commercial Building", "🏭 Industrial Facility", "📊 All Cost Types", "🔗 Detailed Calculator"],
    'cost_type_selection',
    null,
    sessionId
  );
  
  logConversation(sessionId, originalMessage, response, context);
  return res.json(response);
}

// AI Agent cost type selection
async function handleSpecificCostSelection(req, res, sessionId, originalMessage, userMessage, context) {
  let costResponse;
  let selectedType = '';

  if (userMessage.includes('residential') || userMessage.includes('house') || userMessage.includes('home') || userMessage.includes('🏠')) {
    selectedType = 'residential';
    costResponse = `🏠 **Residential Construction Expertise**\n\nBased on our ${knowledge.projectPortfolio.residential} residential projects, here are current market rates:\n\n• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}\n• Finished: ${knowledge.constructionCosts.residential.finished}\n• Premium: ${knowledge.constructionCosts.residential.premium}\n\n*Costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*\n\nI recommend a consultation for precise pricing tailored to your specific needs.`;
  } 
  else if (userMessage.includes('commercial') || userMessage.includes('office') || userMessage.includes('business') || userMessage.includes('🏢')) {
    selectedType = 'commercial';
    costResponse = `🏢 **Commercial Construction Insights**\n\nWith ${knowledge.projectPortfolio.commercial} commercial projects completed, our current rates are:\n\n• Basic: ${knowledge.constructionCosts.commercial.basic}\n• Standard: ${knowledge.constructionCosts.commercial.standard}\n• Premium: ${knowledge.constructionCosts.commercial.premium}\n\n*Commercial projects require careful planning. ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()} significantly impact final costs.*`;
  }
  else if (userMessage.includes('industrial') || userMessage.includes('factory') || userMessage.includes('warehouse') || userMessage.includes('🏭')) {
    selectedType = 'industrial';
    costResponse = `🏭 **Industrial Construction Specialization**\n\nOur ${knowledge.projectPortfolio.industrial} industrial projects inform these current rates:\n\n• Basic: ${knowledge.constructionCosts.industrial.basic}\n• Standard: ${knowledge.constructionCosts.industrial.standard}\n• Premium: ${knowledge.constructionCosts.industrial.premium}\n\n*Industrial construction involves specialized considerations. ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()} are crucial factors.*`;
  }
  else if (userMessage.includes('all') || userMessage.includes('overview') || userMessage.includes('📊')) {
    selectedType = 'all';
    costResponse = `💰 **Construction Cost Overview**\n\nBased on our ${knowledge.projectPortfolio.totalCompleted} projects, here's a comprehensive cost overview:\n\n🏠 **Residential Expertise:**\n• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}\n• Finished: ${knowledge.constructionCosts.residential.finished}\n• Premium: ${knowledge.constructionCosts.residential.premium}\n\n🏢 **Commercial Experience:**\n• Basic: ${knowledge.constructionCosts.commercial.basic}\n• Standard: ${knowledge.constructionCosts.commercial.standard}\n• Premium: ${knowledge.constructionCosts.commercial.premium}\n\n🏭 **Industrial Specialization:**\n• Basic: ${knowledge.constructionCosts.industrial.basic}\n• Standard: ${knowledge.constructionCosts.industrial.standard}\n• Premium: ${knowledge.constructionCosts.industrial.premium}\n\n*Each project is unique. I recommend discussing your specific requirements with our team.*`;
  }
  else if (userMessage.includes('calculator') || userMessage.includes('calculate') || userMessage.includes('🔗')) {
    return await handleCostCalculator(res, sessionId, context);
  }
  else {
    // Natural redirection
    return await handleCostQuery(req, res, sessionId, originalMessage, context);
  }

  // Update context
  context.lastTopic = 'cost estimation';
  context.lastService = selectedType;
  context.state = conversationStates.COST_DISCUSSION;

  const response = formatResponse(
    costResponse,
    ["Get Detailed Calculation", "Schedule Expert Consultation", "Discuss Project Specifics"],
    'cost_estimation',
    { costType: selectedType },
    sessionId
  );
  
  logConversation(sessionId, originalMessage, response, context);
  return res.json(response);
}

// AI Agent service cost estimates
async function provideServiceCostEstimate(res, sessionId, serviceType, originalMessage, context) {
  let costResponse;

  if (serviceType.includes('commercial')) {
    costResponse = `🏢 **Commercial Construction Expertise**\n\nOur team has delivered ${knowledge.projectPortfolio.commercial} commercial projects. Current market rates:\n\n• Basic: ${knowledge.constructionCosts.commercial.basic}\n• Standard: ${knowledge.constructionCosts.commercial.standard}\n• Premium: ${knowledge.constructionCosts.commercial.premium}\n\n*Commercial projects require specialized planning. ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()} significantly impact budgets.*`;
  } else if (serviceType.includes('residential')) {
    costResponse = `🏠 **Residential Construction Experience**\n\nWith ${knowledge.projectPortfolio.residential} residential projects completed:\n\n• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}\n• Finished: ${knowledge.constructionCosts.residential.finished}\n• Premium: ${knowledge.constructionCosts.residential.premium}\n\n*Residential costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*`;
  } else if (serviceType.includes('industrial')) {
    costResponse = `🏭 **Industrial Construction Specialization**\n\nOur ${knowledge.projectPortfolio.industrial} industrial projects inform these rates:\n\n• Basic: ${knowledge.constructionCosts.industrial.basic}\n• Standard: ${knowledge.constructionCosts.industrial.standard}\n• Premium: ${knowledge.constructionCosts.industrial.premium}\n\n*Industrial projects have unique requirements affecting costs.*`;
  } else {
    costResponse = getCostFallbackResponse(originalMessage);
  }

  // Update context
  context.lastTopic = 'cost estimation';
  context.lastService = serviceType;
  context.state = conversationStates.COST_DISCUSSION;

  const response = formatResponse(
    costResponse,
    ["Detailed Cost Analysis", "Expert Consultation", "Project Planning"],
    'cost_estimation',
    { serviceType },
    sessionId
  );
  
  logConversation(sessionId, originalMessage, response, context);
  return res.json(response);
}

// AI Agent service details
async function provideServiceDetails(res, sessionId, serviceType, context) {
  const service = knowledge.services.find(s => 
    s.name.toLowerCase().includes(serviceType)
  );

  let detailsResponse;
  if (service) {
    detailsResponse = `🏗️ **${service.name} - Our Expertise**\n\n${service.description}\n\n**Why Choose Meezan Developers:**\n• ${knowledge.projectPortfolio.totalCompleted} projects of experience\n• Professional project management\n• Quality materials and craftsmanship\n• Timely completion track record\n\nWe've successfully completed ${getServiceProjectCount(service.name)} ${service.name.toLowerCase()} projects.`;
  } else {
    detailsResponse = `🏗️ **${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} Construction**\n\nOur team has extensive experience in ${serviceType} construction with ${getServiceProjectCount(serviceType)} completed projects.\n\nWe ensure quality construction with professional project management and proven results.`;
  }

  const response = formatResponse(
    detailsResponse,
    [`Cost Analysis for ${serviceType}`, `Schedule ${serviceType} Consultation`, "View Similar Projects"],
    'service_details',
    { serviceType },
    sessionId
  );
  
  return res.json(response);
}

// AI Agent cost calculator
async function handleCostCalculator(res, sessionId, context) {
  const calculatorResponse = `🔗 **Detailed Cost Calculator**\n\nFor precise construction cost calculations, I recommend our specialized cost calculator.\n\nIt provides accurate estimates based on:\n• Specific project requirements\n• Local material costs\n• Construction methodology\n• Quality specifications\n\nThis tool incorporates our ${knowledge.projectPortfolio.totalCompleted} projects of experience for reliable pricing.`;

  // Update context
  context.lastTopic = 'cost calculator';
  context.state = conversationStates.COST_DISCUSSION;

  const response = formatResponse(
    calculatorResponse,
    ["Get Custom Estimate", "Expert Consultation", "Our Construction Services"],
    'redirect_calculator',
    { redirectUrl: CALCULATOR_URL },
    sessionId
  );
  
  return res.json(response);
}

// AI Agent cost estimate handler
async function handleCostEstimate(req, res, sessionId, originalMessage, context) {
  try {
    const promptConfig = {
      contents: [{
        parts: [{
          text: `${costEstimationPrompt}\n\nClient is asking about construction costs: "${originalMessage}"\n\nProvide a professional, helpful cost estimate response (3-5 lines) using our actual project data. Sound like a construction expert, not an AI. Focus on practical cost guidance.\n\nResponse:`
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
      ["Detailed Cost Analysis", "Schedule Expert Consultation", "Project Planning"],
      'cost_estimation',
      null,
      sessionId
    );
    
    logConversation(sessionId, originalMessage, response, context);
    return res.json(response);

  } catch (error) {
    console.error('❌ AI Agent Cost Estimation Error:', error);
    
    const fallbackCostResponse = getCostFallbackResponse(originalMessage);
    const response = formatResponse(
      fallbackCostResponse,
      ["Detailed Cost Analysis", "Schedule Expert Consultation", "Project Planning"],
      'cost_estimation_fallback',
      null,
      sessionId
    );
    
    return res.json(response);
  }
}

// AI Agent portfolio handler
async function handlePortfolioQuery(res, sessionId, context) {
  const portfolioResponse = `🏗️ **Meezan Developers Project Portfolio**\n\nWith ${knowledge.company.yearsExperience} of construction excellence, we've successfully delivered:\n\n📊 **Our Construction Expertise:**\n• ${knowledge.projectPortfolio.totalCompleted} - Total Projects Completed\n• ${knowledge.projectPortfolio.residential} - Residential Projects\n• ${knowledge.projectPortfolio.commercial} - Commercial Buildings\n• ${knowledge.projectPortfolio.industrial} - Industrial Facilities\n• ${knowledge.projectPortfolio.religious} - Religious Structures\n• ${knowledge.projectPortfolio.infrastructure} - Infrastructure Projects\n• ${knowledge.projectPortfolio.educational} - Educational Facilities\n• ${knowledge.projectPortfolio.roads} - Road Construction Projects\n\nOur portfolio reflects our commitment to quality and client satisfaction across all construction sectors.`;

  // Update context
  context.lastTopic = 'portfolio';
  context.state = conversationStates.PORTFOLIO_REVIEW;

  const response = formatResponse(
    portfolioResponse,
    ["Residential Expertise", "Commercial Experience", "Schedule Project Consultation"],
    'portfolio_view',
    null,
    sessionId
  );
  
  return res.json(response);
}

// AI Agent greeting handler
async function handleGreeting(req, res, sessionId, userMessage, context) {
  let reply;
  
  if (context.interactionCount <= 1) {
    reply = generateNaturalResponse('greeting', {
      yearsExperience: knowledge.company.yearsExperience,
      totalCompleted: knowledge.projectPortfolio.totalCompleted
    });
  } else {
    const previousTopic = context.lastTopic ? ` about ${context.lastTopic}` : '';
    const personalized = context.clientName ? `, ${context.clientName}` : '';
    reply = `Welcome back${personalized}! I'm ready to continue our discussion${previousTopic}. What would you like to explore next?`;
  }

  const response = formatResponse(
    reply,
    ["Schedule Consultation", "Our Construction Services", "Cost Estimation"],
    'greeting',
    null,
    sessionId
  );
  
  logConversation(sessionId, userMessage, response, context);
  return res.json(response);
}

// AI Agent about handler
async function handleAboutQuery(res, sessionId, context) {
  const aboutResponse = `I'm your AI Construction Consultant at Meezan Developers! 🤖\n\nI combine construction expertise with AI technology to help you plan and execute successful projects.\n\n**What I can do:**\n• Provide construction cost estimates based on ${knowledge.projectPortfolio.totalCompleted} projects\n• Schedule consultations with our expert team\n• Guide you through project planning\n• Answer construction-related questions\n\n${knowledge.company.name} brings ${knowledge.company.yearsExperience} of construction excellence to every project.`;

  const response = formatResponse(
    aboutResponse,
    ["Schedule Consultation", "Construction Costs", "Our Services"],
    'about_info',
    null,
    sessionId
  );
  
  return res.json(response);
}

// AI Agent service query handler
async function handleServiceQuery(res, sessionId, userMessage, context) {
  let reply;
  let specificService = null;

  // Check for specific service types
  const serviceKeywords = {
    'residential': ['house', 'home', 'residential', 'villa', 'apartment', 'housing'],
    'commercial': ['commercial', 'office', 'business', 'shop', 'mall', 'retail'],
    'industrial': ['industrial', 'factory', 'warehouse', 'manufacturing', 'plant'],
    'religious': ['mosque', 'church', 'temple', 'religious', 'worship'],
    'infrastructure': ['road', 'bridge', 'infrastructure', 'highway', 'utilities'],
    'educational': ['school', 'college', 'university', 'educational', 'campus'],
    'healthcare': ['hospital', 'clinic', 'medical', 'healthcare'],
    'sports': ['sports', 'stadium', 'recreational', 'gym', 'arena'],
    'renovation': ['renovation', 'remodel', 'upgrade', 'renovate', 'refurbish'],
    'project management': ['project management', 'project oversight', 'timeline', 'budget', 'coordination']
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
    reply = `🏗️ **${specificService.name} - Our Specialization**\n${specificService.description}\n\nWe bring ${getServiceProjectCount(specificService.name)} projects of experience to every ${specificService.name.toLowerCase()} undertaking.\n\nInterested in costs or scheduling a consultation for your ${specificService.name.toLowerCase()} project?`;
  } else {
    // General services overview
    const topServices = knowledge.services.slice(0, 5);
    reply = `🏗️ **Meezan Developers Construction Services**\n\nWe offer comprehensive construction solutions including:\n${topServices.map(service => `• ${service.name}`).join('\n')}\n\nWith ${knowledge.company.yearsExperience} years and ${knowledge.projectPortfolio.totalCompleted} projects of experience, we deliver quality across all construction sectors.\n\nWhich area interests you most?`;
  }

  // Update context with service information
  context.lastTopic = 'our services';
  context.lastService = specificService ? specificService.name.toLowerCase() : null;
  context.state = conversationStates.SERVICE_INQUIRY;

  const suggestions = specificService ? 
    [`Cost Analysis for ${specificService.name}`, `Schedule ${specificService.name} Consultation`, "View Our Portfolio"] :
    ["Residential Construction", "Commercial Projects", "Industrial Facilities"];

  const response = formatResponse(
    reply,
    suggestions,
    'service_info',
    { specificService: specificService?.name },
    sessionId
  );
  
  return res.json(response);
}

// AI Agent general query handler
async function handleGeneralQuery(req, res, sessionId, message, userMessage, context) {
  // Enhanced context detection
  if (userMessage.includes('build') || userMessage.includes('construct') || userMessage.includes('project')) {
    context.lastTopic = 'construction projects';
    context.state = conversationStates.PROJECT_DETAILS;
  } else if (userMessage.includes('time') || userMessage.includes('duration') || userMessage.includes('timeline')) {
    context.lastTopic = 'project timeline';
  } else if (userMessage.includes('material') || userMessage.includes('quality') || userMessage.includes('specification')) {
    context.lastTopic = 'construction materials';
  } else if (userMessage.includes('cost') || userMessage.includes('price') || userMessage.includes('estimate') || userMessage.includes('budget')) {
    context.lastTopic = 'cost estimation';
    context.state = conversationStates.COST_DISCUSSION;
  }

  // Enhanced prompt with AI Agent personality
  const contextPrompt = context.lastTopic ? 
    `Previous discussion was about: ${context.lastTopic}. Current client message: ${message}` : 
    `Client message: ${message}`;

  const promptConfig = {
    contents: [{
      parts: [{
        text: `${systemPrompt}\n\nCONVERSATION CONTEXT: ${contextPrompt}\n\nRespond as a knowledgeable construction consultant. Be helpful, professional, and maintain natural conversation flow.\n\nAI Consultant:`
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
    console.error('AI Agent General Query Error:', error);
    
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

// ==================== AI AGENT MEETING HANDLER ====================

async function handleMeetingBooking(req, res, sessionId, userMessage, context) {
  let meetingState = meetingStates.get(sessionId) || {
    step: 0,
    data: {},
    createdAt: new Date().toISOString(),
    conversationFlow: []
  };

  console.log('🤖 AI Agent - Meeting Step:', meetingState.step, 'User:', userMessage);

  // Update context
  context.lastTopic = 'meeting booking';
  context.state = conversationStates.MEETING_BOOKING;

  // Store conversation for context
  meetingState.conversationFlow.push({
    user: userMessage,
    timestamp: new Date().toISOString()
  });

  // Step 0: Natural conversation start
  if (meetingState.step === 0) {
    meetingState.step = 1;
    meetingStates.set(sessionId, meetingState);
    
    const response = formatResponse(
      generateNaturalResponse('meeting_start', {
        totalCompleted: knowledge.projectPortfolio.totalCompleted
      }),
      [],
      'get_name_natural',
      null,
      sessionId
    );
    
    return res.json(response);
  }

  // Step 1: Get name with personalization
  if (meetingState.step === 1) {
    const userName = req.body.message.trim();
    meetingState.data.name = userName;
    context.clientName = userName; // Store for personalization
    meetingState.step = 2;
    meetingStates.set(sessionId, meetingState);
    
    const response = formatResponse(
      `Perfect! Now, ${userName}, what's the best email to send your consultation details and confirmation to?`,
      [],
      'get_email_natural',
      null,
      sessionId
    );
    
    return res.json(response);
  }

  // Step 2: Get email with professional handling
  if (meetingState.step === 2) {
    const userEmail = req.body.message.trim();
    
    if (!isValidEmail(userEmail)) {
      return res.json(formatResponse(
        "To ensure we can send your meeting confirmation and project details, could you please provide a valid email address?",
        ["Try again", "Contact via phone"],
        'get_email_natural',
        null,
        sessionId
      ));
    }

    meetingState.data.email = userEmail;
    meetingState.step = 3;
    meetingStates.set(sessionId, meetingState);
    
    const response = formatResponse(
      generateNaturalResponse('project_type', { name: meetingState.data.name }),
      ["Residential", "Commercial", "Industrial", "General Consultation"],
      'get_project_type',
      null,
      sessionId
    );
    
    return res.json(response);
  }

  // Step 3: Get project type and show calendar expertise
  if (meetingState.step === 3) {
    const projectType = req.body.message.trim();
    meetingState.data.projectType = projectType;
    meetingState.step = 4;
    meetingStates.set(sessionId, meetingState);

    // Generate available dates for 2025
    const availableDates = calendarService.generateAvailableDates();
    
    if (availableDates.length === 0) {
      // No available dates - expert handling
      const nextSlots = calendarService.getNextAvailableSlots(3);
      let reply = `I've checked our specialists' calendars for 2025, and unfortunately, all consultation slots for the coming period are fully booked. `;
      
      if (nextSlots.length > 0) {
        reply += `However, I found these available slots coming up:\n\n`;
        nextSlots.forEach(slot => {
          reply += `• ${slot.date} at ${slot.time}\n`;
        });
        reply += `\nWould you like me to reserve one of these times for you?`;
        
        meetingState.step = 4.5;
        meetingStates.set(sessionId, meetingState);
        
        return res.json(formatResponse(
          reply,
          ["Reserve alternative slot", "Check next week", "Contact me when available"],
          'no_availability_expert',
          { nextSlots },
          sessionId
        ));
      } else {
        return res.json(formatResponse(
          `Our consultation schedule for 2025 is currently fully booked. For urgent project inquiries, I recommend contacting our team directly at ${knowledge.company.contact.phone}.`,
          ["Contact via phone", "Send project details", "Try again later"],
          'fully_booked_expert',
          null,
          sessionId
        ));
      }
    }

    const dateSuggestions = availableDates.map(date => `${date.display} (${date.availability})`);
    
    const response = formatResponse(
      generateNaturalResponse('date_selection', { projectType: projectType }),
      dateSuggestions,
      'get_date_natural',
      { availableDates },
      sessionId
    );
    
    return res.json(response);
  }

  // Step 4.5: Handle alternative dates
  if (meetingState.step === 4.5) {
    const userResponse = userMessage.toLowerCase();
    
    if (userResponse.includes('reserve') || userResponse.includes('alternative') || userResponse.includes('yes')) {
      const nextSlots = calendarService.getNextAvailableSlots(5);
      
      if (nextSlots.length > 0) {
        const dateSuggestions = nextSlots.map(slot => `${slot.date} at ${slot.time}`);
        
        meetingState.step = 4;
        meetingState.alternativeDates = nextSlots;
        meetingStates.set(sessionId, meetingState);
        
        return res.json(formatResponse(
          `Excellent! Here are the available consultation slots I found for 2025:\n\n${nextSlots.map(slot => `• ${slot.date} at ${slot.time}`).join('\n')}\n\nWhich one works best for your schedule?`,
          dateSuggestions,
          'get_alternative_date_natural',
          { alternativeSlots: nextSlots },
          sessionId
        ));
      } else {
        return res.json(formatResponse(
          `I apologize, but those slots were just booked. For immediate assistance with your ${meetingState.data.projectType} project, please contact our team at ${knowledge.company.contact.phone}.`,
          ["Contact team directly", "Try again tomorrow", "Send project details"],
          'no_slots_available_expert',
          null,
          sessionId
        ));
      }
    } else {
      meetingStates.delete(sessionId);
      return res.json(formatResponse(
        "No problem at all! Feel free to reach out when you're ready to schedule your consultation for 2025. We're here to help bring your construction vision to life.",
        ["Schedule later", "Our services", "Cost estimation"],
        'booking_canceled_natural',
        null,
        sessionId
      ));
    }
  }

  // Step 4: Get date with intelligent handling - FIXED FOR 2025
  if (meetingState.step === 4) {
    const selectedDateInput = req.body.message.trim();
    
    console.log('🤖 AI Agent - User selected date:', selectedDateInput);
    
    // Extract date from the input - handle multiple formats
    let selectedDate;
    let selectedDateDisplay;
    
    if (meetingState.alternativeDates) {
      // User selected from alternative dates
      const selectedSlot = meetingState.alternativeDates.find(slot => 
        `${slot.date} at ${slot.time}` === selectedDateInput
      );
      if (selectedSlot) {
        selectedDate = selectedSlot.fullDate;
        selectedDateDisplay = selectedSlot.date;
        meetingState.data.time = selectedSlot.time; // Pre-select the time
      }
    }
    
    if (!selectedDate) {
      // Normal date selection flow - handle user typing dates
      const availableDates = meetingState.availableDates || calendarService.generateAvailableDates();
      
      // Try to match the user's input with available dates
      const selectedDateObj = availableDates.find(date => {
        // Check exact match
        if (date.display === selectedDateInput) return true;
        if (date.value === selectedDateInput) return true;
        
        // Check partial matches (user might type "Nov 24" instead of full date)
        if (selectedDateInput.includes(date.value.substring(5))) return true; // Match "Nov 24"
        if (date.display.toLowerCase().includes(selectedDateInput.toLowerCase())) return true;
        
        return false;
      });
      
      if (!selectedDateObj) {
        // User typed something that doesn't match available dates
        const aiAgentDateResponses = [
          `I want to make sure I book the right date in 2025 for your ${meetingState.data.projectType} project consultation. Could you select one of these available dates?`,
          `For your ${meetingState.data.projectType} project, our specialists have these dates available in November 2025. Which works best?`,
          `Let's find the perfect date in 2025 for your ${meetingState.data.projectType} discussion. Here are our available slots:`,
          `Our ${meetingState.data.projectType} experts have these openings in late 2025. Which suits your schedule?`
        ];
        
        const randomResponse = aiAgentDateResponses[Math.floor(Math.random() * aiAgentDateResponses.length)];
        
        return res.json(formatResponse(
          randomResponse,
          availableDates.map(date => `${date.display} (${date.availability})`),
          'get_date_natural',
          { availableDates },
          sessionId
        ));
      }
      selectedDate = selectedDateObj.value;
      selectedDateDisplay = selectedDateObj.display;
    }

    meetingState.data.date = selectedDate;
    meetingState.step = 5;
    meetingStates.set(sessionId, meetingState);

    // Generate available times for the selected date
    const availableTimes = calendarService.generateAvailableTimes(selectedDate);
    const availableTimeSlots = availableTimes.filter(time => time.isAvailable);
    
    if (availableTimeSlots.length === 0) {
      const nextDates = calendarService.generateAvailableDates();
      const nextDatesDisplay = nextDates.map(date => `${date.display} (${date.availability})`);
      
      return res.json(formatResponse(
        `It looks like ${selectedDateDisplay} is fully booked. Our ${meetingState.data.projectType} specialists have these dates available in 2025 instead:`,
        nextDatesDisplay,
        'get_date_natural',
        { availableDates: nextDates },
        sessionId
      ));
    }

    const timeSuggestions = availableTimeSlots.map(time => time.display);
    
    // If time was pre-selected from alternative dates, skip to confirmation
    if (meetingState.data.time) {
      meetingState.step = 6;
      meetingStates.set(sessionId, meetingState);
      
      return res.json(formatResponse(
        `Perfect! Let me confirm your ${meetingState.data.projectType} project consultation for 2025:\n\n• **Date:** ${selectedDateDisplay}\n• **Time:** ${meetingState.data.time}\n• **With:** ${meetingState.data.name}\n\nReady to secure this time with our specialists?`,
        ["Yes, confirm booking", "No, let me make changes"],
        'confirm_meeting_natural',
        { meeting: meetingState.data },
        sessionId
      ));
    }

    const timeSelectionResponses = [
      `Great! I have ${availableTimeSlots.length} time slots available on ${selectedDateDisplay} for your ${meetingState.data.projectType} consultation. Which time works best?`,
      `Excellent choice! Our ${meetingState.data.projectType} specialists have these times available on ${selectedDateDisplay}. What works for your schedule?`,
      `Perfect! Let's pick a time on ${selectedDateDisplay} for your ${meetingState.data.projectType} discussion. Here are the available slots:`,
      `I've checked our schedule for ${selectedDateDisplay}. Here are the available times for your ${meetingState.data.projectType} consultation:`
    ];
    
    const randomTimeResponse = timeSelectionResponses[Math.floor(Math.random() * timeSelectionResponses.length)];

    return res.json(formatResponse(
      randomTimeResponse,
      timeSuggestions,
      'get_time_natural',
      { availableTimes: availableTimeSlots },
      sessionId
    ));
  }

  // Step 5: Get time with professional handling
  if (meetingState.step === 5) {
    const selectedTime = req.body.message.trim();
    const selectedDate = meetingState.data.date;
    
    // Check if the selected time slot is still available
    const isAvailable = calendarService.isSlotAvailable(selectedDate, selectedTime);
    
    if (!isAvailable) {
      const availableTimes = calendarService.generateAvailableTimes(selectedDate);
      const availableTimeSlots = availableTimes.filter(time => time.isAvailable);
      
      return res.json(formatResponse(
        `That time slot was just booked by another client. Here are the remaining available times on ${meetingState.data.date}:`,
        availableTimeSlots.map(time => time.display),
        'get_time_natural',
        { availableTimes: availableTimeSlots },
        sessionId
      ));
    }

    meetingState.data.time = selectedTime;
    meetingState.step = 6;
    meetingStates.set(sessionId, meetingState);

    const confirmationResponses = [
      `Excellent! Here's what I have for your 2025 consultation:\n\n• **Name:** ${meetingState.data.name}\n• **Project:** ${meetingState.data.projectType}\n• **Date:** ${meetingState.data.date}\n• **Time:** ${meetingState.data.time}\n\nReady to confirm and secure this time with our ${meetingState.data.projectType} specialists?`,
      `Perfect! Let me confirm your ${meetingState.data.projectType} consultation details for 2025:\n\n• **Date:** ${meetingState.data.date}\n• **Time:** ${meetingState.data.time}\n• **With:** ${meetingState.data.name}\n\nShall I book this appointment with our experts?`,
      `Great! Here's your 2025 consultation summary:\n\n• **Project Type:** ${meetingState.data.projectType}\n• **Consultation Date:** ${meetingState.data.date}\n• **Time:** ${meetingState.data.time}\n• **Client:** ${meetingState.data.name}\n\nReady to confirm this booking?`
    ];
    
    const randomConfirmation = confirmationResponses[Math.floor(Math.random() * confirmationResponses.length)];

    return res.json(formatResponse(
      randomConfirmation,
      ["Yes, confirm and book", "No, I need to make changes"],
      'confirm_meeting_natural',
      { meeting: meetingState.data },
      sessionId
    ));
  }

  // Step 6: Confirm meeting with professional assurance
  if (meetingState.step === 6) {
    const userResponse = userMessage.toLowerCase();
    
    if (userResponse.includes('yes') || userResponse.includes('confirm') || userResponse.includes('book')) {
      // Final availability check before booking
      const isAvailable = calendarService.isSlotAvailable(meetingState.data.date, meetingState.data.time);
      
      if (!isAvailable) {
        const nextDates = calendarService.generateAvailableDates();
        
        return res.json(formatResponse(
          `That time slot was just secured by another client. Here are our available consultation dates for 2025:`,
          nextDates.map(date => `${date.display} (${date.availability})`),
          'get_date_natural',
          { availableDates: nextDates },
          sessionId
        ));
      }

      // Generate meeting ID and book the slot
      meetingState.data.id = 'MTG_' + Date.now();
      meetingState.data.timestamp = new Date().toISOString();

      // Book the slot in calendar
      const bookingResult = await calendarService.bookSlot({
        date: meetingState.data.date,
        time: meetingState.data.time,
        meetingId: meetingState.data.id
      });

      if (!bookingResult.success) {
        return res.json(formatResponse(
          `I apologize, but that time slot is no longer available. Let's find another time that works for your ${meetingState.data.projectType} project in 2025.`,
          ["Choose different time", "Select another date", "Contact support"],
          'booking_failed_expert',
          null,
          sessionId
        ));
      }

      meetingState.step = 7;
      meetingStates.set(sessionId, meetingState);

      return res.json(formatResponse(
        `✅ **Consultation Confirmed for 2025!**\n\nI've secured your time with our ${meetingState.data.projectType} specialists.\n\nShall I send the confirmation details to ${meetingState.data.email}?`,
        ["Yes, send confirmation", "No, cancel booking"],
        'confirm_email_sending_natural',
        { meeting: meetingState.data, bookingId: bookingResult.bookingId },
        sessionId
      ));
    } else {
      // Intelligent change handling
      if (userResponse.includes('name')) {
        meetingState.step = 1;
      } else if (userResponse.includes('email')) {
        meetingState.step = 2;
      } else if (userResponse.includes('project')) {
        meetingState.step = 3;
      } else if (userResponse.includes('date')) {
        meetingState.step = 4;
      } else if (userResponse.includes('time')) {
        meetingState.step = 5;
      } else {
        meetingState.step = 4;
      }
      
      meetingStates.set(sessionId, meetingState);
      
      const stepMessages = {
        1: "Let's update your name. What should I call you?",
        2: "What's the best email to send your confirmation to?",
        3: "What type of construction project are you planning?",
        4: "Which consultation date in 2025 works best for you?",
        5: "What time would you prefer for your consultation?"
      };
      
      return res.json(formatResponse(
        stepMessages[meetingState.step] || "Let's start over. What's your name?",
        [],
        `get_${['name', 'email', 'project_type', 'date', 'time'][meetingState.step - 1]}_natural`,
        null,
        sessionId
      ));
    }
  }

  // Step 7: Send confirmation with professional touch
  if (meetingState.step === 7) {
    const userResponse = userMessage.toLowerCase();
    
    if (userResponse.includes('yes') || userResponse.includes('send') || userResponse.includes('confirm')) {
      try {
        console.log('🤖 AI Agent sending confirmation email...');
        
        const emailResult = await resendEmailService.sendMeetingConfirmation(meetingState.data);
        
        if (emailResult.success) {
          console.log('✅ AI Agent email sent successfully!');
          
          meetingStates.delete(sessionId);
          
          return res.json(formatResponse(
            `🎉 **Consultation Booked Successfully for 2025!**\n\n✅ Confirmation sent to ${meetingState.data.email}\n✅ Time secured with our ${meetingState.data.projectType} specialists\n✅ Our team will prepare for your project discussion\n\n**Meeting ID:** ${meetingState.data.id}\n**Date:** ${meetingState.data.date}\n**Time:** ${meetingState.data.time}\n\nWe look forward to helping bring your construction vision to life!`,
            ["Schedule another consultation", "Our construction services", "Project cost estimation"],
            'meeting_completed_expert',
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
          console.log('⚠️ AI Agent email failed:', emailResult.error);
          meetingStates.delete(sessionId);
          
          return res.json(formatResponse(
            `✅ **Consultation Confirmed for 2025!**\n\nYour meeting is scheduled for ${meetingState.data.date} at ${meetingState.data.time}.\n\n**Meeting ID:** ${meetingState.data.id}\n\nOur team will contact you directly to confirm and discuss your ${meetingState.data.projectType} project.`,
            ["Schedule another meeting", "Our services", "Cost estimation"],
            'meeting_completed_fallback_expert',
            { meetingId: meetingState.data.id, emailSent: false },
            sessionId
          ));
        }
      } catch (error) {
        console.error('❌ AI Agent email process error:', error);
        meetingStates.delete(sessionId);
        
        return res.json(formatResponse(
          `✅ **Consultation Scheduled for 2025!**\n\nYour meeting has been confirmed. Our construction team will contact you shortly to discuss your ${meetingState.data.projectType} project.\n\n**Meeting ID:** ${meetingState.data.id}`,
          ["Schedule another consultation", "Our construction services", "Project planning"],
          'meeting_completed_fallback_expert',
          { meetingId: meetingState.data.id, emailSent: false },
          sessionId
        ));
      }
    } else {
      // User canceled - professional handling
      await calendarService.cancelBooking(meetingState.data.date, meetingState.data.time);
      meetingStates.delete(sessionId);
      
      return res.json(formatResponse(
        "I've cancelled the booking and freed up the time slot for other clients. Feel free to reach out when you're ready to schedule your construction consultation for 2025.",
        ["Schedule consultation", "Our services", "Cost estimation"],
        'meeting_canceled_professional',
        null,
        sessionId
      ));
    }
  }
}

// ==================== AI AGENT HELPER FUNCTIONS ====================

// Enhanced helper functions
function isGreeting(message) {
  const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'hola', 'salam', 'greetings'];
  return greetings.some(greeting => message.includes(greeting));
}

function isAboutQuery(message) {
  const aboutKeywords = ['who are you', 'what are you', 'tell me about you', 'about yourself', 'your role', 'what do you do', 'are you ai', 'are you bot'];
  return aboutKeywords.some(keyword => message.includes(keyword));
}

function isPortfolioQuery(message) {
  const portfolioKeywords = ['portfolio', 'projects', 'completed work', 'experience', 'past work', 'our work', 'completed projects'];
  const costWords = ['cost', 'price', 'estimate', 'budget', 'how much'];
  const hasCostWords = costWords.some(word => message.includes(word));
  
  return portfolioKeywords.some(keyword => message.includes(keyword)) && !hasCostWords;
}

function isServiceQuery(message) {
  const serviceKeywords = ['service', 'services', 'what do you do', 'offer', 'provide', 'build', 'construct', 'develop', 'specialize'];
  return serviceKeywords.some(keyword => message.includes(keyword));
}

function isCostQuery(message) {
  const costKeywords = ['cost', 'price', 'how much', 'estimate', 'budget', 'pricing', 'rate', 'charges', 'quotation', 'investment', 'expense'];
  
  const projectCostPatterns = [
    'industrial.*cost', 'residential.*cost', 'commercial.*cost',
    'industrial.*price', 'residential.*price', 'commercial.*price',
    'industrial.*estimate', 'residential.*estimate', 'commercial.*estimate',
    'how much.*industrial', 'how much.*residential', 'how much.*commercial',
    'what.*cost.*industrial', 'what.*price.*residential', 'how much to build',
    'construction cost', 'building price', 'project budget'
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
    return `🏭 **Industrial Construction Expertise**\n\nBased on our ${knowledge.projectPortfolio.industrial} industrial projects:\n\n• Basic: ${knowledge.constructionCosts.industrial.basic}\n• Standard: ${knowledge.constructionCosts.industrial.standard}\n• Premium: ${knowledge.constructionCosts.industrial.premium}\n\n*Industrial costs depend on specialized requirements and ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*`;
  }
  
  if (lowerMessage.includes('residential') || lowerMessage.includes('house') || lowerMessage.includes('home')) {
    return `🏠 **Residential Construction Experience**\n\nFrom ${knowledge.projectPortfolio.residential} residential projects:\n\n• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}\n• Finished: ${knowledge.constructionCosts.residential.finished}\n• Premium: ${knowledge.constructionCosts.residential.premium}\n\n*Residential pricing varies based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*`;
  }
  
  if (lowerMessage.includes('commercial') || lowerMessage.includes('office') || lowerMessage.includes('business')) {
    return `🏢 **Commercial Construction Specialization**\n\nOur ${knowledge.projectPortfolio.commercial} commercial projects inform:\n\n• Basic: ${knowledge.constructionCosts.commercial.basic}\n• Standard: ${knowledge.constructionCosts.commercial.standard}\n• Premium: ${knowledge.constructionCosts.commercial.premium}\n\n*Commercial projects require detailed planning considering ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*`;
  }
  
  return `💰 **Construction Cost Guidance**\n\nBased on ${knowledge.projectPortfolio.totalCompleted} projects:\n\n🏠 Residential: ${knowledge.constructionCosts.residential.greyStructure} (Grey Structure)\n🏢 Commercial: ${knowledge.constructionCosts.commercial.basic} (Basic)\n🏭 Industrial: ${knowledge.constructionCosts.industrial.basic} (Basic)\n\n*All construction costs depend on: ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}*\n\nI recommend a detailed consultation for accurate project pricing.`;
}

function getSmartFallbackResponse(userMessage, context) {
  // Use context to provide better fallback responses
  if (context.lastTopic === 'our services' && (userMessage.includes('cost') || userMessage.includes('price'))) {
    return `I'd be happy to provide detailed cost estimates for ${context.lastService || 'that service'}! Would you like current market rates or a customized calculation?`;
  }
  
  if (userMessage.includes('cost') || userMessage.includes('price') || userMessage.includes('estimate')) {
    return `I can provide construction cost guidance! Our team uses detailed calculations or I can share general market rates. Which would be more helpful for your project planning?`;
  }
  
  if (userMessage.includes('project') || userMessage.includes('build') || userMessage.includes('construct')) {
    return `${knowledge.company.name} specializes in residential, commercial, and industrial construction. With ${knowledge.projectPortfolio.totalCompleted} projects completed, we have the expertise to bring your vision to life. Tell me about your project!`;
  }
  
  if (userMessage.includes('service') || userMessage.includes('offer')) {
    return `We offer comprehensive construction services for residential, commercial, industrial, and specialized projects. Our ${knowledge.company.yearsExperience} of experience ensures quality delivery. Which construction sector interests you?`;
  }
  
  if (userMessage.includes('portfolio') || userMessage.includes('experience')) {
    return `We've successfully delivered ${knowledge.projectPortfolio.totalCompleted} projects across various construction sectors. Would you like to see specific project types or schedule a consultation to discuss your requirements?`;
  }

  if (context.lastTopic) {
    return `Regarding ${context.lastTopic}, would you like more detailed information or should we explore another aspect of your construction project?`;
  }

  return `I'm here to help with your construction project planning! I can assist with cost estimates, service information, project consultations, or general construction guidance. What would you like to explore?`;
}

function getRelevantSuggestions(userMessage, context) {
  if (userMessage.includes('meeting') || userMessage.includes('schedule') || userMessage.includes('consultation')) {
    return [];
  }

  // Context-aware suggestions
  if (context.lastTopic === 'our services' && context.lastService) {
    return [`Cost Analysis for ${context.lastService}`, `Schedule ${context.lastService} Consultation`, "View Our Portfolio"];
  }
  
  if (context.lastTopic === 'cost estimation') {
    return ["Detailed Cost Calculation", "Expert Consultation", "Project Planning Guide"];
  }
  
  if (userMessage.includes('cost') || userMessage.includes('price') || userMessage.includes('budget')) {
    return ["🏠 Residential Costs", "🏢 Commercial Pricing", "🏭 Industrial Estimates", "🔗 Detailed Calculator"];
  }
  
  if (userMessage.includes('portfolio') || userMessage.includes('experience') || userMessage.includes('work')) {
    return ["Residential Projects", "Commercial Buildings", "Schedule Consultation"];
  }
  
  if (userMessage.includes('residential') || userMessage.includes('house') || userMessage.includes('home')) {
    return ["Residential Cost Analysis", "Schedule Home Consultation", "View Residential Portfolio"];
  }
  
  if (userMessage.includes('commercial') || userMessage.includes('business') || userMessage.includes('office')) {
    return ["Commercial Project Pricing", "Schedule Business Consultation", "View Commercial Portfolio"];
  }
  
  if (userMessage.includes('service') || userMessage.includes('offer')) {
    return ["Residential Construction", "Commercial Projects", "Cost Estimation"];
  }
  
  return ["Schedule Expert Consultation", "Our Construction Services", "Project Cost Estimation"];
}

// ==================== AI AGENT MAINTENANCE ====================

// Session cleanup interval
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
    console.log(`🤖 AI Agent cleaned up ${cleanedCount} old sessions`);
  }
}, 60 * 60 * 1000);

// Clear meeting state endpoint
router.post('/clear-meeting', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && meetingStates.has(sessionId)) {
    meetingStates.delete(sessionId);
    console.log('🤖 AI Agent cleared meeting state for session:', sessionId);
  }
  res.json({ success: true });
});

// Clear conversation context endpoint
router.post('/clear-context', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && conversationContexts.has(sessionId)) {
    conversationContexts.delete(sessionId);
    console.log('🤖 AI Agent cleared conversation context for session:', sessionId);
  }
  res.json({ success: true });
});

// AI Agent health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'AI Agent Operational',
    agent: AGENT_PERSONALITY.name,
    activeSessions: conversationContexts.size,
    activeConsultations: meetingStates.size,
    expertise: `${knowledge.projectPortfolio.totalCompleted} projects experience`,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// AI Agent conversation stats
router.get('/stats', (req, res) => {
  res.json({
    agent: AGENT_PERSONALITY.name,
    totalSessions: conversationContexts.size,
    activeConsultations: meetingStates.size,
    rateLimitStats: Object.fromEntries(requestCounts.entries()),
    expertise: `${knowledge.projectPortfolio.totalCompleted} projects`,
    serverTime: new Date().toISOString()
  });
});

module.exports = router;