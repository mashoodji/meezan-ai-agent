const axios = require('axios');
require('dotenv').config();

async function checkAvailableModels() {
  try {
    console.log('🔍 Checking available models...');
    console.log('🔑 API Key present:', !!process.env.GEMINI_API_KEY);
    
    const response = await axios.get(
      `https://generativelanguage.googleapis.com/v1/models?key=${process.env.GEMINI_API_KEY}`,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('✅ Available Models:');
    if (response.data.models && response.data.models.length > 0) {
      response.data.models.forEach(model => {
        console.log(`📦 Model: ${model.name}`);
        console.log(`   Display Name: ${model.displayName}`);
        console.log(`   Description: ${model.description}`);
        console.log(`   Supported Methods: ${model.supportedGenerationMethods?.join(', ') || 'None'}`);
        console.log('---');
      });
    } else {
      console.log('❌ No models found');
    }
  } catch (error) {
    console.error('❌ Error fetching models:', error.response?.data || error.message);
    
    // Try alternative endpoint
    console.log('\n🔄 Trying alternative endpoint (v1beta)...');
    try {
      const altResponse = await axios.get(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
      );
      
      console.log('✅ Available Models (v1beta):');
      if (altResponse.data.models && altResponse.data.models.length > 0) {
        altResponse.data.models.forEach(model => {
          console.log(`📦 Model: ${model.name}`);
          console.log(`   Display Name: ${model.displayName}`);
          console.log(`   Supported Methods: ${model.supportedGenerationMethods?.join(', ') || 'None'}`);
          console.log('---');
        });
      } else {
        console.log('❌ No models found in v1beta either');
      }
    } catch (altError) {
      console.error('❌ Alternative endpoint also failed:', altError.response?.data || altError.message);
    }
  }
}

checkAvailableModels();