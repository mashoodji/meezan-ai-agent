// Test the handleGeneralQuery function directly
const axios = require('axios');
require('dotenv').config();

async function testReActLoop() {
    try {
        console.log('🧪 Testing ReAct Loop with real API call...\n');

        // Simulate the reasoning prompt
        const reasoningPrompt = {
            contents: [{
                parts: [{
                    text: `You are the brain of the Meezan AI Construction Consultant.
          Goal: Analyze the user's request and decide the best course of action.
          
          Available Tools:
          - MARKET_RESEARCH: For questions about trends, prices, or "is this a good time to build?".
          - COST_CALCULATOR: For specific cost estimates ("how much for 5 marla?").
          - WEATHER_CHECK: For timeline/weather questions.
          - CHECK_SERVICE_AREA: For queries about locations (Karachi, Lahore, Multan, etc.).
          - DIRECT_RESPONSE: For greetings, general info, or if no tool is needed.

          User Request: "Can you offer your services in Lahore?"

          Return ONLY a JSON object: { "action": "TOOL_NAME_OR_DIRECT_RESPONSE", "reason": "Why?", "toolParams": { "location": "City Name" } }`
                }]
            }]
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

        console.log('📤 Sending reasoning request to Gemini...');
        const response = await axios.post(apiUrl, reasoningPrompt, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const rawPlan = response.data.candidates[0].content.parts[0].text.trim();
            console.log('📥 Raw Response:', rawPlan);

            // Try to parse JSON
            const jsonPlan = rawPlan.replace(/```json/g, '').replace(/```/g, '').trim();
            console.log('🧹 Sanitized:', jsonPlan);

            const plan = JSON.parse(jsonPlan);
            console.log('✅ Parsed Plan:', plan);
            console.log('\n🎯 Action:', plan.action);
            console.log('💡 Reason:', plan.reason);
            console.log('🔧 Params:', plan.toolParams);

        } else {
            console.log('❌ Unexpected response format');
        }
    } catch (error) {
        console.error('❌ Test Failed:');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testReActLoop();
