const express = require('express');
const axios = require('axios');
const router = express.Router();
const knowledge = require('../data/knowledge.json');

// Import services
const resendEmailService = require('../services/resendEmailService');
const calendarService = require('../services/calendarService');

// ==================== AI AGENT CORE SYSTEMS ====================

// Store AI Agents in memory
const aiAgents = new Map();
const requestCounts = new Map();

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequests: 25,
  windowMs: 60000
};

// AI AGENT GOALS CONFIGURATION
const AGENT_GOALS = {
  LEAD_QUALIFICATION: {
    objective: "Qualify construction leads to appropriate project tiers",
    success_criteria: ["get_project_type", "assess_budget_range", "determine_timeline", "identify_urgency"],
    priority: "high",
    required_data: ["projectType", "budgetRange", "timeline"]
  },
  PROJECT_SCOPING: {
    objective: "Define complete project scope and technical requirements",
    success_criteria: ["identify_plot_size", "determine_complexity", "assess_special_needs", "technical_requirements"],
    priority: "medium",
    required_data: ["plotSize", "complexityLevel", "specialRequirements"]
  },
  SOLUTION_MATCHING: {
    objective: "Match client needs with optimal construction solutions",
    success_criteria: ["recommend_services", "suggest_materials", "propose_methodology", "value_engineering"],
    priority: "medium",
    required_data: ["recommendedServices", "materialSuggestions"]
  },
  CONSULTATION_BOOKING: {
    objective: "Schedule qualified consultations with appropriate experts",
    success_criteria: ["book_meeting", "prepare_team_brief", "send_technical_prep"],
    priority: "high",
    required_data: ["meetingScheduled", "expertType"]
  }
};

// CONSTRUCTION PROJECT STAGES
const PROJECT_STAGES = {
  CONCEPTUAL: {
    name: "Conceptual Planning",
    focus: "Ideation and feasibility",
    typical_questions: ["budget planning", "site selection", "project viability"],
    next_stage: "DESIGN"
  },
  DESIGN: {
    name: "Design Development", 
    focus: "Architectural and engineering design",
    typical_questions: ["floor plans", "structural design", "permits"],
    next_stage: "PRE_CONSTRUCTION"
  },
  PRE_CONSTRUCTION: {
    name: "Pre-Construction",
    focus: "Preparation and procurement",
    typical_questions: ["contractor selection", "material procurement", "timeline"],
    next_stage: "CONSTRUCTION"
  },
  CONSTRUCTION: {
    name: "Construction Execution",
    focus: "Physical construction work",
    typical_questions: ["progress updates", "quality control", "issues"],
    next_stage: "POST_CONSTRUCTION"
  },
  POST_CONSTRUCTION: {
    name: "Post-Construction",
    focus: "Completion and handover",
    typical_questions: ["renovation", "maintenance", "warranty"]
  }
};

// AI AGENT PERSONALITY & EXPERTISE
const AGENT_CONFIG = {
  name: "Meezan Construction AI Agent",
  role: "Senior Construction Consultant",
  expertise: "Structural Engineering & Project Management",
  traits: ["proactive", "diagnostic", "solution-oriented", "technical", "strategic"],
  capabilities: [
    "project_assessment", 
    "technical_consultation", 
    "risk_analysis", 
    "budget_planning",
    "workflow_orchestration",
    "autonomous_decision_making"
  ]
};

// ==================== AI AGENT CORE CLASSES ====================

class ConstructionAgent {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.activeGoals = new Map();
    this.achievedGoals = [];
    this.conversationHistory = [];
    this.clientProfile = {};
    this.projectContext = {};
    this.learningData = {};
    this.lastProactiveAction = null;
    this.consultationReadinessScore = 0;
    this.createdAt = new Date().toISOString();
    this.lastInteraction = new Date().toISOString();
    
    // Initialize with primary goals
    this.setGoal('LEAD_QUALIFICATION');
    this.setGoal('PROJECT_SCOPING');
  }

  setGoal(goalType, parameters = {}) {
    this.activeGoals.set(goalType, {
      ...AGENT_GOALS[goalType],
      parameters,
      startedAt: new Date(),
      progress: 0,
      collectedData: {},
      completed: false
    });
  }

  updateGoalProgress(goalType, data) {
    const goal = this.activeGoals.get(goalType);
    if (goal && !goal.completed) {
      goal.collectedData = { ...goal.collectedData, ...data };
      goal.progress = this.calculateGoalProgress(goal);
      
      // Check if goal is completed
      if (goal.progress >= 85) {
        goal.completed = true;
        this.achievedGoals.push(goalType);
        this.activeGoals.delete(goalType);
        this.onGoalCompleted(goalType);
      }
    }
  }

  calculateGoalProgress(goal) {
    const requiredData = goal.required_data || [];
    if (requiredData.length === 0) return 0;

    const collectedCount = requiredData.filter(field => 
      goal.collectedData[field] !== undefined
    ).length;

    return (collectedCount / requiredData.length) * 100;
  }

  onGoalCompleted(goalType) {
    console.log(`🎯 AI Agent ${this.sessionId} completed goal: ${goalType}`);
    
    // Trigger next actions based on completed goal
    switch(goalType) {
      case 'LEAD_QUALIFICATION':
        this.setGoal('SOLUTION_MATCHING');
        break;
      case 'PROJECT_SCOPING':
        this.updateConsultationReadiness();
        break;
      case 'SOLUTION_MATCHING':
        this.setGoal('CONSULTATION_BOOKING');
        break;
    }
  }

  updateConsultationReadiness() {
    let score = 0;
    
    // Project type identified
    if (this.projectContext.projectType) score += 25;
    
    // Budget range known
    if (this.projectContext.budgetRange) score += 25;
    
    // Timeline understood
    if (this.projectContext.timeline) score += 20;
    
    // Technical requirements captured
    if (this.projectContext.specialRequirements) score += 15;
    
    // Plot size known
    if (this.projectContext.plotSize) score += 15;
    
    this.consultationReadinessScore = Math.min(100, score);
  }

  shouldSuggestConsultation() {
    return this.consultationReadinessScore >= 70 && 
           !this.projectContext.consultationSuggested &&
           !this.activeGoals.has('CONSULTATION_BOOKING');
  }

  getActiveGoals() {
    return Array.from(this.activeGoals.values());
  }

  hasActiveGoals() {
    return this.activeGoals.size > 0;
  }

  getContext() {
    return {
      clientProfile: this.clientProfile,
      projectContext: this.projectContext,
      activeGoals: this.getActiveGoals(),
      consultationReadiness: this.consultationReadinessScore,
      projectStage: this.diagnoseProjectStage()
    };
  }

  diagnoseProjectStage() {
    const history = this.conversationHistory.join(' ').toLowerCase();
    
    if (history.includes('renovation') || history.includes('extension') || history.includes('modification')) {
      return PROJECT_STAGES.POST_CONSTRUCTION;
    }
    
    if (history.includes('construction') || history.includes('building') || history.includes('progress')) {
      return PROJECT_STAGES.CONSTRUCTION;
    }
    
    if (history.includes('contractor') || history.includes('material') || history.includes('procurement')) {
      return PROJECT_STAGES.PRE_CONSTRUCTION;
    }
    
    if (history.includes('design') || history.includes('plan') || history.includes('architect')) {
      return PROJECT_STAGES.DESIGN;
    }
    
    return PROJECT_STAGES.CONCEPTUAL;
  }

  recordInteraction(userMessage, agentResponse, type = 'response') {
    this.conversationHistory.push({
      user: userMessage,
      agent: agentResponse,
      type: type,
      timestamp: new Date().toISOString(),
      goals: this.getActiveGoals(),
      context: this.getContext()
    });

    // Keep history manageable
    if (this.conversationHistory.length > 15) {
      this.conversationHistory = this.conversationHistory.slice(-12);
    }

    this.lastInteraction = new Date().toISOString();
  }
}

// ==================== AUTONOMOUS DECISION ENGINE ====================

class DecisionEngine {
  static analyzeConversationContext(agent, userMessage) {
    const context = agent.getContext();
    const message = userMessage.toLowerCase();
    
    // Technical intent detection
    const technicalIntent = this.detectTechnicalIntent(message);
    const projectStage = agent.diagnoseProjectStage();
    const missingData = this.identifyMissingInformation(agent);
    
    return {
      technicalIntent,
      projectStage,
      missingData,
      shouldBeProactive: this.shouldTakeInitiative(agent, message),
      recommendedActions: this.generateRecommendedActions(agent, message, context)
    };
  }

  static detectTechnicalIntent(message) {
    const technicalAreas = {
      structural: ['foundation', 'load-bearing', 'columns', 'beams', 'structural', 'integrity', 'reinforcement'],
      architectural: ['layout', 'design', 'floor plan', 'elevation', 'facade', 'aesthetic', 'space planning'],
      materials: ['concrete', 'steel', 'bricks', 'finishes', 'specifications', 'quality', 'brand'],
      permits: ['permit', 'approval', 'noc', 'documentation', 'authority', 'regulation'],
      methodology: ['construction method', 'technique', 'process', 'phases', 'sequence'],
      site_conditions: ['soil', 'ground', 'water table', 'topography', 'survey', 'geotechnical']
    };

    for (const [area, keywords] of Object.entries(technicalAreas)) {
      if (keywords.some(keyword => message.includes(keyword))) {
        return {
          area: area,
          confidence: 'high',
          requiresExpert: area === 'structural' || area === 'site_conditions'
        };
      }
    }

    return null;
  }

  static identifyMissingInformation(agent) {
    const missing = [];
    const context = agent.getContext();

    if (!context.projectContext.projectType) {
      missing.push('project_type');
    }
    
    if (!context.projectContext.budgetRange) {
      missing.push('budget_range');
    }
    
    if (!context.projectContext.timeline) {
      missing.push('timeline');
    }
    
    if (!context.projectContext.plotSize && context.projectContext.projectType) {
      missing.push('plot_size');
    }

    return missing;
  }

  static shouldTakeInitiative(agent, userMessage) {
    // Don't be proactive if user just asked a direct question
    if (userMessage.includes('?') || userMessage.includes('what') || userMessage.includes('how')) {
      return false;
    }

    const context = agent.getContext();
    
    // Be proactive if we have incomplete information
    if (this.identifyMissingInformation(agent).length > 0) {
      return true;
    }

    // Be proactive if consultation is ready but not suggested
    if (agent.shouldSuggestConsultation()) {
      return true;
    }

    // Be proactive if conversation is stalling
    if (agent.conversationHistory.length >= 3 && 
        !userMessage.includes('yes') && !userMessage.includes('no') &&
        !userMessage.includes('thank')) {
      return true;
    }

    return false;
  }

  static generateRecommendedActions(agent, userMessage, context) {
    const actions = [];
    const missingInfo = this.identifyMissingInformation(agent);

    // Information gathering actions
    missingInfo.forEach(info => {
      actions.push({
        type: 'PROACTIVE_QUESTION',
        question: this.generateQuestionForInfo(info, context),
        goal: this.getGoalForInfo(info),
        priority: 'high',
        data_target: info
      });
    });

    // Consultation suggestion action
    if (agent.shouldSuggestConsultation()) {
      actions.push({
        type: 'PROACTIVE_SUGGESTION',
        suggestion: "Based on the project details we've discussed, I recommend scheduling a technical consultation with our engineering team.",
        goal: 'CONSULTATION_BOOKING',
        priority: 'high'
      });
    }

    // Technical follow-up actions
    const technicalIntent = this.detectTechnicalIntent(userMessage);
    if (technicalIntent && technicalIntent.requiresExpert) {
      actions.push({
        type: 'EXPERT_ROUTING',
        message: "This involves specialized engineering considerations. Let me connect you with our structural team.",
        priority: 'medium'
      });
    }

    // Project stage advancement actions
    const currentStage = context.projectStage;
    if (currentStage.next_stage && this.isStageComplete(agent, currentStage)) {
      actions.push({
        type: 'STAGE_ADVANCEMENT',
        message: `Now that we've covered ${currentStage.name.toLowerCase()}, let's discuss ${PROJECT_STAGES[currentStage.next_stage].name.toLowerCase()}.`,
        priority: 'medium'
      });
    }

    return actions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  static generateQuestionForInfo(infoType, context) {
    const questions = {
      project_type: "What type of construction project are you planning? Residential, commercial, industrial, or something else?",
      budget_range: "What's your approximate budget range for this project? This helps me suggest suitable options.",
      timeline: "What's your preferred timeline for this project? Are you looking to start soon?",
      plot_size: "What's the approximate plot size or square footage you're working with?"
    };

    return questions[infoType] || "Could you provide more details about your project?";
  }

  static getGoalForInfo(infoType) {
    const goalMap = {
      project_type: 'LEAD_QUALIFICATION',
      budget_range: 'LEAD_QUALIFICATION', 
      timeline: 'LEAD_QUALIFICATION',
      plot_size: 'PROJECT_SCOPING'
    };

    return goalMap[infoType] || 'LEAD_QUALIFICATION';
  }

  static isStageComplete(agent, stage) {
    // Simple heuristic for stage completion
    const context = agent.getContext();
    const history = agent.conversationHistory.map(h => h.user).join(' ');

    switch(stage.name) {
      case 'Conceptual Planning':
        return context.projectContext.projectType && context.projectContext.budgetRange;
      case 'Design Development':
        return history.includes('design') || history.includes('plan') || history.includes('layout');
      default:
        return agent.conversationHistory.length >= 4;
    }
  }
}

// ==================== TECHNICAL CONSULTATION ENGINE ====================

class TechnicalConsultationEngine {
  static async generateTechnicalResponse(userMessage, agentContext, sessionId) {
    const technicalPrompt = `You are a senior construction engineer and consultant at Meezan Developers with ${knowledge.company.yearsExperience} of field experience.

CLIENT CONTEXT:
${JSON.stringify(agentContext.projectContext, null, 2)}

CONVERSATION HISTORY: Last few exchanges for context
PROJECT STAGE: ${agentContext.projectStage.name}
ACTIVE GOALS: ${agentContext.activeGoals.map(g => g.objective).join(', ')}

TECHNICAL EXPERTISE:
- Structural engineering principles and building codes
- Material specifications and applications in Pakistani context
- Construction methodology and best practices
- Site assessment and risk analysis
- Value engineering and cost optimization

RESPONSE GUIDELINES:
1. Use appropriate technical terminology but explain when needed
2. Provide practical, field-tested advice specific to Pakistan
3. Reference relevant building codes when applicable (e.g., Building Code of Pakistan)
4. Suggest multiple solutions with pros/cons
5. Consider local material availability and construction practices
6. Be proactive in identifying potential challenges and solutions
7. Position yourself as Meezan's senior construction expert

CLIENT QUESTION: "${userMessage}"

Provide expert technical guidance that demonstrates deep construction expertise:`;

    const promptConfig = {
      contents: [{
        parts: [{ text: technicalPrompt }]
      }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 350,
        topP: 0.8,
        topK: 40
      }
    };

    try {
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
      throw new Error('Invalid response format from API');
    } catch (error) {
      console.error('❌ Technical Consultation Error:', error);
      return this.getTechnicalFallback(userMessage, agentContext);
    }
  }

  static getTechnicalFallback(userMessage, context) {
    return `As Meezan Developers' construction specialist, I'd recommend discussing "${userMessage}" with our technical team for precise engineering guidance. 

Based on your ${context.projectStage.name.toLowerCase()} stage, we should consider:
- Site-specific conditions and testing requirements
- Relevant building codes and regulations
- Optimal material selection for your budget
- Construction methodology alternatives

Our engineering team can provide detailed analysis during a technical consultation.`;
  }
}

// ==================== PROACTIVE WORKFLOW ENGINE ====================

class ProactiveWorkflowEngine {
  static async executeProactiveAction(action, agent, sessionId) {
    switch(action.type) {
      case 'PROACTIVE_QUESTION':
        return await this.askProactiveQuestion(action, agent, sessionId);
      
      case 'PROACTIVE_SUGGESTION':
        return await this.makeProactiveSuggestion(action, agent, sessionId);
      
      case 'EXPERT_ROUTING':
        return await this.routeToExpert(action, agent, sessionId);
      
      case 'STAGE_ADVANCEMENT':
        return await this.advanceProjectStage(action, agent, sessionId);
      
      default:
        return this.formatAgentResponse(
          "I'd like to help move your project forward. What specific aspect would you like to discuss?",
          ["Project Planning", "Technical Questions", "Cost Estimation"],
          'proactive_engagement',
          sessionId
        );
    }
  }

  static async askProactiveQuestion(action, agent, sessionId) {
    agent.lastProactiveAction = action;
    
    // Update relevant goal with the data we're seeking
    agent.updateGoalProgress(action.goal, { [action.data_target]: 'inquiring' });

    const suggestions = this.getContextualSuggestions(agent, action.data_target);
    
    return this.formatAgentResponse(
      action.question,
      suggestions,
      'proactive_question',
      sessionId,
      { 
        goal: action.goal,
        data_target: action.data_target,
        agent_initiated: true
      }
    );
  }

  static async makeProactiveSuggestion(action, agent, sessionId) {
    // Mark consultation as suggested
    agent.projectContext.consultationSuggested = true;
    
    const readiness = agent.consultationReadinessScore;
    const projectType = agent.projectContext.projectType || 'construction';
    
    const suggestionMessage = `🎯 **Project Consultation Ready**\n\nBased on our discussion, your ${projectType} project is ${readiness}% defined. ${action.suggestion}\n\n**What we know about your project:**\n${this.formatProjectSummary(agent.projectContext)}\n\n**Recommended next step:** Technical consultation with our ${this.getRecommendedExpert(agent.projectContext)}`;

    return this.formatAgentResponse(
      suggestionMessage,
      ["Schedule Consultation Now", "Provide More Details", "Discuss Costs First"],
      'consultation_suggestion',
      sessionId,
      { 
        readiness_score: readiness,
        recommended_expert: this.getRecommendedExpert(agent.projectContext)
      }
    );
  }

  static formatProjectSummary(projectContext) {
    const summary = [];
    
    if (projectContext.projectType) {
      summary.push(`• Project Type: ${projectContext.projectType}`);
    }
    
    if (projectContext.budgetRange) {
      summary.push(`• Budget Range: ${projectContext.budgetRange}`);
    }
    
    if (projectContext.timeline) {
      summary.push(`• Timeline: ${projectContext.timeline}`);
    }
    
    if (projectContext.plotSize) {
      summary.push(`• Plot Size: ${projectContext.plotSize}`);
    }
    
    return summary.join('\n') || '• Basic project details (more information needed)';
  }

  static getRecommendedExpert(projectContext) {
    if (projectContext.projectType?.includes('residential')) {
      return 'Residential Construction Specialist';
    } else if (projectContext.projectType?.includes('commercial')) {
      return 'Commercial Project Director';
    } else if (projectContext.projectType?.includes('industrial')) {
      return 'Industrial Facilities Engineer';
    }
    
    return 'Senior Construction Consultant';
  }

  static getContextualSuggestions(agent, dataTarget) {
    const suggestions = {
      project_type: ["🏠 Residential", "🏢 Commercial", "🏭 Industrial", "🕌 Religious Building"],
      budget_range: ["💰 < 50 Lakh", "💰 50L - 1Cr", "💰 1Cr - 5Cr", "💰 5Cr+"],
      timeline: ["⏰ Immediate (1-3 months)", "⏰ Short-term (3-6 months)", "⏰ Planning Phase (6-12 months)", "⏰ Future Planning"],
      plot_size: ["📐 5-10 Marla", "📐 10-20 Marla", "📐 1 Kanal", "📐 2+ Kanal", "📐 Commercial Plot"]
    };

    return suggestions[dataTarget] || ["Continue Discussion", "Technical Questions", "Schedule Meeting"];
  }

  static formatAgentResponse(reply, suggestions, action = null, sessionId = null, details = null) {
    const response = {
      success: true,
      reply,
      suggestions,
      timestamp: new Date().toISOString(),
      agent: AGENT_CONFIG.name,
      agent_role: AGENT_CONFIG.role,
      proactive: details?.agent_initiated || false
    };
    
    if (action) response.action = action;
    if (details) response.details = details;
    if (sessionId) response.sessionId = sessionId;
    
    return response;
  }
}

// ==================== AI AGENT MAIN ROUTE ====================

router.post('/chat', async (req, res) => {
  try {
    let { message, sessionId } = req.body;
    
    // Input validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        reply: "I'd love to help with your construction project! Could you please share what you're planning to build?",
        agent: AGENT_CONFIG.name
      });
    }
    
    // Sanitize inputs
    message = message.trim();
    sessionId = sessionId || 'agent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Rate limiting
    if (isRateLimited(sessionId)) {
      return res.status(429).json({
        success: false,
        reply: "I'm currently assisting multiple clients with their construction projects. Please try again in a moment, or contact our team directly for immediate assistance.",
        agent: AGENT_CONFIG.name
      });
    }

    console.log('🤖 AI Agent Processing:', message.substring(0, 100));
    
    // Initialize or retrieve AI Agent
    let agent = aiAgents.get(sessionId) || new ConstructionAgent(sessionId);
    
    // Analyze conversation context for autonomous decision making
    const contextAnalysis = DecisionEngine.analyzeConversationContext(agent, message);
    
    let response;
    
    // AUTONOMOUS DECISION: Handle proactive actions first
    if (contextAnalysis.shouldBeProactive && contextAnalysis.recommendedActions.length > 0) {
      const topAction = contextAnalysis.recommendedActions[0];
      console.log(`🎯 AI Agent taking proactive action: ${topAction.type}`);
      
      response = await ProactiveWorkflowEngine.executeProactiveAction(topAction, agent, sessionId);
      agent.recordInteraction(message, response, 'proactive_action');
    }
    // AUTONOMOUS DECISION: Handle technical queries with expert mode
    else if (contextAnalysis.technicalIntent) {
      console.log(`🔧 AI Agent entering technical consultation mode: ${contextAnalysis.technicalIntent.area}`);
      
      const technicalResponse = await TechnicalConsultationEngine.generateTechnicalResponse(
        message, 
        agent.getContext(), 
        sessionId
      );
      
      response = ProactiveWorkflowEngine.formatAgentResponse(
        technicalResponse,
        ["Detailed Technical Analysis", "Schedule Engineering Consultation", "Material Specifications"],
        'technical_consultation',
        sessionId,
        { 
          technical_area: contextAnalysis.technicalIntent.area,
          requires_expert: contextAnalysis.technicalIntent.requiresExpert
        }
      );
      
      agent.recordInteraction(message, response, 'technical_response');
    }
    // Standard response with goal progression
    else {
      response = await handleStandardInteraction(message, agent, sessionId, contextAnalysis);
    }
    
    // Update agent goals based on conversation
    updateAgentGoalsFromMessage(message, agent);
    
    // Store updated agent
    aiAgents.set(sessionId, agent);
    
    // Log agent activity
    logAgentActivity(sessionId, message, response, agent);
    
    return res.json(response);

  } catch (error) {
    console.error('❌ AI Agent System Error:', error);
    
    return res.json({ 
      success: true,
      reply: `As your construction consultant, I'm here to help bring your project to life. For detailed technical questions, our engineering team at ${knowledge.company.contact.phone} can provide expert guidance.`,
      suggestions: ["Schedule Technical Consultation", "Project Planning", "Cost Estimation"],
      agent: AGENT_CONFIG.name,
      agent_role: AGENT_CONFIG.role
    });
  }
});

// ==================== SUPPORTING FUNCTIONS ====================

async function handleStandardInteraction(message, agent, sessionId, contextAnalysis) {
  const lowerMessage = message.toLowerCase();
  
  // Use existing meeting booking system if meeting-related
  if (isMeetingRequest(lowerMessage)) {
    return await handleMeetingBooking({ body: { message, sessionId } }, { json: (r) => r }, sessionId, lowerMessage, agent.getContext());
  }
  
  // Use existing cost estimation for cost queries
  if (isCostQuery(lowerMessage)) {
    return await handleCostEstimation(message, agent, sessionId);
  }
  
  // Default to intelligent response with goal context
  const intelligentResponse = await generateIntelligentResponse(message, agent, sessionId, contextAnalysis);
  
  agent.recordInteraction(message, intelligentResponse, 'standard_response');
  return intelligentResponse;
}

async function generateIntelligentResponse(message, agent, sessionId, contextAnalysis) {
  const context = agent.getContext();
  const activeGoals = agent.getActiveGoals();
  
  const prompt = `You are Meezan Developers' AI Construction Agent - a senior construction consultant.

AGENT CONFIGURATION:
- Role: ${AGENT_CONFIG.role}
- Expertise: ${AGENT_CONFIG.expertise}
- Current Goals: ${activeGoals.map(g => g.objective).join(', ')}
- Project Stage: ${context.projectStage.name}
- Consultation Readiness: ${context.consultationReadinessScore}%

CLIENT PROJECT CONTEXT:
${JSON.stringify(context.projectContext, null, 2)}

RESPONSE STRATEGY:
1. Be proactive in moving conversation toward active goals
2. Demonstrate construction expertise naturally
3. Identify and fill information gaps autonomously
4. Provide value through construction insights
5. Maintain professional consultant positioning

CONVERSATION HISTORY: Last 2-3 exchanges for context
CURRENT MESSAGE: "${message}"

Respond as a senior construction consultant who is strategically guiding the client through their project planning:`;

  const promptConfig = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 250,
      topP: 0.8,
      topK: 40
    }
  };

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const response = await axios.post(apiUrl, promptConfig, { timeout: 10000 });
    
    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      const aiReply = response.data.candidates[0].content.parts[0].text.trim();
      
      return ProactiveWorkflowEngine.formatAgentResponse(
        aiReply,
        getStrategicSuggestions(agent, contextAnalysis),
        'intelligent_response',
        sessionId,
        { 
          active_goals: activeGoals.length,
          project_stage: context.projectStage.name
        }
      );
    }
  } catch (error) {
    console.error('AI Agent Response Error:', error);
  }

  // Fallback response
  return ProactiveWorkflowEngine.formatAgentResponse(
    getStrategicFallback(message, context),
    getStrategicSuggestions(agent, contextAnalysis),
    'fallback_response',
    sessionId
  );
}

function updateAgentGoalsFromMessage(message, agent) {
  const lowerMessage = message.toLowerCase();
  
  // Detect project type
  if (lowerMessage.includes('residential') || lowerMessage.includes('house') || lowerMessage.includes('home')) {
    agent.projectContext.projectType = 'residential';
    agent.updateGoalProgress('LEAD_QUALIFICATION', { projectType: 'residential' });
  } else if (lowerMessage.includes('commercial') || lowerMessage.includes('office') || lowerMessage.includes('business')) {
    agent.projectContext.projectType = 'commercial';
    agent.updateGoalProgress('LEAD_QUALIFICATION', { projectType: 'commercial' });
  } else if (lowerMessage.includes('industrial') || lowerMessage.includes('factory') || lowerMessage.includes('warehouse')) {
    agent.projectContext.projectType = 'industrial';
    agent.updateGoalProgress('LEAD_QUALIFICATION', { projectType: 'industrial' });
  }
  
  // Detect budget information
  if (lowerMessage.includes('budget') || lowerMessage.includes('lakh') || lowerMessage.includes('crore') || lowerMessage.match(/\d/)) {
    const budgetMatch = message.match(/(\d+(?:\.\d+)?)\s*(lakh|lac|crore|cr)/i);
    if (budgetMatch) {
      agent.projectContext.budgetRange = budgetMatch[0];
      agent.updateGoalProgress('LEAD_QUALIFICATION', { budgetRange: budgetMatch[0] });
    }
  }
  
  // Detect timeline
  if (lowerMessage.includes('immediate') || lowerMessage.includes('soon') || lowerMessage.includes('urgent')) {
    agent.projectContext.timeline = 'immediate';
    agent.updateGoalProgress('LEAD_QUALIFICATION', { timeline: 'immediate' });
  } else if (lowerMessage.includes('month') || lowerMessage.includes('week') || lowerMessage.includes('time')) {
    agent.projectContext.timeline = 'planned';
    agent.updateGoalProgress('LEAD_QUALIFICATION', { timeline: 'planned' });
  }
  
  // Detect plot size
  if (lowerMessage.includes('marla') || lowerMessage.includes('kanal') || lowerMessage.includes('square') || lowerMessage.includes('plot')) {
    const sizeMatch = message.match(/(\d+)\s*(marla|kanal|sq|square)/i);
    if (sizeMatch) {
      agent.projectContext.plotSize = sizeMatch[0];
      agent.updateGoalProgress('PROJECT_SCOPING', { plotSize: sizeMatch[0] });
    }
  }
}

function getStrategicSuggestions(agent, contextAnalysis) {
  const missingInfo = DecisionEngine.identifyMissingInformation(agent);
  
  if (missingInfo.length > 0) {
    return missingInfo.map(info => 
      DecisionEngine.generateQuestionForInfo(info, agent.getContext()).split('?')[0] + '?'
    ).slice(0, 3);
  }
  
  if (agent.shouldSuggestConsultation()) {
    return ["Schedule Technical Consultation", "Discuss Project Details", "Cost Breakdown"];
  }
  
  return ["Project Planning", "Technical Questions", "Schedule Meeting"];
}

function getStrategicFallback(message, context) {
  return `As your construction consultant at Meezan Developers, I'm focused on helping you plan your project successfully. \n\nBased on our discussion, let me provide some construction insights that might be helpful for "${message}". Our team brings ${knowledge.projectPortfolio.totalCompleted} of project experience to ensure your project's success.`;
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

function logAgentActivity(sessionId, userMessage, response, agent) {
  console.log('🤖 AI Agent Activity:', {
    sessionId: sessionId.substring(0, 12) + '...',
    userMessage: userMessage.substring(0, 80) + (userMessage.length > 80 ? '...' : ''),
    responseType: response.action || 'general',
    agentGoals: agent.getActiveGoals().map(g => g.objective),
    consultationReadiness: agent.consultationReadinessScore + '%',
    proactive: response.proactive || false,
    timestamp: new Date().toISOString()
  });
}

// ==================== EXISTING FUNCTIONS (minimal changes) ====================

// Keep your existing meeting booking, cost estimation, and other functions
// They will work with the new AI Agent system

async function handleMeetingBooking(req, res, sessionId, userMessage, context) {
  // Your existing meeting booking code here
  // It will now be called by the AI Agent when appropriate
}

async function handleCostEstimation(message, agent, sessionId) {
  // Your existing cost estimation code here  
  // Enhanced with agent context
}

function isMeetingRequest(userMessage) {
  const meetingKeywords = [
    'meeting', 'schedule', 'appointment', 'consultation', 
    'discuss my project', 'talk to expert', 'meet with team'
  ];
  return meetingKeywords.some(keyword => userMessage.includes(keyword));
}

function isCostQuery(userMessage) {
  const costKeywords = ['cost', 'price', 'how much', 'estimate', 'budget'];
  return costKeywords.some(keyword => userMessage.includes(keyword));
}

// ==================== AGENT MANAGEMENT ROUTES ====================

router.get('/agent/status', (req, res) => {
  res.json({
    status: 'AI Agent System Operational',
    agent: AGENT_CONFIG.name,
    activeAgents: aiAgents.size,
    capabilities: AGENT_CONFIG.capabilities,
    system: 'Autonomous Construction Consultation',
    timestamp: new Date().toISOString()
  });
});

router.get('/agent/stats', (req, res) => {
  const agents = Array.from(aiAgents.values());
  
  res.json({
    totalAgents: agents.length,
    avgConsultationReadiness: agents.reduce((sum, a) => sum + a.consultationReadinessScore, 0) / agents.length || 0,
    activeGoals: agents.reduce((sum, a) => sum + a.activeGoals.size, 0),
    completedGoals: agents.reduce((sum, a) => sum + a.achievedGoals.length, 0),
    systemUptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

router.post('/agent/clear', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && aiAgents.has(sessionId)) {
    aiAgents.delete(sessionId);
    console.log('🤖 AI Agent cleared:', sessionId);
  }
  res.json({ success: true });
});

// Session cleanup
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
  
  if (cleanedCount > 0) {
    console.log(`🤖 AI Agent System cleaned up ${cleanedCount} inactive agents`);
  }
}, 60 * 60 * 1000);

module.exports = router;