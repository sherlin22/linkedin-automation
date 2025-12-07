// scripts/step7_submit_proposal_loop.js - IMPROVED NAME DETECTION
const fs = require('fs');
const path = require('path');
const minimist = require('minimist');
const playwright = require('playwright');

const args = minimist(process.argv.slice(2), {
  string: ['auth', 'state', 'page', 'browser', 'profile', 'slowMo'],
  boolean: ['headful', 'confirm'],
  default: {
    auth: 'auth_state.json',
    state: 'proposals_state.json',
    page: 'https://www.linkedin.com/service-marketplace/provider/requests/',
    headful: true,
    confirm: false,
    browser: 'chromium',
    slowMo: '0',
    max: 20
  }
});

args.max = Number(args.max) || 0;
if (args.max <= 0) args.max = 20;

const MSG_TEMPLATE = `Hello {name},

Greetings!!!

Are you tired of your resume getting lost in the shuffle?

Did you know that 85% of resumes are rejected by Applicant Tracking Systems (ATS)?

As a seasoned career coach with 15+ years of experience, I help ambitious professionals like you craft ATS-friendly resumes and LinkedIn profiles that showcase your strengths and achievements.

Whether you're a C-level executive, leadership aspirant, or mid-career professional, my expert services will help you:

• Stand out in a competitive job market
• Increase your visibility to recruiters and hiring managers
• Boost your confidence and career growth

Ready to transform your career?

Let's get started!

Share your resume and contact details, and I'll be in touch to discuss how my personalized services can help you achieve your career goals.

Services Offered:
• Resume Writing
• LinkedIn Profile Optimization
• Career Coaching
• Interview Preparation

Looking forward to empowering your career success!

Cheers,
Deepa Rajan
Ph: 9036846673
Write to: deeparajan890@gmail.com`;

function log(...a){ console.log(...a); }

// -------------------- Persistent state (processed card IDs) --------------------
let PERSIST = { processed: [], submittedNames: [] };

function loadPersist() {
  try {
    if (args.state && fs.existsSync(args.state)) {
      const raw = fs.readFileSync(args.state, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.processed)) {
        PERSIST = parsed;
        if (!PERSIST.submittedNames) PERSIST.submittedNames = [];
      } else if (parsed) {
        PERSIST = { 
          processed: parsed.processed || [], 
          submittedNames: parsed.submittedNames || [] 
        };
      }
      log('Loaded state:', (PERSIST.processed||[]).length, 'processed IDs,', (PERSIST.submittedNames||[]).length, 'submitted names from', args.state);
    } else {
      log('No state file found — starting fresh.');
      PERSIST = { processed: [], submittedNames: [] };
    }
  } catch (e) {
    log('Failed to load state file, starting fresh:', e && e.message);
    PERSIST = { processed: [], submittedNames: [] };
  }
}

function savePersist() {
  try {
    if (!args.state) return;
    fs.writeFileSync(args.state, JSON.stringify(PERSIST, null, 2), 'utf8');
    log('Saved state:', (PERSIST.processed||[]).length, 'processed IDs,', (PERSIST.submittedNames||[]).length, 'submitted names ->', args.state);
  } catch (e) {
    log('Failed to save state:', e && e.message);
  }
}

loadPersist();

async function safeSaveDebug(page, name = 'debug') {
  try {
    if (!page) return {};
    if (typeof page.isClosed === 'function' && page.isClosed()) {
      console.warn('safeSaveDebug: page closed — skip', name);
      return {};
    }
    const ts = Date.now();
    const png = path.resolve(`debug_${name}_${ts}.png`);
    const html = path.resolve(`debug_${name}_${ts}.html`);
    try { await page.screenshot({ path: png, fullPage: true }).catch(()=>{}); } catch(e){}
    try {
      const content = await page.content().catch(()=>null);
      if (content) fs.writeFileSync(html, content);
    } catch(e){}
    log('Saved debug files (best-effort):', png, html);
    return { png, html };
  } catch (e) {
    console.error('safeSaveDebug failed', e && e.message);
    return {};
  }
}

/* Robust fill: handles textarea, input, contenteditable */
async function robustFill(page, elementHandle, message) {
  if (!page || !elementHandle) { 
    console.warn('robustFill: missing page or elementHandle'); 
    return false; 
  }

  try {
    await elementHandle.scrollIntoViewIfNeeded().catch(()=>{});
    await elementHandle.evaluate((el, txt) => {
      function fireEvents(node, data) {
        try {
          node.dispatchEvent(new CompositionEvent('compositionstart', { bubbles:true, cancelable:true, data: data || '' }));
          node.dispatchEvent(new CompositionEvent('compositionend', { bubbles:true, cancelable:true, data: data || '' }));
        } catch(e){}
        try { node.dispatchEvent(new InputEvent('input', { bubbles:true, cancelable:true, data: data || null })); } catch(e){}
        try { node.dispatchEvent(new Event('change', { bubbles:true })); } catch(e){}
      }

      if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
        el.focus();
        while (el.firstChild) el.removeChild(el.firstChild);
        el.appendChild(document.createTextNode(txt));
      } else if ('value' in el) {
        el.value = txt;
      } else {
        el.innerText = txt;
      }
      fireEvents(el, txt);
      try { el.blur(); } catch(e){}
    }, message);
    log('robustFill: evaluate assignment done');
  } catch (e) {
    log('robustFill: evaluate assignment failed:', e && e.message);
  }

  try {
    await elementHandle.focus();
    const tail = message.slice(-6);
    await page.keyboard.type(tail, { delay: 10 });
    for (let i = 0; i < tail.length; i++) { 
      await page.keyboard.press('Backspace'); 
    }
    await page.waitForTimeout(200);
    log('robustFill: keyboard nudge done');
  } catch (e) {
    log('robustFill: keyboard nudge failed:', e && e.message);
  }

  try {
    const current = await elementHandle.evaluate(el => {
      if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
        return el.innerText || el.textContent || '';
      }
      if ('value' in el) return el.value || '';
      return el.innerText || el.textContent || '';
    });
    if (current && String(current).trim().length >= 40) {
      log('robustFill: read-back OK (len=' + String(current).trim().length + ')');
      return true;
    } else {
      log('robustFill: read-back short (len=' + (current ? String(current).length : 0) + ')');
    }
  } catch (e) {
    log('robustFill: read-back failed', e && e.message);
  }

  try {
    await elementHandle.focus();
    if (process.platform === 'darwin') {
      await page.keyboard.down('Meta');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Meta');
    } else {
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
    }
    await page.keyboard.press('Backspace');
    await page.keyboard.type(message, { delay: 5 });
    await page.waitForTimeout(300);
    
    const finalRead = await elementHandle.evaluate(el => {
      if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
        return el.innerText || el.textContent || '';
      }
      if ('value' in el) return el.value || '';
      return el.innerText || el.textContent || '';
    });
    
    if (finalRead && String(finalRead).trim().length >= 40) {
      log('robustFill: keyboard fallback OK');
      return true;
    }
  } catch (e) {
    log('robustFill: keyboard fallback failed', e && e.message);
  }

  return false;
}

/* IMPROVED: Better card detection with unique identification */
async function getRequestCardsWithCTA(page) {
  const CTA_TEXTS = ['submit proposal', 'send proposal', 'submit'];
  
  const cardsWithCTA = await page.evaluate((CTA_TEXTS) => {
    const cards = [];
    const allCards = Array.from(document.querySelectorAll('li, div[class*="request"], div[class*="card"], section[class*="request"]'));
    
    for (const card of allCards) {
      const buttons = Array.from(card.querySelectorAll('button, a'));
      for (const btn of buttons) {
        const txt = (btn.innerText || '').toLowerCase().trim();
        if (CTA_TEXTS.some(cta => txt.includes(cta))) {
          // Get unique identifier for the card
          const cardText = Array.from(card.querySelectorAll('span, div, p, h3, h4'))
            .map(el => el.innerText || '')
            .filter(text => text.trim().length > 5 && !text.includes('Submit proposal'))
            .slice(0, 3)
            .join(' | ');
            
          const cardId = card.getAttribute('data-id') || 
                        card.getAttribute('id') || 
                        card.getAttribute('data-urn') ||
                        `text-${cardText.substring(0, 100)}`;
          
          cards.push({
            found: true,
            buttonText: btn.innerText ? btn.innerText.trim().slice(0, 80) : '',
            cardId: cardId,
            cardText: cardText.substring(0, 150)
          });
          break;
        }
      }
    }
    return cards;
  }, CTA_TEXTS);
  
  return cardsWithCTA;
}

/* Wait for and detect proposal dialog/modal */
async function waitForDialog(page, timeout = 5000) {
  const selectors = [
    '[role="dialog"]',
    '.artdeco-modal',
    'div[class*="modal"]',
    'div[class*="dialog"]'
  ];
  
  try {
    for (const sel of selectors) {
      const dialog = await page.waitForSelector(sel, { 
        state: 'visible', 
        timeout 
      }).catch(() => null);
      
      if (dialog) {
        log('Proposal dialog visible via selector:', sel);
        return dialog;
      }
    }
  } catch (e) {
    log('waitForDialog timeout');
  }
  return null;
}

/* Find editor within dialog */
async function findDialogEditor(page, dialog) {
  const selectors = [
    'textarea[aria-label*="proposal"]',
    'textarea[placeholder*="client"]',
    'textarea.artdeco-text-input--textarea',
    'textarea[id*="multiline"]',
    'textarea',
    'div[contenteditable="true"]',
    '[role="textbox"][contenteditable="true"]'
  ];

  for (const sel of selectors) {
    try {
      if (dialog) {
        const editor = await dialog.$(sel);
        if (editor) {
          const visible = await editor.evaluate(el => {
            const cs = window.getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return cs && cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
          }).catch(()=>false);
          if (visible) return editor;
        }
      }
      
      const editor = await page.$(sel);
      if (editor) {
        const visible = await editor.evaluate(el => {
          const cs = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return cs && cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        }).catch(()=>false);
        if (visible) return editor;
      }
    } catch (e) {}
  }
  
  return null;
}

// IMPROVED NAME DETECTION - ENHANCED VERSION WITH BETTER FILTERING
async function detectNameFromDialog(page, dialog) {
  try {
    log('   🔍 Starting IMPROVED name detection...');

    // Enhanced blacklist of common LinkedIn UI texts that are NOT names
    const BLACKLIST_PATTERNS = [
      'my network', 'career development', 'career coaching', 'resume writing',
      'interview preparation', 'linkedin profile', 'profile optimization',
      'career services', 'job search', 'professional development',
      'skill development', 'business consulting', 'project management',
      'digital marketing', 'software development', 'data analysis',
      'graphic design', 'content writing', 'web development',
      'submit proposal', 'send proposal', 'no thanks', 'dialog content',
      'see more', 'show more', 'view profile', 'connect', 'message',
      'service request', 'marketplace', 'project details', 'budget',
      'delivery time', 'project description', 'requirements', 'For Business', 'Deepa Rajan'
    ];

    // Helper function to check if text is blacklisted
    function isBlacklisted(text) {
      if (!text) return true;
      const lowerText = text.toLowerCase().trim();
      return BLACKLIST_PATTERNS.some(pattern => lowerText.includes(pattern));
    }

    // Helper function to validate person name with stricter rules
    function isValidPersonName(text) {
      if (!text || text.length < 2 || text.length > 60) return false;
      
      // Check blacklist first
      if (isBlacklisted(text)) return false;
      
      const words = text.split(' ').filter(w => w.length > 0);
      
      // Must be 2-3 words (First Last or First Middle Last)
      if (words.length < 2 || words.length > 3) return false;
      
      // Each word must start with capital letter and contain only letters, hyphens, or apostrophes
      const nameRegex = /^[A-Z][a-z'-]*$/;
      const allValid = words.every(word => nameRegex.test(word));
      
      // No numbers or special characters except hyphen and apostrophe
      const hasInvalidChars = /[0-9!@#$%^&*()_+=<>?/\\.,;:{}|[\]]/.test(text);
      
      // Must not be all uppercase (likely an acronym or UI text)
      const isAllCaps = text === text.toUpperCase();
      
      return allValid && !hasInvalidChars && !isAllCaps;
    }

    // STRATEGY 1: Look for the timestamp pattern "FirstName LastName · Xh ago" or "FirstName LastName · Xd ago"
    if (dialog) {
      const timestampName = await dialog.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        for (const el of elements) {
          const text = (el.innerText || el.textContent || '').trim();
          // Match pattern: "Name · Xh ago" or "Name · Xd ago" or "Name · now"
          const match = text.match(/([A-Z][a-z]+(?: [A-Z][a-z]+){1,2}) · (\d+[hd] ago|now)/);
          if (match && match[1]) {
            const name = match[1].trim();
            const words = name.split(' ');
            if (words.length >= 2 && words.length <= 3 && 
                words.every(word => /^[A-Z][a-z'-]+$/.test(word))) {
              return name;
            }
          }
        }
        return null;
      });

      if (timestampName && isValidPersonName(timestampName)) {
        log('   ✓ Name from timestamp pattern:', timestampName);
        return timestampName;
      }
    }

    // STRATEGY 2: Look for profile link with data-test attributes
    if (dialog) {
      try {
        // Try creator title link
        const creatorTitleLink = await dialog.$('a[data-test-service-requests-detail__creator-title-link]');
        if (creatorTitleLink) {
          const title = await creatorTitleLink.getAttribute('title');
          if (title && isValidPersonName(title.trim())) {
            log('   ✓ Name from creator-title-link:', title.trim());
            return title.trim();
          }
        }

        // Try profile image link
        const profileImageLink = await dialog.$('a[data-test-service-requests-detail__creator-profile-image-link]');
        if (profileImageLink) {
          const title = await profileImageLink.getAttribute('title');
          if (title && isValidPersonName(title.trim())) {
            log('   ✓ Name from profile-image-link:', title.trim());
            return title.trim();
          }
        }
      } catch (e) {
        log('   Data-test attribute search failed:', e.message);
      }
    }

    // STRATEGY 3: Look for profile links with /in/ pattern (LinkedIn profile URLs)
    if (dialog) {
      const profileLinkName = await dialog.evaluate(() => {
        // Find all links that point to LinkedIn profiles
        const profileLinks = Array.from(document.querySelectorAll('a[href*="/in/"]'));
        
        for (const link of profileLinks) {
          const linkText = (link.innerText || link.textContent || '').trim();
          
          // Check if link text looks like a name
          if (linkText && linkText.length > 3 && linkText.length < 60) {
            const words = linkText.split(' ').filter(w => w.length > 0);
            
            // Must be 2-3 words starting with capitals
            if (words.length >= 2 && words.length <= 3) {
              const allCapitalized = words.every(word => /^[A-Z][a-z'-]*$/.test(word));
              if (allCapitalized) {
                return linkText;
              }
            }
          }
          
          // Also check the title attribute
          const title = link.getAttribute('title');
          if (title && title.length > 3 && title.length < 60) {
            const words = title.split(' ').filter(w => w.length > 0);
            if (words.length >= 2 && words.length <= 3) {
              const allCapitalized = words.every(word => /^[A-Z][a-z'-]*$/.test(word));
              if (allCapitalized) {
                return title;
              }
            }
          }
        }
        return null;
      });

      if (profileLinkName && isValidPersonName(profileLinkName)) {
        log('   ✓ Name from profile link:', profileLinkName);
        return profileLinkName;
      }
    }

    // STRATEGY 4: Look for heading elements near the top of dialog (often contain requester name)
    if (dialog) {
      const headingName = await dialog.evaluate(() => {
        // Look for h2, h3 elements which often contain the requester's name
        const headings = Array.from(document.querySelectorAll('h2, h3, h4'));
        
        for (const heading of headings) {
          const text = (heading.innerText || heading.textContent || '').trim();
          
          // Must be reasonably short and look like a name
          if (text && text.length > 3 && text.length < 60) {
            const words = text.split(' ').filter(w => w.length > 0);
            
            if (words.length >= 2 && words.length <= 3) {
              const allCapitalized = words.every(word => /^[A-Z][a-z'-]*$/.test(word));
              if (allCapitalized) {
                return text;
              }
            }
          }
        }
        return null;
      });

      if (headingName && isValidPersonName(headingName)) {
        log('   ✓ Name from heading:', headingName);
        return headingName;
      }
    }

    // STRATEGY 5: Scan all visible text with strict filtering
    if (dialog) {
      const allText = await dialog.evaluate(() => {
        const texts = [];
        const walker = document.createTreeWalker(
          document.body, 
          NodeFilter.SHOW_TEXT, 
          null, 
          false
        );
        
        let node;
        while (node = walker.nextNode()) {
          const text = node.textContent.trim();
          if (text && text.length > 5 && text.length < 100) {
            // Skip if parent is a button or hidden
            const parent = node.parentElement;
            if (parent) {
              const style = window.getComputedStyle(parent);
              const isVisible = style.display !== 'none' && 
                               style.visibility !== 'hidden' &&
                               style.opacity !== '0';
              const notButton = parent.tagName !== 'BUTTON';
              
              if (isVisible && notButton) {
                texts.push(text);
              }
            }
          }
        }
        return texts;
      });

      for (const text of allText) {
        // Look for pattern: "FirstName LastName" (and optionally MiddleName)
        const nameMatch = text.match(/\b([A-Z][a-z'-]+(?: [A-Z][a-z'-]+){1,2})\b/);
        
        if (nameMatch) {
          const potentialName = nameMatch[1].trim();
          
          if (isValidPersonName(potentialName)) {
            log('   ✓ Name from text pattern:', potentialName);
            return potentialName;
          }
        }
      }
    }

    // STRATEGY 6: Debug logging if nothing found
    log('   ⚠ No valid name found after all strategies');
    
    if (dialog) {
      const debugInfo = await dialog.evaluate(() => {
        return {
          allLinks: Array.from(document.querySelectorAll('a'))
            .map(a => ({
              text: (a.innerText || '').trim().substring(0, 50),
              href: a.getAttribute('href'),
              title: a.getAttribute('title')
            }))
            .filter(item => item.text || item.title)
            .slice(0, 5),
          allHeadings: Array.from(document.querySelectorAll('h1, h2, h3, h4'))
            .map(h => (h.innerText || '').trim().substring(0, 50))
            .filter(text => text.length > 0)
            .slice(0, 5)
        };
      });
      
      log('   Debug - Links found:', JSON.stringify(debugInfo.allLinks, null, 2));
      log('   Debug - Headings found:', debugInfo.allHeadings);
    }

    return null;

  } catch (e) {
    log('detectNameFromDialog error:', e && e.message);
    return null;
  }
}

// Also update the helper functions in the main code
function isServiceText(text) {
  if (!text) return true;
  const lowerText = text.toLowerCase();
  const servicePatterns = [
    'resume writing', 'resume', 'writing', 'interview preparation',
    'linkedin profile', 'career coaching', 'service', 'marketplace',
    'premium', 'submit', 'proposal', 'request', 'project details',
    'my network', 'career development', 'skill development', 'network'
  ];
  return servicePatterns.some(pattern => lowerText.includes(pattern));
}

function isValidPersonName(text) {
  if (!text || text.length < 2 || text.length > 60) return false;
  
  // Check if it's service-related text
  if (isServiceText(text)) {
    return false;
  }
  
  const words = text.split(' ').filter(w => w.length > 0);
  
  // Must be 2-3 words (First Last or First Middle Last)
  if (words.length < 2 || words.length > 3) return false;
  
  // Each word must be properly capitalized (First letter capital, rest lowercase)
  const nameRegex = /^[A-Z][a-z'-]*$/;
  const allValid = words.every(word => nameRegex.test(word));
  
  // No numbers or most special characters
  const hasInvalidChars = /[0-9!@#$%^&*()_+=<>?/\\.,;:{}|[\]]/.test(text);
  
  // Reject if all caps (likely acronym or UI element)
  const isAllCaps = text === text.toUpperCase();
  
  return allValid && !hasInvalidChars && !isAllCaps;
}

async function clickDialogSubmit(page, dialog) {
  const CANDIDATE_TEXTS = ['send', 'submit', 'send proposal', 'submit proposal', 'confirm', 'continue'];

  async function clickVisiblePrimary(root) {
    return await root.evaluate((node, candidateTexts) => {
      function norm(s){ return (s || '').toString().toLowerCase().trim(); }
      function isUsable(btn) {
        try {
          const style = window.getComputedStyle(btn);
          const disabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true' || btn.getAttribute('disabled') !== null;
          const rect = btn.getBoundingClientRect();
          const visible = style && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
          const txt = norm(btn.innerText || btn.textContent || btn.value || '');
          const notCancel = !/cancel|close|discard|dismiss/.test(txt);
          return !disabled && visible && notCancel;
        } catch (e) { return false; }
      }

      const acceptBtn = node.querySelector('button[data-test-service-request-details__accept]');
      if (acceptBtn && isUsable(acceptBtn)) {
        acceptBtn.click();
        return { clicked: true, text: 'accept button (data-test)' };
      }

      const PREFERRED = [
        'button[data-test*="send"]:not([disabled])',
        'button[data-test*="submit"]:not([disabled])',
        'button[type="submit"]:not([disabled])',
        '.artdeco-modal footer .artdeco-button--primary:not([disabled])',
        'button.artdeco-button--primary:not([disabled])',
        'button',
        'a[role="button"]',
        '[role="button"]'
      ];

      for (const sel of PREFERRED) {
        const el = node.querySelector(sel);
        if (el && isUsable(el)) {
          const txt = norm(el.innerText || el.textContent || '');
          if (!txt || candidateTexts.some(t => txt.includes(t))) {
            el.click();
            return { clicked: true, text: txt || sel };
          }
        }
      }

      const all = Array.from(node.querySelectorAll('button, [role="button"], a'));
      for (const btn of all) {
        const txt = norm(btn.innerText || btn.textContent || btn.value || '');
        if (isUsable(btn) && candidateTexts.some(t => txt.includes(t))) {
          btn.click();
          return { clicked: true, text: txt };
        }
      }
      return { clicked: false };
    }, CANDIDATE_TEXTS);
  }

  try {
    let result = null;
    if (dialog) {
      result = await clickVisiblePrimary(dialog);
      if (result && result.clicked) {
        log('✅ Clicked submit:', result.text || '(primary)');
      }
    }

    if (!result || !result.clicked) {
      result = await page.evaluate((candidateTexts) => {
        function norm(s){ return (s || '').toString().toLowerCase().trim(); }
        function isUsable(btn) {
          try {
            const style = window.getComputedStyle(btn);
            const disabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true' || btn.getAttribute('disabled') !== null;
            const rect = btn.getBoundingClientRect();
            const visible = style && style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
            const txt = norm(btn.innerText || btn.textContent || btn.value || '');
            const notCancel = !/cancel|close|discard|dismiss/.test(txt);
            return !disabled && visible && notCancel;
          } catch (e) { return false; }
        }
        const modals = Array.from(document.querySelectorAll('[role="dialog"], .artdeco-modal, .artdeco-modal__content, [aria-modal="true"]'))
          .filter(m => { 
            try { 
              const cs = getComputedStyle(m); 
              const r = m.getBoundingClientRect(); 
              return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; 
            } catch(e){ 
              return false; 
            } 
          });
        const root = modals.length ? modals[modals.length - 1] : document.body;
        const PREFERRED = [
          'button[data-test-service-request-details__accept]',
          'button[data-test*="send"]',
          'button[data-test*="submit"]',
          'button[type="submit"]:not([disabled])',
          '.artdeco-modal footer .artdeco-button--primary:not([disabled])',
          'button.artdeco-button--primary:not([disabled])',
          'button',
          'a[role="button"]',
          '[role="button"]'
        ];
        for (const sel of PREFERRED) {
          const el = root.querySelector(sel);
          if (el && isUsable(el)) {
            const txt = norm(el.innerText || el.textContent || '');
            if (!txt || candidateTexts.some(t => txt.includes(t))) {
              el.click();
              return { clicked: true, text: txt || sel };
            }
          }
        }
        const all = Array.from(root.querySelectorAll('button, [role="button"], a'));
        for (const btn of all) {
          const txt = norm(btn.innerText || btn.textContent || btn.value || '');
          if (isUsable(btn) && candidateTexts.some(t => txt.includes(t))) {
            btn.click();
            return { clicked: true, text: txt };
          }
        }
        return { clicked: false };
      }, CANDIDATE_TEXTS);
      if (result && result.clicked) {
        log('✅ Clicked submit (page-level):', result.text || '(primary)');
      }
    }

    if (result && result.clicked) {
      const closed = await Promise.race([
        page.waitForSelector('[role="dialog"], .artdeco-modal, .artdeco-modal__content', { state: 'hidden', timeout: 4000 }).then(() => true).catch(() => false),
        page.waitForSelector('.artdeco-toast-item, .artdeco-toast', { timeout: 4000 }).then(() => true).catch(() => false)
      ]);

      if (closed) return true;

      await page.waitForTimeout(600);
      if (dialog) {
        const second = await clickVisiblePrimary(dialog);
        if (second && second.clicked) {
          const closed2 = await Promise.race([
            page.waitForSelector('[role="dialog"], .artdeco-modal, .artdeco-modal__content', { state: 'hidden', timeout: 4000 }).then(() => true).catch(() => false),
            page.waitForSelector('.artdeco-toast-item, .artdeco-toast', { timeout: 4000 }).then(() => true).catch(() => false)
          ]);
          if (closed2) return true;
        }
      }
    }

    try {
      if (process.platform === 'darwin') {
        await page.keyboard.down('Meta');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Meta');
      } else {
        await page.keyboard.down('Control');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Control');
      }
      await page.waitForTimeout(400);
      const stillOpen = await page.$('[role="dialog"], .artdeco-modal, .artdeco-modal__content');
      if (!stillOpen) return true;
    } catch (e) { }

    log('⚠️ Submit button not found');
    return false;
  } catch (e) {
    log('clickDialogSubmit error:', e && (e.message || e));
    return false;
  }
}

/* Close dialog by pressing Escape */
async function closeDialog(page) {
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    log('Dialog closed.');
  } catch (e) {
    log('closeDialog error:', e.message);
  }
}

/* IMPROVED: Better card identification */
async function getCardId(cardHandle) {
  try {
    const id = await cardHandle.evaluate(card => {
      // Try to get unique content-based ID first
      const textElements = Array.from(card.querySelectorAll('span, div, p, h3, h4'))
        .map(el => el.innerText || '')
        .filter(text => text.trim().length > 5 && 
                       !text.includes('Submit proposal') && 
                       !text.includes('No thanks'))
        .slice(0, 3)
        .join(' | ');
      
      if (textElements) {
        return 'content-' + textElements.substring(0, 100).replace(/\|/g, '-').replace(/\s+/g, '_');
      }
      
      // Fallback to attributes
      const selectorsForLink = [
        'a[href*="/service-marketplace/"]',
        'a[href*="/in/"]',
        'a[href*="/profile/"]',
        'a'
      ];
      for (const sel of selectorsForLink) {
        const a = card.querySelector(sel);
        if (a) {
          const href = a.getAttribute('href');
          if (href) return 'href-' + href;
          const dataId = a.getAttribute('data-id') || (a.dataset && (a.dataset.urn || a.dataset.id));
          if (dataId) return 'data-' + dataId;
        }
      }
      if (card.getAttribute('data-id')) return 'attr-' + card.getAttribute('data-id');
      if (card.id) return 'id-' + card.id;
      
      return 'fallback-' + Date.now() + '-' + Math.floor(Math.random()*100000);
    });
    return id || null;
  } catch (e) {
    return null;
  }
}
/* FIXED: Improved scrolling without button clicks - FAILS FAST */
async function loadMoreCards(page) {
  log('🔄 Attempting to load more cards...');
  
  try {
    // Get initial card count
    const cardsBefore = await getRequestCardsWithCTA(page);
    const initialCount = cardsBefore.length;
    
    // ✅ If there are literally 0 cards, don't even try
    if (initialCount === 0) {
      log('⚠️ No cards found at all - likely no requests available');
      return false;
    }
    
    // Strategy 1: Multiple gentle scrolls to bottom
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000 + Math.random() * 1000);
    }
    
    await page.waitForTimeout(2000);
    
    // Check if new cards loaded
    let cardsAfter = await getRequestCardsWithCTA(page);
    if (cardsAfter.length > initialCount) {
      log(`✅ Loaded ${cardsAfter.length - initialCount} new cards (scroll method 1)`);
      return true;
    }
    
    // Strategy 2: Scroll in smaller increments
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    for (let i = 0; i < 8; i++) {
      await page.evaluate((h) => window.scrollBy(0, h * 0.7), viewportHeight);
      await page.waitForTimeout(800);
    }
    
    await page.waitForTimeout(2000);
    
    cardsAfter = await getRequestCardsWithCTA(page);
    if (cardsAfter.length > initialCount) {
      log(`✅ Loaded ${cardsAfter.length - initialCount} new cards (scroll method 2)`);
      return true;
    }
    
    // Strategy 3: Try to find and click "Load more" button (with timeout protection)
    try {
      const loadMoreSelectors = [
        'button[aria-label*="more" i]',
        'button[aria-label*="load" i]',
        'button:has-text("Show more")',
        'button:has-text("Load more")',
        '.scaffold-finite-scroll__load-button'
      ];
      
      for (const selector of loadMoreSelectors) {
        const button = await page.$(selector);
        if (button) {
          const isVisible = await button.isVisible().catch(() => false);
          if (isVisible) {
            // Scroll button into view first
            await button.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(500);
            
            // Try to click with short timeout
            await button.click({ timeout: 5000 }).catch(() => {
              log('   Button click failed, continuing...');
            });
            
            await page.waitForTimeout(2000);
            
            cardsAfter = await getRequestCardsWithCTA(page);
            if (cardsAfter.length > initialCount) {
              log(`✅ Loaded ${cardsAfter.length - initialCount} new cards (button click)`);
              return true;
            }
          }
        }
      }
    } catch (e) {
      log('   Load more button search failed (non-critical):', e.message);
    }
    
    // Final check
    cardsAfter = await getRequestCardsWithCTA(page);
    if (cardsAfter.length > initialCount) {
      log(`✅ Loaded ${cardsAfter.length - initialCount} new cards`);
      return true;
    }
    
    log('⚠️ No new cards loaded after all strategies');
    return false;
    
  } catch (e) {
    log('⚠️ loadMoreCards error (non-critical):', e.message);
    return false;
  }
}

/* IMPROVED: Main execution with better card handling */
(async () => {
  const browserName = args.browser === 'firefox' ? 'firefox' : 
                      args.browser === 'webkit' ? 'webkit' : 'chromium';
  const lib = playwright[browserName];
  log('Using browser:', browserName);

  let context;

  process.on('SIGINT', async () => {
    log('SIGINT received — closing Playwright context and exiting...');
    try {
      if (context) {
        await context.close().catch(()=>{});
      }
    } catch (e) {
    }
    process.exit(0);
  });

  if (args.profile) {
    context = await lib.launchPersistentContext(args.profile, { 
      headless: !args.headful, 
      slowMo: Number(args.slowMo) 
    });
  } else {
    const browser = await lib.launch({ 
      headless: !args.headful, 
      slowMo: Number(args.slowMo) 
    });
    const ctxOptions = args.auth && fs.existsSync(args.auth) 
      ? { storageState: args.auth } 
      : {};
    context = await browser.newContext(ctxOptions);
  }

  const pages = context.pages();
  const page = pages.length ? pages[0] : await context.newPage();
  page.setDefaultTimeout(60000);

  try {
    log('Opening provider requests page:', args.page);
await page.goto(args.page, { 
  waitUntil: 'domcontentloaded',
  timeout: 90000  //90 seconds for the initial page load
});

    if (/\/uas\/login|\/login|\/checkpoint/.test(page.url())) {
      log('Login redirect detected. Please sign in manually and re-run.');
      await safeSaveDebug(page, 'redirected');
      if (!args.headful) await context.close();
      process.exit(1);
    }

    const MAX_ITER = 50;
    const MAX_CONSEC_FAIL = 8;
    let consecutiveFailures = 0;
    let processedCount = 0;
    let totalLoadAttempts = 0;
    const MAX_LOAD_ATTEMPTS = 10;

    for (let iter = 0; iter < MAX_ITER && totalLoadAttempts < MAX_LOAD_ATTEMPTS; iter++) {
      const jitter = 300 + Math.floor(Math.random() * 1200);
      await page.waitForTimeout(jitter);

      if (processedCount >= args.max) {
        log(`✅ Reached requested max proposals for this run (${args.max}). Exiting loop.`);
        break;
      }

      await page.waitForTimeout(1000);
      
      // Try to load more cards if we're running low
      const cardsInfo = await getRequestCardsWithCTA(page);
      const unprocessedCards = cardsInfo.filter(card => 
        !PERSIST.processed.includes(card.cardId)
      );
      
      log(`Found ${cardsInfo.length} request card(s) with CTA, ${unprocessedCards.length} unprocessed`);
      
      if (unprocessedCards.length === 0) {
        log('No unprocessed cards found. Attempting to load more...');
        const loaded = await loadMoreCards(page);
        totalLoadAttempts++;
        
        if (loaded) {
          consecutiveFailures = 0;
          continue; // Retry with new cards
        } else {
          consecutiveFailures++;
          if (consecutiveFailures >= MAX_CONSEC_FAIL) {
            log('❌ Too many consecutive failures. Exiting.');
            break;
          }
          continue;
        }
      }
      
      log(`Processing card #1 of ${unprocessedCards.length} unprocessed cards`);
      
      const cardElements = await page.$$('li, div[class*="request"], div[class*="card"], section[class*="request"]');
      if (cardElements.length === 0) {
        log('No card elements found. Exiting.');
        break;
      }
      
      let ctaClicked = false;
      let clickedCardHandle = null;
      let clickedCardId = null;

      for (let ci = 0; ci < cardElements.length; ci++) {
        const card = cardElements[ci];

        let cardId = null;
        try {
          cardId = await getCardId(card);
        } catch (e) { cardId = null; }

        if (cardId && PERSIST.processed && PERSIST.processed.includes(cardId)) {
          continue; // Skip already processed
        }

        try {
          await card.scrollIntoViewIfNeeded().catch(()=>{});
          const buttons = await card.$$('button, a');
          for (const btn of buttons) {
            const txt = (await btn.evaluate(b => (b.innerText || '').toLowerCase().trim())).trim();
            if (txt && (txt.includes('submit proposal') || txt.includes('send proposal') || /submit|send|proposal/.test(txt))) {
              try {
                await btn.click({ force: true }).catch(()=>{});
                ctaClicked = true;
                clickedCardHandle = card;
                clickedCardId = cardId;
                break;
              } catch (e) {}
            }
          }
          if (ctaClicked) break;
        } catch (e) {
          log('card click attempt error:', e && e.message);
        }
      }

      if (!ctaClicked) {
        log('Could not click CTA in any unprocessed card.');
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_CONSEC_FAIL) break;
        
        // Try loading more cards
        const loaded = await loadMoreCards(page);
        totalLoadAttempts++;
        if (loaded) consecutiveFailures = 0;
        continue;
      }

      log('CTA clicked (card-scoped).');
      await page.waitForTimeout(1500);
      
      const dialog = await waitForDialog(page, 5000);
      if (!dialog) {
        log('Proposal dialog not found. Skipping card.');
        consecutiveFailures++;
        await closeDialog(page);
        if (consecutiveFailures >= MAX_CONSEC_FAIL) break;
        await page.goto(args.page, { waitUntil: 'domcontentloaded' });
        continue;
      }
      
      const name = await detectNameFromDialog(page, dialog);
      
      log('   🔍 NAME DETECTION DEBUG:');
      log('   Raw name detected:', name);
      log('   Clean name to save:', name && name !== 'there' ? name.trim() : 'INVALID_NAME');
      
      const personalized = MSG_TEMPLATE.replace('{name}', name || 'there');
      log('Detected name:', name || 'there');
      
      const editor = await findDialogEditor(page, dialog);
      if (!editor) {
        log('Editor not found in dialog. Skipping.');
        consecutiveFailures++;
        await safeSaveDebug(page, 'no_editor');
        await closeDialog(page);
        if (consecutiveFailures >= MAX_CONSEC_FAIL) break;
        await page.goto(args.page, { waitUntil: 'domcontentloaded' });
        continue;
      }
      
      const filled = await robustFill(page, editor, personalized);
      if (!filled) {
        log('Fill failed. Skipping card.');
        consecutiveFailures++;
        await safeSaveDebug(page, 'fill_failed');
        await closeDialog(page);
        if (consecutiveFailures >= MAX_CONSEC_FAIL) break;
        await page.goto(args.page, { waitUntil: 'domcontentloaded' });
        continue;
      }
      
      consecutiveFailures = 0;
      
      const preview = await editor.evaluate(el => {
        if (el.getAttribute && el.getAttribute('contenteditable') === 'true') {
          return el.innerText || el.textContent || '';
        }
        if ('value' in el) return el.value || '';
        return el.innerText || el.textContent || '';
      }).catch(() => '');
      
      log('Filled preview (trim):', (preview || '').slice(0,200).replace(/\n/g,'␤'));
      
      if (args.confirm) {
        const submitted = await clickDialogSubmit(page, dialog);
        if (submitted) {
          log('✅ Proposal submitted (confirm=true).');
          processedCount++;

          try {
            const cid = clickedCardId || (await getCardId(clickedCardHandle).catch(()=>null));
            
            if (!PERSIST.processed) PERSIST.processed = [];
            if (cid && !PERSIST.processed.includes(cid)) {
              PERSIST.processed.push(cid);
            } else if (!cid) {
              const fallbackId = 'fallback-' + Date.now();
              PERSIST.processed.push(fallbackId);
            }
            
            if (!PERSIST.submittedNames) PERSIST.submittedNames = [];
            
            if (name && name !== 'there' && name.trim().length > 0) {
              const cleanName = name.trim();
              if (!PERSIST.submittedNames.includes(cleanName)) {
                PERSIST.submittedNames.push(cleanName);
                log('   ✅ Added to submittedNames:', cleanName);
              } else {
                log('   ⏭️ Name already in submittedNames:', cleanName);
              }
            } else {
              log('   ⚠ No valid name to save for follow-up:', name);
            }
            
            savePersist();
            log('   💾 Saved state - Processed:', PERSIST.processed.length, 'Submitted names:', PERSIST.submittedNames.length);
          } catch (e) {
            log('Warning: failed to persist state:', e && e.message);
          }

          await page.waitForTimeout(2000);
        } else {
          log('⚠️ Could not find submit button. Left as draft.');
          await safeSaveDebug(page, 'no_submit_button');
        }
      } else {
        log('Dry-run: proposal drafted but not submitted (use --confirm=true to send).');
      }
      
      await safeSaveDebug(page, 'filled_proposal_success');
      
      await closeDialog(page);
      await page.waitForTimeout(1000);
      await page.goto(args.page, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500);
    }

    log(`✅ Loop finished. Processed ${processedCount} proposal(s).`);
    if (!args.headful) await context.close();
    process.exit(0);

  } catch (err) {
    console.error('ERROR main flow:', err && (err.stack || err));
    try { await safeSaveDebug(page, 'main_error'); } catch(e){}
    process.exit(2);
  }
})();