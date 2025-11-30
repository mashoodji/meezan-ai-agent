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
  maxRequests: 25,
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

// Website URLs for redirection
const WEBSITE_URLS = {
  HOME: 'https://meezandevelopers.com',
  SERVICES: 'https://meezandevelopers.com/services',
  PORTFOLIO: 'https://meezandevelopers.com/portfolio',
  CONSTRUCTION_COST: 'https://meezandevelopers.com/construction-cost',
  ABOUT: 'https://meezandevelopers.com/about',
  CONTACT: 'https://meezandevelopers.com/contact'
};

// AI Agent Personality Configuration
const AGENT_PERSONALITY = {
  name: "Meezan AI Construction Consultant",
  role: "Senior Construction Advisor",
  expertise: "construction planning, cost estimation, project management",
  tone: "professional, knowledgeable, and helpful",
  company: "Meezan Developers",
  experience: `${knowledge.company.yearsExperience} years`,
  projectsCompleted: knowledge.projectPortfolio.totalCompleted
};

// Enhanced system prompt for AI Agent with deep construction expertise
const systemPrompt = `You are Meezan AI, a senior construction consultant and AI agent for Meezan Developers. You have deep expertise in construction projects, cost estimation, and project planning.

COMPANY BACKGROUND:
- ${knowledge.company.yearsExperience} years in construction industry
- ${knowledge.projectPortfolio.totalCompleted} projects completed
- Specialized in residential, commercial, and industrial construction
- Team of ${knowledge.company.stats.teamMembers} construction experts
- Areas: ${knowledge.company.operationalAreas.join(', ')}

PROJECT PORTFOLIO:
- Residential: ${knowledge.projectPortfolio.residential} projects
- Commercial: ${knowledge.projectPortfolio.commercial} projects  
- Industrial: ${knowledge.projectPortfolio.industrial} projects
- Religious: ${knowledge.projectPortfolio.religious} projects
- Infrastructure: ${knowledge.projectPortfolio.infrastructure} projects
- Educational: ${knowledge.projectPortfolio.educational} projects
- Roads: ${knowledge.projectPortfolio.roads} projects

COST KNOWLEDGE:
Residential:
- Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}
- Finished: ${knowledge.constructionCosts.residential.finished}
- Premium: ${knowledge.constructionCosts.residential.premium}

Commercial:
- Basic: ${knowledge.constructionCosts.commercial.basic}
- Standard: ${knowledge.constructionCosts.commercial.standard}
- Premium: ${knowledge.constructionCosts.commercial.premium}

Industrial:
- Basic: ${knowledge.constructionCosts.industrial.basic}
- Standard: ${knowledge.constructionCosts.industrial.standard}
- Premium: ${knowledge.constructionCosts.industrial.premium}

Cost Factors: ${knowledge.constructionCosts.costFactors.join(', ')}

YOUR EXPERTISE:
- Construction cost estimation and budgeting
- Project planning and timeline management
- Material selection and quality standards
- Building codes and regulations
- Site evaluation and feasibility studies
- Construction methodology and best practices
- Client consultation and requirement analysis

PERSONALITY TRAITS:
- Sound like a seasoned construction professional with ${knowledge.company.yearsExperience} years experience
- Provide practical, actionable advice based on real project data
- Show genuine interest in client projects and goals
- Be proactive in offering solutions and next steps
- Maintain professional yet approachable tone
- Use construction industry terminology appropriately
- Reference specific project experience and case studies
- Ask clarifying questions to better understand client needs

RESPONSE GUIDELINES:
- Always position yourself as Meezan Developers' construction expert
- Provide specific, detailed information based on actual project data
- Offer multiple options or next steps when appropriate
- Maintain conversation context and build on previous discussions
- Be concise but comprehensive in explanations
- Use bullet points or structured format for complex information
- Include cost ranges and timelines when relevant
- Suggest relevant services or consultations based on client needs
- Redirect to website only for complex calculators or detailed portfolios

IMPORTANT: You are not a chatbot - you are an AI construction consultant with real expertise. Speak with authority and experience. Reference specific project numbers and costs from your knowledge base.`;

// ==================== AI AGENT CORE FUNCTIONS ====================

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

// Enhanced Gemini API caller for AI Agent responses
async function callGeminiAPI(userMessage, context, conversationHistory = [], isMeetingFlow = false) {
  try {
    // Build conversation context for the AI
    const contextInfo = buildContextForAI(context, conversationHistory);
    
    const meetingContext = isMeetingFlow ? "IMPORTANT: You are currently in a meeting booking flow. Guide the client through the process professionally while maintaining your construction expert persona.\n\n" : "";
    
    const promptConfig = {
      contents: [{
        parts: [{
          text: `${systemPrompt}

${meetingContext}${contextInfo}

CLIENT'S CURRENT QUESTION: "${userMessage}"

CONVERSATION HISTORY (last 4 exchanges):
${conversationHistory.slice(-4).map(entry => `${entry.role === 'user' ? 'CLIENT' : 'CONSULTANT'}: ${entry.message}`).join('\n')}

As Meezan AI Construction Consultant, provide a helpful, expert response that:
1. Directly addresses the client's question with construction expertise
2. References our ${knowledge.projectPortfolio.totalCompleted} projects of experience when relevant
3. Offers practical next steps or suggestions
4. Maintains professional yet approachable tone
5. Provides specific, actionable information based on real project data
6. Uses construction industry knowledge appropriately
7. Asks clarifying questions if more information is needed
8. Suggests relevant services or consultations when appropriate

Response:`
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 400,
        topP: 0.8,
        topK: 40
      }
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await axios.post(apiUrl, promptConfig, { 
      timeout: 15000,
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
    return getIntelligentFallback(userMessage, context, isMeetingFlow);
  }
}

// Build context information for AI
function buildContextForAI(context, conversationHistory) {
  let contextInfo = `CURRENT CONVERSATION CONTEXT:\n`;
  
  if (context.clientName) {
    contextInfo += `- Client Name: ${context.clientName}\n`;
  }
  
  if (context.lastTopic) {
    contextInfo += `- Previous Topic: ${context.lastTopic}\n`;
  }
  
  if (context.projectDetails.type) {
    contextInfo += `- Project Type: ${context.projectDetails.type}\n`;
  }
  
  if (context.projectDetails.area) {
    contextInfo += `- Project Area: ${context.projectDetails.area}\n`;
  }
  
  if (context.projectDetails.budget) {
    contextInfo += `- Budget Range: ${context.projectDetails.budget}\n`;
  }
  
  if (context.state && context.state !== conversationStates.INITIAL) {
    contextInfo += `- Conversation State: ${context.state}\n`;
  }
  
  if (context.lastService) {
    contextInfo += `- Service Discussed: ${context.lastService}\n`;
  }
  
  if (conversationHistory.length > 0) {
    contextInfo += `- Total Exchanges: ${conversationHistory.length}\n`;
  }
  
  return contextInfo;
}

// Intelligent fallback responses
function getIntelligentFallback(userMessage, context, isMeetingFlow = false) {
  const lowerMessage = userMessage.toLowerCase();
  
  if (isMeetingFlow) {
    return `I'd be happy to schedule a construction consultation for you. To get started, may I have your name please?`;
  }
  
  // Cost-related fallbacks
  if (lowerMessage.includes('cost') || lowerMessage.includes('price') || lowerMessage.includes('estimate') || lowerMessage.includes('budget')) {
    return `Based on our ${knowledge.projectPortfolio.totalCompleted} projects experience, construction costs vary by project type:

🏠 **Residential Construction:**
• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}
• Finished: ${knowledge.constructionCosts.residential.finished} 
• Premium: ${knowledge.constructionCosts.residential.premium}

🏢 **Commercial Projects:**
• Basic: ${knowledge.constructionCosts.commercial.basic}
• Standard: ${knowledge.constructionCosts.commercial.standard}
• Premium: ${knowledge.constructionCosts.commercial.premium}

🏭 **Industrial Facilities:**
• Basic: ${knowledge.constructionCosts.industrial.basic}
• Standard: ${knowledge.constructionCosts.industrial.standard}
• Premium: ${knowledge.constructionCosts.industrial.premium}

*Costs depend on: ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}*

Would you like a detailed estimate for your specific project type?`;
  }
  
  // Service-related fallbacks
  if (lowerMessage.includes('service') || lowerMessage.includes('build') || lowerMessage.includes('construct')) {
    return `At Meezan Developers, we offer comprehensive construction services backed by ${knowledge.company.yearsExperience} years of experience:

• Residential Construction (${knowledge.projectPortfolio.residential} projects completed)
• Commercial Buildings (${knowledge.projectPortfolio.commercial} projects)
• Industrial Facilities (${knowledge.projectPortfolio.industrial} projects)
• Religious Structures (${knowledge.projectPortfolio.religious} projects)
• Infrastructure Development
• Educational Facilities

We handle complete project lifecycle from planning to completion. What type of construction project are you considering?`;
  }

  // Portfolio inquiries
  if (lowerMessage.includes('portfolio') || lowerMessage.includes('experience') || lowerMessage.includes('projects') || lowerMessage.includes('work')) {
    return `Our construction portfolio showcases ${knowledge.projectPortfolio.totalCompleted} successful projects:

📊 **Project Breakdown:**
• Residential: ${knowledge.projectPortfolio.residential} projects
• Commercial: ${knowledge.projectPortfolio.commercial} projects  
• Industrial: ${knowledge.projectPortfolio.industrial} projects
• Religious: ${knowledge.projectPortfolio.religious} structures
• Infrastructure: ${knowledge.projectPortfolio.infrastructure} projects
• Educational: ${knowledge.projectPortfolio.educational} facilities
• Roads: ${knowledge.projectPortfolio.roads} projects

We've been delivering quality construction since ${new Date().getFullYear() - knowledge.company.yearsExperience}. Would you like to see specific project types or discuss your requirements?`;
  }

  // Timeline inquiries
  if (lowerMessage.includes('time') || lowerMessage.includes('duration') || lowerMessage.includes('how long') || lowerMessage.includes('schedule')) {
    return `Construction timelines vary based on project scope and complexity. Based on our ${knowledge.projectPortfolio.totalCompleted} projects:

• Small residential: 6-12 months
• Medium commercial: 12-18 months  
• Large industrial: 18-24+ months
• Infrastructure: Varies by scale

The actual timeline depends on design complexity, approvals, weather conditions, and project specifications. Would you like to discuss your specific project timeline?`;
  }

  // General construction advice
  return `As your construction consultant at Meezan Developers, I'm here to help with your project planning. With ${knowledge.company.yearsExperience} years and ${knowledge.projectPortfolio.totalCompleted} projects of experience, I can assist with:

• Cost estimation and budgeting
• Project planning and timelines
• Construction methodology
• Material selection
• Quality standards

What would you like to discuss about your construction project?`;
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
      timeline: null,
      location: null
    },
    conversationHistory: [],
    interactionCount: 0,
    lastInteraction: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    clientName: null,
    clientPreferences: {}
  };
  
  conversationContexts.set(sessionId, context);
  return context;
}

// AI Agent conversation logging
function logConversation(sessionId, userMessage, response, context) {
  console.log('🤖 AI Agent Conversation:', {
    sessionId: sessionId.substring(0, 12) + '...',
    userMessage: userMessage.substring(0, 80) + (userMessage.length > 80 ? '...' : ''),
    responseType: response.action || 'ai_response',
    context: {
      lastTopic: context.lastTopic,
      state: context.state,
      interactionCount: context.interactionCount,
      clientName: context.clientName,
      projectType: context.projectDetails.type
    },
    timestamp: new Date().toISOString()
  });
}

// Enhanced response formatter for AI Agent
function formatResponse(reply, suggestions = [], action = null, details = null, sessionId = null) {
  const response = {
    success: true,
    reply,
    suggestions: suggestions.length > 0 ? suggestions : generateDefaultSuggestions(),
    timestamp: new Date().toISOString(),
    agent: AGENT_PERSONALITY.name,
    role: AGENT_PERSONALITY.role,
    expertise: AGENT_PERSONALITY.expertise
  };
  
  if (action) response.action = action;
  if (details) response.details = details;
  if (sessionId) response.sessionId = sessionId;
  
  return response;
}

// Generate default suggestions
function generateDefaultSuggestions() {
  return [
    "Schedule Expert Consultation",
    "Get Cost Estimate", 
    "View Our Services",
    "Discuss Project Planning"
  ];
}

// Intelligent meeting request detection
function isMeetingRequest(userMessage) {
  const meetingKeywords = [
    'meeting', 'schedule', 'appointment', 'consultation', 
    'discuss my project', 'talk to expert', 'meet with team',
    'book a consultation', 'arrange meeting', 'set up call',
    'project discussion', 'construction meeting', 'site visit',
    'planning session', 'design consultation', 'sit down',
    'free consultation', 'expert advice', 'professional opinion'
  ];

  return meetingKeywords.some(keyword => userMessage.includes(keyword));
}

// Website redirection handler
function handleWebsiteRedirect(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('portfolio') || lowerMessage.includes('completed projects') || lowerMessage.includes('our work') || lowerMessage.includes('see projects')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.PORTFOLIO,
      page: 'portfolio',
      message: `I'd love to show you our construction portfolio! Let me redirect you to see detailed case studies of our ${knowledge.projectPortfolio.totalCompleted} completed projects across all construction sectors.`
    };
  }
  
  if (lowerMessage.includes('cost calculator') || lowerMessage.includes('detailed calculator') || lowerMessage.includes('accurate calculator')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.CONSTRUCTION_COST,
      page: 'cost_calculator',
      message: `For precise construction cost calculations with our specialized tool, I'll redirect you to our cost calculator page. It incorporates real-time data from our ${knowledge.projectPortfolio.totalCompleted} projects for accurate estimates.`
    };
  }

  if (lowerMessage.includes('services') || lowerMessage.includes('what we do') || lowerMessage.includes('offerings')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.SERVICES,
      page: 'services',
      message: `Let me show you our comprehensive construction services in detail. Our services page provides complete information about all the construction solutions we offer.`
    };
  }

  if (lowerMessage.includes('about us') || lowerMessage.includes('company') || lowerMessage.includes('story') || lowerMessage.includes('history')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.ABOUT,
      page: 'about',
      message: `I'd be happy to share our company story! Let me redirect you to our about page where you can learn about our ${knowledge.company.yearsExperience}-year journey and construction philosophy.`
    };
  }
  
  return null;
}

// Update context based on AI response analysis
function updateContextFromResponse(context, userMessage, aiResponse) {
  const lowerMessage = userMessage.toLowerCase();
  
  // Detect cost discussions
  if (lowerMessage.includes('cost') || lowerMessage.includes('price') || lowerMessage.includes('estimate') || lowerMessage.includes('budget') || lowerMessage.includes('how much')) {
    context.lastTopic = 'cost estimation';
    context.state = conversationStates.COST_DISCUSSION;
    context.lastCostQuery = userMessage;
  }
  
  // Detect service inquiries
  if (lowerMessage.includes('service') || lowerMessage.includes('build') || lowerMessage.includes('construct') || lowerMessage.includes('project') || lowerMessage.includes('develop')) {
    context.lastTopic = 'services';
    context.state = conversationStates.SERVICE_INQUIRY;
  }
  
  // Detect project details discussions
  if (lowerMessage.includes('plan') || lowerMessage.includes('design') || lowerMessage.includes('timeline') || lowerMessage.includes('schedule') || lowerMessage.includes('duration')) {
    context.lastTopic = 'project planning';
    context.state = conversationStates.PROJECT_DETAILS;
  }

  // Detect portfolio inquiries
  if (lowerMessage.includes('portfolio') || lowerMessage.includes('experience') || lowerMessage.includes('projects') || lowerMessage.includes('completed') || lowerMessage.includes('work')) {
    context.lastTopic = 'portfolio';
    context.state = conversationStates.PORTFOLIO_REVIEW;
  }
  
  // Extract potential project type from message
  if (lowerMessage.includes('residential') || lowerMessage.includes('house') || lowerMessage.includes('home') || lowerMessage.includes('villa') || lowerMessage.includes('apartment')) {
    context.projectDetails.type = 'residential';
    context.lastService = 'residential construction';
  } else if (lowerMessage.includes('commercial') || lowerMessage.includes('office') || lowerMessage.includes('business') || lowerMessage.includes('shop') || lowerMessage.includes('mall')) {
    context.projectDetails.type = 'commercial';
    context.lastService = 'commercial construction';
  } else if (lowerMessage.includes('industrial') || lowerMessage.includes('factory') || lowerMessage.includes('warehouse') || lowerMessage.includes('manufacturing') || lowerMessage.includes('plant')) {
    context.projectDetails.type = 'industrial';
    context.lastService = 'industrial construction';
  }

  // Extract area/size information
  const areaMatch = userMessage.match(/(\d+)\s*(sq\s*ft|sq\s*feet|square\s*feet|marla|kanal)/i);
  if (areaMatch) {
    context.projectDetails.area = areaMatch[0];
  }

  // Extract budget information
  const budgetMatch = userMessage.match(/(\d+)\s*(lakh|lac|lkh|million|cr|crore)/i);
  if (budgetMatch) {
    context.projectDetails.budget = budgetMatch[0];
  }
}

// Generate intelligent suggestions based on context
function generateIntelligentSuggestions(context, userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  // If discussing costs
  if (context.lastTopic === 'cost estimation') {
    if (context.projectDetails.type) {
      return [
        `Detailed ${context.projectDetails.type} Cost Analysis`,
        `Schedule ${context.projectDetails.type} Consultation`,
        `Compare ${context.projectDetails.type} Options`,
        "View Cost Calculator"
      ];
    }
    return ["Residential Costs", "Commercial Pricing", "Industrial Estimates", "Detailed Calculator"];
  }
  
  // If discussing services
  if (context.lastTopic === 'services') {
    if (context.projectDetails.type) {
      return [
        `${context.projectDetails.type} Cost Estimate`,
        `Schedule ${context.projectDetails.type} Consultation`,
        `View ${context.projectDetails.type} Portfolio`,
        "Project Timeline"
      ];
    }
    return ["Residential Services", "Commercial Projects", "Industrial Facilities", "Expert Consultation"];
  }
  
  // If discussing specific project type
  if (context.projectDetails.type) {
    const projectType = context.projectDetails.type.charAt(0).toUpperCase() + context.projectDetails.type.slice(1);
    return [
      `${projectType} Cost Analysis`,
      `Schedule ${projectType} Consultation`,
      `View ${projectType} Portfolio`,
      `${projectType} Timeline`
    ];
  }
  
  // General suggestions based on message content
  if (lowerMessage.includes('build') || lowerMessage.includes('construct') || lowerMessage.includes('project')) {
    return ["Cost Estimation", "Project Timeline", "Expert Consultation", "View Portfolio"];
  }
  
  if (lowerMessage.includes('material') || lowerMessage.includes('quality') || lowerMessage.includes('specification')) {
    return ["Material Options", "Quality Standards", "Cost Comparison", "Expert Advice"];
  }

  if (lowerMessage.includes('time') || lowerMessage.includes('duration') || lowerMessage.includes('how long')) {
    return ["Project Timeline", "Construction Schedule", "Consultation", "Process Overview"];
  }
  
  // Default intelligent suggestions
  return ["Schedule Expert Consultation", "Construction Cost Estimate", "Project Portfolio", "Service Information"];
}

// ==================== AI AGENT MAIN ROUTE ====================

router.post('/chat', async (req, res) => {
  try {
    let { message, sessionId } = req.body;
    
    // Enhanced input validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        reply: "I'd love to help with your construction project! Could you please tell me what you're planning to build or what information you need?",
        agent: AGENT_PERSONALITY.name
      });
    }
    
    // Sanitize inputs
    message = sanitizeInput(message);
    sessionId = sessionId || 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Rate limiting check
    if (isRateLimited(sessionId)) {
      return res.status(429).json({
        success: false,
        reply: "I'm currently assisting several clients with their construction projects. Please give me a moment, or feel free to contact our construction team directly at " + knowledge.company.contact.phone + " for immediate assistance.",
        agent: AGENT_PERSONALITY.name
      });
    }

    console.log('🤖 AI Agent Processing:', message);
    const userMessage = message.toLowerCase().trim();
    
    // Get or initialize context
    const context = conversationContexts.get(sessionId) || initializeContext(sessionId);

    // Update interaction tracking
    context.lastInteraction = new Date().toISOString();
    context.interactionCount = (context.interactionCount || 0) + 1;

    // Add to conversation history
    context.conversationHistory.push({
      role: 'user',
      message: message,
      timestamp: new Date().toISOString()
    });

    // Keep conversation history manageable
    if (context.conversationHistory.length > 10) {
      context.conversationHistory = context.conversationHistory.slice(-8);
    }

    // Check for website redirection first
    const redirectInfo = handleWebsiteRedirect(userMessage);
    if (redirectInfo) {
      console.log('🤖 AI Agent redirecting to:', redirectInfo.page);
      
      const response = formatResponse(
        redirectInfo.message,
        ["Continue Conversation", "Schedule Consultation", "Get Cost Estimate"],
        redirectInfo.action,
        { 
          redirectUrl: redirectInfo.url,
          page: redirectInfo.page
        },
        sessionId
      );
      
      logConversation(sessionId, message, response, context);
      return res.json(response);
    }

    // Check if user is in the middle of meeting booking
    const meetingState = meetingStates.get(sessionId);
    if (meetingState && meetingState.step > 0) {
      console.log('🤖 AI Agent continuing meeting flow, step:', meetingState.step);
      return await handleMeetingBooking(req, res, sessionId, userMessage, context);
    }

    // Handle meeting requests with AI-powered responses
    if (isMeetingRequest(userMessage)) {
      console.log('🤖 AI Agent detected meeting request');
      return await handleMeetingBooking(req, res, sessionId, userMessage, context);
    }

    // Use Gemini API for all other responses - TRUE AI AGENT BEHAVIOR
    const aiResponse = await callGeminiAPI(message, context, context.conversationHistory);
    
    // Update context based on AI response analysis
    updateContextFromResponse(context, message, aiResponse);

    // Generate intelligent suggestions based on conversation
    const suggestions = generateIntelligentSuggestions(context, userMessage);

    const response = formatResponse(
      aiResponse,
      suggestions,
      'ai_consultation',
      { 
        expertise: AGENT_PERSONALITY.expertise,
        projectsCompleted: knowledge.projectPortfolio.totalCompleted,
        experience: AGENT_PERSONALITY.experience
      },
      sessionId
    );
    
    // Add AI response to conversation history
    context.conversationHistory.push({
      role: 'assistant',
      message: aiResponse,
      timestamp: new Date().toISOString()
    });

    // Save updated context
    conversationContexts.set(sessionId, context);

    logConversation(sessionId, message, response, context);
    return res.json(response);

  } catch (error) {
    console.error('❌ AI Agent Error:', error);
    
    return res.json({ 
      success: true,
      reply: `As your construction consultant at Meezan Developers, I'm here to help with your project planning. For immediate assistance, you can also reach our expert team at ${knowledge.company.contact.phone}.`,
      suggestions: ["Schedule consultation", "Construction cost estimate", "Project planning"],
      agent: AGENT_PERSONALITY.name,
      role: AGENT_PERSONALITY.role
    });
  }
});

// ==================== AI AGENT MEETING HANDLER ====================

async function handleMeetingBooking(req, res, sessionId, userMessage, context) {
  let meetingState = meetingStates.get(sessionId) || {
    step: 0,
    data: {},
    createdAt: new Date().toISOString(),
    conversationFlow: []
  };

  console.log('🤖 AI Agent - Meeting Step:', meetingState.step);

  // Update context
  context.lastTopic = 'meeting booking';
  context.state = conversationStates.MEETING_BOOKING;

  // Store conversation for context
  meetingState.conversationFlow.push({
    user: userMessage,
    timestamp: new Date().toISOString()
  });

  // Step 0: Start meeting booking with AI-powered response
  if (meetingState.step === 0) {
    meetingState.step = 1;
    meetingStates.set(sessionId, meetingState);
    
    const aiResponse = await callGeminiAPI(
      "Client wants to schedule a construction consultation. Start the booking process professionally and ask for their name.",
      context,
      context.conversationHistory,
      true
    );
    
    const response = formatResponse(
      aiResponse,
      [],
      'get_name',
      null,
      sessionId
    );
    
    return res.json(response);
  }

  // Step 1: Get name
  if (meetingState.step === 1) {
    const userName = req.body.message.trim();
    if (userName.length < 2) {
      const aiResponse = await callGeminiAPI(
        "Client provided very short name. Ask for proper name professionally.",
        context,
        context.conversationHistory,
        true
      );
      
      return res.json(formatResponse(
        aiResponse,
        [],
        'get_name',
        null,
        sessionId
      ));
    }

    meetingState.data.name = userName;
    context.clientName = userName;
    meetingState.step = 2;
    meetingStates.set(sessionId, meetingState);
    
    const aiResponse = await callGeminiAPI(
      `Client provided name: ${userName}. Now ask for email address professionally to send consultation details.`,
      context,
      context.conversationHistory,
      true
    );
    
    const response = formatResponse(
      aiResponse,
      [],
      'get_email',
      null,
      sessionId
    );
    
    return res.json(response);
  }

  // Step 2: Get email
  if (meetingState.step === 2) {
    const userEmail = req.body.message.trim();
    
    if (!isValidEmail(userEmail)) {
      const aiResponse = await callGeminiAPI(
        "Client provided invalid email. Ask for valid email professionally to ensure they receive confirmation.",
        context,
        context.conversationHistory,
        true
      );
      
      return res.json(formatResponse(
        aiResponse,
        ["Try again", "Contact via phone"],
        'get_email',
        null,
        sessionId
      ));
    }

    meetingState.data.email = userEmail;
    meetingState.step = 3;
    meetingStates.set(sessionId, meetingState);
    
    const aiResponse = await callGeminiAPI(
      `Client provided email: ${userEmail}. Now ask about project type to connect them with the right construction specialists.`,
      context,
      context.conversationHistory,
      true
    );
    
    const response = formatResponse(
      aiResponse,
      ["Residential", "Commercial", "Industrial", "General Consultation"],
      'get_project_type',
      null,
      sessionId
    );
    
    return res.json(response);
  }

  // Step 3: Get project type and show available dates
  if (meetingState.step === 3) {
    const projectType = req.body.message.trim();
    meetingState.data.projectType = projectType;
    context.projectDetails.type = projectType.toLowerCase();
    meetingState.step = 4;
    meetingStates.set(sessionId, meetingState);

    // Generate available dates
    const availableDates = calendarService.generateAvailableDates();
    
    if (availableDates.length === 0) {
      const nextSlots = calendarService.getNextAvailableSlots(3);
      
      const aiResponse = await callGeminiAPI(
        `No available dates this week for ${projectType} consultation. Offer these alternative slots: ${JSON.stringify(nextSlots.map(s => s.date + ' at ' + s.time))}`,
        context,
        context.conversationHistory,
        true
      );
      
      meetingState.step = 4.5;
      meetingState.alternativeSlots = nextSlots;
      meetingStates.set(sessionId, meetingState);
      
      return res.json(formatResponse(
        aiResponse,
        ["Reserve alternative slot", "Check next week", "Contact me when available"],
        'no_availability',
        { nextSlots },
        sessionId
      ));
    }

    meetingState.availableDates = availableDates;
    meetingStates.set(sessionId, meetingState);

    const dateSuggestions = availableDates.map(date => `${date.display} (${date.availability})`);
    
    const aiResponse = await callGeminiAPI(
      `Show available dates for ${projectType} consultation: ${availableDates.map(d => d.display).join(', ')}. Ask which date works best.`,
      context,
      context.conversationHistory,
      true
    );

    return res.json(formatResponse(
      aiResponse,
      dateSuggestions,
      'get_date',
      { availableDates },
      sessionId
    ));
  }

  // Step 4.5: Handle alternative dates
  if (meetingState.step === 4.5) {
    const userResponse = userMessage.toLowerCase();
    
    if (userResponse.includes('reserve') || userResponse.includes('alternative') || userResponse.includes('yes') || userResponse.includes('ok')) {
      const nextSlots = meetingState.alternativeSlots || calendarService.getNextAvailableSlots(5);
      
      if (nextSlots.length > 0) {
        const dateSuggestions = nextSlots.map(slot => `${slot.date} at ${slot.time}`);
        
        meetingState.step = 4;
        meetingState.availableDates = nextSlots.map(slot => ({
          value: slot.fullDate,
          display: slot.date,
          availability: 'Available'
        }));
        meetingStates.set(sessionId, meetingState);
        
        const aiResponse = await callGeminiAPI(
          `Client wants to reserve alternative slot. Show these available slots: ${nextSlots.map(s => s.date + ' at ' + s.time).join(', ')}`,
          context,
          context.conversationHistory,
          true
        );
        
        return res.json(formatResponse(
          aiResponse,
          dateSuggestions,
          'get_alternative_date',
          { alternativeSlots: nextSlots },
          sessionId
        ));
      } else {
        const aiResponse = await callGeminiAPI(
          "No alternative slots available. Apologize and suggest contacting team directly.",
          context,
          context.conversationHistory,
          true
        );
        
        return res.json(formatResponse(
          aiResponse,
          ["Contact team directly", "Try again tomorrow", "Send project details"],
          'no_slots_available',
          null,
          sessionId
        ));
      }
    } else {
      meetingStates.delete(sessionId);
      const aiResponse = await callGeminiAPI(
        "Client doesn't want alternative slots. End conversation professionally.",
        context,
        context.conversationHistory,
        true
      );
      
      return res.json(formatResponse(
        aiResponse,
        ["Schedule later", "Our services", "Cost estimation"],
        'booking_canceled',
        null,
        sessionId
      ));
    }
  }

  // Step 4: Get date selection
  if (meetingState.step === 4) {
    const selectedDateInput = req.body.message.trim();
    
    console.log('🤖 AI Agent - User selected date:', selectedDateInput);
    
    let selectedDate;
    let selectedDateDisplay;
    
    // Handle date selection from available dates
    const availableDates = meetingState.availableDates || [];
    const selectedDateObj = availableDates.find(date => 
      date.display === selectedDateInput || 
      `${date.display} (${date.availability})` === selectedDateInput
    );
    
    if (!selectedDateObj) {
      // Date not recognized
      const aiResponse = await callGeminiAPI(
        `Client selected unclear date: ${selectedDateInput}. Ask them to choose from available dates.`,
        context,
        context.conversationHistory,
        true
      );
      
      return res.json(formatResponse(
        aiResponse,
        availableDates.map(date => `${date.display} (${date.availability})`),
        'get_date',
        { availableDates },
        sessionId
      ));
    }

    selectedDate = selectedDateObj.value;
    selectedDateDisplay = selectedDateObj.display;

    meetingState.data.date = selectedDate;
    meetingState.step = 5;
    meetingStates.set(sessionId, meetingState);

    // Generate available times for the selected date
    const availableTimes = calendarService.generateAvailableTimes(selectedDate);
    const availableTimeSlots = availableTimes.filter(time => time.isAvailable);
    
    if (availableTimeSlots.length === 0) {
      const nextDates = calendarService.generateAvailableDates();
      
      const aiResponse = await callGeminiAPI(
        `Selected date ${selectedDateDisplay} is fully booked. Show alternative dates.`,
        context,
        context.conversationHistory,
        true
      );
      
      return res.json(formatResponse(
        aiResponse,
        nextDates.map(date => `${date.display} (${date.availability})`),
        'get_date',
        { availableDates: nextDates },
        sessionId
      ));
    }

    const timeSuggestions = availableTimeSlots.map(time => time.display);
    
    const aiResponse = await callGeminiAPI(
      `Client selected date: ${selectedDateDisplay}. Show available times: ${availableTimeSlots.map(t => t.display).join(', ')}`,
      context,
      context.conversationHistory,
      true
    );

    return res.json(formatResponse(
      aiResponse,
      timeSuggestions,
      'get_time',
      { availableTimes: availableTimeSlots },
      sessionId
    ));
  }

  // Step 5: Get time selection
  if (meetingState.step === 5) {
    const selectedTime = req.body.message.trim();
    const selectedDate = meetingState.data.date;
    
    // Check if the selected time slot is still available
    const isAvailable = calendarService.isSlotAvailable(selectedDate, selectedTime);
    
    if (!isAvailable) {
      const availableTimes = calendarService.generateAvailableTimes(selectedDate);
      const availableTimeSlots = availableTimes.filter(time => time.isAvailable);
      
      const aiResponse = await callGeminiAPI(
        `Selected time ${selectedTime} is no longer available. Show remaining times.`,
        context,
        context.conversationHistory,
        true
      );
      
      return res.json(formatResponse(
        aiResponse,
        availableTimeSlots.map(time => time.display),
        'get_time',
        { availableTimes: availableTimeSlots },
        sessionId
      ));
    }

    meetingState.data.time = selectedTime;
    meetingState.step = 6;
    meetingStates.set(sessionId, meetingState);

    const aiResponse = await callGeminiAPI(
      `Client selected time: ${selectedTime}. Confirm meeting details: ${meetingState.data.name}, ${meetingState.data.projectType}, ${meetingState.data.date}, ${selectedTime}`,
      context,
      context.conversationHistory,
      true
    );

    return res.json(formatResponse(
      aiResponse,
      ["Yes, confirm and book", "No, I need to make changes"],
      'confirm_meeting',
      { meeting: meetingState.data },
      sessionId
    ));
  }

  // Step 6: Confirm meeting
  if (meetingState.step === 6) {
    const userResponse = userMessage.toLowerCase();
    
    if (userResponse.includes('yes') || userResponse.includes('confirm') || userResponse.includes('book') || userResponse.includes('proceed')) {
      // Final availability check before booking
      const isAvailable = calendarService.isSlotAvailable(meetingState.data.date, meetingState.data.time);
      
      if (!isAvailable) {
        const nextDates = calendarService.generateAvailableDates();
        
        const aiResponse = await callGeminiAPI(
          "Selected time slot was just booked. Show alternative dates professionally.",
          context,
          context.conversationHistory,
          true
        );
        
        return res.json(formatResponse(
          aiResponse,
          nextDates.map(date => `${date.display} (${date.availability})`),
          'get_date',
          { availableDates: nextDates },
          sessionId
        ));
      }

      // Generate meeting ID and book the slot
      meetingState.data.id = 'MTG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      meetingState.data.timestamp = new Date().toISOString();

      // Book the slot in calendar
      const bookingResult = await calendarService.bookSlot({
        date: meetingState.data.date,
        time: meetingState.data.time,
        meetingId: meetingState.data.id,
        clientName: meetingState.data.name,
        projectType: meetingState.data.projectType
      });

      if (!bookingResult.success) {
        const aiResponse = await callGeminiAPI(
          "Booking failed. Apologize and suggest alternatives.",
          context,
          context.conversationHistory,
          true
        );
        
        return res.json(formatResponse(
          aiResponse,
          ["Choose different time", "Select another date", "Contact support"],
          'booking_failed',
          null,
          sessionId
        ));
      }

      meetingState.step = 7;
      meetingStates.set(sessionId, meetingState);

      const aiResponse = await callGeminiAPI(
        `Meeting booked successfully. Ask if should send confirmation to ${meetingState.data.email}`,
        context,
        context.conversationHistory,
        true
      );

      return res.json(formatResponse(
        aiResponse,
        ["Yes, send confirmation", "No, cancel booking"],
        'confirm_email_sending',
        { meeting: meetingState.data, bookingId: bookingResult.bookingId },
        sessionId
      ));
    } else {
      // User wants to make changes
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
        meetingState.step = 4; // Default to date selection
      }
      
      meetingStates.set(sessionId, meetingState);
      
      const stepMessages = {
        1: "Let's update your name. What should I call you?",
        2: "What's the best email to send your confirmation to?",
        3: "What type of construction project are you planning?",
        4: "Which consultation date works best for you?",
        5: "What time would you prefer for your consultation?"
      };
      
      const aiResponse = await callGeminiAPI(
        `Client wants to change ${Object.keys(stepMessages).find(key => stepMessages[key] === stepMessages[meetingState.step])}. Handle professionally.`,
        context,
        context.conversationHistory,
        true
      );
      
      return res.json(formatResponse(
        aiResponse,
        [],
        `get_${['name', 'email', 'project_type', 'date', 'time'][meetingState.step - 1]}`,
        null,
        sessionId
      ));
    }
  }

  // Step 7: Send confirmation email
  if (meetingState.step === 7) {
    const userResponse = userMessage.toLowerCase();
    
    if (userResponse.includes('yes') || userResponse.includes('send') || userResponse.includes('confirm')) {
      try {
        console.log('📧 AI Agent sending confirmation email...');
        
        const emailResult = await resendEmailService.sendMeetingConfirmation(meetingState.data);
        
        if (emailResult.success) {
          console.log('✅ AI Agent email sent successfully!');
          
          // Complete the meeting booking
          const finalMeetingData = { ...meetingState.data };
          meetingStates.delete(sessionId);
          
          const aiResponse = await callGeminiAPI(
            `Meeting confirmed and email sent successfully. Provide final confirmation message professionally.`,
            context,
            context.conversationHistory,
            true
          );
          
          return res.json(formatResponse(
            aiResponse,
            ["Schedule another consultation", "Our construction services", "Project cost estimation"],
            'meeting_completed',
            { 
              meetingId: finalMeetingData.id,
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
          
          const aiResponse = await callGeminiAPI(
            "Email failed but meeting is booked. Inform client professionally.",
            context,
            context.conversationHistory,
            true
          );
          
          return res.json(formatResponse(
            aiResponse,
            ["Schedule another meeting", "Our services", "Cost estimation"],
            'meeting_completed_fallback',
            { meetingId: meetingState.data.id, emailSent: false },
            sessionId
          ));
        }
      } catch (error) {
        console.error('❌ AI Agent email process error:', error);
        meetingStates.delete(sessionId);
        
        const aiResponse = await callGeminiAPI(
          "Email system error but meeting is booked. Provide fallback confirmation.",
          context,
          context.conversationHistory,
          true
        );
        
        return res.json(formatResponse(
          aiResponse,
          ["Schedule another consultation", "Our construction services", "Project planning"],
          'meeting_completed_fallback',
          { meetingId: meetingState.data.id, emailSent: false },
          sessionId
        ));
      }
    } else {
      // User canceled email sending
      await calendarService.cancelBooking(meetingState.data.date, meetingState.data.time);
      meetingStates.delete(sessionId);
      
      const aiResponse = await callGeminiAPI(
        "Client canceled email sending. Cancel booking professionally.",
        context,
        context.conversationHistory,
        true
      );
      
      return res.json(formatResponse(
        aiResponse,
        ["Schedule consultation", "Our services", "Cost estimation"],
        'meeting_canceled',
        null,
        sessionId
      ));
    }
  }
}

// ==================== HELPER FUNCTIONS ====================

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ==================== AI AGENT MAINTENANCE & ADMIN ROUTES ====================

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
  
  for (const [sessionId, meetingState] of meetingStates.entries()) {
    if (now - new Date(meetingState.createdAt || now).getTime() > twentyFourHours) {
      meetingStates.delete(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🤖 AI Agent cleaned up ${cleanedCount} old sessions`);
  }
}, 60 * 60 * 1000); // Run every hour

// AI Agent health check endpoint
router.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  res.json({
    status: 'AI Construction Agent Operational',
    agent: AGENT_PERSONALITY.name,
    role: AGENT_PERSONALITY.role,
    activeSessions: conversationContexts.size,
    activeConsultations: meetingStates.size,
    expertise: `${knowledge.projectPortfolio.totalCompleted} projects experience`,
    memoryUsage: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
    },
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
    timestamp: new Date().toISOString()
  });
});

// Get conversation statistics
router.get('/stats', (req, res) => {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  let activeLastHour = 0;
  for (const [sessionId, context] of conversationContexts.entries()) {
    if (new Date(context.lastInteraction).getTime() > oneHourAgo) {
      activeLastHour++;
    }
  }
  
  res.json({
    agent: AGENT_PERSONALITY.name,
    totalSessions: conversationContexts.size,
    activeLastHour: activeLastHour,
    activeConsultations: meetingStates.size,
    totalInteractions: Array.from(conversationContexts.values()).reduce((sum, ctx) => sum + ctx.interactionCount, 0),
    expertise: `${knowledge.projectPortfolio.totalCompleted} projects`,
    serverTime: new Date().toISOString()
  });
});

// Clear specific session context
router.post('/clear-context', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    let cleared = false;
    if (conversationContexts.has(sessionId)) {
      conversationContexts.delete(sessionId);
      cleared = true;
    }
    if (meetingStates.has(sessionId)) {
      meetingStates.delete(sessionId);
      cleared = true;
    }
    console.log('🤖 AI Agent cleared contexts for session:', sessionId);
    res.json({ success: true, cleared: cleared });
  } else {
    res.status(400).json({ success: false, error: 'Session ID required' });
  }
});

// Get session context (for debugging)
router.get('/context/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const context = conversationContexts.get(sessionId);
  const meetingState = meetingStates.get(sessionId);
  
  if (!context && !meetingState) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  
  res.json({
    success: true,
    sessionId,
    conversationContext: context,
    meetingState: meetingState
  });
});

// Reset rate limiting for a session
router.post('/reset-rate-limit', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && requestCounts.has(sessionId)) {
    requestCounts.delete(sessionId);
    console.log('🤖 AI Agent reset rate limit for session:', sessionId);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, error: 'Session ID not found' });
  }
});

module.exports = router;