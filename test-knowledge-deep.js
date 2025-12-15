const axios = require('axios');
require('dotenv').config();

async function testDeepKnowledge() {
    try {
        console.log('🧪 Testing Deep Knowledge Injection (Warranty Policy)...');

        // We use the same prompt structure to verify the model has access to the FAQs injected
        const knowledgeSummary = `
        FREQUENTLY ASKED QUESTIONS:
        Q: What areas do you serve? A: We primarily serve Lahore, Karachi...
        Q: What is your warranty policy? A: We offer a comprehensive 10-year structural warranty and 2-year workmanship warranty on all our projects.
        `;

        const directPrompt = {
            contents: [{
                parts: [{
                    text: `You are an expert AI consultant for Meezan Developers.
            
            KNOWLEDGE BASE:
            ${knowledgeSummary}
            
            User: "What warranty do you provide?"
            
            Task: Provide a short, friendly, and conversational response (max 2 sentences) using the Knowledge Base.
            Rules:
            - NO corporate fluff or long intros
            - Be direct and helpful
            - Use emojis if appropriate
            
            Return JSON ONLY (no markdown): { "reply": "...", "suggestions": ["...", "...", "..."] }`
                }]
            }]
        };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await axios.post(url, directPrompt, {
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const rawText = response.data.candidates[0].content.parts[0].text;
            const json = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());

            console.log('\n📝 Generated Reply:', json.reply);

            if (json.reply.includes('10-year') || json.reply.includes('structural warranty')) {
                console.log('✅ PASS: Response contains specific warranty info.');
            } else {
                console.log('❌ FAIL: Response is generic.');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testDeepKnowledge();
