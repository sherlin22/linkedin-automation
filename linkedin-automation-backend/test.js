const fs = require('fs');
const state = JSON.parse(fs.readFileSync('resume_processing_state_ALL.json', 'utf8'));
console.log('Readable:', (state.readable || []).length);
console.log('Unreadable:', (state.unreadable || []).length);
