const axios = require('axios');
require('dotenv').config();

async function runTest(name, query, expectedAction) {
    console.log(`\n🧪 Testing: ${name}`);
    console.log(`   Query: "${query}"`);

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
        - BOOK_MEETING: For requests to meet, consult, or schedule a call.
        - GET_PORTFOLIO: For requests to see past work, examples, or designs.
        - DIRECT_RESPONSE: For greetings, general info, or if no tool is needed.

        User Request: "${query}"

        Return ONLY a JSON object: { "action": "TOOL_NAME_OR_DIRECT_RESPONSE", "reason": "Why?", "toolParams": { "location": "City Name" } }`
            }]
        }]
    };

    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await axios.post(apiUrl, reasoningPrompt, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const raw = response.data.candidates[0].content.parts[0].text;
            const json = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());

            console.log(`   🎯 Action: ${json.action}`);

            if (json.action === expectedAction) {
                console.log(`   ✅ PASS`);
                return true;
            } else {
                console.log(`   ❌ FAIL (Expected ${expectedAction})`);
                return false;
            }
        }
    } catch (error) {
        console.log(`   ❌ ERROR: ${error.message}`);
        return false;
    }
}

async function runFinalSuite() {
    console.log('🚀 STARTING FINAL PRE-DEPLOYMENT CHECKS...\n');

    const tests = [
        { name: 'Service Area Check', query: 'Can you build in Multan?', expected: 'CHECK_SERVICE_AREA' },
        { name: 'Meeting Booking', query: 'I want to book a consultation', expected: 'BOOK_MEETING' },
        { name: 'Cost Estimation', query: 'How much does a 10 marla house cost?', expected: 'COST_CALCULATOR' },
        { name: 'Portfolio View', query: 'Show me your past projects', expected: 'GET_PORTFOLIO' },
        { name: 'General Chat', query: 'Hello there', expected: 'DIRECT_RESPONSE' }
    ];

    let passed = 0;
    for (const test of tests) {
        if (await runTest(test.name, test.query, test.expected)) {
            passed++;
        }
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5s delay to avoid 429
    }

    console.log(`\n📊 RESULTS: ${passed}/${tests.length} Tests Passed`);
    if (passed === tests.length) {
        console.log('✅ SYSTEM READY FOR DEPLOYMENT');
    } else {
        console.log('⚠️ REVIEW FAILURES BEFORE DEPLOYMENT');
    }
}

runFinalSuite();
