//step9_final_resume_download.js
const { chromium } = require('playwright');
const fs = require('fs-extra');
const path = require('path');

class ResumeDownloader {
    constructor() {
        this.browser = null;
        this.page = null;
        this.downloadsDir = path.join(process.cwd(), 'downloads', 'resumes');
        this.resumeState = this.loadResumeState();
        this.downloadedFiles = [];
    }

    loadResumeState() {
        try {
            const statePath = path.join(this.downloadsDir, 'resume_download_state.json');
            if (fs.existsSync(statePath)) {
                const state = fs.readJsonSync(statePath);
                console.log('📁 Loaded resume state:', state.processed?.length || 0, 'processed');
                return state;
            }
        } catch (error) {
            console.log('📁 No existing resume state found, starting fresh');
        }
        return { 
            downloaded: [], 
            processed: [],
            files: [] // Track individual files to avoid duplicates
        };
    }

    saveResumeState() {
        const statePath = path.join(this.downloadsDir, 'resume_download_state.json');
        fs.ensureDirSync(this.downloadsDir);
        fs.writeJsonSync(statePath, this.resumeState, { spaces: 2 });
    }

    async init() {
        console.log('🚀 STEP 9 FINAL: Resume Download - ALL Conversations');
        console.log('====================================================');
        
        this.browser = await chromium.launch({ 
            headless: false,
            downloadsPath: this.downloadsDir
        });
        
        const context = await this.browser.newContext({
            acceptDownloads: true
        });
        
        this.page = await context.newPage();
        return this;
    }

    async loginToLinkedIn() {
        console.log('📱 Opening LinkedIn Messaging...');
        await this.page.goto('https://www.linkedin.com/messaging/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Check if we need to login
        if (await this.page.locator('input[type="password"]').isVisible() || 
            await this.page.locator('text=Sign in').isVisible()) {
            console.log('🔐 MANUAL LOGIN REQUIRED');
            console.log('Please log in to LinkedIn in the browser window.');
            
            await this.page.waitForURL('https://www.linkedin.com/messaging/**', { timeout: 120000 });
            console.log('✅ Login successful!');
        }

        await this.page.waitForTimeout(5000);
    }

    async getAllConversations() {
        console.log('📜 Loading conversations...');
        
        // Use more reliable selectors
        await this.page.waitForSelector('li.msg-conversation-listitem', { timeout: 15000 });
        
        console.log('🔍 Getting ALL conversation names...');
        const conversationItems = await this.page.locator('li.msg-conversation-listitem').all();
        console.log(`📊 Found ${conversationItems.length} conversations`);
        
        const conversations = [];
        for (let i = 0; i < conversationItems.length; i++) {
            try {
                const name = await conversationItems[i].locator('.msg-conversation-listitem__participant-names').textContent();
                const cleanName = name ? name.trim() : `Unknown_${i + 1}`;
                console.log(`   ${i + 1}. ${cleanName}`);
                conversations.push({
                    element: conversationItems[i],
                    name: cleanName,
                    index: i
                });
            } catch (error) {
                console.log(`   ❌ Could not get conversation ${i + 1}: ${error.message}`);
            }
        }
        
        return conversations;
    }

    // Replace the downloadResumeFromConversation method with this improved version:

async downloadResumeFromConversation(conversation) {
    const { name, element, index } = conversation;
    
    console.log(`\n🔍 [${index + 1}] Checking: ${name}`);
    
    try {
        // Click on the conversation
        await element.click();
        await this.page.waitForTimeout(3000);
        
        // Wait for conversation to load
        try {
            await this.page.waitForSelector('.msg-s-message-list', { timeout: 5000 });
        } catch (error) {
            console.log('   ⏳ Conversation loading slowly, continuing...');
        }
        
        // SCROLL to load all messages
        await this.page.evaluate(() => {
            const messageList = document.querySelector('.msg-s-message-list');
            if (messageList) {
                messageList.scrollTop = messageList.scrollHeight;
            }
        });
        await this.page.waitForTimeout(2000);
        
        // IMPROVED PDF DETECTION - Look for actual download buttons
        const downloadButtons = await this.page.locator('button:has-text("Download"), [data-test-file-download-button]').all();
        const pdfLinks = await this.page.locator('a[href*=".pdf"], [data-test-pdf-attachment]').all();
        
        console.log(`   📎 Found ${downloadButtons.length} download buttons and ${pdfLinks.length} PDF links`);
        
        const allElements = [...downloadButtons, ...pdfLinks];
        
        if (allElements.length === 0) {
            console.log('   📭 No downloadable attachments found');
            return false;
        }
        
        let downloadedCount = 0;
        
        for (let i = 0; i < allElements.length; i++) {
            try {
                // Get file info before downloading - SIMPLIFIED
                let fileName = `resume_${name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
                
                // Try to get actual filename
                try {
                    const elementText = await allElements[i].textContent();
                    if (elementText && elementText.includes('.pdf')) {
                        const match = elementText.match(/([^\/]+\.pdf)/i);
                        if (match) {
                            fileName = match[1];
                        }
                    }
                } catch (error) {
                    // Use default filename if extraction fails
                }
                
                // CHECK IF FILE ALREADY EXISTS
                const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
                const existingFiles = fs.readdirSync(this.downloadsDir).filter(f => 
                    f.includes(safeName) && f.endsWith('.pdf')
                );
                if (existingFiles.length > 0) {
                    console.log(`   ⏭️  File already exists: ${existingFiles[0]}`);
                    continue;
                }
                
                console.log(`   🖱️ Clicking element ${i + 1} for: ${fileName}`);
                
                // Click with better error handling
                await allElements[i].scrollIntoViewIfNeeded();
                await this.page.waitForTimeout(1000);
                await allElements[i].click({ force: true });
                await this.page.waitForTimeout(8000); // Longer wait for download
                
                // Check for new files with better detection
                const filesBefore = new Set(this.resumeState.files);
                const currentFiles = fs.readdirSync(this.downloadsDir).filter(f => f.endsWith('.pdf'));
                const newFiles = currentFiles.filter(f => !filesBefore.has(f));
                
                if (newFiles.length > 0) {
                    downloadedCount++;
                    this.resumeState.files.push(...newFiles);
                    console.log(`   ✅ Downloaded: ${newFiles[0]}`);
                    
                    // Rename file to include conversation name
                    const newPath = path.join(this.downloadsDir, newFiles[0]);
                    const renamedPath = path.join(this.downloadsDir, fileName);
                    if (fs.existsSync(newPath)) {
                        fs.renameSync(newPath, renamedPath);
                        console.log(`   📝 Renamed to: ${fileName}`);
                    }
                } else {
                    console.log(`   ⚠️  Clicked but no new file detected`);
                }
                
                // Record in state
                if (!this.resumeState.downloaded.includes(name)) {
                    this.resumeState.downloaded.push(name);
                }
                
            } catch (error) {
                console.log(`   ❌ Error clicking element ${i + 1}: ${error.message}`);
            }
        }
        
        if (downloadedCount > 0) {
            console.log(`   🎉 Downloaded ${downloadedCount} file(s) from ${name}`);
            return true;
        }
        
        return false;
        
    } catch (error) {
        console.log(`   ❌ Error processing ${name}: ${error.message}`);
        return false;
    }
}
// Add this method to check downloads folder
checkDownloadsFolder() {
    try {
        if (!fs.existsSync(this.downloadsDir)) {
            fs.ensureDirSync(this.downloadsDir);
            console.log(`   📁 Created downloads directory: ${this.downloadsDir}`);
        }
        
        const files = fs.readdirSync(this.downloadsDir).filter(f => f.endsWith('.pdf'));
        console.log(`   📁 Downloads folder currently has: ${files.length} PDF files`);
        return files;
    } catch (error) {
        console.log(`   ❌ Error checking downloads folder: ${error.message}`);
        return [];
    }
}

    async processAllConversations(conversations) {
        console.log(`\n🎯 Processing ALL ${conversations.length} conversations`);
        
        let totalDownloaded = 0;
        let processedCount = 0;
        
        // Process ALL conversations
        for (const conversation of conversations) {
            processedCount++;
            
            // Skip if already processed AND has downloaded files
            if (this.resumeState.processed.includes(conversation.name) && 
                this.resumeState.downloaded.includes(conversation.name)) {
                console.log(`\n⏭️  [${conversation.index + 1}] Skipping (already downloaded): ${conversation.name}`);
                continue;
            }
            
            const downloaded = await this.downloadResumeFromConversation(conversation);
            if (downloaded) {
                totalDownloaded++;
            }
            
            // Mark as processed (even if no download, so we don't check again)
            if (!this.resumeState.processed.includes(conversation.name)) {
                this.resumeState.processed.push(conversation.name);
            }
            
            // Save state after each conversation
            this.saveResumeState();
            
            // Brief pause between conversations
            await this.page.waitForTimeout(1500);
            
            // Show progress every 5 conversations
            if (processedCount % 5 === 0) {
                console.log(`\n📊 Progress: ${processedCount}/${conversations.length} conversations processed`);
            }
        }
        
        return totalDownloaded;
    }

    async run() {
        try {
            await this.init();
            await this.loginToLinkedIn();
            
            // Get all conversations
            const conversations = await this.getAllConversations();
            
            // Process ALL conversations
            const downloadedCount = await this.processAllConversations(conversations);
            
            // Final summary
            console.log('\n' + '='.repeat(60));
            console.log('🏁 PROCESSING COMPLETE - ALL CONVERSATIONS CHECKED');
            console.log('='.repeat(60));
            console.log(`   • Total conversations: ${conversations.length}`);
            console.log(`   • Conversations checked: ${this.resumeState.processed.length}`);
            console.log(`   • Resumes downloaded: ${downloadedCount}`);
            console.log(`   • Files in downloads folder: ${this.resumeState.files.length}`);
            
            if (this.resumeState.files.length > 0) {
                console.log('\n📥 Downloaded Files:');
                this.resumeState.files.forEach(file => {
                    console.log(`   ✅ ${file}`);
                });
            }
            
            if (downloadedCount === 0) {
                console.log('\n💡 Next Steps:');
                console.log('   • Manual check: Open conversations 10-20 to find resumes');
                console.log('   • Verify resumes are actually PDF attachments');
                console.log('   • Check if download buttons are visible');
            }
            
            this.saveResumeState();
            
        } catch (error) {
            console.log(`❌ Script failed: ${error.message}`);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const confirm = args.includes('--confirm=true');

if (confirm) {
    const downloader = new ResumeDownloader();
    downloader.run();
} else {
    console.log('❌ Please run with --confirm=true to start the download process');
    process.exit(1);
}