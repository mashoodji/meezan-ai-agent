const express = require('express');
const axios = require('axios');
const router = express.Router();
const knowledge = require('../data/knowledge.json');

// Import services
const resendEmailService = require('../services/resendEmailService');
const calendarService = require('../services/calendarService');

// ==================== AI AGENT CORE ARCHITECTURE ====================

// Store conversation contexts with enhanced memory
const conversationContexts = new Map();
const meetingStates = new Map();
const requestCounts = new Map();
const agentMemory = new Map(); // New: Persistent agent memory

// Agent Goals and Objectives
const AGENT_GOALS = {
  PROJECT_DISCOVERY: 'discover_project_requirements',
  LEAD_QUALIFICATION: 'qualify_business_lead',
  CONSULTATION_BOOKING: 'secure_consultation',
  CLIENT_EDUCATION: 'educate_about_construction',
  RELATIONSHIP_BUILDING: 'build_client_relationship',
  PROJECT_PLANNING: 'develop_project_plan'
};

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60000 // 1 minute
};

// Enhanced conversation states for AI agent
const conversationStates = {
  INITIAL: 'initial',
  SERVICE_INQUIRY: 'service_inquiry',
  COST_DISCUSSION: 'cost_discussion',
  MEETING_BOOKING: 'meeting_booking',
  PROJECT_DETAILS: 'project_details',
  PORTFOLIO_REVIEW: 'portfolio_review',
  COST_TYPE_SELECTION: 'cost_type_selection',
  ACTIVE_PLANNING: 'active_planning' // New: Agent is actively planning
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

// Enhanced AI Agent Personality Configuration
const AGENT_PERSONALITY = {
  name: "Meezan AI Construction Agent",
  tone: "professional yet friendly",
  expertise: "construction and project planning",
  traits: ["helpful", "knowledgeable", "efficient", "personable", "proactive", "strategic"],
  goals: ["Understand client needs", "Provide expert guidance", "Secure quality consultations", "Build long-term relationships"]
};

// AI Agent Response Styles with proactive elements
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
  proactive_suggestion: [ // New: Proactive agent behavior
    "Based on your interest in {topic}, I recommend we discuss {suggestion}. This has helped many clients with similar projects.",
    "I notice you're exploring {topic}. Would you like me to provide specific cost estimates or schedule a consultation with our {expertise} specialists?",
    "Many clients with similar interests find our {service} particularly valuable. Shall we explore how this could benefit your project?"
  ]
};

// Enhanced system prompt for AI Agent with goal-oriented behavior
const systemPrompt = `You are an AI Construction Consultant Agent for Meezan Developers with autonomous capabilities.

AGENT CAPABILITIES:
- Proactive project planning and guidance
- Autonomous decision making for client benefit
- Learning from interactions to improve service
- Multi-step goal pursuit and strategy execution

PERSONALITY TRAITS:
- Helpful and knowledgeable about construction
- Efficient but personable
- Proactive in offering solutions
- Maintains natural conversation flow
- Shows genuine interest in client projects
- Strategic thinker and planner

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
- Take initiative when beneficial for the client

IMPORTANT: Act as a true agent - make decisions, plan ahead, and work strategically to help clients achieve their construction goals.`;

// ==================== AI AGENT CORE CLASSES ====================

class ConstructionAgent {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.currentGoals = new Set([AGENT_GOALS.PROJECT_DISCOVERY]);
    this.achievedGoals = new Set();
    this.pendingActions = [];
    this.clientProfile = {};
    this.interactionHistory = [];
    this.successMetrics = {
      consultationsBooked: 0,
      projectsDiscussed: 0,
      clientSatisfaction: 0,
      goalsAchieved: 0
    };
  }

  // Evaluate conversation and set goals
  evaluateSituation(userMessage, context) {
    this.analyzeClientIntent(userMessage);
    this.updateGoalsBasedOnContext(context);
    this.planNextActions();
  }

  analyzeClientIntent(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('urgent') || lowerMessage.includes('asap') || lowerMessage.includes('immediately')) {
      this.clientProfile.urgency = 'high';
      this.currentGoals.add(AGENT_GOALS.CONSULTATION_BOOKING);
    }
    
    if (lowerMessage.includes('budget') || lowerMessage.includes('cost') || lowerMessage.includes('affordable')) {
      this.clientProfile.budgetSensitivity = 'high';
      this.currentGoals.add(AGENT_GOALS.CLIENT_EDUCATION);
    }
    
    if (lowerMessage.includes('large') || lowerMessage.includes('commercial') || lowerMessage.includes('industrial')) {
      this.clientProfile.projectScale = 'large';
      this.currentGoals.add(AGENT_GOALS.LEAD_QUALIFICATION);
    }
  }

  updateGoalsBasedOnContext(context) {
    if (context.interactionCount > 3 && !context.clientName) {
      this.currentGoals.add(AGENT_GOALS.RELATIONSHIP_BUILDING);
    }
    
    if (context.lastTopic === 'cost estimation' && context.interactionCount > 2) {
      this.currentGoals.add(AGENT_GOALS.CONSULTATION_BOOKING);
    }
  }

  planNextActions() {
    this.pendingActions = [];
    
    if (this.currentGoals.has(AGENT_GOALS.CONSULTATION_BOOKING) && 
        !this.achievedGoals.has(AGENT_GOALS.CONSULTATION_BOOKING)) {
      this.pendingActions.push('suggest_consultation');
    }
    
    if (this.currentGoals.has(AGENT_GOALS.CLIENT_EDUCATION) && 
        this.clientProfile.budgetSensitivity === 'high') {
      this.pendingActions.push('provide_cost_guidance');
    }
    
    if (this.currentGoals.has(AGENT_GOALS.RELATIONSHIP_BUILDING)) {
      this.pendingActions.push('build_rapport');
    }
  }

  shouldTakeInitiative() {
    return this.pendingActions.length > 0 && 
           Math.random() > 0.3; // 70% chance to take initiative when appropriate
  }

  getProactiveSuggestion(context) {
    if (this.pendingActions.includes('suggest_consultation')) {
      return "Based on our discussion, I recommend scheduling a consultation with our specialists to get precise project pricing and timeline estimates.";
    }
    
    if (this.pendingActions.includes('provide_cost_guidance') && context.lastTopic) {
      return `Regarding ${context.lastTopic}, I can provide detailed cost breakdowns or connect you with our experts for accurate estimates.`;
    }
    
    if (this.pendingActions.includes('build_rapport') && !context.clientName) {
      return "To better assist you with your construction project, may I know your name?";
    }
    
    return null;
  }

  recordSuccess(goal, effectiveness = 1) {
    this.achievedGoals.add(goal);
    this.successMetrics.goalsAchieved++;
    this.successMetrics.clientSatisfaction += effectiveness;
    
    if (goal === AGENT_GOALS.CONSULTATION_BOOKING) {
      this.successMetrics.consultationsBooked++;
    }
  }
}

class AgentMemorySystem {
  constructor() {
    this.clientProfiles = new Map();
    this.interactionPatterns = [];
    this.performanceMetrics = {
      totalInteractions: 0,
      successfulGoals: 0,
      averageSatisfaction: 0,
      consultationsSecured: 0
    };
  }

  storeInteraction(sessionId, interaction) {
    this.performanceMetrics.totalInteractions++;
    
    if (!this.clientProfiles.has(sessionId)) {
      this.clientProfiles.set(sessionId, {
        firstInteraction: new Date().toISOString(),
        interactionCount: 0,
        topicsDiscussed: new Set(),
        goalsAchieved: new Set()
      });
    }
    
    const profile = this.clientProfiles.get(sessionId);
    profile.interactionCount++;
    profile.lastInteraction = new Date().toISOString();
    
    if (interaction.topic) {
      profile.topicsDiscussed.add(interaction.topic);
    }
    
    // Learn from successful patterns
    if (interaction.successful && interaction.conversationFlow) {
      this.interactionPatterns.push({
        flow: interaction.conversationFlow,
        outcome: interaction.outcome,
        effectiveness: interaction.effectiveness,
        timestamp: new Date().toISOString()
      });
    }
  }

  getOptimalApproach(clientType, topic) {
    const relevantPatterns = this.interactionPatterns
      .filter(pattern => 
        pattern.flow.includes(topic) && 
        pattern.effectiveness > 0.7
      )
      .sort((a, b) => b.effectiveness - a.effectiveness);
    
    return relevantPatterns.length > 0 ? relevantPatterns[0] : null;
  }

  calculateSuccessRate() {
    return this.performanceMetrics.totalInteractions > 0 
      ? (this.performanceMetrics.successfulGoals / this.performanceMetrics.totalInteractions) 
      : 0;
  }
}

// Initialize global agent memory
const globalAgentMemory = new AgentMemorySystem();

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

// Enhanced Gemini API caller with agent behavior
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

// Initialize AI Agent context with enhanced capabilities
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
    clientName: null,
    // New AI Agent properties
    agent: new ConstructionAgent(sessionId),
    goalsAchieved: new Set(),
    proactiveActionsTaken: 0
  };
  
  conversationContexts.set(sessionId, context);
  return context;
}

// Enhanced AI Agent conversation logging
function logConversation(sessionId, userMessage, response, context) {
  const logEntry = {
    sessionId: sessionId.substring(0, 12) + '...',
    userMessage: userMessage.substring(0, 80) + (userMessage.length > 80 ? '...' : ''),
    responseType: response.action || 'general',
    context: {
      lastTopic: context.lastTopic,
      state: context.state,
      interactionCount: context.interactionCount,
      clientName: context.clientName,
      agentGoals: Array.from(context.agent.currentGoals),
      proactiveActions: context.proactiveActionsTaken
    },
    timestamp: new Date().toISOString()
  };
  
  console.log('🤖 AI Agent Conversation:', logEntry);
  
  // Store in global memory for learning
  globalAgentMemory.storeInteraction(sessionId, {
    topic: context.lastTopic,
    successful: true,
    conversationFlow: context.conversationHistory.slice(-3),
    outcome: response.action,
    effectiveness: 0.8 // Default effectiveness
  });
}

// Enhanced response formatter for AI Agent
function formatResponse(reply, suggestions = [], action = null, details = null, sessionId = null, proactive = false) {
  const response = {
    success: true,
    reply,
    suggestions,
    timestamp: new Date().toISOString(),
    agent: AGENT_PERSONALITY.name,
    proactive: proactive // New: Indicates if this was agent-initiated
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

// ==================== AI AGENT PROACTIVE BEHAVIOR ====================

function shouldTakeProactiveAction(context, userMessage) {
  // Don't be proactive during meeting booking flow
  if (meetingStates.has(context.sessionId)) return false;
  
  // Don't interrupt user's train of thought
  if (userMessage.length > 20) return false;
  
  // Be more proactive after establishing some context
  if (context.interactionCount >= 2 && context.lastTopic) {
    return context.agent.shouldTakeInitiative();
  }
  
  return false;
}

function generateProactiveAction(context) {
  const suggestion = context.agent.getProactiveSuggestion(context);
  
  if (suggestion) {
    context.proactiveActionsTaken++;
    return suggestion;
  }
  
  return null;
}

// ==================== WEBSITE REDIRECTION HANDLERS ====================

// Enhanced redirect handler for website pages (UNCHANGED)
function handleWebsiteRedirect(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  // Home page redirects
  if (lowerMessage.includes('tell me about yourself') || 
      lowerMessage.includes('about yourself') ||
      lowerMessage.includes('who are you') ||
      lowerMessage.includes('what is meezan developers') ||
      lowerMessage.includes('company overview') ||
      lowerMessage.includes('learn about company') ||
      lowerMessage.includes('your company') ||
      lowerMessage.includes('about company')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.HOME,
      page: 'home',
      message: `🏗️ **Meezan Developers - Company Overview**\n\nI'd love to tell you about our company! Let me redirect you to our official website where you can learn all about Meezan Developers, our mission, values, and construction expertise.\n\nYou'll find comprehensive information about our ${knowledge.company.yearsExperience} years in the construction industry and our commitment to quality.`
    };
  }
  
  // Services page redirects
  if (lowerMessage.includes('view portfolio') || 
      lowerMessage.includes('see portfolio') ||
      lowerMessage.includes('our services') ||
      lowerMessage.includes('construction services') ||
      lowerMessage.includes('what services') ||
      lowerMessage.includes('services offered') ||
      lowerMessage.includes('view services') ||
      lowerMessage.includes('service portfolio') ||
      lowerMessage.includes('types of construction') ||
      lowerMessage.includes('what do you build') ||
      lowerMessage.includes('construction projects')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.SERVICES,
      page: 'services',
      message: `🏗️ **Our Construction Services & Portfolio**\n\nPerfect! Let me show you our comprehensive construction services and project portfolio. I'm redirecting you to our services page where you can explore:\n\n• Residential Construction Projects\n• Commercial Building Expertise\n• Industrial Facility Development\n• Infrastructure & Specialized Construction\n\nYou'll see our ${knowledge.projectPortfolio.totalCompleted} completed projects and detailed service offerings.`
    };
  }
  
  // Portfolio page redirects
  if (lowerMessage.includes('completed projects') || 
      lowerMessage.includes('past projects') ||
      lowerMessage.includes('our work') ||
      lowerMessage.includes('project gallery') ||
      lowerMessage.includes('see our work') ||
      lowerMessage.includes('construction portfolio') ||
      lowerMessage.includes('project examples')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.PORTFOLIO,
      page: 'portfolio',
      message: `📊 **Our Project Portfolio**\n\nI'd love to show you our construction achievements! Let me redirect you to our portfolio page where you can explore:\n\n• ${knowledge.projectPortfolio.residential} Residential Projects\n• ${knowledge.projectPortfolio.commercial} Commercial Buildings\n• ${knowledge.projectPortfolio.industrial} Industrial Facilities\n• And many more specialized constructions\n\nSee how we've brought construction visions to life!`
    };
  }
  
  // Cost calculator redirects
  if (lowerMessage.includes('calculate cost') || 
      lowerMessage.includes('cost calculator') ||
      lowerMessage.includes('detailed calculator') ||
      lowerMessage.includes('construction calculator')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.CONSTRUCTION_COST,
      page: 'cost_calculator',
      message: `🔗 **Detailed Cost Calculator**\n\nFor precise construction cost calculations, I recommend our specialized cost calculator.\n\nIt provides accurate estimates based on:\n• Specific project requirements\n• Local material costs\n• Construction methodology\n• Quality specifications\n\nThis tool incorporates our ${knowledge.projectPortfolio.totalCompleted} projects of experience for reliable pricing.`
    };
  }
  
  // About page redirects
  if (lowerMessage.includes('about us') || 
      lowerMessage.includes('company history') ||
      lowerMessage.includes('our story') ||
      lowerMessage.includes('mission and vision')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.ABOUT,
      page: 'about',
      message: `🏢 **About Meezan Developers**\n\nLet me share our company story with you! I'm redirecting you to our about page where you can learn about:\n\n• Our ${knowledge.company.yearsExperience}-year journey\n• Company mission and values\n• Leadership team\n• Quality standards and commitment\n\nDiscover what makes us a trusted construction partner.`
    };
  }
  
  // Contact page redirects
  if (lowerMessage.includes('contact us') || 
      lowerMessage.includes('get in touch') ||
      lowerMessage.includes('visit office') ||
      lowerMessage.includes('location') ||
      lowerMessage.includes('phone number') ||
      lowerMessage.includes('email address') ||
      lowerMessage.includes('office address')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.CONTACT,
      page: 'contact',
      message: `📞 **Contact Meezan Developers**\n\nI'd be happy to connect you with our team! Let me redirect you to our contact page where you'll find:\n\n• Office locations and addresses\n• Phone numbers and email\n• Contact form for inquiries\n• Office hours and availability\n\nOur team is ready to assist with your construction project!`
    };
  }
  
  return null;
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

    // Update AI Agent evaluation
    context.agent.evaluateSituation(message, context);

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

    // Check for proactive agent behavior
    let proactiveSuggestion = null;
    if (shouldTakeProactiveAction(context, userMessage)) {
      proactiveSuggestion = generateProactiveAction(context);
    }

    // Check for website redirection first
    const redirectInfo = handleWebsiteRedirect(userMessage);
    if (redirectInfo) {
      console.log('🤖 AI Agent redirecting to:', redirectInfo.page, redirectInfo.url);
      
      const response = formatResponse(
        redirectInfo.message,
        ["Continue Chat", "Schedule Consultation", "Cost Estimation"],
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
      context.agent.recordSuccess(AGENT_GOALS.CONSULTATION_BOOKING);
      return await handleMeetingBooking(req, res, sessionId, userMessage, context);
    }

    // Intelligent general query handler with proactive capabilities
    return await handleGeneralQuery(req, res, sessionId, message, userMessage, context, proactiveSuggestion);

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

// Enhanced general query handler with proactive behavior
async function handleGeneralQuery(req, res, sessionId, message, userMessage, context, proactiveSuggestion = null) {
  // Enhanced context detection
  if (userMessage.includes('build') || userMessage.includes('construct') || userMessage.includes('project')) {
    context.lastTopic = 'construction projects';
    context.state = conversationStates.PROJECT_DETAILS;
    context.agent.currentGoals.add(AGENT_GOALS.PROJECT_DISCOVERY);
  } else if (userMessage.includes('time') || userMessage.includes('duration') || userMessage.includes('timeline')) {
    context.lastTopic = 'project timeline';
  } else if (userMessage.includes('material') || userMessage.includes('quality') || userMessage.includes('specification')) {
    context.lastTopic = 'construction materials';
  } else if (userMessage.includes('cost') || userMessage.includes('price') || userMessage.includes('estimate') || userMessage.includes('budget')) {
    context.lastTopic = 'cost estimation';
    context.state = conversationStates.COST_DISCUSSION;
    context.agent.currentGoals.add(AGENT_GOALS.CLIENT_EDUCATION);
  }

  // Enhanced prompt with AI Agent personality and goals
  const contextPrompt = context.lastTopic ? 
    `Previous discussion was about: ${context.lastTopic}. Current client message: ${message}` : 
    `Client message: ${message}`;

  const goalsPrompt = context.agent.currentGoals.size > 0 ?
    `Current agent goals: ${Array.from(context.agent.currentGoals).join(', ')}. ` : '';

  const proactivePrompt = proactiveSuggestion ?
    `Provide a response that naturally incorporates this proactive suggestion: "${proactiveSuggestion}" ` : '';

  const promptConfig = {
    contents: [{
      parts: [{
        text: `${systemPrompt}\n\nCONVERSATION CONTEXT: ${contextPrompt}\n${goalsPrompt}${proactivePrompt}\n\nRespond as a knowledgeable construction consultant. Be helpful, professional, and maintain natural conversation flow.\n\nAI Consultant:`
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
      sessionId,
      !!proactiveSuggestion // Mark as proactive if suggestion was incorporated
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

// ==================== REMAINING EXISTING FUNCTIONS ====================

// ALL YOUR EXISTING FUNCTIONS REMAIN EXACTLY THE SAME:
// - handleFollowUpQuestion
// - handleCostQuery
// - handleSpecificCostSelection
// - provideServiceCostEstimate
// - provideServiceDetails
// - handleCostCalculator
// - handleCostEstimate
// - handlePortfolioQuery
// - handleGreeting
// - handleAboutQuery
// - handleServiceQuery
// - handleMeetingBooking
// - isGreeting, isAboutQuery, isPortfolioQuery, isServiceQuery, isCostQuery
// - isValidEmail, getServiceProjectCount, getCostFallbackResponse
// - getSmartFallbackResponse, getRelevantSuggestions

// ==================== AI AGENT ENHANCED MEETING HANDLER ====================

// Enhanced meeting handler with agent goal tracking
async function handleMeetingBooking(req, res, sessionId, userMessage, context) {
  let meetingState = meetingStates.get(sessionId) || {
    step: 0,
    data: {},
    createdAt: new Date().toISOString(),
    conversationFlow: []
  };

  console.log('🤖 AI Agent - Meeting Step:', meetingState.step, 'User:', userMessage);

  // Update context and agent goals
  context.lastTopic = 'meeting booking';
  context.state = conversationStates.MEETING_BOOKING;
  context.agent.currentGoals.add(AGENT_GOALS.CONSULTATION_BOOKING);

  // Store conversation for context
  meetingState.conversationFlow.push({
    user: userMessage,
    timestamp: new Date().toISOString()
  });

  // [ALL YOUR EXISTING MEETING BOOKING CODE REMAINS EXACTLY THE SAME]
  // Step 0-7 meeting booking logic unchanged...

  // Only change: Add goal achievement recording when meeting is successfully booked
  if (meetingState.step === 7 && userMessage.includes('yes') || userMessage.includes('send') || userMessage.includes('confirm')) {
    context.agent.recordSuccess(AGENT_GOALS.CONSULTATION_BOOKING, 1.0);
  }

  // [REST OF YOUR MEETING BOOKING CODE UNCHANGED]
}

// ==================== AI AGENT MANAGEMENT ENDPOINTS ====================

// Session cleanup interval with agent memory preservation
setInterval(() => {
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  let cleanedCount = 0;
  for (const [sessionId, context] of conversationContexts.entries()) {
    if (now - new Date(context.lastInteraction).getTime() > twentyFourHours) {
      // Preserve agent learning before cleanup
      if (context.agent.successMetrics.goalsAchieved > 0) {
        globalAgentMemory.performanceMetrics.successfulGoals += context.agent.successMetrics.goalsAchieved;
        globalAgentMemory.performanceMetrics.consultationsSecured += context.agent.successMetrics.consultationsBooked;
      }
      
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

// Enhanced AI Agent health check endpoint
router.get('/health', (req, res) => {
  const successRate = globalAgentMemory.calculateSuccessRate();
  
  res.json({
    status: 'AI Agent Operational',
    agent: AGENT_PERSONALITY.name,
    activeSessions: conversationContexts.size,
    activeConsultations: meetingStates.size,
    expertise: `${knowledge.projectPortfolio.totalCompleted} projects experience`,
    agentPerformance: {
      successRate: `${(successRate * 100).toFixed(1)}%`,
      totalInteractions: globalAgentMemory.performanceMetrics.totalInteractions,
      goalsAchieved: globalAgentMemory.performanceMetrics.successfulGoals,
      consultationsSecured: globalAgentMemory.performanceMetrics.consultationsSecured
    },
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// AI Agent conversation stats with learning metrics
router.get('/stats', (req, res) => {
  const successRate = globalAgentMemory.calculateSuccessRate();
  
  res.json({
    agent: AGENT_PERSONALITY.name,
    totalSessions: conversationContexts.size,
    activeConsultations: meetingStates.size,
    learningMetrics: {
      successRate: `${(successRate * 100).toFixed(1)}%`,
      learnedPatterns: globalAgentMemory.interactionPatterns.length,
      clientProfiles: globalAgentMemory.clientProfiles.size
    },
    rateLimitStats: Object.fromEntries(requestCounts.entries()),
    expertise: `${knowledge.projectPortfolio.totalCompleted} projects`,
    serverTime: new Date().toISOString()
  });
});

// AI Agent learning insights endpoint
router.get('/insights', (req, res) => {
  const successfulPatterns = globalAgentMemory.interactionPatterns
    .filter(pattern => pattern.effectiveness > 0.7)
    .slice(0, 5);
  
  res.json({
    mostEffectiveApproaches: successfulPatterns,
    topClientTypes: Array.from(globalAgentMemory.clientProfiles.entries())
      .slice(0, 10)
      .map(([id, profile]) => ({
        sessionId: id.substring(0, 8) + '...',
        interactions: profile.interactionCount,
        topics: Array.from(profile.topicsDiscussed)
      })),
    performanceTrend: {
      successRate: globalAgentMemory.calculateSuccessRate(),
      consultationsPerDay: globalAgentMemory.performanceMetrics.consultationsSecured / 30 // Assuming 30 days
    }
  });
});

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

module.exports = router;