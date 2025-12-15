const axios = require('axios');
require('dotenv').config();

async function testKnowledgeInjection() {
    try {
        console.log('🧪 Testing Knowledge Injection (Location Query)...');

        // We simulate the Direct Response Prompt which now has knowledgeSummary
        // But since we can't easily simulate the internal knowledge summary variable from outside,
        // we will test if the *Agent Logic* (which uses this prompt) actually works.
        // Wait, for this test script to work as an integration test, we should really hit the endpoint 
        // OR simulate the prompt structure if we want to test the LLM's comprehension of the injected text.

        // Let's rely on the fact that we updated the code. We can try to hit the "Direct Response" logic
        // by asking a question that doesn't trigger a tool, like "Where is your office address?".

        // HOWEVER, to be safe and test LOCALLY without running the full server, 
        // I will replicate the PROMPT structure here to verify the Model understands the Summary format.

        const knowledgeSummary = `
        COMPANY: Meezan Developers (17+ Years Exp)
        LOCATION: 97-B Main Boulevard Jubilee Town Housing Scheme Canal Road Lahore
        CONTACT: +92-321-883-6371
        SERVICES: Residential, Commercial, Industrial, Renovations
        `;

        const directPrompt = {
            contents: [{
                parts: [{
                    text: `You are an expert AI consultant for Meezan Developers.
            
            KNOWLEDGE BASE:
            ${knowledgeSummary}
            
            User: "Where are you located?"
            
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

            if (json.reply.includes('Jubilee Town') || json.reply.includes('Lahore')) {
                console.log('✅ PASS: Response contains correct address.');
            } else {
                console.log('❌ FAIL: Response is generic.');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testKnowledgeInjection();
