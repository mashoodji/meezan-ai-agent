const axios = require('axios');
require('dotenv').config();

async function testPromptStyle() {
    try {
        console.log('🧪 Testing AI Response Style (Brevity)...');

        const toolResult = {
            success: true,
            service_available: true,
            message: "Yes, we have active teams in Multan."
        };

        const synthesisPrompt = {
            contents: [{
                parts: [{
                    text: `You are a helpful AI consultant for Meezan Developers (17+ years, 263+ projects).
              
              USER QUESTION: "can you offer your servies in multan"
              TOOL_USED: CHECK_SERVICE_AREA
              TOOL_RESULT: ${JSON.stringify(toolResult)}
              
              Task: Write a VERY SHORT, friendly response (1-2 sentences) using the tool data.
              
              RULES:
              - NO distinct greeting/intro like "Thank you for reaching out"
              - Get straight to the point
              - Use natural language
              
              Return JSON ONLY:
              {
                "reply": "Short, friendly response (1-2 sentences)",
                "suggestions": ["Action 1", "Action 2", "Action 3"]
              }`
                }]
            }]
        };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await axios.post(url, synthesisPrompt, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const rawText = response.data.candidates[0].content.parts[0].text;
            const json = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());

            console.log('\n📝 Generated Reply:');
            console.log(json.reply);
            console.log('\n📏 Length:', json.reply.split('.').length - 1, 'sentences');

            if (json.reply.length < 150) {
                console.log('✅ PASS: Response is concise.');
            } else {
                console.log('⚠️ WARN: Response might be too long.');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testPromptStyle();
