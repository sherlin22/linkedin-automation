const fs = require('fs');
const state = JSON.parse(fs.readFileSync('resume_processing_state_ALL.json', 'utf8'));

console.log('\n📊 RESUME STATE INSPECTION');
console.log('='.repeat(70));
console.log('Total readable:', (state.readable || []).length);
console.log('Total unreadable:', (state.unreadable || []).length);

if (state.readable && state.readable.length > 0) {
  console.log('\n✅ Structure of first readable resume:');
  const first = state.readable[0];
  console.log(JSON.stringify(first, null, 2));
  
  console.log('\n📋 Fields present:');
  Object.keys(first).forEach(key => {
    console.log(`   - ${key}: ${typeof first[key]}`);
  });
  
  console.log('\n✅ First 10 names:');
  state.readable.slice(0, 10).forEach((r, i) => {
    console.log(`${i+1}. ${r.name}`);
  });
}

if (state.unreadable && state.unreadable.length > 0) {
  console.log('\n❌ Structure of first unreadable resume:');
  const first = state.unreadable[0];
  console.log(JSON.stringify(first, null, 2));
}
