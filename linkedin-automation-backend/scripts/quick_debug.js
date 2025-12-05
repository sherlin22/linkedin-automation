// scripts/quick_debug.js
const { runDebugger } = require('./debug_conversation');

// Usage examples:
// node scripts/quick_debug.js                    -> Debug all conversations
// node scripts/quick_debug.js "Subhajit"         -> Debug specific contact
// node scripts/quick_debug.js "all"              -> Debug all with detailed report

const contactName = process.argv[2] || null;

console.log('🔧 Starting Quick Debug...');
console.log('Contact:', contactName || 'All conversations');

runDebugger({
  specificContact: contactName === "all" ? null : contactName,
  saveReport: true,
  takeScreenshots: true
}).catch(console.error);