// scripts/debug_conversation.js
const playwright = require("playwright");
const fs = require('fs');
const path = require('path');

class LinkedInDebugger {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.debugData = {
      timestamp: new Date().toISOString(),
      conversations: [],
      errors: [],
      screenshots: []
    };
  }

  async initialize() {
    console.log('🚀 Initializing LinkedIn Debugger...');
    
    // Check if auth state exists
    if (!fs.existsSync("auth_state.json")) {
      throw new Error("❌ auth_state.json not found. Please run login script first.");
    }

    this.browser = await playwright.chromium.launch({ 
      headless: false,
      slowMo: 1000, // Increased for better handling
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });
    
    this.context = await this.browser.newContext({ 
      storageState: "auth_state.json",
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    this.page = await this.context.newPage();
    
    // Handle page errors and requests
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('📱 Page Error:', msg.text());
      }
    });

    // Block unnecessary resources to speed up loading
    await this.page.route('**/*', route => {
      const resourceType = route.request().resourceType();
      // Block images, fonts, media to speed up
      if (['image', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    return this;
  }

  async navigateToMessaging() {
    console.log('📨 Navigating to LinkedIn Messaging...');
    
    try {
      // First try to go directly to messaging
      await this.page.goto("https://www.linkedin.com/messaging/", { 
        waitUntil: "domcontentloaded", // Changed from networkidle
        timeout: 45000 // Increased timeout
      });
      
      await this.page.waitForTimeout(5000);
      
      // Check if we're actually on messaging page
      const currentUrl = this.page.url();
      console.log('🔗 Current URL:', currentUrl);
      
      if (!currentUrl.includes('messaging')) {
        console.log('⚠️ Not on messaging page, trying alternative approach...');
        
        // Try going to main page first, then navigate to messaging
        await this.page.goto("https://www.linkedin.com/feed/", {
          waitUntil: "domcontentloaded",
          timeout: 30000
        });
        
        await this.page.waitForTimeout(3000);
        
        // Click on messaging icon
        await this.page.click('a[href*="messaging"]', { timeout: 10000 })
          .catch(() => console.log('❌ Could not find messaging link'));
        
        await this.page.waitForTimeout(5000);
      }
      
      // Final check
      const finalUrl = this.page.url();
      if (finalUrl.includes('messaging')) {
        console.log('✅ Successfully reached messaging page');
      } else {
        console.log('❌ Still not on messaging page. Current URL:', finalUrl);
        await this.page.screenshot({ path: 'debug_navigation_issue.png' });
        this.debugData.screenshots.push('debug_navigation_issue.png');
      }
      
    } catch (error) {
      console.log('❌ Navigation failed:', error.message);
      await this.page.screenshot({ path: 'debug_navigation_error.png' });
      this.debugData.screenshots.push('debug_navigation_error.png');
      throw error;
    }
  }

  async getAllConversations() {
    console.log('🔍 Scanning all conversations...');
    
    await this.page.waitForTimeout(3000);
    
    // Try multiple selectors for conversations
    const conversationSelectors = [
      'li.msg-conversation-listitem',
      '[data-test-conversation]',
      '.msg-conversations-container li',
      '.conversation-list li'
    ];
    
    let conversations = [];
    for (const selector of conversationSelectors) {
      conversations = await this.page.$$(selector);
      if (conversations.length > 0) {
        console.log(`✅ Found ${conversations.length} conversations using selector: ${selector}`);
        break;
      }
    }
    
    if (conversations.length === 0) {
      console.log('❌ No conversations found with any selector');
      // Take screenshot to debug
      await this.page.screenshot({ path: 'debug_no_conversations.png' });
      this.debugData.screenshots.push('debug_no_conversations.png');
      return [];
    }
    
    const conversationData = [];
    
    for (let i = 0; i < conversations.length; i++) {
      try {
        const conversation = conversations[i];
        const data = await this.analyzeConversation(conversation, i);
        conversationData.push(data);
        
        // Take screenshot of first few conversations for reference
        if (i < 3) {
          const screenshotPath = `debug_conversation_${i}.png`;
          await this.page.screenshot({ path: screenshotPath });
          this.debugData.screenshots.push(screenshotPath);
        }
        
      } catch (error) {
        console.log(`❌ Error analyzing conversation ${i}:`, error.message);
        this.debugData.errors.push({
          conversationIndex: i,
          error: error.message
        });
      }
    }
    
    this.debugData.conversations = conversationData;
    return conversationData;
  }

  async analyzeConversation(conversation, index) {
    const data = {
      index,
      name: null,
      hasUnread: false,
      lastMessage: null,
      timestamp: null,
      hasAttachments: false,
      attachmentDetails: [],
      selectors: {},
      issues: []
    };

    try {
      // Get participant names
      data.name = await conversation.evaluate(el => {
        const nameEl = el.querySelector('h3.msg-conversation-listitem__participant-names');
        return nameEl ? nameEl.innerText.trim() : 'Unknown';
      });

      // Check for unread messages
      data.hasUnread = await conversation.evaluate(el => {
        return el.classList.contains('msg-conversation-listitem--is-unread') || 
               el.querySelector('.msg-conversation-listitem__badge-count') !== null;
      });

      // Get last message preview
      data.lastMessage = await conversation.evaluate(el => {
        const msgEl = el.querySelector('.msg-conversation-listitem__message-preview');
        return msgEl ? msgEl.innerText.trim() : null;
      });

      // Get timestamp
      data.timestamp = await conversation.evaluate(el => {
        const timeEl = el.querySelector('.msg-conversation-listitem__timestamp');
        return timeEl ? timeEl.innerText.trim() : null;
      });

      // Check for common attachment indicators
      const attachmentIndicators = await conversation.evaluate(el => {
        const indicators = [];
        const text = el.innerText.toLowerCase();
        
        if (text.includes('resume') || text.includes('cv') || text.includes('.pdf') || 
            text.includes('attached') || text.includes('attachment')) {
          indicators.push('Text indicator found');
        }
        
        // Check for attachment icons
        const icons = el.querySelectorAll('[data-test-attachment-icon], .msg-attachment');
        if (icons.length > 0) {
          indicators.push('Attachment icon found');
        }
        
        return indicators;
      });

      data.hasAttachments = attachmentIndicators.length > 0;
      data.attachmentDetails = attachmentIndicators;

      // Log selector information for debugging
      data.selectors = await conversation.evaluate(el => {
        return {
          tagName: el.tagName,
          className: el.className,
          childCount: el.children.length
        };
      });

      console.log(`📝 Conversation ${index}: ${data.name} - ${data.lastMessage?.substring(0, 50)}...`);

    } catch (error) {
      data.issues.push(`Analysis error: ${error.message}`);
    }

    return data;
  }

  async debugSpecificContact(contactName) {
    console.log(`🎯 Debugging specific contact: ${contactName}`);
    
    const conversations = await this.getAllConversations();
    const targetConversation = conversations.find(conv => 
      conv.name && conv.name.toLowerCase().includes(contactName.toLowerCase())
    );

    if (targetConversation) {
      console.log(`✅ Found contact: ${targetConversation.name}`);
      await this.openAndAnalyzeConversation(targetConversation.index);
    } else {
      console.log(`❌ Contact "${contactName}" not found in conversations`);
      this.debugData.errors.push(`Contact not found: ${contactName}`);
    }
  }

  async openAndAnalyzeConversation(conversationIndex) {
    console.log(`🔓 Opening conversation at index ${conversationIndex}`);
    
    const conversations = await this.page.$$('li.msg-conversation-listitem');
    if (conversationIndex >= conversations.length) {
      throw new Error(`Conversation index ${conversationIndex} out of range`);
    }

    await conversations[conversationIndex].click();
    await this.page.waitForTimeout(3000);

    // Analyze the opened conversation
    await this.analyzeOpenedConversation();
  }

  async analyzeOpenedConversation() {
    console.log('🔬 Analyzing opened conversation...');
    
    const analysis = {
      messages: [],
      attachments: [],
      inputAvailable: false,
      sendButton: false
    };

    try {
      // Get all messages in the conversation
      analysis.messages = await this.page.evaluate(() => {
        const messages = [];
        const messageElements = document.querySelectorAll('.msg-s-event-listitem');
        
        messageElements.forEach((msg, index) => {
          const text = msg.innerText.trim();
          const hasAttachment = msg.querySelector('.msg-attachment, [data-test-attachment]') !== null;
          
          messages.push({
            index,
            text: text.substring(0, 200), // First 200 chars
            hasAttachment,
            fullText: text.length > 200 ? text : null
          });
        });
        
        return messages;
      });

      // Check if message input is available
      analysis.inputAvailable = await this.page.evaluate(() => {
        const input = document.querySelector('.msg-form__contenteditable');
        return input !== null && !input.getAttribute('disabled');
      });

      // Check for send button
      analysis.sendButton = await this.page.evaluate(() => {
        const button = document.querySelector('.msg-form__send-button');
        return button !== null && !button.disabled;
      });

      // Look for attachment buttons
      analysis.attachments = await this.page.evaluate(() => {
        const attachments = [];
        
        // Check for existing attachments in messages
        const existingAttachments = document.querySelectorAll('.msg-attachment, [data-test-attachment]');
        existingAttachments.forEach((att, index) => {
          attachments.push({
            type: 'existing',
            text: att.innerText.substring(0, 100),
            classes: att.className
          });
        });

        // Check for attachment upload button
        const attachButton = document.querySelector('.msg-form__attach-button, [data-test-attach-button]');
        if (attachButton) {
          attachments.push({
            type: 'upload_button',
            available: true
          });
        }

        return attachments;
      });

      console.log(`💬 Found ${analysis.messages.length} messages in conversation`);
      console.log(`📎 Found ${analysis.attachments.length} attachment-related elements`);
      console.log(`✏️ Message input available: ${analysis.inputAvailable}`);
      console.log(`📤 Send button available: ${analysis.sendButton}`);

      // Take screenshot of opened conversation
      const screenshotPath = 'debug_opened_conversation.png';
      await this.page.screenshot({ path: screenshotPath });
      this.debugData.screenshots.push(screenshotPath);

    } catch (error) {
      console.log('❌ Error analyzing opened conversation:', error);
    }

    return analysis;
  }

  async saveDebugReport() {
    const reportPath = `debug_reports/debug_report_${Date.now()}.json`;
    
    // Ensure debug_reports directory exists
    if (!fs.existsSync('debug_reports')) {
      fs.mkdirSync('debug_reports');
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(this.debugData, null, 2));
    console.log(`📄 Debug report saved: ${reportPath}`);
    
    return reportPath;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution function
async function runDebugger(options = {}) {
  const {
    specificContact = null,
    saveReport = true,
    takeScreenshots = true
  } = options;

  const debuggerInstance = new LinkedInDebugger();
  
  try {
    await debuggerInstance.initialize();
    await debuggerInstance.navigateToMessaging();
    
    if (specificContact) {
      await debuggerInstance.debugSpecificContact(specificContact);
    } else {
      const conversations = await debuggerInstance.getAllConversations();
      
      // Log summary
      console.log('\n📊 DEBUG SUMMARY:');
      console.log(`Total conversations: ${conversations.length}`);
      console.log(`Unread conversations: ${conversations.filter(c => c.hasUnread).length}`);
      console.log(`Conversations with attachments: ${conversations.filter(c => c.hasAttachments).length}`);
      
      // Log conversations with issues
      const problematic = conversations.filter(c => c.issues.length > 0);
      if (problematic.length > 0) {
        console.log(`\n⚠️ Problematic conversations: ${problematic.length}`);
        problematic.forEach(conv => {
          console.log(`  - ${conv.name}: ${conv.issues.join(', ')}`);
        });
      }
    }
    
    if (saveReport) {
      const reportPath = await debuggerInstance.saveDebugReport();
      console.log(`\n✅ Debugging completed. Report: ${reportPath}`);
    }
    
  } catch (error) {
    console.error('❌ Debugger failed:', error);
  } finally {
    await debuggerInstance.close();
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const contactName = args[0] || null;
  
  runDebugger({
    specificContact: contactName,
    saveReport: true,
    takeScreenshots: true
  });
}

module.exports = { LinkedInDebugger, runDebugger };