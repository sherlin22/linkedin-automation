const fs = require('fs');
const state = JSON.parse(fs.readFileSync('resume_processing_state_ALL.json', 'utf8'));

console.log('\n📊 RESUME STATE SUMMARY');
console.log('='.repeat(60));
console.log('Readable resumes:', (state.readable || []).length);
console.log('Unreadable resumes:', (state.unreadable || []).length);
console.log('Processed:', (state.processed || []).length);

console.log('\n✅ First 10 readable candidates:');
(state.readable || []).slice(0, 10).forEach((r, i) => {
  console.log(`${i+1}. ${r.name} - ${r.fileName || 'no file'}`);
});

console.log('\n❌ First 10 unreadable candidates:');
(state.unreadable || []).slice(0, 10).forEach((r, i) => {
  console.log(`${i+1}. ${r.name} - ${r.fileName || 'no file'}`);
});
