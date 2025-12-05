// scripts/debug_detailed.js
const playwright = require('playwright');
const fs = require('fs');

(async () => {
  console.log('🔍 Detailed Debug of LinkedIn Service Marketplace...');
  
  const browser = await playwright.chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: 'auth_state.json',
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  
  try {
    console.log('🌐 Navigating to LinkedIn Service Marketplace...');
    await page.goto('https://www.linkedin.com/service-marketplace/provider/requests/', {
      waitUntil: 'networkidle',
      timeout: 60000
    });
    
    await page.waitForTimeout(10000); // Wait 10 seconds for full load
    
    console.log('\n=== PAGE INFO ===');
    console.log('URL:', page.url());
    console.log('Title:', await page.title());
    
    // Take screenshot
    await page.screenshot({ path: 'detailed_debug.png', fullPage: true });
    
    console.log('\n=== CARD ANALYSIS ===');
    
    // Look for ALL potential card containers
    const containerSelectors = [
      'div', 'section', 'article', 'li', 'main', 'div[role="listitem"]'
    ];
    
    for (const selector of containerSelectors) {
      const elements = await page.$$(selector);
      console.log(`Selector "${selector}": ${elements.length} elements`);
    }
    
    console.log('\n=== BUTTON TEXT ANALYSIS ===');
    
    // Get ALL button texts on the page
    const allButtons = await page.$$('button');
    console.log(`Total buttons on page: ${allButtons.length}`);
    
    const buttonTexts = [];
    for (let i = 0; i < Math.min(allButtons.length, 50); i++) {
      try {
        const button = allButtons[i];
        const text = await button.evaluate(btn => (btn.textContent || btn.innerText || '').trim());
        const isVisible = await button.isVisible();
        const className = await button.evaluate(btn => btn.className);
        const dataTest = await button.evaluate(btn => btn.getAttribute('data-test'));
        
        if (text && text.length > 0) {
          buttonTexts.push({
            text: text.substring(0, 50),
            visible: isVisible,
            className: className.substring(0, 100),
            dataTest: dataTest
          });
        }
      } catch (e) {
        // Skip if button is not available
      }
    }
    
    console.log('Button texts found:');
    buttonTexts.forEach(btn => {
      console.log(`  "${btn.text}" - visible: ${btn.visible}, data-test: ${btn.dataTest}`);
    });
    
    console.log('\n=== LOOKING FOR PROPOSAL BUTTONS ===');
    
    // Try different button text variations
    const proposalButtonTexts = [
      'Submit proposal',
      'Submit Proposal', 
      'Send proposal',
      'Send Proposal',
      'Submit',
      'Send',
      'Apply',
      'Submit a proposal'
    ];
    
    for (const buttonText of proposalButtonTexts) {
      const buttons = await page.$$(`button:has-text("${buttonText}")`);
      console.log(`Buttons with text "${buttonText}": ${buttons.length}`);
      
      for (const button of buttons) {
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        const fullText = await button.evaluate(btn => (btn.textContent || btn.innerText || '').trim());
        console.log(`  - "${fullText}" - visible: ${isVisible}, enabled: ${isEnabled}`);
      }
    }
    
    console.log('\n=== CARD CONTENT ANALYSIS ===');
    
    // Look at the first few cards to see their structure
    const potentialCards = await page.$$('.artdeco-list__item, div[class*="request"], li, div[role="listitem"]');
    console.log(`Found ${potentialCards.length} potential cards`);
    
    for (let i = 0; i < Math.min(potentialCards.length, 5); i++) {
      console.log(`\n--- Card ${i + 1} ---`);
      const card = potentialCards[i];
      
      // Get all text from card
      const cardText = await card.evaluate(el => (el.textContent || el.innerText || '').trim());
      console.log('Card text (first 200 chars):', cardText.substring(0, 200));
      
      // Get all buttons in this card
      const cardButtons = await card.$$('button');
      console.log(`Buttons in card: ${cardButtons.length}`);
      
      for (const btn of cardButtons) {
        const btnText = await btn.evaluate(button => (button.textContent || button.innerText || '').trim());
        console.log(`  Button: "${btnText}"`);
      }
      
      // Look for names in this card
      const spans = await card.$$('span');
      const potentialNames = [];
      for (const span of spans.slice(0, 10)) {
        const text = await span.evaluate(el => (el.textContent || el.innerText || '').trim());
        if (text && text.length > 2 && text.length < 50 && !text.includes('Submit') && !text.includes('proposal')) {
          potentialNames.push(text);
        }
      }
      console.log('Potential names:', potentialNames.slice(0, 3));
    }
    
    // Save page HTML for detailed analysis
    const html = await page.content();
    fs.writeFileSync('detailed_debug.html', html);
    console.log('\n💾 Saved detailed HTML to detailed_debug.html');
    
    console.log('\n✅ Detailed debug completed. Check detailed_debug.png and detailed_debug.html');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
})();