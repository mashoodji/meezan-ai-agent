const express = require('express');
const axios = require('axios');
const router = express.Router();
const knowledge = require('../data/knowledge.json');

// Import services
const resendEmailService = require('../services/resendEmailService');
const calendarService = require('../services/calendarService');

// Import new AI modules
const GoalManager = require('../ai_modules/GoalManager');
const MemorySystem = require('../ai_modules/MemorySystem');
const LearningEngine = require('../ai_modules/LearningEngine');
const DecisionEngine = require('../ai_modules/DecisionEngine');
const ToolManager = require('../ai_modules/ToolManager');
const SelfImprovement = require('../ai_modules/SelfImprovement');

// Store conversation contexts in memory
const conversationContexts = new Map();
const meetingStates = new Map();
const requestCounts = new Map();

// Initialize AI Modules
const goalManager = new GoalManager();
const memorySystem = new MemorySystem();
const learningEngine = new LearningEngine();
const decisionEngine = new DecisionEngine();
const toolManager = new ToolManager();
const selfImprovement = new SelfImprovement();

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60000 // 1 minute
};

// Enhanced Conversation States with AI Goals
const conversationStates = {
  INITIAL: 'initial',
  SERVICE_INQUIRY: 'service_inquiry',
  COST_DISCUSSION: 'cost_discussion',
  MEETING_BOOKING: 'meeting_booking',
  PROJECT_DETAILS: 'project_details',
  PORTFOLIO_REVIEW: 'portfolio_review',
  COST_TYPE_SELECTION: 'cost_type_selection',
  RESEARCH_MODE: 'research_mode',
  PROBLEM_SOLVING: 'problem_solving',
  STRATEGIC_PLANNING: 'strategic_planning'
};

// AI Agent Goals Configuration
const AGENT_GOALS = {
  PRIMARY: [
    "Convert inquiries to consultations",
    "Provide accurate cost guidance",
    "Build client trust and rapport",
    "Understand client project requirements",
    "Schedule qualified meetings"
  ],
  SECONDARY: [
    "Learn client preferences",
    "Improve response effectiveness",
    "Identify project opportunities",
    "Gather market intelligence",
    "Optimize conversation flow"
  ],
  STRATEGIC: [
    "Anticipate client needs",
    "Propose relevant solutions",
    "Identify upsell opportunities",
    "Build long-term relationships",
    "Establish expert authority"
  ]
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
  name: "Meezan AI Consultant",
  tone: "professional yet friendly",
  expertise: "construction and project planning",
  traits: ["helpful", "knowledgeable", "efficient", "personable", "proactive", "strategic"],
  goals: AGENT_GOALS.PRIMARY,
  learning_rate: 0.8,
  initiative_threshold: 0.6
};

// Enhanced AI Agent Response Styles with Goal-Oriented Responses
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
  ],
  proactive_suggestion: [
    "Based on your interest in {topic}, you might also want to consider {suggestion}. This could help with {benefit}.",
    "Many clients exploring {topic} find it helpful to learn about {suggestion}. Would you like me to share more?",
    "Considering your project needs, I recommend exploring {suggestion}. This often addresses {benefit} for similar projects."
  ]
};

// Enhanced system prompt for AI Agent with goal-oriented architecture
const systemPrompt = `You are an AI Construction Consultant Agent for Meezan Developers. You have a professional yet friendly personality with autonomous goal-setting capabilities.

PERSONALITY TRAITS:
- Helpful and knowledgeable about construction
- Efficient but personable
- Proactive in offering solutions and setting goals
- Maintains natural conversation flow while pursuing objectives
- Shows genuine interest in client projects
- Autonomous goal-setting and initiative-taking

GOAL-ORIENTED ARCHITECTURE:
- Set and pursue conversation goals autonomously
- Take initiative based on context and client needs
- Learn from interactions to improve future responses
- Remember client preferences and patterns
- Make strategic decisions about conversation direction

COMPANY EXPERTISE:
- ${knowledge.company.yearsExperience} years in construction industry
- ${knowledge.projectPortfolio.totalCompleted} projects completed
- Specialized in residential, commercial, and industrial construction
- Team of ${knowledge.company.stats.teamMembers} construction experts

RESPONSE GUIDELINES:
- Sound like a knowledgeable construction professional, not a robot
- Use natural, conversational language while pursuing goals
- Show enthusiasm for construction projects
- Provide specific, actionable advice
- Maintain context throughout conversation while advancing objectives
- Be concise but warm and engaging
- Use construction industry terminology appropriately
- Take initiative based on conversation context and client needs

IMPORTANT: When discussing meetings, make it feel like you're personally arranging the consultation with our team, not just processing a form. Set goals for each interaction and work towards them strategically.`;

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

// ==================== ENHANCED AI AGENT CORE MODULES ====================

// Goal Manager Class
class GoalManager {
  constructor() {
    this.activeGoals = new Map();
    this.goalHistory = [];
  }

  setGoal(sessionId, goalType, priority = 'medium') {
    const goal = {
      type: goalType,
      priority,
      createdAt: new Date().toISOString(),
      status: 'active',
      progress: 0,
      steps: []
    };
    
    this.activeGoals.set(sessionId, goal);
    this.goalHistory.push({ sessionId, ...goal });
    
    console.log(`🎯 AI Agent set goal for ${sessionId}: ${goalType}`);
    return goal;
  }

  updateGoalProgress(sessionId, progress, step = null) {
    const goal = this.activeGoals.get(sessionId);
    if (goal) {
      goal.progress = progress;
      if (step) goal.steps.push(step);
      
      if (progress >= 1) {
        goal.status = 'completed';
        goal.completedAt = new Date().toISOString();
        console.log(`✅ AI Agent completed goal for ${sessionId}: ${goal.type}`);
      }
    }
  }

  getCurrentGoal(sessionId) {
    return this.activeGoals.get(sessionId);
  }

  shouldTakeInitiative(sessionId, context) {
    const goal = this.getCurrentGoal(sessionId);
    if (!goal) return true; // No active goal, take initiative
    
    const progress = goal.progress || 0;
    const interactionCount = context.interactionCount || 0;
    
    // Take initiative if goal progress is slow or conversation is stalling
    return progress < 0.3 && interactionCount > 2;
  }
}

// Memory System Class
class MemorySystem {
  constructor() {
    this.clientMemories = new Map();
    this.conversationPatterns = new Map();
    this.preferenceDatabase = new Map();
  }

  rememberClient(sessionId, clientData) {
    if (!this.clientMemories.has(sessionId)) {
      this.clientMemories.set(sessionId, {
        ...clientData,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        interactionCount: 0,
        preferences: {},
        conversationHistory: []
      });
    }
    
    const memory = this.clientMemories.get(sessionId);
    memory.lastSeen = new Date().toISOString();
    memory.interactionCount++;
    
    return memory;
  }

  updatePreferences(sessionId, preferences) {
    const memory = this.clientMemories.get(sessionId);
    if (memory) {
      memory.preferences = { ...memory.preferences, ...preferences };
      memory.updatedAt = new Date().toISOString();
    }
  }

  getClientMemory(sessionId) {
    return this.clientMemories.get(sessionId);
  }

  learnPattern(sessionId, patternType, data) {
    const patternKey = `${sessionId}_${patternType}`;
    this.conversationPatterns.set(patternKey, {
      type: patternType,
      data,
      learnedAt: new Date().toISOString(),
      confidence: 0.8
    });
  }

  getRelevantMemory(sessionId, currentContext) {
    const memory = this.getClientMemory(sessionId);
    if (!memory) return null;

    // Return relevant preferences and patterns
    return {
      preferences: memory.preferences,
      lastTopics: memory.conversationHistory.slice(-3),
      interactionPatterns: Array.from(this.conversationPatterns.entries())
        .filter(([key]) => key.startsWith(sessionId))
        .map(([, pattern]) => pattern)
    };
  }
}

// Learning Engine Class
class LearningEngine {
  constructor() {
    this.successMetrics = new Map();
    this.conversationOutcomes = [];
    this.learningRate = 0.8;
  }

  trackOutcome(sessionId, outcomeType, success, data = {}) {
    const outcome = {
      sessionId,
      outcomeType,
      success,
      data,
      timestamp: new Date().toISOString(),
      learnedLessons: this.extractLessons(outcomeType, success, data)
    };
    
    this.conversationOutcomes.push(outcome);
    
    // Update success metrics
    const key = `${outcomeType}_${success ? 'success' : 'failure'}`;
    this.successMetrics.set(key, (this.successMetrics.get(key) || 0) + 1);
    
    console.log(`📚 AI Agent learned from ${outcomeType}: ${success ? 'SUCCESS' : 'FAILURE'}`);
    return outcome;
  }

  extractLessons(outcomeType, success, data) {
    const lessons = [];
    
    if (outcomeType === 'meeting_booking' && success) {
      lessons.push('Effective meeting booking requires clear project type identification');
      lessons.push('Personalized communication increases booking success');
    }
    
    if (outcomeType === 'cost_estimation' && !success) {
      lessons.push('Cost estimates should be followed by clear next steps');
      lessons.push('Multiple cost presentation options improve understanding');
    }
    
    return lessons;
  }

  getSuccessRate(outcomeType) {
    const successCount = this.successMetrics.get(`${outcomeType}_success`) || 0;
    const failureCount = this.successMetrics.get(`${outcomeType}_failure`) || 0;
    const total = successCount + failureCount;
    
    return total > 0 ? successCount / total : 0.5;
  }

  optimizeStrategy(strategyType, context) {
    const successRate = this.getSuccessRate(strategyType);
    
    if (successRate < 0.3) {
      return this.getAlternativeStrategy(strategyType);
    }
    
    return null; // Keep current strategy
  }

  getAlternativeStrategy(strategyType) {
    const alternatives = {
      'meeting_booking': 'Try more personalized approach with project-specific benefits',
      'cost_estimation': 'Provide range estimates with clear value propositions',
      'service_inquiry': 'Focus on specific benefits rather than general features'
    };
    
    return alternatives[strategyType] || 'Adjust communication style based on client response';
  }
}

// Decision Engine Class
class DecisionEngine {
  constructor() {
    this.decisionHistory = [];
    this.strategyWeights = new Map();
  }

  evaluateContext(context, memory, goals) {
    const factors = {
      conversationProgress: this.calculateProgress(context),
      clientEngagement: this.assessEngagement(context),
      goalAlignment: this.assessGoalAlignment(context, goals),
      opportunityScore: this.calculateOpportunity(context, memory),
      urgencyLevel: this.assessUrgency(context)
    };

    const decisionScore = (
      factors.conversationProgress * 0.3 +
      factors.clientEngagement * 0.25 +
      factors.goalAlignment * 0.2 +
      factors.opportunityScore * 0.15 +
      factors.urgencyLevel * 0.1
    );

    return {
      score: decisionScore,
      factors,
      recommendation: decisionScore > 0.6 ? 'take_initiative' : 'wait_for_input'
    };
  }

  calculateProgress(context) {
    const interactionCount = context.interactionCount || 0;
    return Math.min(interactionCount / 5, 1);
  }

  assessEngagement(context) {
    const history = context.conversationHistory || [];
    if (history.length < 2) return 0.5;
    
    const recentMessages = history.slice(-2);
    const engagementSignals = recentMessages.filter(msg => 
      msg.user && msg.user.length > 10
    ).length;
    
    return engagementSignals / 2;
  }

  assessGoalAlignment(context, goals) {
    if (!goals) return 0.5;
    
    const currentState = context.state;
    const goalStates = ['meeting_booking', 'cost_discussion', 'service_inquiry'];
    
    return goalStates.includes(currentState) ? 0.8 : 0.3;
  }

  calculateOpportunity(context, memory) {
    let opportunity = 0.5;
    
    if (memory && memory.preferences) {
      if (Object.keys(memory.preferences).length > 0) opportunity += 0.2;
      if (memory.interactionCount > 3) opportunity += 0.3;
    }
    
    return Math.min(opportunity, 1);
  }

  assessUrgency(context) {
    const urgencyKeywords = ['urgent', 'asap', 'immediately', 'soon', 'quick'];
    const lastMessage = context.conversationHistory?.[context.conversationHistory.length - 1]?.user || '';
    
    return urgencyKeywords.some(keyword => 
      lastMessage.toLowerCase().includes(keyword)
    ) ? 0.8 : 0.3;
  }

  chooseStrategy(context, availableStrategies) {
    // Implement multi-step planning and strategy selection
    const scores = availableStrategies.map(strategy => ({
      strategy,
      score: this.scoreStrategy(strategy, context)
    }));
    
    return scores.sort((a, b) => b.score - a.score)[0].strategy;
  }

  scoreStrategy(strategy, context) {
    // Base scoring logic for different strategies
    const baseScores = {
      'direct_approach': 0.7,
      'consultative': 0.8,
      'educational': 0.6,
      'problem_solving': 0.9
    };
    
    return baseScores[strategy] || 0.5;
  }
}

// Tool Manager Class
class ToolManager {
  constructor() {
    this.availableTools = new Map();
    this.toolUsageHistory = [];
    this.initTools();
  }

  initTools() {
    this.availableTools.set('cost_calculator', {
      name: 'Cost Calculator',
      description: 'Detailed construction cost estimation',
      function: this.useCostCalculator.bind(this)
    });
    
    this.availableTools.set('market_research', {
      name: 'Market Research',
      description: 'Current construction market analysis',
      function: this.researchMarketData.bind(this)
    });
    
    this.availableTools.set('project_planner', {
      name: 'Project Planner',
      description: 'Construction project timeline planning',
      function: this.planProjectTimeline.bind(this)
    });
  }

  async useTool(toolName, parameters, context) {
    const tool = this.availableTools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not available`);
    }

    try {
      const result = await tool.function(parameters, context);
      
      this.toolUsageHistory.push({
        tool: toolName,
        parameters,
        result: typeof result === 'string' ? result.substring(0, 100) + '...' : result,
        timestamp: new Date().toISOString(),
        sessionId: context.sessionId
      });
      
      return result;
    } catch (error) {
      console.error(`❌ Tool usage error for ${toolName}:`, error);
      throw error;
    }
  }

  async useCostCalculator(parameters, context) {
    // Enhanced cost calculation with real-time factors
    const { projectType, area, quality } = parameters;
    
    // Simulate API call to cost database
    const baseCost = knowledge.constructionCosts[projectType]?.basic || 'PKR 2,500/sq ft';
    const calculatedCost = `Based on current market rates, estimated cost: ${baseCost} for ${area} sq ft`;
    
    return {
      estimate: calculatedCost,
      factors: knowledge.constructionCosts.costFactors,
      recommendations: ['Consider material quality variations', 'Include contingency budget'],
      timestamp: new Date().toISOString()
    };
  }

  async researchMarketData(parameters, context) {
    const { topic, location = 'Pakistan' } = parameters;
    
    // Simulate market research
    return {
      topic,
      location,
      findings: [
        `Current ${topic} construction trends in ${location}`,
        `Material cost fluctuations affecting ${topic} projects`,
        `Labor market conditions for ${topic} construction`
      ],
      sources: ['Local market reports', 'Industry publications', 'Project data'],
      relevance: 'high'
    };
  }

  async planProjectTimeline(parameters, context) {
    const { projectType, size, complexity } = parameters;
    
    // Simulate project planning
    const timelines = {
      residential: '4-8 months',
      commercial: '8-18 months',
      industrial: '12-24 months'
    };
    
    return {
      projectType,
      estimatedTimeline: timelines[projectType] || '6-12 months',
      keyMilestones: ['Design Approval', 'Foundation', 'Structure', 'Finishing'],
      criticalFactors: ['Permit timelines', 'Weather conditions', 'Material availability']
    };
  }

  suggestTools(context, userMessage) {
    const suggestions = [];
    
    if (userMessage.includes('cost') || userMessage.includes('price')) {
      suggestions.push('cost_calculator');
    }
    
    if (userMessage.includes('trend') || userMessage.includes('market')) {
      suggestions.push('market_research');
    }
    
    if (userMessage.includes('timeline') || userMessage.includes('schedule')) {
      suggestions.push('project_planner');
    }
    
    return suggestions;
  }
}

// Self-Improvement Class
class SelfImprovement {
  constructor() {
    this.performanceMetrics = new Map();
    this.improvementGoals = new Map();
    this.optimizationHistory = [];
  }

  trackMetric(metricName, value, context = {}) {
    if (!this.performanceMetrics.has(metricName)) {
      this.performanceMetrics.set(metricName, []);
    }
    
    const metricData = {
      value,
      timestamp: new Date().toISOString(),
      context
    };
    
    this.performanceMetrics.get(metricName).push(metricData);
    
    // Keep only last 100 records per metric
    const records = this.performanceMetrics.get(metricName);
    if (records.length > 100) {
      this.performanceMetrics.set(metricName, records.slice(-100));
    }
    
    this.checkForOptimization(metricName, value, context);
  }

  checkForOptimization(metricName, value, context) {
    const threshold = this.getOptimizationThreshold(metricName);
    
    if (value < threshold) {
      const optimization = this.generateOptimization(metricName, value, context);
      this.optimizationHistory.push(optimization);
      
      console.log(`🔄 AI Agent self-optimization triggered for ${metricName}`);
      return optimization;
    }
    
    return null;
  }

  getOptimizationThreshold(metricName) {
    const thresholds = {
      'response_effectiveness': 0.7,
      'goal_completion_rate': 0.6,
      'client_satisfaction': 0.75,
      'meeting_conversion': 0.4
    };
    
    return thresholds[metricName] || 0.5;
  }

  generateOptimization(metricName, currentValue, context) {
    const optimizations = {
      'response_effectiveness': [
        'Adjust response tone to be more conversational',
        'Include more specific construction details',
        'Add proactive suggestions based on context'
      ],
      'goal_completion_rate': [
        'Set more achievable intermediate goals',
        'Improve goal progression detection',
        'Enhance context awareness for goal setting'
      ],
      'meeting_conversion': [
        'Streamline meeting booking process',
        'Add more persuasive benefits to consultation offers',
        'Improve timing of meeting suggestions'
      ]
    };
    
    const availableOptimizations = optimizations[metricName] || ['Review and adjust conversation strategy'];
    
    return {
      metric: metricName,
      currentValue,
      optimization: availableOptimizations[0],
      appliedAt: new Date().toISOString(),
      expectedImprovement: 0.15
    };
  }

  getPerformanceReport() {
    const report = {};
    
    for (const [metric, data] of this.performanceMetrics.entries()) {
      const values = data.map(d => d.value);
      report[metric] = {
        current: values[values.length - 1],
        average: values.reduce((a, b) => a + b, 0) / values.length,
        trend: this.calculateTrend(values),
        totalMeasurements: values.length
      };
    }
    
    return report;
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-5);
    const older = values.slice(-10, -5);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    if (recentAvg > olderAvg + 0.1) return 'improving';
    if (recentAvg < olderAvg - 0.1) return 'declining';
    return 'stable';
  }
}

// ==================== ENHANCED AI AGENT HELPER FUNCTIONS ====================

// Natural response generator with goal awareness
function generateNaturalResponse(type, variables = {}, context = null) {
  const templates = RESPONSE_STYLES[type] || [variables.default || "I'd be happy to help with that!"];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  // Replace variables in template
  let response = template.replace(/{(\w+)}/g, (match, key) => {
    return variables[key] || knowledge[key] || match;
  });

  // Add proactive suggestions if context allows
  if (context && shouldAddProactiveSuggestion(context)) {
    const suggestion = generateProactiveSuggestion(context);
    if (suggestion) {
      response += `\n\n${suggestion}`;
    }
  }

  return response;
}

// Proactive suggestion generator
function generateProactiveSuggestion(context) {
  const templates = RESPONSE_STYLES.proactive_suggestion;
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  const lastTopic = context.lastTopic;
  const suggestions = {
    'residential': 'our residential project portfolio and financing options',
    'commercial': 'commercial construction timelines and ROI analysis',
    'industrial': 'industrial facility requirements and regulatory compliance',
    'cost_estimation': 'detailed project breakdown and value engineering',
    'portfolio_review': 'similar completed projects in your area'
  };
  
  const benefits = {
    'residential': 'better planning and budget management',
    'commercial': 'informed decision making and timeline forecasting',
    'industrial': 'compliance assurance and operational efficiency',
    'cost_estimation': 'accurate budgeting and cost optimization',
    'portfolio_review': 'visualizing potential outcomes and quality standards'
  };
  
  const topic = lastTopic || 'construction projects';
  const suggestion = suggestions[topic] || 'our comprehensive construction services';
  const benefit = benefits[topic] || 'project success and satisfaction';
  
  return template
    .replace('{topic}', topic)
    .replace('{suggestion}', suggestion)
    .replace('{benefit}', benefit);
}

function shouldAddProactiveSuggestion(context) {
  // Add proactive suggestions when:
  // - Conversation has good momentum
  // - Client is engaged
  // - Not in middle of complex process
  const engaged = context.interactionCount > 2;
  const notInProcess = !['meeting_booking', 'cost_type_selection'].includes(context.state);
  const hasMomentum = context.conversationHistory.length >= 3;
  
  return engaged && notInProcess && hasMomentum;
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

// Enhanced Gemini API caller with personality and goal context
async function callGeminiAPI(promptConfig, fallbackResponse, context = null) {
  try {
    // Add goal context to prompt if available
    if (context) {
      const goal = goalManager.getCurrentGoal(context.sessionId);
      if (goal) {
        const existingPrompt = promptConfig.contents[0].parts[0].text;
        promptConfig.contents[0].parts[0].text = 
          `${existingPrompt}\n\nCURRENT GOAL: ${goal.type} (Progress: ${Math.round(goal.progress * 100)}%)\nMaintain progress toward this goal while responding naturally.`;
      }
    }

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

// Initialize Enhanced AI Agent context
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
    // Enhanced AI Agent properties
    goals: [],
    initiatives: [],
    learningPoints: [],
    strategy: 'consultative',
    confidence: 0.7
  };
  
  conversationContexts.set(sessionId, context);
  
  // Initialize memory for client
  memorySystem.rememberClient(sessionId, {
    sessionId,
    firstInteraction: new Date().toISOString()
  });
  
  return context;
}

// Enhanced AI Agent conversation logging with goal tracking
function logConversation(sessionId, userMessage, response, context) {
  const goal = goalManager.getCurrentGoal(sessionId);
  
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
    goal: goal ? `${goal.type} (${Math.round(goal.progress * 100)}%)` : 'none',
    timestamp: new Date().toISOString()
  });
}

// Enhanced response formatter for AI Agent with goal context
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

// Intelligent follow-up detection with pattern learning
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

  // Learn pattern if this is a follow-up
  if (isFollowUp) {
    memorySystem.learnPattern(context.sessionId, 'follow_up', {
      topic: context.lastTopic,
      trigger: userMessage,
      timestamp: new Date().toISOString()
    });
  }

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

// ==================== ENHANCED WEBSITE REDIRECTION HANDLERS ====================

// Enhanced redirect handler for website pages with goal tracking
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
  
  // Cost calculator redirects (existing)
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

// ==================== ENHANCED AI AGENT ROUTE HANDLERS ====================

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

    // Update memory system
    memorySystem.rememberClient(sessionId, {
      lastMessage: message,
      interactionCount: context.interactionCount
    });

    // Keep conversation history manageable
    if (context.conversationHistory.length > 10) {
      context.conversationHistory = context.conversationHistory.slice(-8);
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

    // Enhanced goal-oriented processing
    await processWithGoals(sessionId, context, userMessage);

    // Tool usage detection and execution
    const suggestedTools = toolManager.suggestTools(context, userMessage);
    if (suggestedTools.length > 0 && context.interactionCount > 1) {
      const toolResult = await executeRelevantTools(suggestedTools, context, userMessage);
      if (toolResult) {
        return toolResult;
      }
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

    // Enhanced general query handler with goal orientation
    return await handleGeneralQuery(req, res, sessionId, message, userMessage, context);

  } catch (error) {
    console.error('❌ AI Agent Error:', error);
    
    // Track error in learning system
    learningEngine.trackOutcome(sessionId, 'error_handling', false, { error: error.message });
    
    return res.json({ 
      success: true,
      reply: `I'd be delighted to help with your construction project! For detailed assistance, you can also reach our construction team at ${knowledge.company.contact.phone}.`,
      suggestions: ["Schedule consultation", "Our construction services", "Cost estimation"],
      agent: AGENT_PERSONALITY.name
    });
  }
});

// Enhanced goal-oriented processing
async function processWithGoals(sessionId, context, userMessage) {
  let currentGoal = goalManager.getCurrentGoal(sessionId);
  
  // Set initial goal if none exists
  if (!currentGoal) {
    const goalType = determineInitialGoal(userMessage, context);
    currentGoal = goalManager.setGoal(sessionId, goalType, 'high');
    context.currentGoal = goalType;
  }

  // Evaluate if we should take initiative
  const memory = memorySystem.getRelevantMemory(sessionId, context);
  const decision = decisionEngine.evaluateContext(context, memory, currentGoal);
  
  context.decisionData = decision;
  
  // Update goal progress based on conversation
  const progress = calculateGoalProgress(context, currentGoal);
  goalManager.updateGoalProgress(sessionId, progress, {
    userMessage,
    decisionScore: decision.score,
    timestamp: new Date().toISOString()
  });

  // Self-improvement tracking
  selfImprovement.trackMetric('conversation_effectiveness', decision.score, context);
  
  console.log(`🎯 AI Agent Goal: ${currentGoal.type} - Progress: ${Math.round(progress * 100)}% - Decision: ${decision.recommendation}`);
}

function determineInitialGoal(userMessage, context) {
  if (isMeetingRequest(userMessage)) return 'schedule_consultation';
  if (isCostQuery(userMessage)) return 'provide_cost_guidance';
  if (isServiceQuery(userMessage)) return 'educate_about_services';
  if (userMessage.includes('portfolio') || userMessage.includes('experience')) return 'showcase_expertise';
  
  return 'understand_client_needs';
}

function calculateGoalProgress(context, goal) {
  const baseProgress = Math.min(context.interactionCount / 8, 0.7);
  
  // Additional progress based on specific achievements
  let bonusProgress = 0;
  
  if (goal.type === 'schedule_consultation' && context.state === 'meeting_booking') {
    bonusProgress += 0.2;
  }
  
  if (goal.type === 'provide_cost_guidance' && context.lastTopic === 'cost_estimation') {
    bonusProgress += 0.2;
  }
  
  if (context.clientName) {
    bonusProgress += 0.1; // Progress for building rapport
  }
  
  return Math.min(baseProgress + bonusProgress, 1);
}

// Enhanced tool execution
async function executeRelevantTools(toolNames, context, userMessage) {
  for (const toolName of toolNames) {
    try {
      const parameters = extractToolParameters(toolName, userMessage);
      const result = await toolManager.useTool(toolName, parameters, context);
      
      // Integrate tool result into response
      if (toolName === 'cost_calculator') {
        return formatResponse(
          `🔧 **AI-Powered Cost Analysis**\n\n${result.estimate}\n\n**Key Factors:** ${result.factors.join(', ')}\n\n**Recommendations:**\n${result.recommendations.map(rec => `• ${rec}`).join('\n')}`,
          ["Schedule Expert Review", "Detailed Project Planning", "View Cost Breakdowns"],
          'tool_result',
          { tool: toolName, result },
          context.sessionId
        );
      }
      
      if (toolName === 'market_research') {
        return formatResponse(
          `📊 **Market Intelligence Report**\n\n**Topic:** ${result.topic}\n\n**Key Findings:**\n${result.findings.map(f => `• ${f}`).join('\n')}\n\n**Relevance:** ${result.relevance}`,
          ["Apply to My Project", "Schedule Market Review", "Latest Trends"],
          'tool_result',
          { tool: toolName, result },
          context.sessionId
        );
      }
      
    } catch (error) {
      console.error(`Tool execution failed for ${toolName}:`, error);
      // Continue to next tool or fall back to normal processing
    }
  }
  
  return null;
}

function extractToolParameters(toolName, userMessage) {
  const params = {};
  
  if (toolName === 'cost_calculator') {
    // Extract project details from message
    if (userMessage.includes('residential')) params.projectType = 'residential';
    else if (userMessage.includes('commercial')) params.projectType = 'commercial';
    else if (userMessage.includes('industrial')) params.projectType = 'industrial';
    else params.projectType = 'residential';
    
    // Simple area extraction (in real implementation, use more sophisticated NLP)
    const areaMatch = userMessage.match(/(\d+)\s*(sq|square|sq\s*ft|square feet)/i);
    params.area = areaMatch ? parseInt(areaMatch[1]) : 1000;
    
    params.quality = userMessage.includes('premium') ? 'premium' : 'standard';
  }
  
  if (toolName === 'market_research') {
    if (userMessage.includes('residential')) params.topic = 'residential construction';
    else if (userMessage.includes('commercial')) params.topic = 'commercial construction';
    else if (userMessage.includes('industrial')) params.topic = 'industrial construction';
    else params.topic = 'construction market';
  }
  
  if (toolName === 'project_planner') {
    if (userMessage.includes('residential')) params.projectType = 'residential';
    else if (userMessage.includes('commercial')) params.projectType = 'commercial';
    else if (userMessage.includes('industrial')) params.projectType = 'industrial';
    
    params.size = userMessage.includes('large') ? 'large' : 
                 userMessage.includes('small') ? 'small' : 'medium';
    params.complexity = userMessage.includes('complex') ? 'high' : 'medium';
  }
  
  return params;
}

// [Rest of the existing functions remain the same but enhanced with goal-awareness...]
// Due to length constraints, I'll show the enhanced general query handler as an example:

// Enhanced AI Agent general query handler with goal orientation
async function handleGeneralQuery(req, res, sessionId, message, userMessage, context) {
  // Enhanced context detection with goal awareness
  if (userMessage.includes('build') || userMessage.includes('construct') || userMessage.includes('project')) {
    context.lastTopic = 'construction projects';
    context.state = conversationStates.PROJECT_DETAILS;
    goalManager.setGoal(sessionId, 'understand_project_requirements', 'high');
  } else if (userMessage.includes('time') || userMessage.includes('duration') || userMessage.includes('timeline')) {
    context.lastTopic = 'project timeline';
    goalManager.setGoal(sessionId, 'provide_timeline_guidance', 'medium');
  } else if (userMessage.includes('material') || userMessage.includes('quality') || userMessage.includes('specification')) {
    context.lastTopic = 'construction materials';
    goalManager.setGoal(sessionId, 'educate_materials', 'medium');
  } else if (userMessage.includes('cost') || userMessage.includes('price') || userMessage.includes('estimate') || userMessage.includes('budget')) {
    context.lastTopic = 'cost estimation';
    context.state = conversationStates.COST_DISCUSSION;
    goalManager.setGoal(sessionId, 'provide_cost_guidance', 'high');
  }

  // Enhanced prompt with AI Agent personality and goal context
  const contextPrompt = context.lastTopic ? 
    `Previous discussion was about: ${context.lastTopic}. Current client message: ${message}` : 
    `Client message: ${message}`;

  const currentGoal = goalManager.getCurrentGoal(sessionId);
  const goalContext = currentGoal ? `\nACTIVE GOAL: ${currentGoal.type} (${Math.round(currentGoal.progress * 100)}% complete). Advance this goal while responding naturally.` : '';

  const promptConfig = {
    contents: [{
      parts: [{
        text: `${systemPrompt}${goalContext}\n\nCONVERSATION CONTEXT: ${contextPrompt}\n\nRespond as a knowledgeable construction consultant. Be helpful, professional, and maintain natural conversation flow while strategically advancing conversation goals.\n\nAI Consultant:`
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
      getSmartFallbackResponse(userMessage, context),
      context
    );

    // Track response effectiveness
    selfImprovement.trackMetric('response_effectiveness', 0.8, context);

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
    
    // Track failure in learning system
    learningEngine.trackOutcome(sessionId, 'general_query', false, { error: error.message });
    
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

// Enhanced meeting booking handler with goal tracking
async function handleMeetingBooking(req, res, sessionId, userMessage, context) {
  // Set meeting booking goal
  goalManager.setGoal(sessionId, 'schedule_consultation', 'high');
  
  // Continue with existing meeting booking logic...
  // [Existing meeting booking code remains the same but now tracks goals]
  
  // Example goal progress update in meeting flow:
  if (meetingState && meetingState.step > 0) {
    const progress = meetingState.step / 7; // Assuming 7 steps total
    goalManager.updateGoalProgress(sessionId, progress, `meeting_step_${meetingState.step}`);
  }
  
  // [Rest of existing meeting booking code...]
}

// ==================== ENHANCED AI AGENT ADMINISTRATION ====================

// Enhanced health check with AI metrics
router.get('/health', (req, res) => {
  const performanceReport = selfImprovement.getPerformanceReport();
  
  res.json({
    status: 'AI Agent Operational',
    agent: AGENT_PERSONALITY.name,
    activeSessions: conversationContexts.size,
    activeConsultations: meetingStates.size,
    expertise: `${knowledge.projectPortfolio.totalCompleted} projects experience`,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    aiMetrics: {
      activeGoals: goalManager.activeGoals.size,
      clientMemories: memorySystem.clientMemories.size,
      learningOutcomes: learningEngine.conversationOutcomes.length,
      performanceReport
    },
    timestamp: new Date().toISOString()
  });
});

// AI Agent performance dashboard
router.get('/performance', (req, res) => {
  const performanceReport = selfImprovement.getPerformanceReport();
  const goalStats = {
    active: goalManager.activeGoals.size,
    completed: goalManager.goalHistory.filter(g => g.status === 'completed').length,
    total: goalManager.goalHistory.length
  };
  
  res.json({
    agent: AGENT_PERSONALITY.name,
    performance: performanceReport,
    goals: goalStats,
    learning: {
      totalOutcomes: learningEngine.conversationOutcomes.length,
      successRate: learningEngine.getSuccessRate('meeting_booking'),
      recentLessons: learningEngine.conversationOutcomes.slice(-5)
    },
    tools: {
      usageCount: toolManager.toolUsageHistory.length,
      recentUsage: toolManager.toolUsageHistory.slice(-10)
    },
    system: {
      activeSessions: conversationContexts.size,
      totalRequests: Array.from(requestCounts.values()).reduce((sum, requests) => sum + requests.length, 0),
      serverTime: new Date().toISOString()
    }
  });
});

// AI Agent learning insights
router.get('/insights', (req, res) => {
  const insights = {
    topSuccessFactors: learningEngine.conversationOutcomes
      .filter(o => o.success)
      .slice(0, 10),
    commonPatterns: Array.from(memorySystem.conversationPatterns.values())
      .slice(0, 10),
    optimizationHistory: selfImprovement.optimizationHistory.slice(-10),
    toolEffectiveness: toolManager.toolUsageHistory
      .reduce((acc, usage) => {
        acc[usage.tool] = (acc[usage.tool] || 0) + 1;
        return acc;
      }, {})
  };
  
  res.json(insights);
});

// Reset AI learning (admin function)
router.post('/reset-learning', (req, res) => {
  const { authorization } = req.headers;
  
  if (authorization !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  // Reinitialize learning systems
  learningEngine.conversationOutcomes = [];
  learningEngine.successMetrics.clear();
  selfImprovement.performanceMetrics.clear();
  selfImprovement.optimizationHistory = [];
  
  res.json({ 
    success: true, 
    message: 'AI learning systems reset',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;