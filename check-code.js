// Diagnostic: Check if server is using updated code
const fs = require('fs');

console.log('🔍 Checking if your server code has the latest fixes...\n');

const chatJsContent = fs.readFileSync('./src/routes/chat.js', 'utf8');

// Check 1: Is systemPrompt still referenced (should be REMOVED)?
const hasSystemPromptBug = chatJsContent.includes('${systemPrompt}');
console.log('❌ Bug: systemPrompt reference exists:', hasSystemPromptBug);
if (hasSystemPromptBug) {
    console.log('   → This means you have OLD CODE running!');
    console.log('   → You MUST restart your server!\n');
}

// Check 2: Is gemini-2.5-flash being used?
const hasCorrectModel = chatJsContent.includes('gemini-2.5-flash');
console.log('✅ Using gemini-2.5-flash model:', hasCorrectModel);

// Check 3: Is CHECK_SERVICE_AREA tool implemented?
const hasServiceAreaTool = chatJsContent.includes('CHECK_SERVICE_AREA');
console.log('✅ CHECK_SERVICE_AREA tool exists:', hasServiceAreaTool);

// Check 4: Are service handlers commented out?
const serviceHandlerCommented = chatJsContent.includes('// if (isServiceQuery(userMessage))');
console.log('✅ Service handlers delegated to ReAct:', serviceHandlerCommented);

console.log('\n📋 DIAGNOSIS:');
if (hasSystemPromptBug) {
    console.log('🚨 YOUR SERVER IS RUNNING OLD CODE!');
    console.log('   The file has been updated, but your server needs to be restarted.');
    console.log('\n   Steps:');
    console.log('   1. Stop your server (Ctrl+C)');
    console.log('   2. Run: npm start');
    console.log('   3. Test again');
} else {
    console.log('✅ Code looks good! If still having issues, check server console for errors.');
}
