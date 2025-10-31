require('dotenv').config();
const OpenAI = require('openai');
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

(async () => {
  try {
    console.log('🔍 Checking OpenAI connection...');
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: "Write a one-line greeting message for a LinkedIn proposal automation project test."
    });
    console.log('✅ OpenAI is working! Response:');
    console.log(response.output[0].content[0].text);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
