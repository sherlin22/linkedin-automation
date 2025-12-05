// Test harness: Load saved debug HTML and verify name extraction
const fs = require('fs');
const playwright = require('playwright');
const { getRecipientNameAndConfirmSend } = require('./getRecipientNameAndConfirmSend');

async function testIntegration() {
  console.log('🧪 Testing getRecipientNameAndConfirmSend with saved HTML snapshot\n');
  
  // Use one of the actual debug files from the scripts folder
  const testFile = 'scripts/repro_frame_6_1761836119328.html';
  
  if (!fs.existsSync(testFile)) {
    console.log(`⚠️  Test file not found: ${testFile}`);
    console.log('   Looking for alternative debug files...\n');
    
    // Try to find any HTML debug files
    try {
      const scriptsFiles = fs.readdirSync('scripts/').filter(f => f.endsWith('.html') || f.includes('repro_frame'));
      const rootFiles = fs.readdirSync('.').filter(f => f.includes('debug_filled_proposal') && f.endsWith('.html'));
      
      if (scriptsFiles.length > 0) {
        console.log('   Available debug files in scripts/:');
        scriptsFiles.slice(0, 5).forEach(f => console.log(`     - scripts/${f}`));
        console.log(`\n   Update testFile variable to use one of these files.`);
      } else if (rootFiles.length > 0) {
        console.log('   Available debug files in project root:');
        rootFiles.slice(0, 5).forEach(f => console.log(`     - ${f}`));
        console.log(`\n   Update testFile variable to use one of these files.`);
      } else {
        console.log('   No debug HTML files found.');
        console.log('   Run step7 script once to generate debug files.');
      }
    } catch (e) {
      console.log('   Could not scan for debug files:', e.message);
    }
    
    return;
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log(`📄 Loading: ${testFile}`);
  const html = fs.readFileSync(testFile, 'utf8');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Find dialog
  const dialog = await page.$('[role="dialog"], .artdeco-modal').catch(() => null);

  if (!dialog) {
    console.log('⚠️  No dialog found in HTML snapshot');
  }

  // Test name extraction only (no send)
  const result = await getRecipientNameAndConfirmSend(page, dialog, null);

  console.log(`\n📊 RESULT:`);
  console.log(`   Detected name: "${result.name || 'null'}"`);
  console.log(`   Send status: ${result.sendStatus}`);
  console.log(`   Debug files: ${result.debugFiles.length}`);

  console.log(`\n✅ EXPECTED OUTPUT (for successful case):`);
  console.log(`   Detected name: "FirstName LastName" (valid name from dialog)`);
  console.log(`   Send status: not_attempted`);
  console.log(`   Debug files: 0`);

  console.log(`\n📊 ACTUAL OUTPUT:`);
  if (result.name && result.name !== 'there') {
    console.log(`   ✅ PASS - Name successfully extracted: "${result.name}"`);
  } else {
    console.log(`   ❌ FAIL - Name not found or fell back to "there"`);
    if (result.debugSnapshots && result.debugSnapshots.length > 0) {
      console.log('\n   Debug snapshots captured:');
      result.debugSnapshots.forEach((snap, i) => {
        console.log(`\n   Snapshot ${i + 1} (${snap.source}):`);
        console.log(`     Text: ${JSON.stringify(snap.texts || snap.html?.substring(0, 100))}`);
      });
      console.log('\n   💡 Next steps:');
      console.log('      1. Review the debug snapshots above');
      console.log('      2. Look for the actual recipient name in the HTML');
      console.log('      3. Update getRecipientNameAndConfirmSend.js selectors if needed');
    }
  }

  await browser.close();
  console.log('\n✅ Test complete\n');
}

testIntegration().catch(err => {
  console.error('❌ Test error:', err);
  process.exit(1);
});
