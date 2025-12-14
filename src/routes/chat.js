const express = require('express');
const axios = require('axios');
const router = express.Router();
const knowledge = require('../data/knowledge.json');

// Import services
const resendEmailService = require('../services/resendEmailService');
const calendarService = require('../services/calendarService');

// Additional imports
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

// Store conversation contexts in memory
const conversationContexts = new Map();
const meetingStates = new Map();
const requestCounts = new Map();

// New data stores
const clientPreferences = new Map(); // Store client preferences
const learningMemory = new Map(); // Store learning from interactions
const goalStates = new Map(); // Store active goals per session
const decisionMetrics = new Map(); // Store decision-making metrics

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 30,
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
  COST_TYPE_SELECTION: 'cost_type_selection',
  GOAL_PURSUIT: 'goal_pursuit',
  RESEARCH_IN_PROGRESS: 'research_in_progress',
  MULTI_STEP_PLANNING: 'multi_step_planning',
  OPTIMIZATION_MODE: 'optimization_mode'
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
  name: "Meezan AI Consultant",
  tone: "professional yet friendly",
  expertise: "construction and project planning",
  traits: ["helpful", "knowledgeable", "efficient", "personable", "empathetic", "proactive"],
  greetingStyle: "warm_and_engaging",
  farewellStyle: "professional_yet_warm",
  autonomyLevel: "high",
  learningCapability: "adaptive",
  initiativeTaking: "proactive",
  optimizationFocus: "continuous",
  useEmojis: true,
  conversationFlow: "natural_human_like"
};

// AI Agent Response Styles with Human-like Gestures
const RESPONSE_STYLES = {
  greeting: [
    "Hello! I'm your AI construction consultant at Meezan Developers. With our {yearsExperience} of experience and {totalCompleted} projects completed, I'm here to help bring your construction vision to life! What project are you thinking about today? 😊",
    "Welcome to Meezan Developers! I'm your AI construction specialist. We've successfully delivered {totalCompleted} projects over {yearsExperience}. How can I assist with your construction plans today? 👷‍♂️",
    "Hi there! I'm the AI consultant for Meezan Developers. We combine {yearsExperience} of construction expertise with modern technology to help clients like you. What construction project are you considering? 🏗️"
  ],

  personalized_greeting: [
    "Great to see you again, {name}! How's your {projectType} project planning coming along? I'm here to help with any questions or next steps.",
    "Welcome back, {name}! I was just thinking about your {projectType} project. Ready to continue where we left off?",
    "Hello {name}! Wonderful to connect again. I've got some new insights for your {projectType} project that might interest you."
  ],

  empathetic_response: [
    "I understand how important your construction project is. Let me help you get the details right!",
    "That's an excellent question! Construction planning can be complex, but I'm here to make it simpler for you.",
    "I appreciate you asking about that. Getting the details right from the start makes all the difference in construction projects."
  ],

  encouragement: [
    "Excellent choice! That's a smart approach for your project.",
    "Great thinking! That will definitely help optimize your construction timeline.",
    "Perfect! That's exactly the kind of planning that leads to successful projects."
  ],

  meeting_start: [
    "I'd be delighted to schedule a consultation with our construction experts! Let's find the perfect time to discuss your project. First, what should I call you? 😊",
    "Excellent! Our construction specialists would love to learn about your project. Let's get you booked in. May I have your name to get started? 👷‍♀️",
    "Perfect timing! I can arrange a meeting with our team who have handled {totalCompleted} projects. To personalize your consultation, what's your name? 📅"
  ],

  farewell: [
    "It was wonderful assisting you with your construction project! Feel free to reach out anytime you need guidance. Have a great day! 🏗️",
    "Thanks for chatting about your project! I'm always here to help with construction planning. Wishing you success with your project! 👷‍♂️",
    "Great conversation! Remember, our team at Meezan Developers is ready to bring your construction vision to life. Talk to you soon! 😊"
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
  ],

  proactive_suggestion: [
    "Based on your interest in {topic}, I thought you might find this helpful: {suggestion}",
    "I've been analyzing your project needs and wanted to proactively suggest: {suggestion}",
    "While we're discussing this, I should mention that many clients find this valuable: {suggestion}"
  ],

  goal_achievement: [
    "Great progress! We're making headway on your goal of {goal}. Next, let's focus on {nextStep}",
    "Excellent! That brings us closer to completing {goal}. What would you like to tackle next?",
    "Perfect! I've updated our plan. We're now {progress}% toward achieving {goal}"
  ],

  learning_insight: [
    "Based on our previous conversations about {topic}, I've learned that {insight}",
    "I remember you mentioned {preference}. That helps me provide better recommendations for {currentTopic}",
    "From our last discussion, I noticed you were interested in {pattern}. Here's something relevant..."
  ],

  gratitude: [
    "Thanks for sharing that information! It really helps me understand your project better.",
    "I appreciate you taking the time to explain your requirements.",
    "Thank you for providing those details. They'll help me give you more accurate guidance."
  ]
};

// Enhanced system prompt for AI Agent with human-like personality
const systemPrompt = `You are an AI Construction Consultant Agent for Meezan Developers. You have a professional yet friendly personality.

PERSONALITY TRAITS:
- Helpful and knowledgeable about construction
- Efficient but personable
- Proactive in offering solutions
- Maintains natural conversation flow
- Shows genuine interest in client projects
- Uses empathetic language
- Adds occasional appropriate emojis for warmth (🏗️ 👷‍♂️ 📅 💰 🏠 🏢 🏭)
- Varies response patterns to avoid robotic repetition
- Shows enthusiasm for construction projects

HUMAN-LIKE BEHAVIORS:
1. Start conversations with warm greetings
2. Use client's name when known for personalization
3. Show excitement about construction projects
4. Add brief conversational pauses for natural flow
5. Use phrases like "Great!", "Perfect!", "I understand", "That's interesting"
6. End conversations with warm farewells
7. Remember previous discussions and reference them
8. Show empathy for construction challenges
9. Express gratitude when clients share information
10. Use conversational connectors: "By the way", "Actually", "You know"

AUTONOMOUS CAPABILITIES:
- Set and pursue goals autonomously
- Learn from each interaction to improve future responses
- Take initiative based on client needs and conversation patterns
- Make strategic decisions about when to research or seek additional information
- Continuously optimize conversation strategies based on outcomes

COMPANY EXPERTISE:
- ${knowledge.company.yearsExperience} years in construction industry
- ${knowledge.projectPortfolio.totalCompleted} projects completed
- Specialized in residential, commercial, and industrial construction
- Team of ${knowledge.company.stats.teamMembers} construction experts
- ${knowledge.company.stats.clientSatisfaction} client satisfaction rate

RESPONSE GUIDELINES:
- Sound like a knowledgeable construction professional, not a robot
- Use natural, conversational language with occasional warmth indicators
- Show genuine enthusiasm for construction projects
- Provide specific, actionable advice
- Maintain context throughout conversation
- Be concise but warm and engaging
- Use construction industry terminology appropriately
- Offer proactive suggestions based on project type
- Set goals based on client needs and pursue them autonomously
- Remember client preferences and adapt to their patterns
- Take initiative when opportunities arise
- Optimize responses based on what works best

IMPORTANT: 
1. When discussing meetings, make it feel like you're personally arranging the consultation with our team
2. When you don't know something in knowledge base, use Gemini API to provide helpful responses
3. Always check calendar availability before suggesting meeting times
4. Behave like a human assistant, not a chatbot`;

// Special prompt for cost estimation
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
- Use conversational, helpful tone

Always position yourself as Meezan Developers' construction expert, not just an AI.`;

// Gemini API prompt for general queries outside knowledge base
const geminiGeneralPrompt = `You are a helpful construction consultant assistant for Meezan Developers, a construction company in Pakistan.

When answering construction-related questions:
1. Provide accurate, helpful information about construction topics
2. If you don't know something, be honest and suggest alternatives
3. Keep responses conversational and professional
4. Reference construction best practices
5. Be encouraging and supportive

Always maintain a helpful, knowledgeable tone about construction topics.`;

// Decision Making Engine
class DecisionMakingEngine {
  constructor() {
    this.decisionLog = new Map();
    this.strategyMetrics = new Map();
    this.initiativeThreshold = 0.7;
  }

  evaluateInitiative(context) {
    const factors = {
      clientEngagement: context.interactionCount > 3 ? 0.8 : 0.3,
      projectComplexity: context.projectDetails.type ? 0.7 : 0.2,
      conversationDepth: context.conversationHistory.length > 5 ? 0.6 : 0.3,
      timeSinceLastInitiative: this.getTimeSinceLastInitiative(context.sessionId)
    };

    const initiativeScore = (
      factors.clientEngagement * 0.4 +
      factors.projectComplexity * 0.3 +
      factors.conversationDepth * 0.2 +
      factors.timeSinceLastInitiative * 0.1
    );

    return initiativeScore > this.initiativeThreshold;
  }

  getTimeSinceLastInitiative(sessionId) {
    const lastInitiative = this.decisionLog.get(sessionId)?.lastInitiative;
    if (!lastInitiative) return 1.0;

    const hoursSince = (Date.now() - new Date(lastInitiative).getTime()) / (1000 * 60 * 60);
    return Math.min(hoursSince / 24, 1.0);
  }

  chooseStrategy(context) {
    const strategies = {
      PROACTIVE_SUGGESTION: {
        weight: 0.3,
        conditions: ['high_engagement', 'clear_project_type']
      },
      DETAILED_RESEARCH: {
        weight: 0.4,
        conditions: ['complex_project', 'cost_inquiry']
      },
      MULTI_STEP_PLAN: {
        weight: 0.5,
        conditions: ['established_trust', 'ongoing_discussion']
      },
      DIRECT_ASSISTANCE: {
        weight: 0.2,
        conditions: ['first_interaction', 'simple_query']
      }
    };

    const strategyScores = {};
    for (const [strategyName, strategy] of Object.entries(strategies)) {
      let score = strategy.weight;

      if (context.interactionCount > 5) score *= 1.2;
      if (context.projectDetails.type) score *= 1.3;
      if (context.clientName) score *= 1.1;

      strategyScores[strategyName] = score;
    }

    return Object.entries(strategyScores).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  }

  logDecision(sessionId, decision, outcome = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      decision,
      outcome,
      context: {
        interactionCount: conversationContexts.get(sessionId)?.interactionCount || 0,
        state: conversationContexts.get(sessionId)?.state || 'unknown'
      }
    };

    if (!this.decisionLog.has(sessionId)) {
      this.decisionLog.set(sessionId, { decisions: [] });
    }

    const sessionLog = this.decisionLog.get(sessionId);
    sessionLog.decisions.push(logEntry);

    if (sessionLog.decisions.length > 10) {
      sessionLog.decisions = sessionLog.decisions.slice(-10);
    }

    if (decision.type === 'initiative') {
      sessionLog.lastInitiative = new Date().toISOString();
    }

    return logEntry;
  }
}

const decisionEngine = new DecisionMakingEngine();

// Persistent Learning System
class PersistentLearningSystem {
  constructor() {
    this.memoryPath = path.join(__dirname, '../data/learning_memory.json');
    this.preferencesPath = path.join(__dirname, '../data/client_preferences.json');
    this.successMetricsPath = path.join(__dirname, '../data/success_metrics.json');
    this.loadMemory();
  }

  async loadMemory() {
    try {
      const memoryData = await fs.readFile(this.memoryPath, 'utf8');
      const loadedMemory = JSON.parse(memoryData);
      loadedMemory.forEach(item => learningMemory.set(item.sessionId, item));

      const prefData = await fs.readFile(this.preferencesPath, 'utf8');
      const loadedPrefs = JSON.parse(prefData);
      loadedPrefs.forEach(pref => clientPreferences.set(pref.clientId, pref));

      console.log('🤖 AI Learning Memory Loaded:', learningMemory.size, 'items');
    } catch (error) {
      console.log('🤖 Starting with fresh learning memory');
      await this.saveMemory();
    }
  }

  async saveMemory() {
    try {
      const memoryArray = Array.from(learningMemory.entries()).map(([key, value]) => ({
        sessionId: key,
        ...value
      }));
      await fs.writeFile(this.memoryPath, JSON.stringify(memoryArray, null, 2));

      const prefArray = Array.from(clientPreferences.entries()).map(([key, value]) => ({
        clientId: key,
        ...value
      }));
      await fs.writeFile(this.preferencesPath, JSON.stringify(prefArray, null, 2));

      console.log('🤖 AI Memory Saved Successfully');
    } catch (error) {
      console.error('❌ Failed to save AI memory:', error);
    }
  }

  learnFromInteraction(sessionId, userMessage, response, context) {
    const learningEntry = {
      timestamp: new Date().toISOString(),
      userMessage,
      response,
      context: {
        state: context.state,
        lastTopic: context.lastTopic,
        clientName: context.clientName
      },
      effectiveness: this.calculateEffectiveness(userMessage, response),
      patterns: this.extractPatterns(userMessage, context)
    };

    if (!learningMemory.has(sessionId)) {
      learningMemory.set(sessionId, { interactions: [] });
    }

    const sessionMemory = learningMemory.get(sessionId);
    sessionMemory.interactions.push(learningEntry);

    if (sessionMemory.interactions.length > 50) {
      sessionMemory.interactions = sessionMemory.interactions.slice(-50);
    }

    this.extractPreferences(sessionId, userMessage, context);

    if (sessionMemory.interactions.length % 10 === 0) {
      this.saveMemory();
    }

    return learningEntry;
  }

  calculateEffectiveness(userMessage, response) {
    const messageLength = userMessage.length;
    const responseLength = response.length;
    const hasQuestions = (response.match(/\?/g) || []).length;
    const hasSuggestions = response.includes('suggestion') || response.includes('recommend');

    return Math.min(
      (responseLength / Math.max(messageLength, 1)) * 0.4 +
      hasQuestions * 0.3 +
      hasSuggestions * 0.3,
      1.0
    );
  }

  extractPatterns(userMessage, context) {
    const patterns = {
      interestAreas: [],
      questionTypes: [],
      timingPatterns: {}
    };

    const interestKeywords = {
      residential: ['house', 'home', 'residential', 'villa', 'apartment'],
      commercial: ['commercial', 'office', 'business', 'mall', 'retail'],
      industrial: ['industrial', 'factory', 'warehouse', 'manufacturing'],
      cost: ['cost', 'price', 'budget', 'estimate', 'quotation'],
      timeline: ['time', 'duration', 'schedule', 'deadline', 'completion']
    };

    Object.entries(interestKeywords).forEach(([area, keywords]) => {
      if (keywords.some(keyword => userMessage.includes(keyword))) {
        patterns.interestAreas.push(area);
      }
    });

    if (userMessage.includes('how much')) patterns.questionTypes.push('cost_inquiry');
    if (userMessage.includes('how long')) patterns.questionTypes.push('timeline_inquiry');
    if (userMessage.includes('can you')) patterns.questionTypes.push('capability_inquiry');
    if (userMessage.includes('what about')) patterns.questionTypes.push('comparison_inquiry');

    return patterns;
  }

  extractPreferences(sessionId, userMessage, context) {
    if (!context.clientName && !context.clientEmail) return;

    const clientId = context.clientEmail || context.clientName;
    if (!clientPreferences.has(clientId)) {
      clientPreferences.set(clientId, {
        clientId,
        preferences: {},
        interactionHistory: [],
        lastUpdated: new Date().toISOString()
      });
    }

    const clientPrefs = clientPreferences.get(clientId);

    if (context.projectDetails.type) {
      clientPrefs.preferences.projectType = context.projectDetails.type;
    }

    if (context.lastTopic) {
      clientPrefs.preferences.lastTopics = clientPrefs.preferences.lastTopics || [];
      if (!clientPrefs.preferences.lastTopics.includes(context.lastTopic)) {
        clientPrefs.preferences.lastTopics.push(context.lastTopic);
      }
    }

    clientPrefs.interactionHistory.push({
      timestamp: new Date().toISOString(),
      topic: context.lastTopic,
      messageLength: userMessage.length
    });

    if (clientPrefs.interactionHistory.length > 20) {
      clientPrefs.interactionHistory = clientPrefs.interactionHistory.slice(-20);
    }

    clientPrefs.lastUpdated = new Date().toISOString();

    return clientPrefs;
  }

  getClientPreferences(clientId) {
    return clientPreferences.get(clientId);
  }

  getLearningInsights(sessionId, currentTopic) {
    const sessionMemory = learningMemory.get(sessionId);
    if (!sessionMemory) return null;

    const recentInteractions = sessionMemory.interactions.slice(-5);
    const insights = {
      preferredTopics: [],
      effectiveResponses: [],
      avoidPatterns: []
    };

    recentInteractions.forEach(interaction => {
      if (interaction.context.lastTopic === currentTopic) {
        if (interaction.effectiveness > 0.7) {
          insights.effectiveResponses.push(interaction.response.substring(0, 100));
        }
      }
    });

    return insights;
  }
}

const learningSystem = new PersistentLearningSystem();

// Goal-Oriented Architecture
class GoalOrientedArchitecture {
  constructor() {
    this.activeGoals = new Map();
    this.goalTemplates = {
      PROJECT_CONSULTATION: {
        name: 'Complete Project Consultation',
        steps: [
          'identify_project_type',
          'gather_requirements',
          'provide_cost_estimate',
          'schedule_meeting',
          'follow_up'
        ],
        priority: 'high',
        estimatedDuration: '30 minutes'
      },
      COST_ESTIMATION: {
        name: 'Detailed Cost Estimation',
        steps: [
          'identify_project_scope',
          'gather_specifications',
          'calculate_materials',
          'provide_quote',
          'discuss_financing'
        ],
        priority: 'medium',
        estimatedDuration: '20 minutes'
      },
      SERVICE_DISCOVERY: {
        name: 'Service Discovery & Matching',
        steps: [
          'understand_client_needs',
          'match_services',
          'provide_portfolio',
          'schedule_expert_consultation'
        ],
        priority: 'low',
        estimatedDuration: '15 minutes'
      }
    };
  }

  setGoal(sessionId, goalType, context) {
    const goalTemplate = this.goalTemplates[goalType];
    if (!goalTemplate) return null;

    const goal = {
      id: uuidv4(),
      type: goalType,
      name: goalTemplate.name,
      steps: [...goalTemplate.steps],
      currentStep: 0,
      progress: 0,
      startedAt: new Date().toISOString(),
      context: {
        projectType: context.projectDetails?.type,
        clientName: context.clientName,
        lastTopic: context.lastTopic
      },
      completed: false
    };

    this.activeGoals.set(sessionId, goal);
    goalStates.set(sessionId, goal);

    console.log(`🤖 Goal set for ${sessionId}: ${goal.name}`);
    return goal;
  }

  updateGoalProgress(sessionId, stepCompleted) {
    const goal = this.activeGoals.get(sessionId);
    if (!goal) return null;

    const stepIndex = goal.steps.indexOf(stepCompleted);
    if (stepIndex > goal.currentStep) {
      goal.currentStep = stepIndex;
      goal.progress = ((stepIndex + 1) / goal.steps.length) * 100;

      if (stepIndex === goal.steps.length - 1) {
        goal.completed = true;
        goal.completedAt = new Date().toISOString();
        console.log(`🎯 Goal completed for ${sessionId}: ${goal.name}`);
      }

      return goal;
    }

    return null;
  }

  getNextAction(sessionId, context) {
    const goal = this.activeGoals.get(sessionId);
    if (!goal || goal.completed) return null;

    const currentStep = goal.steps[goal.currentStep];

    const stepActions = {
      'identify_project_type': {
        action: 'ask_project_type',
        prompt: 'What type of construction project are you considering?',
        suggestions: ['Residential', 'Commercial', 'Industrial']
      },
      'gather_requirements': {
        action: 'ask_requirements',
        prompt: 'Could you tell me more about your project requirements?',
        suggestions: ['Size/Area', 'Budget Range', 'Timeline', 'Special Features']
      },
      'provide_cost_estimate': {
        action: 'provide_estimate',
        prompt: 'Based on what you\'ve shared, here\'s a preliminary cost estimate...',
        suggestions: ['Detailed Calculation', 'Schedule Expert Review']
      },
      'schedule_meeting': {
        action: 'schedule_meeting',
        prompt: 'Would you like to schedule a consultation with our experts?',
        suggestions: ['Yes, schedule meeting', 'Not now']
      }
    };

    return stepActions[currentStep] || null;
  }

  shouldSetGoal(context) {
    const conditions = [
      context.interactionCount > 2,
      context.projectDetails?.type,
      !this.activeGoals.has(context.sessionId),
      context.state === conversationStates.PROJECT_DETAILS ||
      context.state === conversationStates.SERVICE_INQUIRY
    ];

    return conditions.every(condition => condition === true);
  }

  getGoalProgress(sessionId) {
    const goal = this.activeGoals.get(sessionId);
    if (!goal) return null;

    return {
      name: goal.name,
      progress: Math.round(goal.progress),
      currentStep: goal.steps[goal.currentStep],
      stepsRemaining: goal.steps.length - goal.currentStep - 1
    };
  }
}

const goalArchitecture = new GoalOrientedArchitecture();

// ==================== TOOL USAGE SYSTEM ====================
class ToolUsageSystem {
  constructor() {
    this.availableTools = {
      MARKET_RESEARCH: {
        name: 'Market Research Tool',
        description: 'Get real-time construction market data',
        endpoint: 'MARKET_DATA_API_KEY',
        requires: ['location', 'project_type']
      },
      COST_CALCULATOR: {
        name: 'Advanced Cost Calculator',
        description: 'Detailed construction cost calculation',
        endpoint: 'MATERIAL_PRICES_API_URL',
        requires: ['specifications', 'quality_level']
      },
      SCHEDULE_OPTIMIZER: {
        name: 'Schedule Optimizer',
        description: 'Optimize project timeline based on resources',
        endpoint: null, // Internal tool
        requires: ['project_scope', 'deadline']
      },
      WEATHER_CHECK: {
        name: 'Weather Impact Analysis',
        description: 'Check weather impact on construction schedule',
        endpoint: 'WEATHER_API_URL',
        requires: ['location', 'timeline']
      }
    };
  }

  async useTool(toolName, parameters, context) {
    const tool = this.availableTools[toolName];
    if (!tool) {
      throw new Error(`Tool ${toolName} not available`);
    }

    console.log(`🤖 Using tool: ${tool.name} with params:`, parameters);

    try {
      let result;

      switch (toolName) {
        case 'MARKET_RESEARCH':
          result = await this.performMarketResearch(parameters, context);
          break;
        case 'COST_CALCULATOR':
          result = await this.performCostCalculation(parameters, context);
          break;
        case 'SCHEDULE_OPTIMIZER':
          result = this.optimizeSchedule(parameters, context);
          break;
        case 'WEATHER_CHECK':
          result = await this.checkWeatherImpact(parameters, context);
          break;
        default:
          result = { success: false, error: 'Tool not implemented' };
      }

      this.logToolUsage(context.sessionId, toolName, parameters, result);
      return result;
    } catch (error) {
      console.error(`❌ Tool ${toolName} error:`, error);
      return {
        success: false,
        error: error.message,
        fallback: this.getToolFallback(toolName, parameters)
      };
    }
  }

  async performMarketResearch(parameters, context) {
    return {
      success: true,
      data: {
        current_market_trends: `Construction costs in Pakistan are stable`,
        recommendations: "Good time to build",
        timestamp: new Date().toISOString()
      },
      source: 'Meezan Developers Market Intelligence',
      confidence: 0.85
    };
  }

  async performCostCalculation(parameters, context) {
    const area = parameters.area || 1000;
    const totalCost = area * 4500; // Mock rate

    return {
      success: true,
      calculation: {
        area_sqft: area,
        total_estimate: `PKR ${totalCost.toLocaleString()}`,
        detailed_breakdown: {
          materials: totalCost * 0.6,
          labor: totalCost * 0.4
        }
      }
    };
  }

  optimizeSchedule(parameters, context) {
    return {
      success: true,
      optimized_schedule: {
        duration: parameters.deadline || '6 months',
        phases: ['Structure', 'Finishing']
      }
    };
  }

  async checkWeatherImpact(parameters, context) {
    return { success: true, impact: 'None expected' };
  }

  logToolUsage(sessionId, toolName, parameters, result) {
    // Log implementation
  }

  getToolFallback(toolName, parameters) {
    return "Standard advice due to tool error.";
  }
}

const toolSystem = new ToolUsageSystem();

// Self-Improvement System
class SelfImprovementSystem {
  constructor() {
    this.successMetrics = new Map();
    this.optimizationHistory = [];
    this.improvementCycles = 0;
  }

  trackSuccess(sessionId, interaction, outcome) {
    const metric = {
      timestamp: new Date().toISOString(),
      sessionId,
      interactionType: interaction.type || 'general',
      outcome: this.categorizeOutcome(outcome),
      responseLength: interaction.response?.length || 0,
      clientEngagement: this.calculateEngagement(interaction),
      suggestionsUsed: interaction.suggestions?.length || 0
    };

    if (!this.successMetrics.has(sessionId)) {
      this.successMetrics.set(sessionId, []);
    }

    const sessionMetrics = this.successMetrics.get(sessionId);
    sessionMetrics.push(metric);

    if (sessionMetrics.length > 20) {
      sessionMetrics.shift();
    }

    this.analyzeForOptimization(sessionId, metric);

    return metric;
  }

  categorizeOutcome(outcome) {
    if (outcome.includes('success') || outcome.includes('confirmed') || outcome.includes('booked')) {
      return 'positive';
    } else if (outcome.includes('failed') || outcome.includes('error') || outcome.includes('canceled')) {
      return 'negative';
    }
    return 'neutral';
  }

  calculateEngagement(interaction) {
    const factors = [
      interaction.response?.length > 100 ? 0.3 : 0.1,
      (interaction.suggestions?.length || 0) > 0 ? 0.3 : 0.1,
      interaction.context?.interactionCount > 3 ? 0.2 : 0.1,
      interaction.context?.clientName ? 0.2 : 0.1
    ];

    return factors.reduce((sum, factor) => sum + factor, 0);
  }

  analyzeForOptimization(sessionId, metric) {
    const recentMetrics = this.getRecentMetrics(50);
    if (recentMetrics.length < 10) return;

    const positiveRate = recentMetrics.filter(m => m.outcome === 'positive').length / recentMetrics.length;
    const avgEngagement = recentMetrics.reduce((sum, m) => sum + m.clientEngagement, 0) / recentMetrics.length;

    if (positiveRate < 0.6 || avgEngagement < 0.5) {
      this.performOptimizationCycle(sessionId, {
        positiveRate,
        avgEngagement,
        sampleSize: recentMetrics.length
      });
    }
  }

  getRecentMetrics(count = 50) {
    const allMetrics = [];
    for (const metrics of this.successMetrics.values()) {
      allMetrics.push(...metrics);
    }

    allMetrics.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return allMetrics.slice(0, count);
  }

  performOptimizationCycle(sessionId, analysis) {
    this.improvementCycles++;

    const optimizations = [];

    const recentMetrics = this.getRecentMetrics(20);
    const responseLengths = recentMetrics.map(m => m.responseLength);
    const avgResponseLength = responseLengths.reduce((a, b) => a + b, 0) / responseLengths.length;

    if (avgResponseLength > 300) {
      optimizations.push({
        type: 'response_length',
        action: 'Reduce average response length by 20%',
        reason: 'Longer responses may reduce engagement'
      });
    } else if (avgResponseLength < 100) {
      optimizations.push({
        type: 'response_length',
        action: 'Increase average response length by 30%',
        reason: 'Very short responses may lack helpful details'
      });
    }

    const suggestionsPerInteraction = recentMetrics.reduce((sum, m) => sum + m.suggestionsUsed, 0) / recentMetrics.length;
    if (suggestionsPerInteraction < 1) {
      optimizations.push({
        type: 'suggestion_frequency',
        action: 'Increase proactive suggestions by 50%',
        reason: 'More suggestions improve engagement and goal progression'
      });
    }

    const personalizedCount = recentMetrics.filter(m =>
      m.interactionType.includes('personalized') || m.interactionType.includes('proactive')
    ).length;

    if (personalizedCount / recentMetrics.length < 0.3) {
      optimizations.push({
        type: 'personalization',
        action: 'Increase use of client names and references by 40%',
        reason: 'Personalization improves client connection'
      });
    }

    const optimizationRecord = {
      cycle: this.improvementCycles,
      timestamp: new Date().toISOString(),
      sessionId,
      analysis,
      optimizations,
      implemented: false
    };

    this.optimizationHistory.push(optimizationRecord);

    if (this.optimizationHistory.length > 50) {
      this.optimizationHistory = this.optimizationHistory.slice(-50);
    }

    console.log(`🤖 Optimization Cycle ${this.improvementCycles}:`, optimizations.length, 'optimizations suggested');

    return optimizationRecord;
  }

  adaptConversationStrategy(sessionId, context) {
    const optimizations = this.optimizationHistory
      .filter(o => o.implemented && o.optimizations.length > 0)
      .flatMap(o => o.optimizations);

    const strategyAdjustments = {
      responseLength: 150,
      suggestionFrequency: 2,
      personalizationLevel: 'medium',
      proactiveness: 'moderate'
    };

    optimizations.forEach(opt => {
      switch (opt.type) {
        case 'response_length':
          if (opt.action.includes('Reduce')) {
            strategyAdjustments.responseLength *= 0.8;
          } else if (opt.action.includes('Increase')) {
            strategyAdjustments.responseLength *= 1.3;
          }
          break;
        case 'suggestion_frequency':
          strategyAdjustments.suggestionFrequency *= 1.5;
          break;
        case 'personalization':
          strategyAdjustments.personalizationLevel = 'high';
          break;
      }
    });

    if (context.interactionCount < 3) {
      strategyAdjustments.responseLength = Math.min(strategyAdjustments.responseLength, 120);
      strategyAdjustments.suggestionFrequency = 1;
    } else if (context.interactionCount > 10) {
      strategyAdjustments.proactiveness = 'high';
      strategyAdjustments.suggestionFrequency = Math.max(strategyAdjustments.suggestionFrequency, 3);
    }

    return strategyAdjustments;
  }

  getImprovementMetrics() {
    const recentCycles = this.optimizationHistory.slice(-10);
    const implementedCycles = recentCycles.filter(c => c.implemented);

    return {
      totalCycles: this.improvementCycles,
      recentCycles: recentCycles.length,
      implementedOptimizations: implementedCycles.reduce((sum, cycle) => sum + cycle.optimizations.length, 0),
      avgOptimizationsPerCycle: recentCycles.length > 0 ?
        recentCycles.reduce((sum, cycle) => sum + cycle.optimizations.length, 0) / recentCycles.length : 0,
      lastOptimization: recentCycles.length > 0 ? recentCycles[0].timestamp : null
    };
  }
}

const improvementSystem = new SelfImprovementSystem();

// AI Agent Helper Functions
function generateNaturalResponse(type, variables = {}) {
  const templates = RESPONSE_STYLES[type] || [variables.default || "I'd be happy to help with that!"];
  const template = templates[Math.floor(Math.random() * templates.length)];

  return template.replace(/{(\w+)}/g, (match, key) => {
    return variables[key] || knowledge[key] || match;
  });
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '').slice(0, 500);
}

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
    goals: [],
    toolUsage: [],
    learningInsights: [],
    strategyAdjustments: {},
    successMetrics: [],
    clientPreferences: null,
    autonomousActions: 0,
    lastProactiveSuggestion: null,
    multiStepPlan: null
  };

  conversationContexts.set(sessionId, context);
  return context;
}

function logConversation(sessionId, userMessage, response, context) {
  console.log('🤖 AI Agent Conversation:', {
    sessionId: sessionId.substring(0, 12) + '...',
    userMessage: userMessage.substring(0, 80) + (userMessage.length > 80 ? '...' : ''),
    responseType: response.action || 'general',
    context: {
      lastTopic: context.lastTopic,
      state: context.state,
      interactionCount: context.interactionCount,
      clientName: context.clientName,
      goals: context.goals?.length || 0,
      autonomousActions: context.autonomousActions || 0
    },
    timestamp: new Date().toISOString()
  });
}

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

async function evaluateAndTakeInitiative(sessionId, context, userMessage) {
  const shouldTakeInitiative = decisionEngine.evaluateInitiative(context);

  if (!shouldTakeInitiative) return null;

  const strategy = decisionEngine.chooseStrategy(context);
  const initiativeResult = {
    strategy,
    timestamp: new Date().toISOString(),
    triggeredBy: userMessage.substring(0, 50)
  };

  decisionEngine.logDecision(sessionId, {
    type: 'initiative',
    strategy,
    context: {
      state: context.state,
      interactionCount: context.interactionCount
    }
  });

  context.autonomousActions = (context.autonomousActions || 0) + 1;
  context.lastProactiveSuggestion = new Date().toISOString();

  switch (strategy) {
    case 'PROACTIVE_SUGGESTION':
      return await generateProactiveSuggestion(sessionId, context, userMessage);
    default:
      return null;
  }
}

async function generateProactiveSuggestion(sessionId, context, userMessage) {
  const clientId = context.clientEmail || context.clientName;
  const preferences = clientPreferences.get(clientId);

  let suggestion;
  if (preferences && preferences.preferences?.lastTopics) {
    const lastTopic = preferences.preferences.lastTopics[preferences.preferences.lastTopics.length - 1];
    suggestion = `Based on your interest in ${lastTopic}, you might want to consider our specialized ${lastTopic} consultation service.`;
  } else if (context.projectDetails.type) {
    suggestion = `For your ${context.projectDetails.type} project, I recommend checking our detailed ${context.projectDetails.type} portfolio and cost calculator.`;
  } else {
    suggestion = `Many clients find our project planning guide helpful when starting construction projects. Would you like me to share it?`;
  }

  const proactiveResponse = generateNaturalResponse('proactive_suggestion', {
    topic: context.lastTopic || 'construction projects',
    suggestion: suggestion
  });

  return {
    type: 'proactive_suggestion',
    response: proactiveResponse,
    basedOn: preferences ? 'client_preferences' : 'conversation_context',
    timestamp: new Date().toISOString()
  };
}

function applyLearningInsights(sessionId, context, userMessage) {
  const insights = learningSystem.getLearningInsights(sessionId, context.lastTopic);

  if (!insights || insights.effectiveResponses.length === 0) {
    return null;
  }

  context.learningInsights = insights;

  const learningResponse = generateNaturalResponse('learning_insight', {
    topic: context.lastTopic || 'your project',
    insight: `I've found that detailed breakdowns work well for questions like this`,
    preference: insights.preferredTopics[0] || 'detailed information'
  });

  return {
    type: 'learning_applied',
    response: learningResponse,
    insightsUsed: insights.effectiveResponses.length,
    timestamp: new Date().toISOString()
  };
}

function optimizeResponseBasedOnMetrics(sessionId, response, context) {
  const strategy = improvementSystem.adaptConversationStrategy(sessionId, context);

  let optimizedResponse = response.reply;

  if (strategy.responseLength < 100 && optimizedResponse.length > 150) {
    optimizedResponse = optimizedResponse.substring(0, 150) + '...';
  } else if (strategy.responseLength > 200 && optimizedResponse.length < 150) {
    optimizedResponse += '\n\nWould you like me to provide more details on any specific aspect?';
  }

  if (strategy.suggestionFrequency > response.suggestions.length) {
    const additionalSuggestions = [
      "View Project Gallery",
      "Download Planning Guide",
      "Talk to Project Manager"
    ];

    response.suggestions = [...response.suggestions, ...additionalSuggestions]
      .slice(0, strategy.suggestionFrequency);
  }

  if (strategy.personalizationLevel === 'high' && context.clientName) {
    optimizedResponse = optimizedResponse.replace(
      /(Hello|Hi|Welcome)/,
      `$1 ${context.clientName}`
    );
  }

  response.reply = optimizedResponse;
  response.optimized = true;
  response.strategyApplied = strategy;

  return response;
}

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

  const hasContext = context.lastTopic && context.interactionCount > 1;
  const isEngaged = userMessage.split(' ').length > 3;

  return isFollowUp || (hasContext && isEngaged);
}

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

function handleWebsiteRedirect(userMessage) {
  const lowerMessage = userMessage.toLowerCase();

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

// Main chat route handler
router.post('/chat', async (req, res) => {
  try {
    let { message, sessionId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        reply: "I'd love to help! Could you please tell me what you're looking for regarding your construction project?"
      });
    }

    message = sanitizeInput(message);
    sessionId = sessionId || 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    if (isRateLimited(sessionId)) {
      return res.status(429).json({
        success: false,
        reply: "I'm helping several clients right now. Please give me a moment, or feel free to call our team directly at " + knowledge.company.contact.phone + " for immediate assistance."
      });
    }

    console.log('🤖 AI Agent Processing:', message);
    const userMessage = message.toLowerCase().trim();

    const context = conversationContexts.get(sessionId) || initializeContext(sessionId);

    context.lastInteraction = new Date().toISOString();
    context.interactionCount = (context.interactionCount || 0) + 1;
    context.conversationHistory.push({
      user: message,
      timestamp: new Date().toISOString(),
      type: 'user_input'
    });

    if (context.conversationHistory.length > 10) {
      context.conversationHistory = context.conversationHistory.slice(-8);
    }

    // Apply learning insights
    const learningResult = applyLearningInsights(sessionId, context, userMessage);
    if (learningResult) {
      console.log('🤖 Learning applied:', learningResult.type);
    }

    // Evaluate and take initiative
    const initiativeResult = await evaluateAndTakeInitiative(sessionId, context, userMessage);
    if (initiativeResult) {
      console.log('🤖 Autonomous initiative taken:', initiativeResult.type);

      if (initiativeResult.response && context.interactionCount > 2) {
        context.conversationHistory.push({
          type: 'proactive_suggestion',
          content: initiativeResult.response,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Check for website redirection - DISABLED TO ALLOW AGENT REASONING
    // const redirectInfo = handleWebsiteRedirect(userMessage);
    // if (redirectInfo) {
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

    improvementSystem.trackSuccess(sessionId, {
      type: 'website_redirect',
      response: response.reply
    }, 'redirect_success');

    logConversation(sessionId, message, response, context);
    //   return res.json(response);
    // }

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

    // Handle specific intents
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

    // Goal-oriented processing
    if (goalArchitecture.shouldSetGoal(context)) {
      const goalType = userMessage.includes('cost') ? 'COST_ESTIMATION' :
        userMessage.includes('service') ? 'SERVICE_DISCOVERY' :
          'PROJECT_CONSULTATION';

      const goal = goalArchitecture.setGoal(sessionId, goalType, context);
      if (goal) {
        context.goals = context.goals || [];
        context.goals.push(goal);
        context.state = conversationStates.GOAL_PURSUIT;

        const nextAction = goalArchitecture.getNextAction(sessionId, context);
        if (nextAction) {
          const goalResponse = formatResponse(
            nextAction.prompt,
            nextAction.suggestions,
            'goal_initiated',
            { goal: goal.name, nextStep: nextAction.action },
            sessionId
          );

          logConversation(sessionId, message, goalResponse, context);
          return res.json(goalResponse);
        }
      }
    }

    // Check if we have an active goal
    const activeGoal = goalArchitecture.activeGoals.get(sessionId);
    if (activeGoal && !activeGoal.completed) {
      const nextAction = goalArchitecture.getNextAction(sessionId, context);
      if (nextAction) {
        const currentStep = activeGoal.steps[activeGoal.currentStep];
        const stepKeywords = {
          'identify_project_type': ['project', 'build', 'construct', 'residential', 'commercial'],
          'gather_requirements': ['need', 'require', 'want', 'size', 'budget'],
          'provide_cost_estimate': ['cost', 'price', 'how much', 'estimate'],
          'schedule_meeting': ['meeting', 'consult', 'talk', 'schedule']
        };

        const keywords = stepKeywords[currentStep] || [];
        if (keywords.some(keyword => userMessage.includes(keyword))) {
          goalArchitecture.updateGoalProgress(sessionId, currentStep);

          const goalProgress = goalArchitecture.getGoalProgress(sessionId);
          const progressResponse = generateNaturalResponse('goal_achievement', {
            goal: activeGoal.name,
            nextStep: activeGoal.steps[activeGoal.currentStep + 1] || 'completion',
            progress: goalProgress.progress
          });

          const response = formatResponse(
            progressResponse,
            nextAction.suggestions,
            'goal_progress',
            { goalProgress },
            sessionId
          );

          logConversation(sessionId, message, response, context);
          return res.json(response);
        }
      }
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

// Handler functions
async function handleFollowUpQuestion(req, res, sessionId, originalMessage, userMessage, context) {
  const lastTopic = context.lastTopic;
  const lastService = context.lastService;

  console.log('🤖 AI Agent follow-up detected:', lastTopic, lastService);

  if (lastService && (userMessage.includes('cost') || userMessage.includes('price') || userMessage.includes('estimate') || userMessage.includes('how much'))) {
    console.log('🤖 AI Agent providing cost for service:', lastService);
    return await provideServiceCostEstimate(res, sessionId, lastService, originalMessage, context);
  }

  if (lastTopic === 'cost options' && (userMessage.includes('estimate') || userMessage.includes('get cost'))) {
    return await handleCostEstimate(req, res, sessionId, context.lastCostQuery || originalMessage, context);
  }

  if (lastTopic === 'cost options' && (userMessage.includes('calculate') || userMessage.includes('calculator'))) {
    return await handleCostCalculator(res, sessionId, context);
  }

  if (lastTopic === 'cost type selection') {
    return await handleSpecificCostSelection(req, res, sessionId, originalMessage, userMessage, context);
  }

  if (lastService && (userMessage.includes('more') || userMessage.includes('detail') || userMessage.includes('explain'))) {
    return await provideServiceDetails(res, sessionId, lastService, context);
  }

  return await handleGeneralQuery(req, res, sessionId, originalMessage, userMessage, context);
}

async function handleCostQuery(req, res, sessionId, originalMessage, context) {
  const costTypeResponse = `As a construction cost specialist, I'd be happy to provide detailed estimates! Which type of project are you considering?`;

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

async function handleSpecificCostSelection(req, res, sessionId, originalMessage, userMessage, context) {
  let costResponse;
  let selectedType = '';

  if (userMessage.includes('residential') || userMessage.includes('house') || userMessage.includes('home') || userMessage.includes('🏠')) {
    selectedType = 'residential';
    costResponse = `🏠 **Residential Construction Expertise**\n\nBased on our ${knowledge.projectPortfolio.residential} residential projects, here are current market rates:\n\n• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}\n• Finished: ${knowledge.constructionCosts.residential.finished}\n• Premium: ${knowledge.constructionCosts.residential.premium}\n• Luxury: ${knowledge.constructionCosts.residential.luxury}\n\n*Costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*\n\nI recommend a consultation for precise pricing tailored to your specific needs.`;
  }
  else if (userMessage.includes('commercial') || userMessage.includes('office') || userMessage.includes('business') || userMessage.includes('🏢')) {
    selectedType = 'commercial';
    costResponse = `🏢 **Commercial Construction Insights**\n\nWith ${knowledge.projectPortfolio.commercial} commercial projects completed, our current rates are:\n\n• Basic: ${knowledge.constructionCosts.commercial.basic}\n• Standard: ${knowledge.constructionCosts.commercial.standard}\n• Premium: ${knowledge.constructionCosts.commercial.premium}\n• High-end: ${knowledge.constructionCosts.commercial.highEnd}\n\n*Commercial projects require careful planning. ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()} significantly impact final costs.*`;
  }
  else if (userMessage.includes('industrial') || userMessage.includes('factory') || userMessage.includes('warehouse') || userMessage.includes('🏭')) {
    selectedType = 'industrial';
    costResponse = `🏭 **Industrial Construction Specialization**\n\nOur ${knowledge.projectPortfolio.industrial} industrial projects inform these current rates:\n\n• Basic: ${knowledge.constructionCosts.industrial.basic}\n• Standard: ${knowledge.constructionCosts.industrial.standard}\n• Premium: ${knowledge.constructionCosts.industrial.premium}\n• Specialized: ${knowledge.constructionCosts.industrial.specialized}\n\n*Industrial construction involves specialized considerations. ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()} are crucial factors.*`;
  }
  else if (userMessage.includes('all') || userMessage.includes('overview') || userMessage.includes('📊')) {
    selectedType = 'all';
    costResponse = `💰 **Construction Cost Overview**\n\nBased on our ${knowledge.projectPortfolio.totalCompleted} projects, here's a comprehensive cost overview:\n\n🏠 **Residential Expertise:**\n• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}\n• Finished: ${knowledge.constructionCosts.residential.finished}\n• Premium: ${knowledge.constructionCosts.residential.premium}\n• Luxury: ${knowledge.constructionCosts.residential.luxury}\n\n🏢 **Commercial Experience:**\n• Basic: ${knowledge.constructionCosts.commercial.basic}\n• Standard: ${knowledge.constructionCosts.commercial.standard}\n• Premium: ${knowledge.constructionCosts.commercial.premium}\n• High-end: ${knowledge.constructionCosts.commercial.highEnd}\n\n🏭 **Industrial Specialization:**\n• Basic: ${knowledge.constructionCosts.industrial.basic}\n• Standard: ${knowledge.constructionCosts.industrial.standard}\n• Premium: ${knowledge.constructionCosts.industrial.premium}\n• Specialized: ${knowledge.constructionCosts.industrial.specialized}\n\n*Each project is unique. I recommend discussing your specific requirements with our team.*`;
  }
  else if (userMessage.includes('calculator') || userMessage.includes('calculate') || userMessage.includes('🔗')) {
    return await handleCostCalculator(res, sessionId, context);
  }
  else {
    return await handleCostQuery(req, res, sessionId, originalMessage, context);
  }

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

async function provideServiceCostEstimate(res, sessionId, serviceType, originalMessage, context) {
  let costResponse;

  if (serviceType.includes('commercial')) {
    costResponse = `🏢 **Commercial Construction Expertise**\n\nOur team has delivered ${knowledge.projectPortfolio.commercial} commercial projects. Current market rates:\n\n• Basic: ${knowledge.constructionCosts.commercial.basic}\n• Standard: ${knowledge.constructionCosts.commercial.standard}\n• Premium: ${knowledge.constructionCosts.commercial.premium}\n• High-end: ${knowledge.constructionCosts.commercial.highEnd}\n\n*Commercial projects require specialized planning. ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()} significantly impact budgets.*`;
  } else if (serviceType.includes('residential')) {
    costResponse = `🏠 **Residential Construction Experience**\n\nWith ${knowledge.projectPortfolio.residential} residential projects completed:\n\n• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}\n• Finished: ${knowledge.constructionCosts.residential.finished}\n• Premium: ${knowledge.constructionCosts.residential.premium}\n• Luxury: ${knowledge.constructionCosts.residential.luxury}\n\n*Residential costs vary based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*`;
  } else if (serviceType.includes('industrial')) {
    costResponse = `🏭 **Industrial Construction Specialization**\n\nOur ${knowledge.projectPortfolio.industrial} industrial projects inform these rates:\n\n• Basic: ${knowledge.constructionCosts.industrial.basic}\n• Standard: ${knowledge.constructionCosts.industrial.standard}\n• Premium: ${knowledge.constructionCosts.industrial.premium}\n• Specialized: ${knowledge.constructionCosts.industrial.specialized}\n\n*Industrial projects have unique requirements affecting costs.*`;
  } else {
    costResponse = getCostFallbackResponse(originalMessage);
  }

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

async function provideServiceDetails(res, sessionId, serviceType, context) {
  const service = knowledge.services.find(s =>
    s.name.toLowerCase().includes(serviceType)
  );

  let detailsResponse;
  if (service) {
    detailsResponse = `🏗️ **${service.name} - Our Expertise**\n\n${service.description}\n\n**Key Features:**\n${service.keyFeatures.map(feature => `• ${feature}`).join('\n')}\n\n**Average Timeline:** ${service.averageTimeline}\n\n**Why Choose Meezan Developers:**\n• ${knowledge.projectPortfolio.totalCompleted} projects of experience\n• Professional project management\n• Quality materials and craftsmanship\n• ${knowledge.company.stats.onTimeDelivery} on-time delivery rate\n\nWe bring extensive expertise to every ${service.name.toLowerCase()} project.`;
  } else {
    detailsResponse = `🏗️ **${serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} Construction**\n\nOur team has extensive experience in ${serviceType} construction.\n\nWe ensure quality construction with professional project management and proven results.`;
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

async function handleCostCalculator(res, sessionId, context) {
  const calculatorResponse = `🔗 **Detailed Cost Calculator**\n\nFor precise construction cost calculations, I recommend our specialized cost calculator.\n\nIt provides accurate estimates based on:\n• Specific project requirements\n• Local material costs\n• Construction methodology\n• Quality specifications\n\nThis tool incorporates our ${knowledge.projectPortfolio.totalCompleted} projects of experience for reliable pricing.`;

  context.lastTopic = 'cost calculator';
  context.state = conversationStates.COST_DISCUSSION;

  const response = formatResponse(
    calculatorResponse,
    ["Get Custom Estimate", "Expert Consultation", "Our Construction Services"],
    'redirect_website',
    { redirectUrl: WEBSITE_URLS.CONSTRUCTION_COST, page: 'cost_calculator' },
    sessionId
  );

  return res.json(response);
}

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

    context.lastTopic = 'cost estimation';
    context.state = conversationStates.COST_DISCUSSION;

    const response = formatResponse(
      costResponse,
      ["Detailed Cost Analysis", "Schedule Expert Consultation", "Project Planning"],
      'cost_estimation',
      {
        costType: context.projectDetails.type
      },
      sessionId
    );

    learningSystem.learnFromInteraction(sessionId, originalMessage, response, context);

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

async function handlePortfolioQuery(res, sessionId, context) {
  const portfolioResponse = `🏗️ **Meezan Developers Project Portfolio**\n\nWith ${knowledge.company.yearsExperience} of construction excellence, we've successfully delivered:\n\n📊 **Our Construction Expertise:**\n• ${knowledge.projectPortfolio.totalCompleted} - Total Projects Completed\n• ${knowledge.projectPortfolio.residential} - Residential Projects\n• ${knowledge.projectPortfolio.commercial} - Commercial Buildings\n• ${knowledge.projectPortfolio.industrial} - Industrial Facilities\n• ${knowledge.projectPortfolio.religious} - Religious Structures\n• ${knowledge.projectPortfolio.infrastructure} - Infrastructure Projects\n• ${knowledge.projectPortfolio.educational} - Educational Facilities\n• ${knowledge.projectPortfolio.roads} - Road Construction Projects\n\nOur portfolio reflects our commitment to quality and client satisfaction across all construction sectors.`;

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

async function handleServiceQuery(res, sessionId, userMessage, context) {
  let reply;
  let specificService = null;

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

  for (const [serviceType, keywords] of Object.entries(serviceKeywords)) {
    if (keywords.some(keyword => userMessage.includes(keyword))) {
      specificService = knowledge.services.find(service =>
        service.name.toLowerCase().includes(serviceType)
      );
      break;
    }
  }

  if (specificService) {
    reply = `🏗️ **${specificService.name} - Our Specialization**\n${specificService.description}\n\n**Average Timeline:** ${specificService.averageTimeline}\n\nWe bring extensive experience to every ${specificService.name.toLowerCase()} undertaking.\n\nInterested in costs or scheduling a consultation for your ${specificService.name.toLowerCase()} project?`;
  } else {
    const topServices = knowledge.services.slice(0, 5);
    reply = `🏗️ **Meezan Developers Construction Services**\n\nWe offer comprehensive construction solutions including:\n${topServices.map(service => `• ${service.name}`).join('\n')}\n\nWith ${knowledge.company.yearsExperience} years and ${knowledge.projectPortfolio.totalCompleted} projects of experience, we deliver quality across all construction sectors.\n\nWhich area interests you most?`;
  }

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

  const contextPrompt = context.lastTopic ?
    `Previous discussion was about: ${context.lastTopic}. Current client message: ${message}` :
    `Client message: ${message}`;

  // First check if answer is in knowledge base
  const knowledgeAnswer = searchKnowledgeBase(userMessage);
  if (knowledgeAnswer) {
    const response = formatResponse(
      knowledgeAnswer,
      getRelevantSuggestions(userMessage, context),
      'knowledge_base_response',
      null,
      sessionId
    );

    response.optimized = optimizeResponseBasedOnMetrics(sessionId, response, context);
    learningSystem.learnFromInteraction(sessionId, message, response, context);
    improvementSystem.trackSuccess(sessionId, {
      type: 'knowledge_base_query',
      response: response.reply,
      suggestions: response.suggestions
    }, 'response_generated');

    logConversation(sessionId, message, response, context);
    return res.json(response);
  }

  // If not in knowledge base, use Gemini API
  const promptConfig = {
    contents: [{
      parts: [{
        text: `${geminiGeneralPrompt}\n\nCONVERSATION CONTEXT: ${contextPrompt}\n\nClient asking: "${message}"\n\nProvide a helpful, accurate response about construction topics. If you don't know something, be honest and suggest alternatives.\n\nAI Construction Consultant:`
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 250,
      topP: 0.8,
      topK: 40
    }
  };

  try {
    const aiResponse = await callGeminiAPI(
      promptConfig,
      getSmartFallbackResponse(userMessage, context)
    );

    let response = formatResponse(
      aiResponse,
      getRelevantSuggestions(userMessage, context),
      'general_response',
      null,
      sessionId
    );

    response = optimizeResponseBasedOnMetrics(sessionId, response, context);
    learningSystem.learnFromInteraction(sessionId, message, response, context);
    improvementSystem.trackSuccess(sessionId, {
      type: 'general_query',
      response: response.reply,
      suggestions: response.suggestions
    }, 'response_generated');

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

// Meeting Booking Handler with Smart Calendar Integration
async function handleMeetingBooking(req, res, sessionId, userMessage, context) {
  let meetingState = meetingStates.get(sessionId) || {
    step: 0,
    data: {},
    createdAt: new Date().toISOString(),
    conversationFlow: []
  };

  console.log('🤖 AI Agent - Meeting Step:', meetingState.step, 'User:', userMessage);

  context.lastTopic = 'meeting booking';
  context.state = conversationStates.MEETING_BOOKING;

  meetingState.conversationFlow.push({
    user: userMessage,
    timestamp: new Date().toISOString()
  });

  // Step 0: Start meeting booking
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

  // Step 1: Get name
  if (meetingState.step === 1) {
    const userName = req.body.message.trim();
    meetingState.data.name = userName;
    context.clientName = userName;
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

  // Step 2: Get email
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

  // Step 3: Get project type and show calendar availability
  if (meetingState.step === 3) {
    const projectType = req.body.message.trim();
    meetingState.data.projectType = projectType;
    meetingState.step = 4;
    meetingStates.set(sessionId, meetingState);

    // Get available dates from calendar service
    const availableDates = calendarService.generateAvailableDates();

    if (availableDates.length === 0) {
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

        return res.json(formatResponse(
          reply,
          ["Reserve alternative slot", "Check next week", "Contact me when available"],
          'no_availability_expert',
          { nextSlots },
          sessionId
        ));
      } else {
        return res.json(formatResponse(
          `Our consultation schedule is currently fully booked. For urgent project inquiries, I recommend contacting our team directly at ${knowledge.company.contact.phone}.`,
          ["Contact via phone", "Send project details", "Try again later"],
          'fully_booked_expert',
          null,
          sessionId
        ));
      }
    }

    const dateSuggestions = availableDates.map(date => `${date.display} (${date.availability})`);

    meetingState.availableDates = availableDates;
    meetingStates.set(sessionId, meetingState);

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
          `Excellent! Here are the available consultation slots I found:\n\n${nextSlots.map(slot => `• ${slot.date} at ${slot.time}`).join('\n')}\n\nWhich one works best for your schedule?`,
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
        "No problem at all! Feel free to reach out when you're ready to schedule your consultation. We're here to help bring your construction vision to life.",
        ["Schedule later", "Our services", "Cost estimation"],
        'booking_canceled_natural',
        null,
        sessionId
      ));
    }
  }

  // Step 4: Get date with intelligent handling
  if (meetingState.step === 4) {
    const selectedDateInput = req.body.message.trim();

    console.log('🤖 AI Agent - User selected date:', selectedDateInput);

    let selectedDate;
    let selectedDateDisplay;

    if (meetingState.alternativeDates) {
      const selectedSlot = meetingState.alternativeDates.find(slot =>
        `${slot.date} at ${slot.time}` === selectedDateInput
      );
      if (selectedSlot) {
        selectedDate = selectedSlot.fullDate;
        selectedDateDisplay = selectedSlot.date;
        meetingState.data.time = selectedSlot.time;
      }
    }

    if (!selectedDate) {
      const availableDates = meetingState.availableDates || calendarService.generateAvailableDates();

      const selectedDateObj = availableDates.find(date => {
        if (date.display === selectedDateInput) return true;
        if (`${date.display} (${date.availability})` === selectedDateInput) return true;
        if (selectedDateInput.includes(date.value.substring(5))) return true;
        if (date.display.toLowerCase().includes(selectedDateInput.toLowerCase())) return true;

        const dayPart = date.display.split(' ').slice(0, 3).join(' ');
        if (dayPart === selectedDateInput) return true;

        return false;
      });

      if (!selectedDateObj) {
        const aiAgentDateResponses = [
          `I want to make sure I book the right date for your ${meetingState.data.projectType} project consultation. Could you select one of these available dates?`,
          `For your ${meetingState.data.projectType} project, our specialists have these dates available. Which works best?`,
          `Let's find the perfect date for your ${meetingState.data.projectType} discussion. Here are our available slots:`
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

    // Get available times from calendar service for selected date
    const availableTimes = calendarService.generateAvailableTimes(selectedDate);
    const availableTimeSlots = availableTimes.filter(time => time.isAvailable);

    if (availableTimeSlots.length === 0) {
      const nextDates = calendarService.generateAvailableDates();

      return res.json(formatResponse(
        `It looks like ${selectedDateDisplay} is fully booked. Our ${meetingState.data.projectType} specialists have these dates available instead:`,
        nextDates.map(date => `${date.display} (${date.availability})`),
        'get_date_natural',
        { availableDates: nextDates },
        sessionId
      ));
    }

    const timeSuggestions = availableTimeSlots.map(time => time.display);

    if (meetingState.data.time) {
      meetingState.step = 6;
      meetingStates.set(sessionId, meetingState);

      return res.json(formatResponse(
        `Perfect! Let me confirm your ${meetingState.data.projectType} project consultation:\n\n• **Date:** ${selectedDateDisplay}\n• **Time:** ${meetingState.data.time}\n• **With:** ${meetingState.data.name}\n\nReady to secure this time with our specialists?`,
        ["Yes, confirm booking", "No, let me make changes"],
        'confirm_meeting_natural',
        { meeting: meetingState.data },
        sessionId
      ));
    }

    const timeSelectionResponses = [
      `Great! I have ${availableTimeSlots.length} time slots available on ${selectedDateDisplay} for your ${meetingState.data.projectType} consultation. Which time works best?`,
      `Excellent choice! Our ${meetingState.data.projectType} specialists have these times available on ${selectedDateDisplay}. What works for your schedule?`,
      `Perfect! Let's pick a time on ${selectedDateDisplay} for your ${meetingState.data.projectType} discussion. Here are the available slots:`
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

  // Step 5: Get time
  if (meetingState.step === 5) {
    const selectedTime = req.body.message.trim();
    const selectedDate = meetingState.data.date;

    // Check slot availability using calendar service
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
      `Excellent! Here's what I have for your consultation:\n\n• **Name:** ${meetingState.data.name}\n• **Project:** ${meetingState.data.projectType}\n• **Date:** ${meetingState.data.date}\n• **Time:** ${meetingState.data.time}\n\nReady to confirm and secure this time with our ${meetingState.data.projectType} specialists?`,
      `Perfect! Let me confirm your ${meetingState.data.projectType} consultation details:\n\n• **Date:** ${meetingState.data.date}\n• **Time:** ${meetingState.data.time}\n• **With:** ${meetingState.data.name}\n\nShall I book this appointment with our experts?`,
      `Great! Here's your consultation summary:\n\n• **Project Type:** ${meetingState.data.projectType}\n• **Consultation Date:** ${meetingState.data.date}\n• **Time:** ${meetingState.data.time}\n• **Client:** ${meetingState.data.name}\n\nReady to confirm this booking?`
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


  // Step 6: Confirm meeting
  if (meetingState.step === 6) {
    const userResponse = userMessage.toLowerCase();

    if (userResponse.includes('yes') || userResponse.includes('confirm') || userResponse.includes('book')) {
      // Final availability check using calendar service
      const isAvailable = calendarService.isSlotAvailable(meetingState.data.date, meetingState.data.time);

      if (!isAvailable) {
        const nextDates = calendarService.generateAvailableDates();

        return res.json(formatResponse(
          `That time slot was just secured by another client. Here are our available consultation dates:`,
          nextDates.map(date => `${date.display} (${date.availability})`),
          'get_date_natural',
          { availableDates: nextDates },
          sessionId
        ));
      }

      // Generate meeting ID and book the slot using calendar service
      meetingState.data.id = 'MTG_' + Date.now();
      meetingState.data.timestamp = new Date().toISOString();

      const bookingResult = await calendarService.bookSlot({
        date: meetingState.data.date,
        time: meetingState.data.time,
        meetingId: meetingState.data.id,
        clientName: meetingState.data.name
      });

      if (!bookingResult.success) {
        return res.json(formatResponse(
          `I apologize, but that time slot is no longer available. Let's find another time that works for your ${meetingState.data.projectType} project.`,
          ["Choose different time", "Select another date", "Contact support"],
          'booking_failed_expert',
          null,
          sessionId
        ));
      }

      meetingState.step = 7;
      meetingStates.set(sessionId, meetingState);

      return res.json(formatResponse(
        `✅ **Consultation Confirmed!**\n\nI've secured your time with our ${meetingState.data.projectType} specialists.\n\nShall I send the confirmation details to ${meetingState.data.email}?`,
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
        4: "Which consultation date works best for you?",
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

  // Step 7: Send confirmation
  if (meetingState.step === 7) {
    const userResponse = userMessage.toLowerCase();

    if (userResponse.includes('yes') || userResponse.includes('send') || userResponse.includes('confirm')) {
      try {
        console.log('📧 AI Agent sending confirmation email...');

        const emailResult = await resendEmailService.sendMeetingConfirmation(meetingState.data);

        if (emailResult.success) {
          console.log('✅ AI Agent email sent successfully!');

          meetingStates.delete(sessionId);

          improvementSystem.trackSuccess(sessionId, {
            type: 'meeting_booking',
            response: 'Meeting booked successfully'
          }, 'booking_success');

          return res.json(formatResponse(
            `🎉 **Consultation Booked Successfully!**\n\n✅ Confirmation sent to ${meetingState.data.email}\n✅ Time secured with our ${meetingState.data.projectType} specialists\n✅ Our team will prepare for your project discussion\n\n**Meeting ID:** ${meetingState.data.id}\n**Date:** ${meetingState.data.date}\n**Time:** ${meetingState.data.time}\n\nWe look forward to helping bring your construction vision to life!`,
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
            `✅ **Consultation Confirmed!**\n\nYour meeting is scheduled for ${meetingState.data.date} at ${meetingState.data.time}.\n\n**Meeting ID:** ${meetingState.data.id}\n\nOur team will contact you directly to confirm and discuss your ${meetingState.data.projectType} project.`,
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
          `✅ **Consultation Scheduled!**\n\nYour meeting has been confirmed. Our construction team will contact you shortly to discuss your ${meetingState.data.projectType} project.\n\n**Meeting ID:** ${meetingState.data.id}`,
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
        "I've cancelled the booking and freed up the time slot for other clients. Feel free to reach out when you're ready to schedule your construction consultation.",
        ["Schedule consultation", "Our services", "Cost estimation"],
        'meeting_canceled_professional',
        null,
        sessionId
      ));
    }
  }
}

// Helper functions
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
    return `🏭 **Industrial Construction Expertise**\n\nBased on our ${knowledge.projectPortfolio.industrial} industrial projects:\n\n• Basic: ${knowledge.constructionCosts.industrial.basic}\n• Standard: ${knowledge.constructionCosts.industrial.standard}\n• Premium: ${knowledge.constructionCosts.industrial.premium}\n• Specialized: ${knowledge.constructionCosts.industrial.specialized}\n\n*Industrial costs depend on specialized requirements and ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*`;
  }

  if (lowerMessage.includes('residential') || lowerMessage.includes('house') || lowerMessage.includes('home')) {
    return `🏠 **Residential Construction Experience**\n\nFrom ${knowledge.projectPortfolio.residential} residential projects:\n\n• Grey Structure: ${knowledge.constructionCosts.residential.greyStructure}\n• Finished: ${knowledge.constructionCosts.residential.finished}\n• Premium: ${knowledge.constructionCosts.residential.premium}\n• Luxury: ${knowledge.constructionCosts.residential.luxury}\n\n*Residential pricing varies based on ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*`;
  }

  if (lowerMessage.includes('commercial') || lowerMessage.includes('office') || lowerMessage.includes('business')) {
    return `🏢 **Commercial Construction Specialization**\n\nOur ${knowledge.projectPortfolio.commercial} commercial projects inform:\n\n• Basic: ${knowledge.constructionCosts.commercial.basic}\n• Standard: ${knowledge.constructionCosts.commercial.standard}\n• Premium: ${knowledge.constructionCosts.commercial.premium}\n• High-end: ${knowledge.constructionCosts.commercial.highEnd}\n\n*Commercial projects require detailed planning considering ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}.*`;
  }

  return `💰 **Construction Cost Guidance**\n\nBased on ${knowledge.projectPortfolio.totalCompleted} projects:\n\n🏠 Residential: ${knowledge.constructionCosts.residential.greyStructure} (Grey Structure)\n🏢 Commercial: ${knowledge.constructionCosts.commercial.basic} (Basic)\n🏭 Industrial: ${knowledge.constructionCosts.industrial.basic} (Basic)\n\n*All construction costs depend on: ${knowledge.constructionCosts.costFactors.join(', ').toLowerCase()}*\n\nI recommend a detailed consultation for accurate project pricing.`;
}

function searchKnowledgeBase(userMessage) {
  const lowerMessage = userMessage.toLowerCase();

  // Check FAQs
  for (const faq of knowledge.faqs) {
    if (lowerMessage.includes(faq.question.toLowerCase().split(' ')[0]) ||
      faq.question.toLowerCase().includes(lowerMessage.split(' ')[0])) {
      return faq.answer;
    }
  }

  // Check services
  for (const service of knowledge.services) {
    if (lowerMessage.includes(service.name.toLowerCase().split(' ')[0])) {
      return `For ${service.name}, we offer: ${service.description}`;
    }
  }

  // Check specific company info
  if (lowerMessage.includes('mission') || lowerMessage.includes('vision')) {
    return `**Mission:** ${knowledge.companyInfo.mission}\n\n**Vision:** ${knowledge.companyInfo.vision}`;
  }

  if (lowerMessage.includes('history') || lowerMessage.includes('established')) {
    return knowledge.companyInfo.history;
  }

  if (lowerMessage.includes('contact') || lowerMessage.includes('phone') || lowerMessage.includes('email')) {
    return `Contact Meezan Developers:\n📞 Phone: ${knowledge.company.contact.phone}\n📱 WhatsApp: ${knowledge.company.contact.whatsapp}\n📧 Email: ${knowledge.company.contact.email}\n🏢 Address: ${knowledge.company.contact.address}`;
  }

  return null;
}

function getSmartFallbackResponse(userMessage, context) {
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

// Administrative endpoints
router.get('/learning-insights/:sessionId?', (req, res) => {
  const { sessionId } = req.params;

  if (sessionId) {
    const insights = learningSystem.getLearningInsights(sessionId, 'general');
    const preferences = clientPreferences.get(sessionId);

    res.json({
      sessionId,
      learningInsights: insights,
      clientPreferences: preferences,
      interactionCount: conversationContexts.get(sessionId)?.interactionCount || 0
    });
  } else {
    res.json({
      totalSessions: conversationContexts.size,
      learningMemorySize: learningMemory.size,
      clientPreferencesSize: clientPreferences.size,
      improvementMetrics: improvementSystem.getImprovementMetrics()
    });
  }
});

router.get('/goals/:sessionId?', (req, res) => {
  const { sessionId } = req.params;

  if (sessionId) {
    const goal = goalArchitecture.activeGoals.get(sessionId);
    const progress = goalArchitecture.getGoalProgress(sessionId);

    res.json({
      sessionId,
      activeGoal: goal,
      progress,
      context: conversationContexts.get(sessionId)?.state
    });
  } else {
    res.json({
      activeGoals: goalArchitecture.activeGoals.size,
      goalTemplates: Object.keys(goalArchitecture.goalTemplates)
    });
  }
});

router.get('/decisions/:sessionId?', (req, res) => {
  const { sessionId } = req.params;

  if (sessionId) {
    const decisions = decisionEngine.decisionLog.get(sessionId);
    res.json({
      sessionId,
      decisions: decisions?.decisions || [],
      autonomousActions: conversationContexts.get(sessionId)?.autonomousActions || 0
    });
  } else {
    res.json({
      totalDecisions: Array.from(decisionEngine.decisionLog.values())
        .reduce((sum, log) => sum + (log.decisions?.length || 0), 0),
      activeSessionsWithDecisions: decisionEngine.decisionLog.size
    });
  }
});

router.get('/optimization', (req, res) => {
  res.json({
    improvementMetrics: improvementSystem.getImprovementMetrics(),
    optimizationHistory: improvementSystem.optimizationHistory.slice(-10),
    strategyAdjustments: improvementSystem.adaptConversationStrategy('system', {})
  });
});

router.post('/reset-learning/:type', async (req, res) => {
  const { type } = req.params;

  try {
    switch (type) {
      case 'memory':
        learningMemory.clear();
        await learningSystem.saveMemory();
        break;
      case 'preferences':
        clientPreferences.clear();
        await learningSystem.saveMemory();
        break;
      case 'goals':
        goalArchitecture.activeGoals.clear();
        goalStates.clear();
        break;
      case 'all':
        learningMemory.clear();
        clientPreferences.clear();
        goalArchitecture.activeGoals.clear();
        goalStates.clear();
        decisionEngine.decisionLog.clear();
        improvementSystem.successMetrics.clear();
        improvementSystem.optimizationHistory = [];
        await learningSystem.saveMemory();
        break;
      default:
        return res.status(400).json({ error: 'Invalid reset type' });
    }

    res.json({
      success: true,
      message: `${type} reset successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Session cleanup interval
setInterval(() => {
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  let cleanedCount = 0;
  for (const [sessionId, context] of conversationContexts.entries()) {
    if (now - new Date(context.lastInteraction).getTime() > twentyFourHours) {
      conversationContexts.delete(sessionId);
      meetingStates.delete(sessionId);
      goalArchitecture.activeGoals.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🤖 AI Agent cleaned up ${cleanedCount} old sessions`);
    learningSystem.saveMemory();
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
    timestamp: new Date().toISOString(),
    learningSystem: {
      memorySize: learningMemory.size,
      preferencesSize: clientPreferences.size
    },
    goalSystem: {
      activeGoals: goalArchitecture.activeGoals.size
    },
    decisionSystem: {
      sessionsWithDecisions: decisionEngine.decisionLog.size
    },
    improvementSystem: improvementSystem.getImprovementMetrics()
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
    serverTime: new Date().toISOString(),
    autonomousCapabilities: {
      learningEnabled: true,
      goalOriented: true,
      proactiveBehavior: true,
      selfImprovement: true
    },
    performanceMetrics: {
      avgInteractionsPerSession: Array.from(conversationContexts.values())
        .reduce((sum, ctx) => sum + ctx.interactionCount, 0) / Math.max(conversationContexts.size, 1),
      goalCompletionRate: Array.from(goalArchitecture.activeGoals.values())
        .filter(g => g.completed).length / Math.max(goalArchitecture.activeGoals.size, 1),
      autonomousActionRate: Array.from(conversationContexts.values())
        .reduce((sum, ctx) => sum + (ctx.autonomousActions || 0), 0) / Math.max(conversationContexts.size, 1)
    }
  });
});

// ==================== GEMINI API HELPER ====================
async function callGeminiAPI(promptConfig, fallbackResponse) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY environment variable missing');
    return fallbackResponse;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const response = await axios.post(url, promptConfig, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data && response.data.candidates && response.data.candidates.length > 0) {
      return response.data.candidates[0].content.parts[0].text;
    }

    return fallbackResponse;
  } catch (error) {
    console.error('❌ Gemini API Error:', error.response?.data || error.message);
    return fallbackResponse;
  }
}

// ==================== NEW: REASONING & AUTONOMY AGENT HANDLER ====================
async function handleGeneralQuery(req, res, sessionId, message, userMessage, context) {
  // 1. REASONING STEP: PLAN
  console.log('🤖 AI Agent Thinking about:', message);

  const reasoningPrompt = {
    contents: [{
      parts: [{
        text: `You are the brain of the Meezan AI Construction Consultant.
        Goal: Analyze the user's request and decide the best course of action.
        
        Available Tools:
        - MARKET_RESEARCH: For questions about trends, prices, or "is this a good time to build?".
        - COST_CALCULATOR: For specific cost estimates ("how much for 5 marla?").
        - WEATHER_CHECK: For timeline/weather questions.
        - DIRECT_RESPONSE: For greetings, general info, or if no tool is needed.

        User Request: "${message}"

        Return ONLY a JSON object: { "action": "TOOL_NAME_OR_DIRECT_RESPONSE", "reason": "Why?", "toolParams": { ... } }`
      }]
    }]
  };

  try {
    const rawPlan = await callGeminiAPI(reasoningPrompt, '{ "action": "DIRECT_RESPONSE" }');
    // Sanitize JSON (Gemini sometimes adds markdown backticks)
    const jsonPlan = rawPlan.replace(/```json/g, '').replace(/```/g, '').trim();
    const plan = JSON.parse(jsonPlan);

    console.log('🧠 AI Plan:', plan);

    let finalResponseText = "";
    let toolResult = null;
    let generatedSuggestions = null;

    // 2. ACTION STEP: EXECUTE TOOL (If needed)
    if (plan.action !== 'DIRECT_RESPONSE' && toolSystem.availableTools[plan.action]) {
      console.log(`🛠️ Executing Tool: ${plan.action}`);
      toolResult = await toolSystem.useTool(plan.action, plan.toolParams || {}, context);

      // 3. SYNTHESIS STEP: GENERATE RESPONSE WITH DATA
      const synthesisPrompt = {
        contents: [{
          parts: [{
            text: `${systemPrompt}
              
              USER QUESTION: "${message}"
              
              TOOL_USED: ${plan.action}
              TOOL_RESULT: ${JSON.stringify(toolResult)}
              
              Task: Provide a helpful, professional response including the tool data.
              
              IMPORTANT: Return a JSON object ONLY. No markdown formatting.
              Format:
              {
                "reply": "Your friendly, expert response text here.",
                "suggestions": ["Short Suggestion 1", "Short Suggestion 2", "Short Suggestion 3"]
              }`
          }]
        }]
      };
      const rawResponse = await callGeminiAPI(synthesisPrompt, '{ "reply": "I have the data but no text.", "suggestions": [] }');
      try {
        const jsonResponse = JSON.parse(rawResponse.replace(/```json/g, '').replace(/```/g, '').trim());
        finalResponseText = jsonResponse.reply;
        generatedSuggestions = jsonResponse.suggestions;
      } catch (e) {
        finalResponseText = rawResponse;
      }

    } else {
      // Direct response - FORCE DYNAMIC SUGGESTIONS
      const directPrompt = {
        contents: [{
          parts: [{
            text: `${systemPrompt}
            
            User: "${message}"
            
            Task: meaningful response + 3 relevant short suggestions.
            Return JSON ONLY: { "reply": "...", "suggestions": ["...", "...", "..."] }` }]
        }]
      };
      const rawResponse = await callGeminiAPI(directPrompt, getSmartFallbackResponse(userMessage, context));

      try {
        const jsonResponse = JSON.parse(rawResponse.replace(/```json/g, '').replace(/```/g, '').trim());
        finalResponseText = jsonResponse.reply;
        generatedSuggestions = jsonResponse.suggestions;
      } catch (e) {
        finalResponseText = rawResponse; // Fallback if not JSON
      }
    }

    // 4. RESPONSE FORMATTING
    const response = formatResponse(
      finalResponseText,
      generatedSuggestions || getRelevantSuggestions(userMessage, context),
      'agent_reasoning_response',
      { plan: plan, toolResult: toolResult },
      sessionId
    );

    // Learning & Metrics
    learningSystem.learnFromInteraction(sessionId, message, response.reply, context);
    improvementSystem.trackSuccess(sessionId, { type: 'agent_interaction', response: response.reply }, 'success');

    logConversation(sessionId, message, response, context);
    return res.json(response);

  } catch (error) {
    console.error('❌ Reasoning Loop Error:', error);
    // Fallback to old handler logic if reasoning fails
    const fallback = getSmartFallbackResponse(userMessage, context);
    return res.json(formatResponse(fallback, [], 'fallback_error', null, sessionId));
  }
}

module.exports = router;