const fs = require("fs");
const path = require("path");
const minimist = require("minimist");
const playwright = require("playwright");

const args = minimist(process.argv.slice(2), {
  string: ["auth", "slowMo"],
  boolean: ["headful"],
  default: {
    auth: "auth_state.json",
    headful: true,
    slowMo: "150",
    max: 5
  }
});

async function debugConversation(page, thread, index) {
  const name = await thread.evaluate(el => {
    const nameEl = el.querySelector('h3.msg-conversation-listitem__participant-names');
    return nameEl ? nameEl.innerText.trim() : 'Unknown';
  });
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 DEBUGGING [${index + 1}]: ${name}`);
  
  await thread.click();
  await page.waitForTimeout(4000);
  
  // Take screenshot
  await page.screenshot({ path: `debug_${name.replace(/[^a-zA-Z0-9]/g, '_')}.png`, fullPage: true });
  
  // Get ALL text content to see what's actually there
  const pageContent = await page.evaluate(() => {
    const messages = Array.from(document.querySelectorAll('[class*="msg-"], [class*="message"]'));
    return messages.map(msg => ({
      text: (msg.innerText || msg.textContent || '').trim(),
      html: msg.outerHTML.substring(0, 200)
    })).filter(m => m.text.length > 0);
  });
  
  console.log(`   📝 Found ${pageContent.length} message elements:`);
  pageContent.forEach((msg, i) => {
    console.log(`      [${i}] ${msg.text.substring(0, 100)}...`);
    if (msg.text.toLowerCase().includes('attachment') || msg.text.toLowerCase().includes('file')) {
      console.log(`          ⚠️  CONTAINS ATTACHMENT KEYWORDS!`);
    }
  });
  
  return { name, hasContent: pageContent.length > 0 };
}

(async () => {
  const browser = await playwright.chromium.launch({ 
    headless: !args.headful, 
    slowMo: Number(args.slowMo) 
  });
  
  const context = await browser.newContext({ storageState: args.auth });
  const page = await context.newPage();

  try {
    console.log('🚀 STEP 9 TEST MODE - Debugging LinkedIn Messages');
    await page.goto("https://www.linkedin.com/messaging/");
    await page.waitForTimeout(5000);

    const threads = await page.$$('li.msg-conversation-listitem');
    console.log(`📊 Found ${threads.length} conversations`);
    
    // Debug first few conversations
    const debugCount = Math.min(args.max, threads.length);
    for (let i = 0; i < debugCount; i++) {
      await debugConversation(page, threads[i], i);
      
      // Go back to list
      await page.goto("https://www.linkedin.com/messaging/");
      await page.waitForTimeout(3000);
    let threads = await page.$$('li.msg-conversation-listitem');
    }

    await browser.close();
    console.log(`\n✅ Debug complete! Check the screenshots.`);

  } catch (e) {
    console.error("❌ Error:", e);
    await browser.close();
  }
})();