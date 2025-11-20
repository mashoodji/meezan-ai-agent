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

// AI Agent Identity Configuration
const AI_AGENT = {
  name: "Meezan AI Construction Consultant",
  role: "Senior Construction Advisor",
  expertise: `${knowledge.company.yearsExperience} years construction experience`,
  personality: "Knowledgeable, helpful, professional, and genuinely interested in client projects",
  specialties: ["Cost Estimation", "Project Planning", "Construction Consulting", "Team Coordination"]
};

// Enhanced conversation states
const conversationStates = {
  INITIAL: 'initial',
  PROJECT_DISCUSSION: 'project_discussion',
  COST_ANALYSIS: 'cost_analysis',
  TIMELINE_PLANNING: 'timeline_planning',
  MEETING_COORDINATION: 'meeting_coordination',
  SERVICE_GUIDANCE: 'service_guidance',
  EXPERT_CONSULTATION: 'expert_consultation'
};

// Updated calculator URL for production
const CALCULATOR_URL = 'https://meezandevelopers.com/construction-cost';

// AI Agent Response Library
const AGENT_RESPONSES = {
  greetings: [
    `Hello! I'm ${AI_AGENT.name}. With our ${knowledge.company.yearsExperience} years and ${knowledge.projectPortfolio.totalCompleted} projects of construction experience, I'm here to help bring your vision to life. What project are you considering?`,
    `Welcome! I'm your AI construction consultant at Meezan Developers. We've successfully delivered ${knowledge.projectPortfolio.totalCompleted} projects across Pakistan. How can I assist with your construction plans today?`,
    `Good day! I'm ${AI_AGENT.role} for Meezan Developers. Our team brings ${knowledge.company.yearsExperience} years of construction expertise to every project. What are you looking to build?`
  ],
  
  project_interest: [
    `That sounds exciting! {projectType} projects are one of our specialties. Based on our {projectCount} {projectType} projects, I can provide some valuable insights. What specific aspects are you most curious about?`,
    `Excellent choice! We have extensive experience with {projectType} construction. Our team has completed {projectCount} similar projects. Tell me more about what you have in mind.`,
    `Wonderful! {projectType} construction is where we truly excel. With {projectCount} successful {projectType} projects, we understand the unique requirements. What's your vision for this project?`
  ],
  
  cost_guidance: [
    `Based on our current {projectType} projects and market analysis, I can provide some cost guidance. Our rates typically range from {priceRange} depending on specifications. Would you like a detailed breakdown?`,
    `I'd be happy to discuss {projectType} construction costs. From our recent projects, pricing generally falls between {priceRange} based on quality levels and specific requirements.`,
    `For {projectType} projects, our experience shows costs typically range {priceRange}. This varies based on {costFactors}. Would you like me to connect you with our estimation team for precise figures?`
  ],
  
  meeting_arrangement: [
    `I'd be delighted to arrange a consultation with our {projectType} specialists. They can provide detailed insights specific to your project. When would work best for you?`,
    `Perfect timing! Our {projectType} experts would love to discuss your project in detail. Let me check their availability for you.`,
    `Excellent! I'll coordinate with our {projectType} team to schedule a comprehensive consultation. They'll provide expert guidance tailored to your specific needs.`
  ]
};

// ==================== AI AGENT CORE FUNCTIONS ====================

// Advanced intent recognition
function understandUserIntent(message, context) {
  const lowerMessage = message.toLowerCase();
  
  // Project discussions with natural language
  if (/(?:build|construct|create|develop|make|erect).*(?:house|home|building|facility|structure|project|office|factory)/.test(lowerMessage) ||
      /(?:want|need|planning|considering).*(?:construct|build|make).*(?:house|home|building)/.test(lowerMessage)) {
    return { intent: 'project_discussion', confidence: 0.92, details: extractProjectDetails(message) };
  }
  
  // Cost inquiries with variations
  if (/(?:how much|what.*cost|what.*price|budget|investment|afford|expensive|cost.*estimate)/.test(lowerMessage) ||
      /(?:price.*range|cost.*range|approximately.*cost|rough.*estimate)/.test(lowerMessage)) {
    return { intent: 'cost_inquiry', confidence: 0.88, details: extractCostContext(message) };
  }
  
  // Timeline and planning
  if (/(?:how long|timeline|timeframe|duration|schedule|when.*complete|completion.*time)/.test(lowerMessage)) {
    return { intent: 'timeline_inquiry', confidence: 0.85 };
  }
  
  // Natural meeting requests
  if (/(?:meet|talk|discuss|consult|schedule|appointment|call|visit|sit down|coordinate)/.test(lowerMessage) &&
      !/(?:no|not|don't|dont).*(?:meet|talk|discuss)/.test(lowerMessage)) {
    return { intent: 'meeting_request', confidence: 0.87 };
  }
  
  // Service and capability inquiries
  if (/(?:what.*do|services|offer|provide|specialize|expertise|capabilities|can you build)/.test(lowerMessage)) {
    return { intent: 'service_inquiry', confidence: 0.83 };
  }
  
  // Portfolio and experience
  if (/(?:experience|portfolio|past work|completed projects|previous work|show.*projects)/.test(lowerMessage)) {
    return { intent: 'portfolio_inquiry', confidence: 0.84 };
  }
  
  // Material and quality discussions
  if (/(?:material|quality|specification|standard|grade|type.*material)/.test(lowerMessage)) {
    return { intent: 'quality_inquiry', confidence: 0.81 };
  }
  
  return { intent: 'general_conversation', confidence: 0.5 };
}

// Extract project details from natural language
function extractProjectDetails(message) {
  const details = {};
  const lowerMessage = message.toLowerCase();
  
  // Project type detection
  if (/(house|home|residential|villa|apartment)/.test(lowerMessage)) details.type = 'residential';
  else if (/(commercial|office|business|shop|mall|retail)/.test(lowerMessage)) details.type = 'commercial';
  else if (/(industrial|factory|warehouse|manufacturing|plant)/.test(lowerMessage)) details.type = 'industrial';
  
  return details;
}

// Natural response generator
function generateAgentResponse(type, variables = {}, context = {}) {
  const templates = AGENT_RESPONSES[type] || ["I'd be happy to help with that!"];
  let template = templates[Math.floor(Math.random() * templates.length)];
  
  // Replace variables
  template = template.replace(/{(\w+)}/g, (match, key) => {
    if (variables[key]) return variables[key];
    if (knowledge[key]) return knowledge[key];
    return match;
  });
  
  return template;
}

// Intelligent input processing
function processUserInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '').slice(0, 600);
}

// Rate limiting with professional messaging
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

// Initialize AI Agent context
function initializeAgentContext(sessionId) {
  const context = {
    sessionId,
    clientName: null,
    currentProject: null,
    lastIntent: null,
    conversationHistory: [],
    interactionCount: 0,
    lastInteraction: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    state: conversationStates.INITIAL
  };
  
  conversationContexts.set(sessionId, context);
  return context;
}

// AI Agent response formatter
function formatAgentResponse(reply, suggestions = [], action = null, details = null, sessionId = null) {
  const response = {
    success: true,
    reply,
    suggestions,
    timestamp: new Date().toISOString(),
    agent: {
      name: AI_AGENT.name,
      role: AI_AGENT.role,
      expertise: AI_AGENT.expertise
    }
  };
  
  if (action) response.action = action;
  if (details) response.details = details;
  if (sessionId) response.sessionId = sessionId;
  
  return response;
}

// ==================== AI AGENT CONVERSATION HANDLERS ====================

router.post('/chat', async (req, res) => {
  try {
    let { message, sessionId } = req.body;
    
    // Professional input validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        reply: "I'd love to help with your construction project! Could you please share what you're looking to build or discuss?",
        agent: AI_AGENT
      });
    }
    
    // Process input
    message = processUserInput(message);
    sessionId = sessionId || 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    
    // Professional rate limiting
    if (isRateLimited(sessionId)) {
      return res.status(429).json({
        success: false,
        reply: `I'm currently assisting several clients with their construction projects. Please give me a moment, or for immediate assistance, our construction team can be reached at ${knowledge.company.contact.phone}.`,
        agent: AI_AGENT
      });
    }

    console.log('🤖 AI Agent Processing:', message);
    const userMessage = message.toLowerCase().trim();
    
    // Get or initialize AI Agent context
    const context = conversationContexts.get(sessionId) || initializeAgentContext(sessionId);

    // Update conversation tracking
    context.lastInteraction = new Date().toISOString();
    context.interactionCount++;
    context.conversationHistory.push({ 
      user: message, 
      timestamp: new Date().toISOString(),
      type: 'client_input'
    });

    // Intelligent intent recognition
    const intent = understandUserIntent(message, context);
    context.lastIntent = intent;
    
    console.log('🎯 AI Agent Intent:', intent);

    // Manage conversation history
    if (context.conversationHistory.length > 12) {
      context.conversationHistory = context.conversationHistory.slice(-10);
    }

    // Check for ongoing meeting coordination
    const meetingState = meetingStates.get(sessionId);
    if (meetingState && meetingState.step > 0) {
      return await handleMeetingCoordination(req, res, sessionId, userMessage, context, meetingState);
    }

    // Handle based on recognized intent
    switch (intent.intent) {
      case 'project_discussion':
        return await handleProjectDiscussion(req, res, sessionId, message, context, intent.details);
      
      case 'cost_inquiry':
        return await handleCostInquiry(req, res, sessionId, message, context);
      
      case 'timeline_inquiry':
        return await handleTimelineInquiry(res, sessionId, context);
      
      case 'meeting_request':
        return await handleMeetingCoordination(req, res, sessionId, userMessage, context);
      
      case 'service_inquiry':
        return await handleServiceInquiry(res, sessionId, context);
      
      case 'portfolio_inquiry':
        return await handlePortfolioInquiry(res, sessionId, context);
      
      case 'quality_inquiry':
        return await handleQualityInquiry(res, sessionId, context);
      
      default:
        return await handleGeneralConstructionConversation(req, res, sessionId, message, context);
    }

  } catch (error) {
    console.error('❌ AI Agent System Error:', error);
    
    return res.json({ 
      success: true,
      reply: `I'd be delighted to help with your construction project! For comprehensive assistance, you can also reach our expert construction team at ${knowledge.company.contact.phone}.`,
      suggestions: ["Schedule expert consultation", "Discuss project requirements", "Get construction guidance"],
      agent: AI_AGENT
    });
  }
});

// Project Discussion Handler
async function handleProjectDiscussion(req, res, sessionId, message, context, projectDetails) {
  context.state = conversationStates.PROJECT_DISCUSSION;
  
  if (projectDetails.type) {
    context.currentProject = context.currentProject || {};
    context.currentProject.type = projectDetails.type;
    
    const projectCount = getProjectTypeCount(projectDetails.type);
    const variables = {
      projectType: projectDetails.type,
      projectCount: projectCount
    };
    
    const reply = generateAgentResponse('project_interest', variables, context);
    
    const response = formatAgentResponse(
      reply,
      ["Cost guidance", "Timeline discussion", "Schedule expert consultation"],
      'project_discussion_started',
      { projectType: projectDetails.type, projectCount },
      sessionId
    );
    
    return res.json(response);
  }
  
  const response = formatAgentResponse(
    "That sounds like an exciting project! I'd love to learn more about what you're planning to build. Could you tell me more about the type of construction you're considering?",
    ["Residential projects", "Commercial construction", "Industrial facilities", "Cost estimation"],
    'project_exploration',
    null,
    sessionId
  );
  
  return res.json(response);
}

// Cost Inquiry Handler
async function handleCostInquiry(req, res, sessionId, message, context) {
  context.state = conversationStates.COST_ANALYSIS;
  
  const projectType = context.currentProject?.type || 'construction';
  const priceRange = getPriceRange(projectType);
  
  const reply = generateAgentResponse('cost_guidance', {
    projectType: projectType,
    priceRange: priceRange,
    costFactors: knowledge.constructionCosts.costFactors.join(', ')
  }, context);
  
  const response = formatAgentResponse(
    reply,
    ["Detailed cost analysis", "Project-specific estimation", "Expert consultation"],
    'cost_guidance_provided',
    { projectType, priceRange, precision: 'general' },
    sessionId
  );
  
  return res.json(response);
}

// Timeline Inquiry Handler
async function handleTimelineInquiry(res, sessionId, context) {
  context.state = conversationStates.TIMELINE_PLANNING;
  
  const projectType = context.currentProject?.type || 'construction';
  const timeline = getTypicalTimeline(projectType);
  
  const reply = `Based on our ${getProjectTypeCount(projectType)} ${projectType} projects, typical construction timelines range ${timeline}. This varies based on project scale, complexity, and specific requirements. Our project management team ensures efficient scheduling while maintaining quality standards.`;
  
  const response = formatAgentResponse(
    reply,
    ["Detailed timeline planning", "Project phasing discussion", "Schedule planning session"],
    'timeline_guidance',
    { projectType, typicalTimeline: timeline },
    sessionId
  );
  
  return res.json(response);
}

// Service Inquiry Handler
async function handleServiceInquiry(res, sessionId, context) {
  context.state = conversationStates.SERVICE_GUIDANCE;
  
  const topServices = knowledge.services.slice(0, 4);
  const reply = `At Meezan Developers, we offer comprehensive construction solutions backed by ${knowledge.company.yearsExperience} years of experience. Our core services include:\n\n${topServices.map(service => `🏗️ **${service.name}**\n${service.description}`).join('\n\n')}\n\nWe've successfully delivered ${knowledge.projectPortfolio.totalCompleted} projects across all construction sectors.`;

  const response = formatAgentResponse(
    reply,
    ["Residential construction", "Commercial projects", "Industrial facilities", "Expert consultation"],
    'services_overview',
    { totalProjects: knowledge.projectPortfolio.totalCompleted },
    sessionId
  );
  
  return res.json(response);
}

// Portfolio Inquiry Handler
async function handlePortfolioInquiry(res, sessionId, context) {
  const reply = `🏗️ **Meezan Developers Project Portfolio**\n\nWith ${knowledge.company.yearsExperience} years of construction excellence, our portfolio showcases ${knowledge.projectPortfolio.totalCompleted} successful projects:\n\n• **Residential:** ${knowledge.projectPortfolio.residential} projects (Houses, Villas, Apartments)\n• **Commercial:** ${knowledge.projectPortfolio.commercial} projects (Offices, Malls, Business Centers)\n• **Industrial:** ${knowledge.projectPortfolio.industrial} facilities (Factories, Warehouses)\n• **Infrastructure:** ${knowledge.projectPortfolio.infrastructure} projects\n• **Institutional:** ${knowledge.projectPortfolio.educational} educational + ${knowledge.projectPortfolio.religious} religious buildings\n\nOur portfolio reflects our commitment to quality across all construction sectors.`;

  const response = formatAgentResponse(
    reply,
    ["Residential portfolio", "Commercial experience", "Schedule project discussion"],
    'portfolio_showcase',
    { totalProjects: knowledge.projectPortfolio.totalCompleted },
    sessionId
  );
  
  return res.json(response);
}

// Quality Inquiry Handler
async function handleQualityInquiry(res, sessionId, context) {
  const reply = `**Construction Quality & Materials**\n\nAt Meezan Developers, we maintain rigorous quality standards across all ${knowledge.projectPortfolio.totalCompleted} projects:\n\n• **Materials:** We use premium, certified construction materials that comply with Pakistani building standards\n• **Workmanship:** Our skilled workforce brings an average of 10+ years of construction experience\n• **Standards:** All projects adhere to international quality and safety standards\n• **Supervision:** Comprehensive project management with daily quality checks\n• **Durability:** We focus on long-term structural integrity and client satisfaction\n\nOur quality commitment has earned us ${knowledge.company.stats.industryAwards} industry recognitions.`;

  const response = formatAgentResponse(
    reply,
    ["Material specifications", "Quality standards", "Project examples"],
    'quality_discussion',
    null,
    sessionId
  );
  
  return res.json(response);
}

// General Construction Conversation Handler
async function handleGeneralConstructionConversation(req, res, sessionId, message, context) {
  const response = formatAgentResponse(
    "I'd be happy to help with your construction inquiry! Based on our extensive project experience, I can provide guidance on costs, timelines, planning, or connect you with our specialist team. What specific aspect would you like to discuss?",
    getContextualSuggestions(context),
    'expert_conversation',
    null,
    sessionId
  );
  
  return res.json(response);
}

// ==================== COMPLETE AI AGENT MEETING COORDINATION ====================

async function handleMeetingCoordination(req, res, sessionId, userMessage, context, existingMeetingState = null) {
  let meetingState = existingMeetingState || meetingStates.get(sessionId) || {
    step: 0,
    data: {},
    context: {},
    createdAt: new Date().toISOString(),
    conversationFlow: []
  };

  console.log('🤖 AI Agent Meeting Coordination - Step:', meetingState.step);

  context.state = conversationStates.MEETING_COORDINATION;
  meetingState.context = context;

  // Store conversation flow
  meetingState.conversationFlow.push({
    user: userMessage,
    timestamp: new Date().toISOString(),
    step: meetingState.step
  });

  // Step 0: Natural meeting initiation
  if (meetingState.step === 0) {
    meetingState.step = 1;
    meetingStates.set(sessionId, meetingState);
    
    const projectType = context.currentProject?.type || 'construction';
    const reply = generateAgentResponse('meeting_arrangement', { projectType }, context);
    
    const response = formatAgentResponse(
      reply,
      [],
      'meeting_initiation',
      null,
      sessionId
    );
    
    return res.json(response);
  }

  // Step 1: Natural name collection
  if (meetingState.step === 1) {
    const userName = req.body.message.trim();
    meetingState.data.name = userName;
    context.clientName = userName;
    meetingState.step = 2;
    meetingStates.set(sessionId, meetingState);
    
    const response = formatAgentResponse(
      `Nice to meet you, ${userName}! To ensure we can send your consultation details and project information, what's the best email address to reach you?`,
      [],
      'get_contact_info',
      null,
      sessionId
    );
    
    return res.json(response);
  }

  // Step 2: Professional email collection
  if (meetingState.step === 2) {
    const userEmail = req.body.message.trim();
    
    if (!isValidEmail(userEmail)) {
      return res.json(formatAgentResponse(
        "To ensure we can properly coordinate your consultation and send project information, could you please provide a valid email address?",
        ["Try again", "Contact via phone"],
        'get_contact_info',
        null,
        sessionId
      ));
    }

    meetingState.data.email = userEmail;
    meetingState.step = 3;
    meetingStates.set(sessionId, meetingState);
    
    const projectType = context.currentProject?.type || 'your project';
    
    const response = formatAgentResponse(
      `Thank you, ${meetingState.data.name}! Now, to connect you with the right construction specialists, could you tell me what type of project you're planning?`,
      ["Residential", "Commercial", "Industrial", "General Consultation"],
      'get_project_context',
      null,
      sessionId
    );
    
    return res.json(response);
  }

  // Step 3: Project context for specialist matching
  if (meetingState.step === 3) {
    const projectType = req.body.message.trim();
    meetingState.data.projectType = projectType;
    context.currentProject = { type: projectType };
    meetingState.step = 4;
    meetingStates.set(sessionId, meetingState);

    // Check specialist availability
    const availableDates = calendarService.generateAvailableDates();
    
    if (availableDates.length === 0) {
      return handleNoAvailability(res, sessionId, context, meetingState);
    }

    const dateSuggestions = availableDates.map(date => `${date.display} (${date.availability})`);
    
    const response = formatAgentResponse(
      `Perfect! I'll coordinate with our ${projectType} specialists. Here are their available consultation slots. Which date works best for your schedule?`,
      dateSuggestions,
      'schedule_coordination',
      { availableDates },
      sessionId
    );
    
    return res.json(response);
  }

  // Step 4: Date selection with intelligent handling
  if (meetingState.step === 4) {
    const selectedDateInput = req.body.message.trim();
    
    // Find the selected date from available dates
    const availableDates = meetingState.availableDates || calendarService.generateAvailableDates();
    const selectedDateObj = availableDates.find(date => 
      date.display === selectedDateInput || date.value === selectedDateInput
    );
    
    if (!selectedDateObj) {
      return res.json(formatAgentResponse(
        "To ensure I coordinate with the right specialists, could you please select from the available dates?",
        availableDates.map(date => `${date.display} (${date.availability})`),
        'get_date_confirmation',
        { availableDates },
        sessionId
      ));
    }

    meetingState.data.date = selectedDateObj.value;
    meetingState.step = 5;
    meetingStates.set(sessionId, meetingState);

    // Generate available times for the selected date
    const availableTimes = calendarService.generateAvailableTimes(selectedDateObj.value);
    const availableTimeSlots = availableTimes.filter(time => time.isAvailable);
    
    if (availableTimeSlots.length === 0) {
      const nextDates = calendarService.generateAvailableDates();
      
      return res.json(formatAgentResponse(
        `It looks like all consultation slots for ${selectedDateInput} have been booked. Our specialists have availability on these dates instead:`,
        nextDates.map(date => `${date.display} (${date.availability})`),
        'get_alternative_date',
        { availableDates: nextDates },
        sessionId
      ));
    }

    const timeSuggestions = availableTimeSlots.map(time => time.display);

    return res.json(formatAgentResponse(
      `Excellent choice! What time on ${selectedDateInput} works best for your ${meetingState.data.projectType} project consultation?`,
      timeSuggestions,
      'get_time_selection',
      { availableTimes: availableTimeSlots },
      sessionId
    ));
  }

  // Step 5: Time selection with availability check
  if (meetingState.step === 5) {
    const selectedTime = req.body.message.trim();
    const selectedDate = meetingState.data.date;
    
    // Check if the selected time slot is still available
    const isAvailable = calendarService.isSlotAvailable(selectedDate, selectedTime);
    
    if (!isAvailable) {
      const availableTimes = calendarService.generateAvailableTimes(selectedDate);
      const availableTimeSlots = availableTimes.filter(time => time.isAvailable);
      
      return res.json(formatAgentResponse(
        `That time slot was just booked by another client. Here are the remaining available times on ${meetingState.data.date}:`,
        availableTimeSlots.map(time => time.display),
        'get_alternative_time',
        { availableTimes: availableTimeSlots },
        sessionId
      ));
    }

    meetingState.data.time = selectedTime;
    meetingState.step = 6;
    meetingStates.set(sessionId, meetingState);

    return res.json(formatAgentResponse(
      `Perfect! Let me confirm your consultation details:\n\n• **Name:** ${meetingState.data.name}\n• **Project:** ${meetingState.data.projectType}\n• **Date:** ${meetingState.data.date}\n• **Time:** ${meetingState.data.time}\n\nReady to confirm and secure this time with our ${meetingState.data.projectType} specialists?`,
      ["Yes, confirm and book", "No, I need to make changes"],
      'confirm_meeting_details',
      { meeting: meetingState.data },
      sessionId
    ));
  }

  // Step 6: Final confirmation and booking
  if (meetingState.step === 6) {
    const userResponse = userMessage.toLowerCase();
    
    if (userResponse.includes('yes') || userResponse.includes('confirm') || userResponse.includes('book')) {
      // Final availability check before booking
      const isAvailable = calendarService.isSlotAvailable(meetingState.data.date, meetingState.data.time);
      
      if (!isAvailable) {
        const nextDates = calendarService.generateAvailableDates();
        
        return res.json(formatAgentResponse(
          `That time slot was just secured by another client. Here are our available consultation dates:`,
          nextDates.map(date => `${date.display} (${date.availability})`),
          'get_alternative_date_final',
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
        return res.json(formatAgentResponse(
          `I apologize, but that time slot is no longer available. Let's find another time that works for your ${meetingState.data.projectType} project.`,
          ["Choose different time", "Select another date", "Contact support"],
          'booking_failed',
          null,
          sessionId
        ));
      }

      meetingState.step = 7;
      meetingStates.set(sessionId, meetingState);

      return res.json(formatAgentResponse(
        `✅ **Consultation Confirmed!**\n\nI've secured your time with our ${meetingState.data.projectType} specialists.\n\nShall I send the confirmation details to ${meetingState.data.email}?`,
        ["Yes, send confirmation", "No, cancel booking"],
        'confirm_email_sending',
        { meeting: meetingState.data, bookingId: bookingResult.bookingId },
        sessionId
      ));
    } else {
      // User wants to change details
      meetingState.step = 4; // Go back to date selection
      meetingStates.set(sessionId, meetingState);
      
      const availableDates = calendarService.generateAvailableDates();
      const dateSuggestions = availableDates.map(date => `${date.display} (${date.availability})`);
      
      return res.json(formatAgentResponse(
        "No problem! Let's find a different time. Which date would work better for you?",
        dateSuggestions,
        'reschedule_date',
        { availableDates },
        sessionId
      ));
    }
  }

  // Step 7: Send confirmation emails
  if (meetingState.step === 7) {
    const userResponse = userMessage.toLowerCase();
    
    if (userResponse.includes('yes') || userResponse.includes('send') || userResponse.includes('confirm')) {
      try {
        console.log('🤖 AI Agent sending confirmation email...');
        
        const emailResult = await resendEmailService.sendMeetingConfirmation(meetingState.data);
        
        if (emailResult.success) {
          console.log('✅ AI Agent email sent successfully!');
          
          meetingStates.delete(sessionId);
          
          return res.json(formatAgentResponse(
            `🎉 **Consultation Booked Successfully!**\n\n✅ Confirmation sent to ${meetingState.data.email}\n✅ Time secured with our ${meetingState.data.projectType} specialists\n✅ Our team will prepare for your project discussion\n\n**Meeting ID:** ${meetingState.data.id}\n**Date:** ${meetingState.data.date}\n**Time:** ${meetingState.data.time}\n\nWe look forward to helping bring your construction vision to life!`,
            ["Schedule another consultation", "Our construction services", "Project cost estimation"],
            'meeting_completed',
            { 
              meetingId: meetingState.data.id, 
              emailSent: true
            },
            sessionId
          ));
        } else {
          console.log('⚠️ AI Agent email failed:', emailResult.error);
          meetingStates.delete(sessionId);
          
          return res.json(formatAgentResponse(
            `✅ **Consultation Confirmed!**\n\nYour meeting is scheduled for ${meetingState.data.date} at ${meetingState.data.time}.\n\n**Meeting ID:** ${meetingState.data.id}\n\nOur team will contact you directly to confirm and discuss your ${meetingState.data.projectType} project.`,
            ["Schedule another meeting", "Our services", "Cost estimation"],
            'meeting_completed_fallback',
            { meetingId: meetingState.data.id, emailSent: false },
            sessionId
          ));
        }
      } catch (error) {
        console.error('❌ AI Agent email process error:', error);
        meetingStates.delete(sessionId);
        
        return res.json(formatAgentResponse(
          `✅ **Consultation Scheduled!**\n\nYour meeting has been confirmed. Our construction team will contact you shortly to discuss your ${meetingState.data.projectType} project.\n\n**Meeting ID:** ${meetingState.data.id}`,
          ["Schedule another consultation", "Our construction services", "Project planning"],
          'meeting_completed_fallback',
          { meetingId: meetingState.data.id, emailSent: false },
          sessionId
        ));
      }
    } else {
      // User canceled - professional handling
      await calendarService.cancelBooking(meetingState.data.date, meetingState.data.time);
      meetingStates.delete(sessionId);
      
      return res.json(formatAgentResponse(
        "I've cancelled the booking and freed up the time slot for other clients. Feel free to reach out when you're ready to schedule your construction consultation.",
        ["Schedule consultation", "Our services", "Cost estimation"],
        'meeting_canceled',
        null,
        sessionId
      ));
    }
  }
}

async function handleNoAvailability(res, sessionId, context, meetingState) {
  const nextSlots = calendarService.getNextAvailableSlots(3);
  
  if (nextSlots.length > 0) {
    let reply = `Our ${meetingState.data.projectType} specialists are fully booked this week. However, I found these available consultation slots:\n\n`;
    nextSlots.forEach(slot => {
      reply += `• ${slot.date} at ${slot.time}\n`;
    });
    reply += `\nWould you like me to reserve one of these times with our specialist team?`;
    
    meetingState.step = 4.5;
    meetingStates.set(sessionId, meetingState);
    
    return res.json(formatAgentResponse(
      reply,
      ["Reserve alternative slot", "Check specialist availability", "Contact team directly"],
      'alternative_scheduling',
      { nextSlots },
      sessionId
    ));
  }
  
  return res.json(formatAgentResponse(
    `Our consultation schedule is currently full. For immediate ${meetingState.data.projectType} project assistance, I recommend contacting our construction team directly at ${knowledge.company.contact.phone}.`,
    ["Contact team directly", "Schedule for next week", "Send project details"],
    'full_schedule',
    null,
    sessionId
  ));
}

// ==================== AI AGENT HELPER FUNCTIONS ====================

function getProjectTypeCount(projectType) {
  const counts = {
    'residential': knowledge.projectPortfolio.residential,
    'commercial': knowledge.projectPortfolio.commercial,
    'industrial': knowledge.projectPortfolio.industrial
  };
  
  return counts[projectType] || knowledge.projectPortfolio.totalCompleted;
}

function getPriceRange(projectType, budgetLevel = 'standard') {
  const ranges = {
    'residential': {
      'economical': 'PKR 2,500 - 3,500 per sq ft',
      'standard': 'PKR 3,500 - 5,500 per sq ft', 
      'premium': 'PKR 5,500 - 8,000+ per sq ft'
    },
    'commercial': {
      'economical': 'PKR 4,000 - 6,000 per sq ft',
      'standard': 'PKR 6,000 - 9,000 per sq ft',
      'premium': 'PKR 9,000 - 15,000+ per sq ft'
    },
    'industrial': {
      'economical': 'PKR 3,500 - 5,500 per sq ft',
      'standard': 'PKR 5,500 - 8,500 per sq ft',
      'premium': 'PKR 8,500 - 12,000+ per sq ft'
    }
  };
  
  return ranges[projectType]?.[budgetLevel] || ranges['residential']['standard'];
}

function getTypicalTimeline(projectType) {
  const timelines = {
    'residential': '6-12 months depending on size and specifications',
    'commercial': '8-18 months based on complexity and scale',
    'industrial': '12-24 months for full facility development'
  };
  
  return timelines[projectType] || '6-18 months based on project requirements';
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function getContextualSuggestions(context) {
  if (context.currentProject?.type) {
    return [
      `${context.currentProject.type} cost analysis`,
      "Project timeline planning", 
      "Schedule specialist consultation",
      "Material quality discussion"
    ];
  }
  
  return [
    "Construction cost guidance",
    "Project planning consultation", 
    "Portfolio review",
    "Team expertise discussion"
  ];
}

// ==================== AI AGENT MAINTENANCE ====================

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
    console.log(`🤖 AI Agent maintained ${cleanedCount} client sessions`);
  }
}, 60 * 60 * 1000);

// AI Agent endpoints
router.post('/clear-context', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    conversationContexts.delete(sessionId);
    meetingStates.delete(sessionId);
    console.log(`🤖 AI Agent cleared context for: ${sessionId}`);
  }
  res.json({ success: true, agent: AI_AGENT.name });
});

router.get('/agent-status', (req, res) => {
  res.json({
    agent: AI_AGENT.name,
    status: 'Active and Ready',
    expertise: AI_AGENT.expertise,
    activeClients: conversationContexts.size,
    activeConsultations: meetingStates.size,
    totalExperience: `${knowledge.projectPortfolio.totalCompleted} projects`,
    operationalSince: new Date().toISOString()
  });
});

module.exports = router;