// scripts/step9_reprocess_all.js
const fs = require('fs');

// Reset state for reprocessing
const resetState = {
  processed: [],
  downloaded: [],
  readable: [],
  unreadable: []
};

fs.writeFileSync('resume_processing_state_ALL.json', JSON.stringify(resetState, null, 2));
console.log('✅ State reset - ready to reprocess all conversations');

// Then run the main script
require('./step9_complete_resume_workflow_ALL.js');