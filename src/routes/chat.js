const express = require('express');
const axios = require('axios');
const router = express.Router();
const knowledge = require('../data/knowledge.json');

// Import services
const resendEmailService = require('../services/resendEmailService');
const calendarService = require('../services/calendarService');

// ==================== AI AGENT CORE SYSTEMS ====================

// Store AI Agents in memory (not just contexts)
const aiAgents = new Map();
const meetingStates = new Map();
const requestCounts = new Map();

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 25,
  windowMs: 60000
};

// AI AGENT GOALS CONFIGURATION
const AGENT_GOALS = {
  LEAD_QUALIFICATION: {
    objective: "Qualify construction leads and understand project requirements",
    success_criteria: ["get_project_type", "assess_budget", "determine_timeline", "identify_pain_points"],
    priority: "high",
    business_value: "high"
  },
  PROJECT_SCOPING: {
    objective: "Define complete project scope and technical requirements",
    success_criteria: ["identify_scope", "assess_complexity", "determine_special_requirements", "evaluate_site_conditions"],
    priority: "medium",
    business_value: "high"
  },
  CONSULTATION_BOOKING: {
    objective: "Schedule qualified consultations with appropriate experts",
    success_criteria: ["book_meeting", "send_confirmation", "prepare_team_brief", "follow_up"],
    priority: "high",
    business_value: "medium"
  },
  SOLUTION_PRESENTATION: {
    objective: "Present tailored construction solutions based on client needs",
    success_criteria: ["suggest_solutions", "explain_benefits", "address_concerns", "build_confidence"],
    priority: "medium",
    business_value: "high"
  }
};

// AI Agent Personality Configuration
const AGENT_PERSONALITY = {
  name: "Meezan AI Construction Agent",
  role: "Senior Construction Consultant",
  tone: "professional yet approachable",
  expertise: "construction engineering and project planning",
  traits: ["proactive", "diagnostic", "solution-oriented", "technical", "personable"],
  capabilities: ["project_assessment", "technical_consultation", "risk_analysis", "budget_planning", "autonomous_decision_making"]
};

// Enhanced conversation states for AI Agent
const conversationStates = {
  INITIAL: 'initial',
  PROJECT_DISCOVERY: 'project_discovery',
  TECHNICAL_ASSESSMENT: 'technical_assessment',
  COST_ANALYSIS: 'cost_analysis',
  SOLUTION_PLANNING: 'solution_planning',
  MEETING_BOOKING: 'meeting_booking',
  FOLLOW_UP: 'follow_up'
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
    "I've checked our specialists' calendar. For your {projectType} project, here are the available consultation slots. Which works best for your schedule?",
    "Our construction experts have availability coming up. For your {projectType} project, which of these dates fits your timeline?",
    "I found some great slots with our {projectType} specialists. When would you prefer to meet and discuss your project in detail?"
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

// ==================== AI AGENT CORE CLASSES ====================

class ConstructionAgent {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.activeGoals = new Map();
    this.achievedGoals = [];
    this.conversationHistory = [];
    this.clientProfile = {
      name: null,
      projectType: null,
      budget: null,
      timeline: null,
      painPoints: [],
      technicalLevel: 'beginner',
      readiness: 'exploring'
    };
    this.interactionCount = 0;
    this.lastInteraction = new Date().toISOString();
    this.createdAt = new Date().toISOString();
    this.learningMemory = new Map();
  }

  setGoal(goalType, parameters = {}) {
    this.activeGoals.set(goalType, {
      ...AGENT_GOALS[goalType],
      parameters,
      startedAt: new Date(),
      progress: 0,
      collectedData: {},
      actionsTaken: []
    });
    console.log(`🎯 AI Agent set goal: ${goalType}`);
  }

  updateGoalProgress(goalType, data, action = '') {
    const goal = this.activeGoals.get(goalType);
    if (goal) {
      goal.collectedData = { ...goal.collectedData, ...data };
      if (action) goal.actionsTaken.push({ action, timestamp: new Date() });
      goal.progress = this.calculateGoalProgress(goal);
      
      // Check if goal is completed
      if (goal.progress >= 100 && !this.achievedGoals.includes(goalType)) {
        this.achievedGoals.push(goalType);
        console.log(`✅ AI Agent completed goal: ${goalType}`);
        
        // Automatically set next goal if applicable
        this.setNextGoal(goalType);
      }
    }
  }

  calculateGoalProgress(goal) {
    const criteria = goal.success_criteria;
    const collected = Object.keys(goal.collectedData);
    const progress = (collected.length / criteria.length) * 100;
    return Math.min(progress, 100);
  }

  setNextGoal(completedGoal) {
    const goalSequence = {
      'LEAD_QUALIFICATION': 'PROJECT_SCOPING',
      'PROJECT_SCOPING': 'SOLUTION_PRESENTATION', 
      'SOLUTION_PRESENTATION': 'CONSULTATION_BOOKING'
    };
    
    const nextGoal = goalSequence[completedGoal];
    if (nextGoal && !this.activeGoals.has(nextGoal) && !this.achievedGoals.includes(nextGoal)) {
      this.setGoal(nextGoal);
    }
  }

  hasActiveGoals() {
    return this.activeGoals.size > 0;
  }

  getContext() {
    return {
      clientProfile: this.clientProfile,
      activeGoals: Array.from(this.activeGoals.keys()),
      achievedGoals: this.achievedGoals,
      interactionCount: this.interactionCount,
      conversationLength: this.conversationHistory.length
    };
  }

  logInteraction(userMessage, agentResponse) {
    this.conversationHistory.push({
      user: userMessage,
      agent: agentResponse,
      timestamp: new Date().toISOString(),
      goals: Array.from(this.activeGoals.keys())
    });
    
    // Keep history manageable
    if (this.conversationHistory.length > 15) {
      this.conversationHistory = this.conversationHistory.slice(-12);
    }
    
    this.interactionCount++;
    this.lastInteraction = new Date().toISOString();
  }
}

class AutonomousDecisionEngine {
  static decideNextAction(agent, userMessage) {
    const context = agent.getContext();
    const availableActions = this.analyzeAvailableActions(context, userMessage);
    const scoredActions = this.scoreActions(availableActions, agent.activeGoals, context);
    
    return this.selectBestAction(scoredActions);
  }

  static analyzeAvailableActions(context, userMessage) {
    const actions = [];
    const clientProfile = context.clientProfile;

    // LEAD QUALIFICATION ACTIONS
    if (!clientProfile.projectType) {
      actions.push({
        type: 'PROACTIVE_QUESTION',
        question: "What type of construction project are you considering? Residential, commercial, or industrial?",
        goal: 'LEAD_QUALIFICATION',
        urgency: 'high',
        expectedData: 'projectType'
      });
    }

    if (!clientProfile.budget && clientProfile.projectType) {
      actions.push({
        type: 'PROACTIVE_QUESTION',
        question: `For your ${clientProfile.projectType} project, what's your approximate budget range? This helps me provide accurate recommendations.`,
        goal: 'LEAD_QUALIFICATION', 
        urgency: 'high',
        expectedData: 'budget'
      });
    }

    if (!clientProfile.timeline) {
      actions.push({
        type: 'PROACTIVE_QUESTION',
        question: "What's your ideal timeline for this project? Are you planning to start soon?",
        goal: 'LEAD_QUALIFICATION',
        urgency: 'medium',
        expectedData: 'timeline'
      });
    }

    // PROJECT SCOPING ACTIONS
    if (clientProfile.projectType && !clientProfile.painPoints.length) {
      actions.push({
        type: 'PROACTIVE_QUESTION',
        question: `What are the main challenges or specific requirements for your ${clientProfile.projectType} project?`,
        goal: 'PROJECT_SCOPING',
        urgency: 'medium',
        expectedData: 'painPoints'
      });
    }

    // SOLUTION PRESENTATION ACTIONS
    if (this.isLeadQualified(context)) {
      actions.push({
        type: 'PROACTIVE_SUGGESTION',
        suggestion: `Based on your ${clientProfile.projectType} project details, I recommend our ${this.getRecommendedService(clientProfile)} service. We've successfully completed ${this.getServiceProjectCount(clientProfile.projectType)} similar projects.`,
        goal: 'SOLUTION_PRESENTATION',
        urgency: 'high'
      });

      actions.push({
        type: 'PROACTIVE_OFFER',
        offer: "Would you like me to schedule a technical consultation with our specialists to discuss your specific requirements in detail?",
        goal: 'CONSULTATION_BOOKING',
        urgency: 'medium'
      });
    }

    // TECHNICAL GUIDANCE ACTIONS
    if (userMessage.includes('foundation') || userMessage.includes('structural') || userMessage.includes('design')) {
      actions.push({
        type: 'TECHNICAL_GUIDANCE',
        guidance: "I can provide preliminary technical advice on that. Our structural engineers typically recommend...",
        goal: 'PROJECT_SCOPING',
        urgency: 'medium'
      });
    }

    return actions;
  }

  static isLeadQualified(context) {
    const profile = context.clientProfile;
    return profile.projectType && profile.budget && profile.timeline;
  }

  static getRecommendedService(profile) {
    const serviceMap = {
      'residential': 'Residential Construction',
      'commercial': 'Commercial Construction', 
      'industrial': 'Industrial Construction'
    };
    return serviceMap[profile.projectType] || 'Construction Consultation';
  }

  static getServiceProjectCount(projectType) {
    const countMap = {
      'residential': knowledge.projectPortfolio.residential,
      'commercial': knowledge.projectPortfolio.commercial,
      'industrial': knowledge.projectPortfolio.industrial
    };
    return countMap[projectType] || knowledge.projectPortfolio.totalCompleted;
  }

  static scoreActions(actions, activeGoals, context) {
    return actions.map(action => {
      let score = 0;
      
      // Base score based on urgency
      if (action.urgency === 'high') score += 30;
      if (action.urgency === 'medium') score += 20;
      if (action.urgency === 'low') score += 10;
      
      // Score based on goal priority
      const goal = activeGoals.get(action.goal);
      if (goal) {
        if (goal.priority === 'high') score += 25;
        if (goal.progress < 50) score += 15; // Prioritize incomplete goals
      }
      
      // Score based on conversation stage
      if (context.interactionCount < 3) score += 10; // Early conversations
      if (context.conversationLength > 8) score += 5; // Engaged conversations
      
      return { ...action, score };
    }).sort((a, b) => b.score - a.score);
  }

  static selectBestAction(scoredActions) {
    return scoredActions.length > 0 ? scoredActions[0] : null;
  }
}

class LearningSystem {
  static learnFromInteraction(agent, userMessage, agentResponse, outcome) {
    const pattern = {
      userIntent: this.extractIntent(userMessage),
      agentAction: agentResponse.action,
      clientType: agent.clientProfile.technicalLevel,
      outcome: outcome,
      timestamp: new Date()
    };
    
    agent.learningMemory.set(Date.now(), pattern);
    this.updateSuccessRates(agent, pattern);
  }

  static extractIntent(message) {
    const intents = {
      cost: ['cost', 'price', 'how much', 'budget'],
      technical: ['foundation', 'structural', 'design', 'materials', 'specifications'],
      timeline: ['time', 'duration', 'how long', 'schedule'],
      portfolio: ['portfolio', 'projects', 'experience', 'completed work'],
      meeting: ['meeting', 'consultation', 'schedule', 'appointment']
    };

    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
        return intent;
      }
    }
    return 'general';
  }

  static updateSuccessRates(agent, pattern) {
    // Simple learning mechanism - in production, this would be more sophisticated
    const key = `${pattern.userIntent}-${pattern.agentAction}`;
    const current = agent.learningMemory.get(key) || { attempts: 0, successes: 0 };
    
    current.attempts++;
    if (pattern.outcome === 'success') current.successes++;
    
    agent.learningMemory.set(key, current);
  }
}

// ==================== AI AGENT HELPER FUNCTIONS ====================

// Natural response generator
function generateNaturalResponse(type, variables = {}) {
  const templates = RESPONSE_STYLES[type] || [variables.default || "I'd be happy to help with that!"];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // Replace variables in template
  return template.replace(/{(\w+)}/g, (match, key) => {
    return variables[key] || knowledge[key] || knowledge.company[key] || match;
  });
}

// Enhanced response formatter
function formatResponse(reply, suggestions = [], action = null, details = null, sessionId = null) {
  const response = {
    success: true,
    reply,
    suggestions,
    timestamp: new Date().toISOString(),
    agent: AGENT_PERSONALITY.name,
    agentRole: AGENT_PERSONALITY.role
  };
  
  if (action) response.action = action;
  if (details) response.details = details;
  if (sessionId) response.sessionId = sessionId;
  
  return response;
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

// Enhanced Gemini API caller
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

// ==================== AI AGENT MAIN HANDLER ====================

router.post('/chat', async (req, res) => {
  try {
    let { message, sessionId } = req.body;
    
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        reply: "I'd love to help! Could you please tell me what you're looking for regarding your construction project?"
      });
    }
    
    // Sanitize inputs
    message = sanitizeInput(message);
    sessionId = sessionId || 'agent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Rate limiting check
    if (isRateLimited(sessionId)) {
      return res.status(429).json({
        success: false,
        reply: "I'm helping several clients right now. Please give me a moment, or feel free to call our team directly at " + knowledge.company.contact.phone + " for immediate assistance."
      });
    }

    console.log('🤖 AI Agent Processing:', message);
    const userMessage = message.toLowerCase().trim();
    
    // Initialize or get AI Agent
    let agent = aiAgents.get(sessionId) || new ConstructionAgent(sessionId);
    
    // Initialize goals if this is a new agent
    if (!agent.hasActiveGoals()) {
      agent.setGoal('LEAD_QUALIFICATION');
      console.log('🎯 AI Agent initialized with lead qualification goal');
    }

    // Check if user is in the middle of meeting booking
    const meetingState = meetingStates.get(sessionId);
    if (meetingState && meetingState.step > 0) {
      console.log('🤖 AI Agent continuing meeting flow, step:', meetingState.step);
      return await handleMeetingBooking(req, res, sessionId, userMessage, agent);
    }

    // Check for website redirection first
    const redirectInfo = handleWebsiteRedirect(userMessage);
    if (redirectInfo) {
      console.log('🤖 AI Agent redirecting to:', redirectInfo.page);
      
      const response = formatResponse(
        redirectInfo.message,
        ["Continue Conversation", "Schedule Consultation", "Cost Estimation"],
        redirectInfo.action,
        { 
          redirectUrl: redirectInfo.url,
          page: redirectInfo.page
        },
        sessionId
      );
      
      agent.logInteraction(message, response);
      aiAgents.set(sessionId, agent);
      return res.json(response);
    }

    // Update client profile from current message
    updateClientProfile(agent, message, userMessage);

    // Autonomous Decision Making
    const nextAction = AutonomousDecisionEngine.decideNextAction(agent, userMessage);
    
    let response;
    if (nextAction) {
      console.log('🎯 AI Agent taking autonomous action:', nextAction.type);
      response = await executeAutonomousAction(nextAction, agent, userMessage, sessionId);
    } else {
      // Handle specific intents with natural responses
      response = await handleSpecificIntent(message, userMessage, agent, sessionId);
    }

    // Learn from this interaction
    LearningSystem.learnFromInteraction(agent, userMessage, response, 'success');
    
    // Store updated agent
    aiAgents.set(sessionId, agent);
    
    return res.json(response);

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

// Execute autonomous actions
async function executeAutonomousAction(action, agent, userMessage, sessionId) {
  switch (action.type) {
    case 'PROACTIVE_QUESTION':
      return formatResponse(
        action.question,
        getContextualSuggestions(agent),
        'proactive_question',
        { goal: action.goal, expectedData: action.expectedData },
        sessionId
      );

    case 'PROACTIVE_SUGGESTION':
      // Update goal progress
      agent.updateGoalProgress(action.goal, { solutionPresented: true }, 'presented_solution');
      
      return formatResponse(
        action.suggestion,
        ["Learn More About This", "Schedule Technical Consultation", "Get Cost Estimate"],
        'proactive_suggestion',
        { goal: action.goal },
        sessionId
      );

    case 'PROACTIVE_OFFER':
      return formatResponse(
        action.offer,
        ["Yes, Schedule Consultation", "Not Yet, More Information", "Discuss Costs First"],
        'proactive_offer',
        { goal: action.goal },
        sessionId
      );

    case 'TECHNICAL_GUIDANCE':
      return formatResponse(
        action.guidance,
        ["Schedule Engineering Consultation", "View Technical Portfolio", "Discuss Implementation"],
        'technical_guidance',
        { goal: action.goal },
        sessionId
      );

    default:
      return await handleGeneralQuery(userMessage, agent, sessionId);
  }
}

// Handle specific intents
async function handleSpecificIntent(originalMessage, userMessage, agent, sessionId) {
  // Handle different intent types
  if (isMeetingRequest(userMessage)) {
    agent.updateGoalProgress('CONSULTATION_BOOKING', { meetingRequested: true }, 'meeting_requested');
    return formatResponse(
      "I'd be delighted to schedule a consultation with our construction experts! Let's find the perfect time to discuss your project.",
      [],
      'meeting_initiated',
      null,
      sessionId
    );
  }

  if (isCostQuery(userMessage)) {
    agent.updateGoalProgress('LEAD_QUALIFICATION', { costDiscussed: true }, 'cost_discussion');
    return await handleCostQuery(originalMessage, agent, sessionId);
  }

  if (isServiceQuery(userMessage)) {
    return await handleServiceQuery(userMessage, agent, sessionId);
  }

  if (isPortfolioQuery(userMessage)) {
    return await handlePortfolioQuery(agent, sessionId);
  }

  if (isGreeting(userMessage)) {
    return await handleGreeting(agent, sessionId);
  }

  if (isAboutQuery(userMessage)) {
    return await handleAboutQuery(agent, sessionId);
  }

  // Default to general query with AI enhancement
  return await handleGeneralQuery(userMessage, agent, sessionId);
}

// Update client profile based on conversation
function updateClientProfile(agent, originalMessage, userMessage) {
  // Extract project type
  if (userMessage.includes('residential') || userMessage.includes('house') || userMessage.includes('home')) {
    agent.clientProfile.projectType = 'residential';
    agent.updateGoalProgress('LEAD_QUALIFICATION', { projectType: 'residential' }, 'identified_project_type');
  } else if (userMessage.includes('commercial') || userMessage.includes('office') || userMessage.includes('business')) {
    agent.clientProfile.projectType = 'commercial';
    agent.updateGoalProgress('LEAD_QUALIFICATION', { projectType: 'commercial' }, 'identified_project_type');
  } else if (userMessage.includes('industrial') || userMessage.includes('factory') || userMessage.includes('warehouse')) {
    agent.clientProfile.projectType = 'industrial';
    agent.updateGoalProgress('LEAD_QUALIFICATION', { projectType: 'industrial' }, 'identified_project_type');
  }

  // Extract budget information
  if (userMessage.includes('budget') || userMessage.includes('cost') || userMessage.match(/\d/)) {
    const budgetMatch = originalMessage.match(/(\d+[\d,]*)\s*(lakh|lac|million|cr|crore|thousand)/i);
    if (budgetMatch) {
      agent.clientProfile.budget = budgetMatch[0];
      agent.updateGoalProgress('LEAD_QUALIFICATION', { budget: budgetMatch[0] }, 'identified_budget');
    }
  }

  // Extract timeline
  if (userMessage.includes('soon') || userMessage.includes('immediately') || userMessage.includes('urgent')) {
    agent.clientProfile.timeline = 'urgent';
    agent.updateGoalProgress('LEAD_QUALIFICATION', { timeline: 'urgent' }, 'identified_timeline');
  } else if (userMessage.includes('month') || userMessage.includes('week') || userMessage.includes('planning')) {
    agent.clientProfile.timeline = 'planned';
    agent.updateGoalProgress('LEAD_QUALIFICATION', { timeline: 'planned' }, 'identified_timeline');
  }

  // Extract client name for personalization
  if (userMessage.includes('name is') || userMessage.includes('i am') || userMessage.includes("i'm")) {
    const nameMatch = originalMessage.match(/(?:name is|i am|i'm)\s+([a-zA-Z]+)/i);
    if (nameMatch && nameMatch[1]) {
      agent.clientProfile.name = nameMatch[1];
    }
  }
}

// ==================== EXISTING FUNCTIONALITY (ADAPTED FOR AI AGENT) ====================

// Cost query handler
async function handleCostQuery(originalMessage, agent, sessionId) {
  const systemPrompt = `You are a construction cost expert at Meezan Developers with ${knowledge.company.yearsExperience} of industry experience.

CLIENT CONTEXT:
- Project Type: ${agent.clientProfile.projectType || 'Not specified'}
- Budget: ${agent.clientProfile.budget || 'Not specified'} 
- Timeline: ${agent.clientProfile.timeline || 'Not specified'}

Provide personalized cost guidance based on the client's specific situation.`;

  const promptConfig = {
    contents: [{
      parts: [{
        text: `${systemPrompt}\n\nClient question: "${originalMessage}"\n\nProvide expert cost guidance:`
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 250,
      topP: 0.8
    }
  };

  const costResponse = await callGeminiAPI(promptConfig, getCostFallbackResponse(originalMessage));

  return formatResponse(
    costResponse,
    ["Detailed Cost Analysis", "Schedule Expert Consultation", "Project Planning Guide"],
    'cost_analysis',
    { projectType: agent.clientProfile.projectType },
    sessionId
  );
}

// Service query handler  
async function handleServiceQuery(userMessage, agent, sessionId) {
  let specificService = null;
  const serviceKeywords = {
    'residential': ['house', 'home', 'residential', 'villa', 'apartment'],
    'commercial': ['commercial', 'office', 'business', 'shop', 'mall'],
    'industrial': ['industrial', 'factory', 'warehouse', 'manufacturing']
  };

  for (const [serviceType, keywords] of Object.entries(serviceKeywords)) {
    if (keywords.some(keyword => userMessage.includes(keyword))) {
      specificService = knowledge.services.find(service => 
        service.name.toLowerCase().includes(serviceType)
      );
      break;
    }
  }

  const reply = specificService ? 
    `🏗️ **${specificService.name} - Our Specialization**\n${specificService.description}\n\nWe bring ${getServiceProjectCount(specificService.name)} projects of experience.` :
    `🏗️ **Meezan Developers Construction Services**\n\nWe offer comprehensive solutions across residential, commercial, and industrial sectors.`;

  return formatResponse(
    reply,
    specificService ? 
      [`Cost Analysis for ${specificService.name}`, `Schedule ${specificService.name} Consultation`] :
      ["Residential Construction", "Commercial Projects", "Industrial Facilities"],
    'service_info',
    { specificService: specificService?.name },
    sessionId
  );
}

// Portfolio handler
async function handlePortfolioQuery(agent, sessionId) {
  const portfolioResponse = `🏗️ **Meezan Developers Project Portfolio**\n\nWith ${knowledge.company.yearsExperience} of excellence, we've delivered ${knowledge.projectPortfolio.totalCompleted} projects including:\n\n• ${knowledge.projectPortfolio.residential} Residential Projects\n• ${knowledge.projectPortfolio.commercial} Commercial Buildings\n• ${knowledge.projectPortfolio.industrial} Industrial Facilities`;

  return formatResponse(
    portfolioResponse,
    ["View Detailed Portfolio", "Schedule Consultation", "Cost Estimation"],
    'portfolio_view',
    null,
    sessionId
  );
}

// Greeting handler
async function handleGreeting(agent, sessionId) {
  let reply;
  
  if (agent.interactionCount <= 1) {
    reply = generateNaturalResponse('greeting', {
      yearsExperience: knowledge.company.yearsExperience,
      totalCompleted: knowledge.projectPortfolio.totalCompleted
    });
  } else {
    const previousTopic = agent.conversationHistory.length > 0 ? ' our previous discussion' : '';
    const personalized = agent.clientProfile.name ? `, ${agent.clientProfile.name}` : '';
    reply = `Welcome back${personalized}! I'm ready to continue${previousTopic}. What would you like to explore next?`;
  }

  return formatResponse(
    reply,
    ["Schedule Consultation", "Our Construction Services", "Cost Estimation"],
    'greeting',
    null,
    sessionId
  );
}

// About handler
async function handleAboutQuery(agent, sessionId) {
  const aboutResponse = `I'm your AI Construction Consultant at Meezan Developers! 🤖\n\nI combine construction expertise with AI technology to help you plan and execute successful projects.\n\n**What I can do:**\n• Provide construction cost estimates based on ${knowledge.projectPortfolio.totalCompleted} projects\n• Schedule consultations with our expert team\n• Guide you through project planning\n• Answer construction-related questions\n\n${knowledge.company.name} brings ${knowledge.company.yearsExperience} of construction excellence to every project.`;

  return formatResponse(
    aboutResponse,
    ["Schedule Consultation", "Construction Costs", "Our Services"],
    'about_info',
    null,
    sessionId
  );
}

// General query handler
async function handleGeneralQuery(userMessage, agent, sessionId) {
  const contextPrompt = `Client Profile: ${JSON.stringify(agent.clientProfile)}\nActive Goals: ${Array.from(agent.activeGoals.keys()).join(', ')}\nUser Message: ${userMessage}`;

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
    const aiResponse = await callGeminiAPI(promptConfig, getSmartFallbackResponse(userMessage, agent));

    return formatResponse(
      aiResponse,
      getContextualSuggestions(agent),
      'general_response',
      null,
      sessionId
    );

  } catch (error) {
    console.error('AI Agent General Query Error:', error);
    
    const fallbackResponse = getSmartFallbackResponse(userMessage, agent);
    return formatResponse(
      fallbackResponse,
      getContextualSuggestions(agent),
      'fallback_response',
      null,
      sessionId
    );
  }
}

// ==================== COMPLETE MEETING BOOKING HANDLER ====================

async function handleMeetingBooking(req, res, sessionId, userMessage, agent) {
  let meetingState = meetingStates.get(sessionId) || {
    step: 0,
    data: {},
    createdAt: new Date().toISOString(),
    conversationFlow: []
  };

  console.log('🤖 AI Agent - Meeting Step:', meetingState.step, 'User:', userMessage);

  // Update agent goals
  agent.updateGoalProgress('CONSULTATION_BOOKING', { meetingInitiated: true }, 'meeting_initiated');

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
    
    agent.logInteraction(userMessage, response);
    return res.json(response);
  }

  // Step 1: Get name with personalization
  if (meetingState.step === 1) {
    const userName = req.body.message.trim();
    meetingState.data.name = userName;
    agent.clientProfile.name = userName; // Store for personalization
    meetingState.step = 2;
    meetingStates.set(sessionId, meetingState);
    
    const response = formatResponse(
      `Perfect! Now, ${userName}, what's the best email to send your consultation details and confirmation to?`,
      [],
      'get_email_natural',
      null,
      sessionId
    );
    
    agent.logInteraction(userMessage, response);
    return res.json(response);
  }

  // Step 2: Get email with professional handling
  if (meetingState.step === 2) {
    const userEmail = req.body.message.trim();
    
    if (!isValidEmail(userEmail)) {
      const response = formatResponse(
        "To ensure we can send your meeting confirmation and project details, could you please provide a valid email address?",
        ["Try again", "Contact via phone"],
        'get_email_natural',
        null,
        sessionId
      );
      
      agent.logInteraction(userMessage, response);
      return res.json(response);
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
    
    agent.logInteraction(userMessage, response);
    return res.json(response);
  }

  // Step 3: Get project type and show calendar expertise
  if (meetingState.step === 3) {
    const projectType = req.body.message.trim();
    meetingState.data.projectType = projectType;
    meetingState.step = 4;
    meetingStates.set(sessionId, meetingState);

    // Update agent profile
    agent.clientProfile.projectType = projectType.toLowerCase();
    agent.updateGoalProgress('CONSULTATION_BOOKING', { projectType: projectType }, 'identified_meeting_project_type');

    // Generate available dates with calendar check
    const availableDates = calendarService.generateAvailableDates();
    
    if (availableDates.length === 0) {
      // No available dates - expert handling
      const nextSlots = calendarService.getNextAvailableSlots(3);
      let reply = `I've checked our specialists' calendars, and unfortunately, all consultation slots for the coming week are fully booked. `;
      
      if (nextSlots.length > 0) {
        reply += `However, I found these available slots coming up:\n\n`;
        nextSlots.forEach(slot => {
          reply += `• ${slot.date} at ${slot.time}\n`;
        });
        reply += `\nWould you like me to reserve one of these times for you?`;
        
        meetingState.step = 4.5;
        meetingStates.set(sessionId, meetingState);
        
        const response = formatResponse(
          reply,
          ["Reserve alternative slot", "Check next week", "Contact me when available"],
          'no_availability_expert',
          { nextSlots },
          sessionId
        );
        
        agent.logInteraction(userMessage, response);
        return res.json(response);
      } else {
        const response = formatResponse(
          `Our consultation schedule is currently fully booked. For urgent project inquiries, I recommend contacting our team directly at ${knowledge.company.contact.phone}.`,
          ["Contact via phone", "Send project details", "Try again later"],
          'fully_booked_expert',
          null,
          sessionId
        );
        
        agent.logInteraction(userMessage, response);
        return res.json(response);
      }
    }

    const dateSuggestions = availableDates.map(date => `${date.display} (${date.availability})`);
    
    // Store available dates in meeting state for reference
    meetingState.availableDates = availableDates;
    meetingStates.set(sessionId, meetingState);

    const response = formatResponse(
      generateNaturalResponse('date_selection', { projectType: projectType }),
      dateSuggestions,
      'get_date_natural',
      { availableDates },
      sessionId
    );
    
    agent.logInteraction(userMessage, response);
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
        
        const response = formatResponse(
          `Excellent! Here are the available consultation slots I found:\n\n${nextSlots.map(slot => `• ${slot.date} at ${slot.time}`).join('\n')}\n\nWhich one works best for your schedule?`,
          dateSuggestions,
          'get_alternative_date_natural',
          { alternativeSlots: nextSlots },
          sessionId
        );
        
        agent.logInteraction(userMessage, response);
        return res.json(response);
      } else {
        const response = formatResponse(
          `I apologize, but those slots were just booked. For immediate assistance with your ${meetingState.data.projectType} project, please contact our team at ${knowledge.company.contact.phone}.`,
          ["Contact team directly", "Try again tomorrow", "Send project details"],
          'no_slots_available_expert',
          null,
          sessionId
        );
        
        agent.logInteraction(userMessage, response);
        return res.json(response);
      }
    } else {
      meetingStates.delete(sessionId);
      const response = formatResponse(
        "No problem at all! Feel free to reach out when you're ready to schedule your consultation. We're here to help bring your construction vision to life.",
        ["Schedule later", "Our services", "Cost estimation"],
        'booking_canceled_natural',
        null,
        sessionId
      );
      
      agent.logInteraction(userMessage, response);
      return res.json(response);
    }
  }

  // Step 4: Get date with intelligent handling
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
      // Normal date selection flow - handle user clicking suggestions
      const availableDates = meetingState.availableDates || calendarService.generateAvailableDates();
      
      // IMPROVED: Better matching for suggested dates
      const selectedDateObj = availableDates.find(date => {
        // Check exact match with display text (what user sees)
        if (date.display === selectedDateInput) return true;
        
        // Check match with the suggestion format (display + availability)
        if (`${date.display} (${date.availability})` === selectedDateInput) return true;
        
        // Check partial matches for user typing
        if (selectedDateInput.includes(date.value.substring(5))) return true; // Match "Nov 24"
        if (date.display.toLowerCase().includes(selectedDateInput.toLowerCase())) return true;
        
        // Check if user typed just the day part (e.g., "Fri, Nov 21")
        const dayPart = date.display.split(' ').slice(0, 3).join(' ');
        if (dayPart === selectedDateInput) return true;
        
        return false;
      });
      
      if (!selectedDateObj) {
        // User typed something that doesn't match available dates
        const aiAgentDateResponses = [
          `I want to make sure I book the right date for your ${meetingState.data.projectType} project consultation. Could you select one of these available dates?`,
          `For your ${meetingState.data.projectType} project, our specialists have these dates available. Which works best?`,
          `Let's find the perfect date for your ${meetingState.data.projectType} discussion. Here are our available slots:`
        ];
        
        const randomResponse = aiAgentDateResponses[Math.floor(Math.random() * aiAgentDateResponses.length)];
        
        const response = formatResponse(
          randomResponse,
          availableDates.map(date => `${date.display} (${date.availability})`),
          'get_date_natural',
          { availableDates },
          sessionId
        );
        
        agent.logInteraction(userMessage, response);
        return res.json(response);
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
      
      const response = formatResponse(
        `It looks like ${selectedDateDisplay} is fully booked. Our ${meetingState.data.projectType} specialists have these dates available instead:`,
        nextDates.map(date => `${date.display} (${date.availability})`),
        'get_date_natural',
        { availableDates: nextDates },
        sessionId
      );
      
      agent.logInteraction(userMessage, response);
      return res.json(response);
    }

    const timeSuggestions = availableTimeSlots.map(time => time.display);
    
    // If time was pre-selected from alternative dates, skip to confirmation
    if (meetingState.data.time) {
      meetingState.step = 6;
      meetingStates.set(sessionId, meetingState);
      
      const response = formatResponse(
        `Perfect! Let me confirm your ${meetingState.data.projectType} project consultation:\n\n• **Date:** ${selectedDateDisplay}\n• **Time:** ${meetingState.data.time}\n• **With:** ${meetingState.data.name}\n\nReady to secure this time with our specialists?`,
        ["Yes, confirm booking", "No, let me make changes"],
        'confirm_meeting_natural',
        { meeting: meetingState.data },
        sessionId
      );
      
      agent.logInteraction(userMessage, response);
      return res.json(response);
    }

    const timeSelectionResponses = [
      `Great! I have ${availableTimeSlots.length} time slots available on ${selectedDateDisplay} for your ${meetingState.data.projectType} consultation. Which time works best?`,
      `Excellent choice! Our ${meetingState.data.projectType} specialists have these times available on ${selectedDateDisplay}. What works for your schedule?`,
      `Perfect! Let's pick a time on ${selectedDateDisplay} for your ${meetingState.data.projectType} discussion. Here are the available slots:`
    ];
    
    const randomTimeResponse = timeSelectionResponses[Math.floor(Math.random() * timeSelectionResponses.length)];

    const response = formatResponse(
      randomTimeResponse,
      timeSuggestions,
      'get_time_natural',
      { availableTimes: availableTimeSlots },
      sessionId
    );
    
    agent.logInteraction(userMessage, response);
    return res.json(response);
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
      
      const response = formatResponse(
        `That time slot was just booked by another client. Here are the remaining available times on ${meetingState.data.date}:`,
        availableTimeSlots.map(time => time.display),
        'get_time_natural',
        { availableTimes: availableTimeSlots },
        sessionId
      );
      
      agent.logInteraction(userMessage, response);
      return res.json(response);
    }

    meetingState.data.time = selectedTime;
    meetingState.step = 6;
    meetingStates.set(sessionId, meetingState);

    const confirmationResponses = [
      `Excellent! Here's what I have for your consultation:\n\n• **Name:** ${meetingState.data.name}\n• **Project:** ${meetingState.data.projectType}\n• **Date:** ${meetingState.data.date}\n• **Time:** ${meetingState.data.time}\n\nReady to confirm and secure this time with our ${meetingState.data.projectType} specialists?`,
      `Perfect! Let me confirm your ${meetingState.data.projectType} consultation details:\n\n• **Date:** ${meetingState.data.date}\n• **Time:** ${meetingState.data.time}\n• **With:** ${meetingState.data.name}\n\nShall I book this appointment with our experts?`,
      `Great! Here's your consultation summary:\n\n• **Project Type:** ${meetingState.data.projectType}\n• **Consultation Date:** ${meetingState.data.date}\n• **Time:** ${meetingState.data.time}\n• **Client:** ${meetingState.data.name}\n\nReady to confirm this booking?`
    ];
    
    const randomConfirmation = confirmationResponses[Math.floor(Math.random() * confirmationResponses.length)];

    const response = formatResponse(
      randomConfirmation,
      ["Yes, confirm and book", "No, I need to make changes"],
      'confirm_meeting_natural',
      { meeting: meetingState.data },
      sessionId
    );
    
    agent.logInteraction(userMessage, response);
    return res.json(response);
  }

  // Step 6: Confirm meeting with professional assurance
  if (meetingState.step === 6) {
    const userResponse = userMessage.toLowerCase();
    
    if (userResponse.includes('yes') || userResponse.includes('confirm') || userResponse.includes('book')) {
      // Final availability check before booking
      const isAvailable = calendarService.isSlotAvailable(meetingState.data.date, meetingState.data.time);
      
      if (!isAvailable) {
        const nextDates = calendarService.generateAvailableDates();
        
        const response = formatResponse(
          `That time slot was just secured by another client. Here are our available consultation dates:`,
          nextDates.map(date => `${date.display} (${date.availability})`),
          'get_date_natural',
          { availableDates: nextDates },
          sessionId
        );
        
        agent.logInteraction(userMessage, response);
        return res.json(response);
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
        const response = formatResponse(
          `I apologize, but that time slot is no longer available. Let's find another time that works for your ${meetingState.data.projectType} project.`,
          ["Choose different time", "Select another date", "Contact support"],
          'booking_failed_expert',
          null,
          sessionId
        );
        
        agent.logInteraction(userMessage, response);
        return res.json(response);
      }

      meetingState.step = 7;
      meetingStates.set(sessionId, meetingState);

      const response = formatResponse(
        `✅ **Consultation Confirmed!**\n\nI've secured your time with our ${meetingState.data.projectType} specialists.\n\nShall I send the confirmation details to ${meetingState.data.email}?`,
        ["Yes, send confirmation", "No, cancel booking"],
        'confirm_email_sending_natural',
        { meeting: meetingState.data, bookingId: bookingResult.bookingId },
        sessionId
      );
      
      agent.logInteraction(userMessage, response);
      return res.json(response);
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
        4: "Which consultation date works best for you?",
        5: "What time would you prefer for your consultation?"
      };
      
      const response = formatResponse(
        stepMessages[meetingState.step] || "Let's start over. What's your name?",
        [],
        `get_${['name', 'email', 'project_type', 'date', 'time'][meetingState.step - 1]}_natural`,
        null,
        sessionId
      );
      
      agent.logInteraction(userMessage, response);
      return res.json(response);
    }
  }

  // Step 7: Send confirmation with professional touch
  if (meetingState.step === 7) {
    const userResponse = userMessage.toLowerCase();
    
    if (userResponse.includes('yes') || userResponse.includes('send') || userResponse.includes('confirm')) {
      try {
        console.log('📧 AI Agent sending confirmation email...');
        
        const emailResult = await resendEmailService.sendMeetingConfirmation(meetingState.data);
        
        if (emailResult.success) {
          console.log('✅ AI Agent email sent successfully!');
          
          // Update agent goals - meeting completed!
          agent.updateGoalProgress('CONSULTATION_BOOKING', { 
            meetingBooked: true,
            meetingId: meetingState.data.id,
            emailSent: true
          }, 'meeting_completed');
          
          meetingStates.delete(sessionId);
          
          const response = formatResponse(
            `🎉 **Consultation Booked Successfully!**\n\n✅ Confirmation sent to ${meetingState.data.email}\n✅ Time secured with our ${meetingState.data.projectType} specialists\n✅ Our team will prepare for your project discussion\n\n**Meeting ID:** ${meetingState.data.id}\n**Date:** ${meetingState.data.date}\n**Time:** ${meetingState.data.time}\n\nWe look forward to helping bring your construction vision to life!`,
            ["Schedule another consultation", "Our construction services", "Project cost estimation"],
            'meeting_completed_expert',
            { 
              meetingId: meetingState.data.id, 
              emailSent: true
            },
            sessionId
          );
          
          agent.logInteraction(userMessage, response);
          return res.json(response);
        } else {
          console.log('⚠️ AI Agent email failed:', emailResult.error);
          meetingStates.delete(sessionId);
          
          const response = formatResponse(
            `✅ **Consultation Confirmed!**\n\nYour meeting is scheduled for ${meetingState.data.date} at ${meetingState.data.time}.\n\n**Meeting ID:** ${meetingState.data.id}\n\nOur team will contact you directly to confirm and discuss your ${meetingState.data.projectType} project.`,
            ["Schedule another meeting", "Our services", "Cost estimation"],
            'meeting_completed_fallback_expert',
            { meetingId: meetingState.data.id, emailSent: false },
            sessionId
          );
          
          agent.logInteraction(userMessage, response);
          return res.json(response);
        }
      } catch (error) {
        console.error('❌ AI Agent email process error:', error);
        meetingStates.delete(sessionId);
        
        const response = formatResponse(
          `✅ **Consultation Scheduled!**\n\nYour meeting has been confirmed. Our construction team will contact you shortly to discuss your ${meetingState.data.projectType} project.\n\n**Meeting ID:** ${meetingState.data.id}`,
          ["Schedule another consultation", "Our construction services", "Project planning"],
          'meeting_completed_fallback_expert',
          { meetingId: meetingState.data.id, emailSent: false },
          sessionId
        );
        
        agent.logInteraction(userMessage, response);
        return res.json(response);
      }
    } else {
      // User canceled - professional handling
      await calendarService.cancelBooking(meetingState.data.date, meetingState.data.time);
      meetingStates.delete(sessionId);
      
      const response = formatResponse(
        "I've cancelled the booking and freed up the time slot for other clients. Feel free to reach out when you're ready to schedule your construction consultation.",
        ["Schedule consultation", "Our services", "Cost estimation"],
        'meeting_canceled_professional',
        null,
        sessionId
      );
      
      agent.logInteraction(userMessage, response);
      return res.json(response);
    }
  }
}

// ==================== HELPER FUNCTIONS ====================

function getContextualSuggestions(agent) {
  const profile = agent.clientProfile;
  const goals = Array.from(agent.activeGoals.keys());

  if (goals.includes('LEAD_QUALIFICATION')) {
    if (!profile.projectType) return ["Residential Project", "Commercial Building", "Industrial Facility"];
    if (!profile.budget) return ["Budget Discussion", "Cost Estimation", "Financial Planning"];
    if (!profile.timeline) return ["Timeline Planning", "Project Scheduling", "Urgent Consultation"];
  }

  if (goals.includes('SOLUTION_PRESENTATION')) {
    return ["Technical Details", "Project Portfolio", "Expert Consultation"];
  }

  return ["Schedule Consultation", "Cost Estimation", "Our Services"];
}

function getServiceProjectCount(serviceName) {
  const serviceMap = {
    'residential construction': knowledge.projectPortfolio.residential,
    'commercial construction': knowledge.projectPortfolio.commercial,
    'industrial construction': knowledge.projectPortfolio.industrial
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
  
  return `💰 **Construction Cost Guidance**\n\nBased on ${knowledge.projectPortfolio.totalCompleted} projects:\n\n🏠 Residential: ${knowledge.constructionCosts.residential.greyStructure} (Grey Structure)\n🏢 Commercial: ${knowledge.constructionCosts.commercial.basic} (Basic)\n🏭 Industrial: ${knowledge.constructionCosts.industrial.basic} (Basic)\n\nI recommend a detailed consultation for accurate project pricing.`;
}

function getSmartFallbackResponse(userMessage, agent) {
  return `I'm here to help with your construction project! Based on our conversation, I can assist with planning, costs, and connecting you with our experts. What would you like to explore next?`;
}

// Intent detection functions
function isMeetingRequest(userMessage) {
  const meetingKeywords = ['meeting', 'schedule', 'appointment', 'consultation', 'book a consultation'];
  return meetingKeywords.some(keyword => userMessage.includes(keyword));
}

function isCostQuery(userMessage) {
  const costKeywords = ['cost', 'price', 'how much', 'estimate', 'budget'];
  return costKeywords.some(keyword => userMessage.includes(keyword));
}

function isServiceQuery(userMessage) {
  const serviceKeywords = ['service', 'services', 'what do you do', 'offer', 'provide'];
  return serviceKeywords.some(keyword => userMessage.includes(keyword));
}

function isPortfolioQuery(userMessage) {
  const portfolioKeywords = ['portfolio', 'projects', 'completed work', 'experience'];
  return portfolioKeywords.some(keyword => userMessage.includes(keyword));
}

function isGreeting(userMessage) {
  const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
  return greetings.some(greeting => userMessage.includes(greeting));
}

function isAboutQuery(userMessage) {
  const aboutKeywords = ['who are you', 'what are you', 'tell me about you', 'about yourself'];
  return aboutKeywords.some(keyword => userMessage.includes(keyword));
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Website redirect handler (simplified version)
function handleWebsiteRedirect(userMessage) {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('tell me about yourself') || lowerMessage.includes('about yourself')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.HOME,
      page: 'home',
      message: `🏗️ **Meezan Developers - Company Overview**\n\nI'd love to tell you about our company! Let me redirect you to our official website where you can learn all about Meezan Developers.`
    };
  }
  
  if (lowerMessage.includes('services') || lowerMessage.includes('what do you build')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.SERVICES,
      page: 'services',
      message: `🏗️ **Our Construction Services**\n\nPerfect! Let me show you our comprehensive construction services and project portfolio.`
    };
  }
  
  if (lowerMessage.includes('portfolio') || lowerMessage.includes('completed projects')) {
    return {
      action: 'redirect_website',
      url: WEBSITE_URLS.PORTFOLIO,
      page: 'portfolio',
      message: `📊 **Our Project Portfolio**\n\nI'd love to show you our construction achievements! Let me redirect you to our portfolio page.`
    };
  }
  
  return null;
}

// ==================== AI AGENT MAINTENANCE ====================

// Session cleanup interval
setInterval(() => {
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  
  let cleanedCount = 0;
  for (const [sessionId, agent] of aiAgents.entries()) {
    if (now - new Date(agent.lastInteraction).getTime() > twentyFourHours) {
      aiAgents.delete(sessionId);
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
}, 60 * 60 * 1000);

// AI Agent monitoring endpoints
router.get('/agent-health', (req, res) => {
  res.json({
    status: 'AI Agent System Operational',
    agent: AGENT_PERSONALITY.name,
    activeAgents: aiAgents.size,
    activeConsultations: meetingStates.size,
    system: 'Autonomous Construction Consultant',
    capabilities: AGENT_PERSONALITY.capabilities,
    timestamp: new Date().toISOString()
  });
});

router.get('/agent-stats', (req, res) => {
  const stats = {
    totalAgents: aiAgents.size,
    goalsInProgress: 0,
    goalsCompleted: 0,
    averageInteractions: 0
  };

  for (const agent of aiAgents.values()) {
    stats.goalsInProgress += agent.activeGoals.size;
    stats.goalsCompleted += agent.achievedGoals.length;
    stats.averageInteractions += agent.interactionCount;
  }

  stats.averageInteractions = aiAgents.size > 0 ? stats.averageInteractions / aiAgents.size : 0;

  res.json({
    system: 'AI Agent Dashboard',
    ...stats,
    serverTime: new Date().toISOString()
  });
});

// Clear agent session
router.post('/clear-agent', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    aiAgents.delete(sessionId);
    meetingStates.delete(sessionId);
    console.log('🤖 AI Agent cleared session:', sessionId);
  }
  res.json({ success: true, message: 'AI Agent session cleared' });
});

module.exports = router;