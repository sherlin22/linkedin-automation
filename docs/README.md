# LinkedIn Automation System

A comprehensive automation system for managing LinkedIn service requests, proposals, follow-ups, and resume processing.

## 🎯 What This Does

This system automates your entire LinkedIn service request workflow:

1. **Step 7**: Automatically sends personalized proposals to service requests
2. **Step 8**: Sends follow-up messages after proposals
3. **Step 9**: Downloads and processes candidate resumes, generates AI critiques, uploads to Google Drive, and creates Gmail drafts

## ✨ Key Features

- **Smart Name Detection**: Extracts client names from LinkedIn messages for personalization
- **Deduplication**: Prevents sending duplicate messages to the same person
- **Resume Processing**: Downloads PDFs, parses content, generates AI feedback
- **Google Integration**: Uploads to Drive, creates organized folders, generates Gmail drafts
- **State Management**: Tracks all proposals, follow-ups, and processed resumes
- **Error Recovery**: Handles failures gracefully with detailed logging

## 📋 Prerequisites

- **Node.js**: Version 16 or higher
- **Chrome/Chromium**: Required for Playwright browser automation
- **Google Account**: For Drive and Gmail integration
- **OpenAI Account**: For AI-powered resume critiques
- **LinkedIn Account**: With access to Services
# 🚀 LinkedIn Automation System - Windows Complete Guide

A complete automation system for Windows that helps you manage LinkedIn career coaching services by automatically sending proposals, follow-ups, and processing client resumes.

---

## 📋 What Does This System Do?

This automation performs **3 main tasks** automatically:

### **Step 7: Send Proposals** 💼
- Finds service requests on LinkedIn Marketplace
- Sends personalized proposals to potential clients
- Tracks who you've already contacted

### **Step 8: Send Follow-ups** 💬
- Sends reminder messages to clients who received your proposal
- Asks them to share their resume
- Only contacts people who haven't been contacted yet

### **Step 9: Process Resumes** 📄
- Downloads resumes from LinkedIn messages
- Analyzes resume quality
- Creates professional critique using AI
- Generates Gmail drafts with pricing and recommendations
- Uploads resumes to Google Drive (organized by quality)

---

## ⚡ Quick Start for Windows (10 minutes)

### **Step 1: Install Node.js (Required)**

Node.js is like an engine that runs these scripts.

1. **Go to:** https://nodejs.org/
2. **Download the LTS version** (Long Term Support)
3. **Run the installer** and follow these steps:
   - Click "Next"
   - Accept the terms → Click "I Agree"
   - Click "Next" until you see "Install"
   - Click "Install"
   - Wait for installation to complete
   - Click "Finish"

4. **Verify installation worked:**
   - Press `Windows Key + R`
   - Type: `cmd`
   - Press Enter
   - Type: `node --version`
   - You should see a version number like `v18.12.0`
   - Type: `npm --version`
   - You should see a version number like `8.19.2`

If you see version numbers ✅ - Installation successful!

---

### **Step 2: Download Automation Files**

1. **Get the files from your provider** (ZIP folder)
2. **Right-click the ZIP file**
3. **Select "Extract All..."**
4. **Choose location** like `C:\Users\YourName\Desktop\linkedin-automation`
5. **Click "Extract"**
6. **Remember this folder location!** You'll use it often.

---

### **Step 3: Install Dependencies (One-Time Setup)**

1. **Press `Windows Key + R`**
2. **Type:** `cmd`
3. **Press Enter** (opens Command Prompt)
4. **Copy and paste this command:**
   ```
   cd C:\Users\YourName\Desktop\linkedin-automation
   ```
   *(Replace "YourName" with your Windows username)*
5. **Press Enter**
6. **Now copy and paste:**
   ```
   npm install
   ```
7. **Press Enter** and wait (this takes 2-5 minutes)
8. You should see "added XXX packages"

---

### **Step 4: Set Up Google Cloud (Google Drive & Gmail)**

#### **Create Google Cloud Project:**

1. **Go to:** https://console.cloud.google.com/
2. **Sign in with your Google account**
3. **Click "Create Project"** (top left)
4. **Name it:** `LinkedIn Automation`
5. **Click "Create"** and wait 30 seconds

#### **Enable Google Sheets API:**

1. **In the search box at top**, type: `Google Sheets API`
2. **Click the first result**
3. **Click "Enable"** (blue button)
4. **Wait for it to finish** (30 seconds)

#### **Enable Google Drive API:**

1. **In the search box**, type: `Google Drive API`
2. **Click the first result**
3. **Click "Enable"**
4. **Wait for it to finish**

#### **Enable Gmail API:**

1. **In the search box**, type: `Gmail API`
2. **Click the first result**
3. **Click "Enable"**

#### **Create OAuth Credentials:**

1. **Click "Credentials"** on the left sidebar
2. **Click "Create Credentials"** (blue button at top)
3. **Select "OAuth client ID"**
4. **If prompted:** Click "Create OAuth consent screen" first
   - Select "External"
   - Click "Create"
   - Fill in:
     - App name: `LinkedIn Automation`
     - User support email: Your email
     - Developer contact: Your email
   - Click "Save and Continue"
   - Click "Add or Remove Scopes"
   - Find and add: `Google Drive API`, `Gmail API`, `Google Sheets API`
   - Click "Update"
   - Click "Save and Continue"
   - Click "Back to Dashboard"

5. **Now create OAuth Client ID:**
   - Click "Create Credentials" again
   - Select "OAuth client ID"
   - Choose "Desktop application"
   - Click "Create"

6. **Download your credentials:**
   - Click the **Download icon** (↓) next to your new credential
   - A file `client_secret_XXXXX.json` will download
   - **Save it to your automation folder**

---

### **Step 5: Create Configuration File (.env)**

1. **Open Notepad:**
   - Press `Windows Key`
   - Type `Notepad`
   - Press Enter

2. **Paste this text:**
   ```
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
   OPENAI_API_KEY=your_openai_key_here
   GOOGLE_SHEET_ID=your_sheet_id_here
   ```

3. **Get your Client ID and Secret:**
   - Go back to Google Cloud Console
   - Click on your credential (it shows a name like "Desktop client 1")
   - You'll see:
     - **Client ID** = Copy this
     - **Client Secret** = Copy this
   - Paste them in the file above

4. **Get OpenAI API Key:**
   - Go to: https://platform.openai.com/api-keys
   - Sign in (create account if needed - requires $5+ credit card)
   - Click "Create new secret key"
   - Copy it and paste in the `.env` file

5. **Save the file:**
   - Click "File" → "Save As"
   - **Filename:** `.env` (with the dot!)
   - **Location:** Your automation folder (`C:\Users\YourName\Desktop\linkedin-automation`)
   - **Important:** Change "Save as type" from "Text Documents" to "All Files"
   - Click "Save"

---

### **Step 6: Google Authentication for Windows**

1. **Open Command Prompt:**
   - Press `Windows Key + R`
   - Type: `cmd`
   - Press Enter

2. **Navigate to your folder:**
   ```
   cd C:\Users\YourName\Desktop\linkedin-automation
   ```
   Press Enter

3. **Run authentication:**
   ```
   node scripts/setup_oauth.js
   ```
   Press Enter

4. **A browser window will open** asking for Google permission
5. **Click "Allow"** or "Grant access"
6. **You'll see a success message** - Close the browser
7. **Check your automation folder** - should have new file `google_token.json` ✅

---

### **Step 7: LinkedIn Authentication**

1. **Open Firefox or Chrome**
2. **Go to:** https://www.linkedin.com/
3. **Log in** with your career coaching account
4. **Go to:** https://www.linkedin.com/service-marketplace/provider/requests/
5. **You should see proposal cards** with "Submit Proposal" buttons
6. **Keep this tab open** while running automation
7. **Don't close LinkedIn!** Scripts need it active

---

## ✅ Verify Everything Works

Before starting, test the setup:

1. **Open Command Prompt:**
   - Press `Windows Key + R`
   - Type: `cmd`
   - Press Enter

2. **Navigate to folder:**
   ```
   cd C:\Users\YourName\Desktop\linkedin-automation
   ```
   Press Enter

3. **Run verification:**
   ```
   node scripts/verify_system.js
   ```
   Press Enter

4. **Look for checkmarks (✅):**
   - ✅ google_token.json
   - ✅ .env file
   - ✅ Google credentials
   - ✅ All helpers installed

If you see ❌ instead, go back and fix that step.

---

## 🧪 Testing (Before Full Automation)

### **First Time Testing (Do This Once)**

Only need to do this the **first 2-3 times** to make sure everything works correctly.

#### **Test 1: Send Just 1 Proposal**

1. **Open Command Prompt:**
   - Press `Windows Key + R`
   - Type: `cmd`
   - Press Enter

2. **Navigate to folder:**
   ```
   cd C:\Users\YourName\Desktop\linkedin-automation
   ```
   Press Enter

3. **Run test (no actual sending):**
   ```
   node scripts/step7_submit_proposal_loop.js --max=1
   ```
   
   This shows WHAT WOULD HAPPEN without actually sending

4. **Look at output:**
   ```
   ðŸ" Found 5 request cards
   ðŸ" Would send to: John Smith
   ðŸ" Would send to: Sarah Johnson
   ```
   
   If you see this ✅ - Good! Continue to test 2

#### **Test 2: Actually Send 1 Proposal**

```
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1
```

**Check if it worked:**
1. Open LinkedIn manually
2. Check your messages
3. Did a proposal get sent to someone? ✅
4. Check `activity_logs.json` file - should show the person's name

#### **Test 3: Send 5 Follow-ups**

```
node scripts/step8_followup_message_loop.js --confirm=true --max=5
```

**Check results:**
- Check `activity_logs.json` - should show 5 follow-ups sent

#### **Test 4: Process 2 Resumes**

```
node scripts/step9_complete_resume_workflow.js --confirm=true --max=2
```

**Check results:**
- Check your Gmail drafts (should have 1-2 new drafts)
- Check Google Drive - resumes should be there
- Check `activity_logs.json` - should show downloads

#### **After Testing:**

Once you've done these 4 tests and everything worked ✅:
- You're confident the automation works
- Never need to run these commands manually again
- From now on, just use N8N (press 'O' and click)

---

## 📊 Checking Results Daily (While N8N Runs)

### **While Automation is Running:**

1. **Watch N8N Dashboard:**
   - Go to: `http://localhost:5678`
   - Press 'O'
   - See the green progress bar
   - Counts update in real-time

2. **Check Your Gmail:**
   - Go to: https://mail.google.com
   - Look in "Drafts" folder
   - New drafts appear as resumes are processed

3. **Check LinkedIn:**
   - Go to your LinkedIn messages
   - New proposal messages appear there

### **After Automation Completes:**

1. **Check `activity_logs.json`:**
   - In your automation folder
   - Right-click → Open with Notepad
   - See exactly what was sent:
     ```
     "proposals": [
       { "name": "John Smith", "status": "success" },
       { "name": "Sarah Johnson", "status": "success" }
     ]
     ```

2. **Check Google Drive:**
   - Go to: https://drive.google.com
   - Open "LinkedIn_Automation" folder
   - See all uploaded resumes organized by:
     - Readable/Unreadable
     - Date
     - Client name

3. **Check Metrics:**
   - Open `n8n_metrics.json`
   - See counts like:
     ```
     "slot1": {
       "proposals": 5,
       "followups": 3,
       "downloads": 2,
       "drafts": 2
     }
     ```

---

## 🧪 Test Mode (Before Running For Real)

**Always test first!**

### **Test 1: See what would happen (no changes)**

```
node scripts/step7_submit_proposal_loop.js --max=1
```

*(No `--confirm=true` = just shows what would happen)*

### **Test 2: Send exactly 1 proposal**

```
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1
```

**Check if it worked:**
- Look at your LinkedIn messages
- Did a proposal get sent?
- Check `activity_logs.json` file

### **Test 3: Once you're confident, send more**

```
node scripts/step7_submit_proposal_loop.js --confirm=true --max=10
```

---

## 🚨 Common Windows Problems & Solutions

### **Problem 1: "Node is not recognized"**

**What it means:** Windows can't find Node.js

**How to fix:**
1. **Restart your computer** (this fixes 80% of installation issues)
2. **After restart, test again:**
   - Press `Windows Key + R`
   - Type: `cmd`
   - Type: `node --version`
   - Should show version number

If still doesn't work:
1. **Reinstall Node.js** (go to step 1 of Quick Start)
2. **Restart computer again**

---

### **Problem 2: ".env file not recognized"**

**What it means:** Windows hid your `.env` file

**How to fix:**
1. **Show hidden files on Windows:**
   - Open File Explorer
   - Click "View" menu (at top)
   - Check the box "Hidden items"
   - Now you can see `.env` file

2. **Edit the file:**
   - Right-click `.env`
   - Select "Edit with Notepad"
   - Make changes
   - Save (Ctrl + S)

---

### **Problem 3: "OPENAI_API_KEY not configured"**

**What it means:** You forgot to add OpenAI key to `.env`

**How to fix:**
1. **Get an OpenAI key:**
   - Go to: https://platform.openai.com/api-keys
   - Sign in (need paid account with $5 minimum)
   - Create a new secret key
   - Copy it

2. **Add to `.env` file:**
   - Open `.env` with Notepad
   - Add: `OPENAI_API_KEY=your_key_here`
   - Replace `your_key_here` with actual key
   - Save

3. **Try command again**

---

### **Problem 4: "google_token.json not found"**

**What it means:** Google authentication didn't work

**How to fix:**
1. **Delete any old google_token.json:**
   - In your automation folder
   - Right-click → Delete

2. **Run authentication again:**
   ```
   node scripts/setup_oauth.js
   ```

3. **Complete all permission prompts:**
   - A browser window will open
   - Click "Allow"
   - Check ALL boxes for permissions
   - Close browser
   - Check that `google_token.json` was created

---

### **Problem 5: "LinkedIn not logged in"**

**What it means:** Automation can't access LinkedIn

**How to fix:**
1. **Keep LinkedIn open:**
   - Open Chrome or Firefox
   - Go to: https://www.linkedin.com/service-marketplace/provider/requests/
   - Log in manually
   - **Do NOT close this tab**

2. **Keep browser open while running automation:**
   - Open Command Prompt
   - Run your script
   - Automation uses the open LinkedIn session
   - Don't touch the LinkedIn tab while it's running

---

### **Problem 6: "No proposals found"**

**What it means:** No service requests available

**How to fix:**
1. **Check manually:**
   - Open LinkedIn
   - Go to: https://www.linkedin.com/service-marketplace/provider/requests/
   - Do you see "Submit Proposal" buttons?
   - If YES → Try running script again
   - If NO → No clients requested your service (try again later)

2. **Wait and retry:**
   - LinkedIn marketplace updates throughout the day
   - Try in 1-2 hours
   - Try in the morning

---

### **Problem 7: "Too many consecutive failures"**

**What it means:** Something went wrong multiple times

**How to fix:**
1. **Check internet connection:**
   - Open browser
   - Go to google.com
   - If it loads → Internet is fine
   - If not → Fix your internet first

2. **Check if LinkedIn is blocking:**
   - Log in manually to LinkedIn
   - Try clicking "Submit Proposal" yourself
   - If it works → Automation should work
   - If blocked → Wait 1-2 hours

3. **Try with fewer proposals:**
   ```
   node scripts/step7_submit_proposal_loop.js --confirm=true --max=2
   ```

4. **Look for clues:**
   - Check your automation folder
   - Look for `debug_*.png` files
   - Open them to see what went wrong
   - Send these to support person

---

### **Problem 8: "Invalid name detected - SKIPPING"**

**What it means:** System found text instead of a real person's name

**This is GOOD!** It's protecting you from mistakes.

**Examples:**
- ✅ "John Smith" - Will work
- ✅ "SURAJ NARAYAN" - Will work
- ✅ "Sarah O'Brien" - Will work
- ❌ "Resume Writing" - Will skip (it's a service, not a name)
- ❌ "For Business" - Will skip
- ❌ "Unknown" - Will skip

**No action needed** - System is working correctly!

---

### **Problem 9: "Webhook failed"**

**What it means:** Can't log results to tracking sheet

**This is OK** - Proposals still sent, but not logged

**How to fix (optional):**
1. **Start the server:**
   - Open another Command Prompt window
   - Type: `cd C:\Users\YourName\Desktop\linkedin-automation`
   - Type: `npm start`
   - You should see: `✅ Server running on http://localhost:3000`

2. **Leave this window open** while running scripts

3. **Run your script in a different Command Prompt window**

---

### **Problem 10: "Resume parsing failed"**

**What it means:** Can't read a resume file

**How to fix:**
1. **Check file format:**
   - Resume must be `.pdf` or `.docx`
   - Not `.doc`, `.txt`, or image file

2. **Check file size:**
   - Resume should be under 10 MB
   - If larger, it's probably corrupted

3. **Test the file:**
   - Try opening resume in Adobe Reader or Google Drive
   - If it won't open there → File is corrupted
   - Skip that client, try next one

4. **System will auto-skip:**
   - If one resume fails, automation tries the next one
   - No action needed

---

## 📊 Understanding What Happens

### **When you run a command, you'll see:**

```
ðŸ" Found 5 request card(s) with CTA, 3 unprocessed
ðŸ" [1/3] Checking: John Smith
   âœ" Name from timestamp pattern: John Smith
   âœ… Proposal submitted (confirm=true)
ðŸ" Metrics: Updated slot1 proposals count
```

### **What each emoji means:**

| Emoji | Meaning |
|-------|---------|
| ðŸ" | Information/checking something |
| âœ… | Success - everything worked ✅ |
| ❌ | Failed - something went wrong |
| ⚠️ | Warning - be careful |
| ðŸ'¬ | Follow-up message sent |
| ðŸ"¥ | Resume downloaded |
| âœ‰ï¸ | Email draft created |
| ðŸ"Š | Statistics/metrics |

### **How to read the output:**

1. **If you see green text with checkmarks** ✅ = Working correctly!
2. **If you see red text with X marks** ❌ = Something went wrong
3. **If yellow text with warnings** ⚠️ = Non-critical issue

---

## 📈 Checking Your Results

### **What proposals were sent?**

1. **Open File Explorer**
2. **Go to:** `C:\Users\YourName\Desktop\linkedin-automation`
3. **Find file:** `activity_logs.json`
4. **Right-click** → "Open with Notepad"
5. **Look for "proposals" section** - shows who got proposals

### **Check your statistics:**

1. **Open:** `n8n_metrics.json`
2. **You'll see counts** for each time period:
   - slot1 (8:00 AM)
   - slot2 (2:00 PM)
   - slot3 (6:00 PM)

### **View in Google Sheets (Optional):**

1. **Go to:** https://docs.google.com/spreadsheets/
2. **Create a new blank spreadsheet**
3. **Get the Sheet ID** from URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
4. **Add to `.env` file:**
   ```
   GOOGLE_SHEET_ID=SHEET_ID_HERE
   ```
5. **All activities auto-log** to this sheet

---

## 🛡️ Safety & Best Practices for Windows

### **DO:**
✅ Test with `--max=1` first
✅ Keep LinkedIn tab open
✅ Wait 2-3 hours between runs
✅ Check results after each run
✅ Use legitimate client requests only

### **DON'T:**
❌ Run 2 scripts at the same time (close other Command Prompt windows)
❌ Manually click LinkedIn while automation runs
❌ Change delay times (makes it faster but LinkedIn will block)
❌ Share your `.env` file (contains API keys)
❌ Share your `google_token.json` (contains authentication)

---

## ⏰ Time Estimates for Windows

**These are realistic times including all delays:**

| Task | # of Items | Estimated Time |
|------|-----------|------------------|
| Send proposals | 5 | 5-10 minutes |
| Send proposals | 20 | 20-40 minutes |
| Send follow-ups | 5 | 5-8 minutes |
| Process resumes | 5 | 15-25 minutes |
| Full cycle | 10 each | 1-1.5 hours |

**Why so long?**
- 2-3 second delays between each (to avoid LinkedIn blocking)
- AI analysis takes time per resume
- Gmail draft creation
- Google Drive uploads

---

## 🔄 Automating (Schedule to Run Regularly)

### **Option 1: Windows Task Scheduler (Easiest for Windows)**

1. **Press `Windows Key`**
2. **Type:** `Task Scheduler`
3. **Press Enter**
4. **Click "Create Basic Task"** (right side)
5. **Fill in:**
   - Name: `LinkedIn Proposals 8am`
   - Description: `Sends LinkedIn proposals`
   - Click "Next"

6. **Trigger:**
   - Select "Daily"
   - Time: 8:00 AM
   - Click "Next"

7. **Action:**
   - Select "Start a program"
   - Program: `C:\Program Files\nodejs\node.exe` (or wherever Node installed)
   - Arguments: `scripts/step7_submit_proposal_loop.js --confirm=true --max=10`
   - Start in: `C:\Users\YourName\Desktop\linkedin-automation`
   - Click "Next"

8. **Click "Finish"**
9. **Do the same for Step 8** (2:00 PM)
10. **Do the same for Step 9** (6:00 PM)

**Now it runs automatically at 8am, 2pm, and 6pm!**

### **Option 2: Manual Scheduled Reminders**

1. **Set phone alarms** for 8am, 2pm, 6pm
2. **When alarm goes off:**
   - Open Command Prompt
   - Run the script
   - Wait for completion
   - Check results

---

## ❓ Frequently Asked Questions

### **Q: Can I run multiple scripts at the same time?**
**A:** NO! Always close other Command Prompt windows. Only one script at a time.

### **Q: Do I need to stay at my computer?**
**A:** No, once started you can do other work. But keep LinkedIn tab open.

### **Q: What if my computer goes to sleep?**
**A:** Script stops. Keep computer awake during execution. (Settings → Power → Never sleep)

### **Q: Can I edit the proposal message?**
**A:** Yes! Open `step7_submit_proposal_loop.js` with Notepad, find `MSG_TEMPLATE`, edit the text.

### **Q: Where are downloaded resumes?**
**A:** In your automation folder under `downloads/resumes/` (also uploaded to Google Drive)

### **Q: What if I close Command Prompt by mistake?**
**A:** Script stops. Just run it again. Nothing is lost.

### **Q: Can I use this on Mac?**
**A:** Yes! But the instructions above are Windows-specific. Commands are the same, just paths differ.

### **Q: How much internet do I need?**
**A:** Very little. Just stable connection. No large files uploaded except resumes.

---

## 📁 Important Files (Don't Delete)

| File/Folder | Purpose | Keep Private? |
|------------|---------|---------------|
| `.env` | Your API keys | 🔒 YES |
| `google_token.json` | Google login | 🔒 YES |
| `auth_state.json` | LinkedIn session | 🔒 YES |
| `scripts/` folder | Automation scripts | ✅ OK to share |
| `activity_logs.json` | History of messages | ✅ OK to view |
| `n8n_metrics.json` | Statistics | ✅ OK to share |
| `downloads/` folder | Saved resumes | ✅ OK to view |
| `debug_*.png` files | Error screenshots | ✅ Safe to delete |

---

## 🚀 Quick Reference for Windows

### **Setup (One time):**
```
1. Install Node.js
2. Extract files
3. cd C:\Users\YourName\Desktop\linkedin-automation
4. npm install
5. Create .env file with API keys
6. node scripts/setup_oauth.js
7. Keep LinkedIn tab open
```

### **Daily Use (Copy & Paste):**
```
cd C:\Users\YourName\Desktop\linkedin-automation
node scripts/step7_submit_proposal_loop.js --confirm=true --max=5
node scripts/step8_followup_message_loop.js --confirm=true --max=5
node scripts/step9_complete_resume_workflow.js --confirm=true --max=5
```

### **Test First:**
```
node scripts/step7_submit_proposal_loop.js --max=1
```

### **Check Results:**
- Open `activity_logs.json` in Notepad
- Check LinkedIn for sent messages
- Check `n8n_metrics.json` for stats

---

## 📞 Getting Help

**Before contacting support, collect:**

1. **Screenshot of the error**
2. **Run this and share output:**
   ```
   node scripts/verify_system.js
   ```
3. **Check for `debug_*.png` files** (share these)
4. **Check `activity_logs.json`** for context

**Common answers:**
- ❌ "X is not recognized" → Restart computer
- ❌ "Cannot find module" → Run `npm install` again
- ❌ "LinkedIn blocked" → Wait 2 hours
- ⚠️ "Webhook failed" → Non-critical, still works

---

## ✨ You're Ready!

**Summary of what you now have:**

✅ A Windows automation system
✅ LinkedIn proposal automation
✅ Follow-up message system
✅ Resume download & analysis
✅ AI-powered critiques
✅ Gmail draft creation
✅ Google Drive organization

**Next steps:**
1. Complete the Quick Start steps
2. Run verification: `node scripts/verify_system.js`
3. Test with 1 proposal: `node scripts/step7_submit_proposal_loop.js --confirm=true --max=1`
4. Monitor results in `activity_logs.json`
5. Gradually increase to 10+ proposals once comfortable

---


## ⚠️ Disclaimer

This tool automates LinkedIn interactions. Use responsibly and in accordance with LinkedIn's Terms of Service. The authors are not responsible for any account restrictions or violations that may result from use of this tool.

---

**Last Updated**: December 2026 
**Version**: 2.0  
**Maintainer**: Rashmi Sherlin