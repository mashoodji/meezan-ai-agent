// List available Gemini models
const axios = require('axios');
require('dotenv').config();

async function listModels() {
    try {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;

        console.log('📋 Fetching available Gemini models...\n');

        const response = await axios.get(apiUrl);

        if (response.data?.models) {
            console.log('✅ Available Models:\n');
            response.data.models.forEach(model => {
                const supportsGenerate = model.supportedGenerationMethods?.includes('generateContent');
                if (supportsGenerate) {
                    console.log(`✓ ${model.name}`);
                    console.log(`  Display Name: ${model.displayName}`);
                    console.log(`  Methods: ${model.supportedGenerationMethods.join(', ')}`);
                    console.log('');
                }
            });
        }
    } catch (error) {
        console.error('❌ Error listing models:');
        console.error(error.response?.data || error.message);
    }
}

listModels();
