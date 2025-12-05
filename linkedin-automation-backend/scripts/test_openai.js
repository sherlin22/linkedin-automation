// scripts/test-openai.js
require('dotenv').config();
const { getResumeCritique } = require('./helpers/openai-service');
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY not found in .env or environment.');
  process.exit(1);
}

(async () => {
  const sample = `John Doe
Software Engineer with 5 years experience.
Skills: Node.js, AWS, SQL.
Work: Acme Corp (2019-2024).`;

  try {
    const critique = await getResumeCritique(sample, apiKey);
    console.log('\n=== Critique ===\n');
    console.log(critique);
    console.log('\n=== End ===\n');
  } catch (err) {
    console.error('Test failed:', err.message || err);
    process.exit(1);
  }
})();
