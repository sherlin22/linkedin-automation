// Drop-in helper for robust name extraction and send confirmation
// Usage: const { name, sendStatus, debugFiles } = await getRecipientNameAndConfirmSend(page, dialog, cardInfo, options);

async function getRecipientNameAndConfirmSend(page, dialog = null, cardInfo = null, options = {}) {
  const {
    performSend = false,
    proposalText = '',
    submitButtonSelector = 'button[aria-label*="Send"], button:has-text("Send proposal")',
    maxWaitForClose = 8000,
    retryOnce = true
  } = options;

  // === PART 1: NAME EXTRACTION ===
  
  function cleanName(text) {
    if (!text) return null;
    text = text.replace(/^(Hi|Hello|Dear|Greetings?|Hey|Messaging|To)[,:\s]*/gi, '').trim();
    text = text.split('\n')[0].trim();
    text = text.replace(/[,;:.!?]+$/, '').trim();
    text = text.replace(/\s+/g, ' ').trim();
    const tokens = text.split(' ').filter(t => t.length > 0);
    if (tokens.length > 3) text = tokens.slice(0, 3).join(' ');
    return text;
  }

  function isValidName(text) {
    if (!text || text.length < 2 || text.length > 60) return false;
    const uiLabels = /^(messaging|message|send|submit|proposal|request|resume|writing|notification|dialog|content|view|profile|start|team|there|client|dear|hello|hi|greetings?|hey|to)$/i;
    if (uiLabels.test(text)) return false;
    const uiBadWords = /notification|request|proposal|total|dialog|preview|send|submit/i;
    if (uiBadWords.test(text)) return false;
    if (/^\d/.test(text)) return false;
    if (!/[A-Z]/.test(text)) return false;
    const words = text.split(' ');
    for (const word of words) {
      if (!/^[A-Z][a-z]+$/.test(word) && !/^[A-Z][a-z]*[A-Z][a-z]*$/.test(word)) return false;
    }
    return true;
  }

  const debugSnapshots = [];
  let detectedName = null;

  // Priority 1: Card info name
  if (cardInfo?.name) {
    const cleaned = cleanName(cardInfo.name);
    if (cleaned && isValidName(cleaned)) {
      detectedName = cleaned;
    }
  }

  // Priority 2: Dialog preview/greeting text
  if (!detectedName && dialog) {
    try {
      const previewSelectors = 'textarea[aria-label*="proposal"], textarea.artdeco-text-input--textarea, div[contenteditable="true"]';
      const text = await dialog.$eval(previewSelectors, el => {
        if (el.getAttribute('contenteditable') === 'true') return el.innerText || el.textContent || '';
        return el.value || '';
      }).catch(() => null);
      
      if (text) {
        const match = text.match(/(?:Hello|Hi|Dear|Hey)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})[,\n]/);
        if (match && match[1]) {
          const cleaned = cleanName(match[1]);
          if (cleaned && isValidName(cleaned)) detectedName = cleaned;
        }
      }
    } catch (e) {}
  }

  // Priority 3: Dialog header/title
  if (!detectedName && dialog) {
    try {
      const headerSelectors = 'h2.artdeco-modal__header, h1[class*="title"], h2[class*="title"], [class*="request-title"], div[class*="header"] strong, [class*="requester-name"]';
      const candidates = await dialog.$$eval(headerSelectors, elements => 
        elements.map(el => (el.innerText || el.textContent || '').trim())
      ).catch(() => []);

      for (const raw of candidates) {
        const cleaned = cleanName(raw);
        if (cleaned && isValidName(cleaned)) {
          detectedName = cleaned;
          break;
        }
      }
    } catch (e) {}
  }

  // Priority 4: Profile link (from dialog or page)
  if (!detectedName) {
    try {
      const profileLink = await (dialog || page).$('a[href*="/in/"]');
      if (profileLink) {
        const linkText = await profileLink.evaluate(el => (el.innerText || '').trim()).catch(() => '');
        const cleaned = cleanName(linkText);
        if (cleaned && isValidName(cleaned)) {
          detectedName = cleaned;
        } else {
          // Try title attribute
          const titleAttr = await profileLink.getAttribute('title').catch(() => '');
          const cleanedTitle = cleanName(titleAttr);
          if (cleanedTitle && isValidName(cleanedTitle)) detectedName = cleanedTitle;
        }
      }
    } catch (e) {}
  }

  // Priority 5: Page-level elements
  if (!detectedName) {
    try {
      const pageSelectors = 'h3, h4, .t-16.t-black.t-bold, [class*="requester"], [class*="creator-title"], strong';
      const pageCandidates = await page.$$eval(pageSelectors, elements => 
        elements.map(el => (el.innerText || '').trim()).filter(t => t.length > 0 && t.length < 100)
      ).catch(() => []);

      for (const raw of pageCandidates) {
        const cleaned = cleanName(raw);
        if (cleaned && isValidName(cleaned)) {
          detectedName = cleaned;
          break;
        }
      }
    } catch (e) {}
  }

  // Capture debug snapshots if no name found
  if (!detectedName) {
    try {
      const dialogHtml = dialog ? await dialog.evaluate(el => el.innerHTML.substring(0, 300)).catch(() => '') : '';
      if (dialogHtml) debugSnapshots.push({ source: 'dialog', html: dialogHtml });

      const h3Texts = await page.$$eval('h3', els => els.map(e => e.innerText.trim()).slice(0, 3)).catch(() => []);
      if (h3Texts.length) debugSnapshots.push({ source: 'page-h3', texts: h3Texts });

      const strongTexts = await page.$$eval('strong', els => els.map(e => e.innerText.trim()).filter(t => t.length > 0).slice(0, 3)).catch(() => []);
      if (strongTexts.length) debugSnapshots.push({ source: 'page-strong', texts: strongTexts });
    } catch (e) {}

    console.debug('🔍 DEBUG - No valid name found. Snapshots:', JSON.stringify(debugSnapshots, null, 2));
  }

  // === PART 2: SEND CONFIRMATION (if requested) ===
  
  const result = {
    name: detectedName,
    sendStatus: 'not_attempted',
    debugFiles: [],
    debugSnapshots
  };

  if (!performSend) return result;

  try {
    // Click submit button
    const submitBtn = await (dialog || page).$(submitButtonSelector);
    if (!submitBtn) {
      result.sendStatus = 'failed_no_button';
      return result;
    }

    await submitBtn.click();
    await page.waitForTimeout(1000);

    // Verification: wait for dialog close OR success indicator
    const dialogClosed = await Promise.race([
      page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: maxWaitForClose }).then(() => true).catch(() => false),
      page.waitForSelector('.artdeco-modal', { state: 'detached', timeout: maxWaitForClose }).then(() => true).catch(() => false),
      page.waitForTimeout(maxWaitForClose).then(() => false)
    ]);

    // Additional verification: check for success toast or card state change
    const successIndicator = await Promise.race([
      page.waitForSelector('text=/Proposal sent|Message sent/i', { timeout: 2000 }).then(() => true).catch(() => false),
      page.waitForSelector('[data-test-icon="check-circle"]', { timeout: 2000 }).then(() => true).catch(() => false),
      page.waitForTimeout(2000).then(() => false)
    ]);

    if (dialogClosed || successIndicator) {
      result.sendStatus = 'success';
    } else {
      // Retry logic
      if (retryOnce) {
        console.warn('⚠️  Initial send verification failed, attempting retry...');
        await page.waitForTimeout(500);
        
        const retryBtn = await (dialog || page).$(submitButtonSelector);
        if (retryBtn) {
          await retryBtn.click();
          await page.waitForTimeout(1000);
          
          const retrySuccess = await Promise.race([
            page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 5000 }).then(() => true).catch(() => false),
            page.waitForTimeout(5000).then(() => false)
          ]);
          
          result.sendStatus = retrySuccess ? 'success_retry' : 'failed_verification';
        } else {
          result.sendStatus = 'failed_verification';
        }
      } else {
        result.sendStatus = 'failed_verification';
      }
    }

    // Save debug artifacts on failure
    if (result.sendStatus.startsWith('failed')) {
      const timestamp = Date.now();
      const screenshotPath = `debug_send_failed_${timestamp}.png`;
      const htmlPath = `debug_send_failed_${timestamp}.html`;
      
      try {
        await page.screenshot({ path: screenshotPath, fullPage: false });
        result.debugFiles.push(screenshotPath);
      } catch (e) {}
      
      try {
        const html = await page.content();
        require('fs').writeFileSync(htmlPath, html, 'utf8');
        result.debugFiles.push(htmlPath);
      } catch (e) {}
    }

  } catch (e) {
    result.sendStatus = 'failed_error';
    result.error = e.message;
  }

  return result;
}

module.exports = { getRecipientNameAndConfirmSend };
