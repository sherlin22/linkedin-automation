// Test harness: Load saved debug HTML and verify name extraction
const fs = require('fs');
const playwright = require('playwright');
const { getRecipientNameAndConfirmSend } = require('./getRecipientNameAndConfirmSend');

async function testNameExtraction() {
  console.log('🧪 Testing name extraction with saved debug HTML...\n');
  
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Test case 1: debug_filled_proposal_success_1762617441336.html (Joseph Djaba)
  const testFile = 'debug_filled_proposal_success_1762617441336.html';
  
  if (!fs.existsSync(testFile)) {
    console.log(`⏭️  Test file not found: ${testFile}`);
    await browser.close();
    return;
  }

  console.log(`📄 Loading: ${testFile}`);
  const html = fs.readFileSync(testFile, 'utf8');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Find dialog
  const dialog = await page.$('[role="dialog"], .artdeco-modal').catch(() => null);

  // Extract name
  const { name, debugSnapshots } = await getRecipientNameAndConfirmSend(page, dialog, null);

  console.log(`\n✅ EXPECTED CONSOLE OUTPUT (success case):`);
  console.log(`   Detected name: "Joseph Djaba"`);
  console.log(`   sendStatus: not_attempted`);
  console.log(`   debugFiles: []`);
  console.log(`\n📊 ACTUAL RESULT:`);
  console.log(`   Detected name: "${name}"`);
  
  if (name === 'Joseph Djaba') {
    console.log('   ✅ PASS - Name correctly extracted');
  } else if (name === null) {
    console.log('   ❌ FAIL - Name not found. Debug snapshots:');
    console.log(JSON.stringify(debugSnapshots, null, 2));
  } else {
    console.log(`   ⚠️  PARTIAL - Name found but mismatch (expected "Joseph Djaba", got "${name}")`);
  }

  await browser.close();
  console.log('\n✅ Test complete');
}

testNameExtraction().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
