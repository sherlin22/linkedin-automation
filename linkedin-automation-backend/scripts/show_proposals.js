// scripts/show_proposals.js
const fs = require('fs');
const state = JSON.parse(fs.readFileSync('state.json','utf8'));
const now = Date.now();
console.log('Total proposals:', (state.proposals||[]).length);
(state.proposals||[]).forEach((p,i) => {
  console.log('#'+(i+1), p.name || 'Unknown', '| id:', (p.id||'N/A').slice(0,80));
  console.log('  sent:', new Date(p.timestamp).toLocaleString(), '| age:', Math.floor((now-p.timestamp)/3600000)+'h', Math.floor(((now-p.timestamp)%3600000)/60000)+'m');
  console.log('  followupSent:', !!p.followupSent, '| replied:', !!p.replied);
  console.log('  profileHref:', p.profileHref || 'N/A');
  console.log('---');
});
