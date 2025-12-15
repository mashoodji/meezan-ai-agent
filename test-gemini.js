// Quick test to verify Gemini API is working
const axios = require('axios');
require('dotenv').config();

async function testGeminiAPI() {
    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const testPrompt = {
            contents: [{
                parts: [{
                    text: 'Return only this JSON: { "status": "working", "message": "API is functional" }'
                }]
            }]
        };

        console.log('🧪 Testing Gemini API...');
        console.log('API URL:', apiUrl.replace(process.env.GEMINI_API_KEY, 'API_KEY_HIDDEN'));

        const response = await axios.post(apiUrl, testPrompt, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            const result = response.data.candidates[0].content.parts[0].text.trim();
            console.log('✅ API Response:', result);
            console.log('✅ Gemini API is working correctly!');
        } else {
            console.log('❌ Unexpected response format:', JSON.stringify(response.data, null, 2));
        }
    } catch (error) {
        console.error('❌ API Test Failed:');
        console.error('Error:', error.response?.data || error.message);
    }
}

testGeminiAPI();
