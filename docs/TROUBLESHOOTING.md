# 🔧 Troubleshooting Guide

Complete troubleshooting guide for common issues in the LinkedIn automation system.

---

## 📋 Quick Diagnostics

### **Run This First:**

Before anything else, run the verification script:

```bash
node scripts/verify_system.js
```

**You should see:**
```
✅ google_token.json
✅ auth_state.json
✅ .env file
✅ All helpers loaded
✅ Dependencies installed
```

If you see ❌, the output will tell you exactly what's wrong.

---

## 🆘 Problem Categories

Choose the category matching your issue:

1. **[Startup Issues](#1-startup-issues)** - Can't start the system
2. **[Server Issues](#2-server-issues)** - Server won't run
3. **[N8N Issues](#3-n8n-issues)** - Workflow problems
4. **[LinkedIn Issues](#4-linkedin-issues)** - LinkedIn blocking/errors
5. **[Google Issues](#5-google-issues)** - Authentication/Drive/Sheets
6. **[Script Issues](#6-script-issues)** - Scripts failing
7. **[Data Issues](#7-data-issues)** - Logs/metrics problems
8. **[Performance Issues](#8-performance-issues)** - Running slowly
9. **[Windows-Specific Issues](#9-windows-specific-issues)** - Windows only

---

## 1. Startup Issues

### **Problem: "Node is not recognized"**

**Symptoms:**
```
'node' is not recognized as an internal or external command
```

**Causes:**
- Node.js not installed
- Node.js not in Windows PATH
- Need to restart after installation

**Solutions:**

**Fix 1: Restart Windows (fixes 80% of cases)**
1. Save all work
2. Restart your computer
3. Try command again:
   ```bash
   node --version
   ```

**Fix 2: Reinstall Node.js**
1. Go to: https://nodejs.org/
2. Download LTS version
3. Run installer
4. Check "Add to PATH" during installation
5. Restart Windows
6. Test: `node --version`

**Fix 3: Manual PATH Setup**
1. Press `Windows Key`
2. Type: `Environment Variables`
3. Click "Edit the system environment variables"
4. Click "Environment Variables"
5. Under "System variables", find "Path"
6. Click "Edit"
7. Click "New"
8. Add: `C:\Program Files\nodejs\`
9. Click OK, OK, OK
10. Restart Windows
11. Test: `node --version`

**Verify:**
```bash
# Should show version like v18.12.0
node --version

# Should show version like 8.19.2
npm --version
```

---

### **Problem: "npm install fails"**

**Symptoms:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Causes:**
- Wrong Node.js version
- Corrupted node_modules
- Network issues
- Incompatible packages

**Solutions:**

**Fix 1: Clear cache and reinstall**
```bash
npm cache clean --force
rm -r node_modules
rm package-lock.json
npm install
```

**Fix 2: Use legacy peer deps (last resort)**
```bash
npm install --legacy-peer-deps
```

**Fix 3: Use different Node.js version**
```bash
# Check your version
node --version

# If version < 14, upgrade to LTS
# If version > 18, downgrade to 16 or 18
```

**Verify:**
```bash
npm list
# Should show all packages loaded successfully
```

---

### **Problem: "Cannot find module X"**

**Symptoms:**
```
Error: Cannot find module 'playwright'
Error: Cannot find module 'googleapis'
```

**Causes:**
- npm install didn't complete
- node_modules deleted
- Wrong folder location

**Solutions:**

**Fix 1: Reinstall dependencies**
```bash
# Navigate to correct folder
cd C:\Users\YourName\Desktop\linkedin-automation

# Clean install
rm -r node_modules
npm install
```

**Fix 2: Check folder location**
```bash
# Verify you're in right folder
pwd
# Should show: C:\Users\YourName\Desktop\linkedin-automation

# If wrong folder, navigate to correct one
cd C:\Users\YourName\Desktop\linkedin-automation
```

**Verify:**
```bash
npm list | grep playwright
npm list | grep googleapis
# Should show version numbers
```

---

## 2. Server Issues

### **Problem: "npm start fails"**

**Symptoms:**
```
Error: Cannot find module 'express'
Port 3000 already in use
EADDRINUSE: address already in use :::3000
```

**Causes:**
- npm install not complete
- Port 3000 already in use
- Another process using the port

**Solutions:**

**Fix 1: Complete npm install**
```bash
npm install
npm start
```

**Fix 2: Kill process on port 3000**

**Windows:**
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual number)
taskkill /PID 1234 /F

# Now try again
npm start
```

**Mac/Linux:**
```bash
lsof -i :3000
kill -9 <PID>
npm start
```

**Fix 3: Use different port**
```bash
npm start -- --port 3001
```

**Verify:**
```bash
# You should see:
✅ Server running on http://localhost:3000
🚀 Webhook Endpoints:
   POST /api/automation/proposal-submitted
```

---

### **Problem: Server starts but can't access it**

**Symptoms:**
```
Server running on http://localhost:3000
But browser shows: "Cannot reach server"
```

**Causes:**
- Firewall blocking
- Browser cache
- Wrong URL
- Server crashed silently

**Solutions:**

**Fix 1: Check URL**
```
Correct: http://localhost:3000
Wrong: http://localhost:3001
Wrong: http://127.0.0.1:3000 (sometimes works, but use localhost)
```

**Fix 2: Clear browser cache**
1. Press `Ctrl + Shift + Delete`
2. Check "Cookies and other site data"
3. Click "Clear data"
4. Reload page

**Fix 3: Disable firewall temporarily**
1. Press `Windows Key`
2. Type: "Firewall"
3. Click "Windows Defender Firewall"
4. Click "Turn Windows Defender Firewall on or off"
5. Turn OFF temporarily
6. Try accessing server
7. If works, add exception:
   - Click "Allow an app through firewall"
   - Add Node.js

**Fix 4: Check server didn't crash**
1. Look at Terminal 1
2. Do you see errors?
3. If yes, read the error message
4. Try `npm start` again

**Verify:**
```bash
curl http://localhost:3000/health
# Should return: {"status":"OK","sheetsConnected":true/false}
```

---

### **Problem: "Server runs but endpoints not working"**

**Symptoms:**
```
Server running, but POST requests fail
{"error":"Route not found"}
```

**Causes:**
- Server crashed after starting
- Old server still running on port
- server.js has errors

**Solutions:**

**Fix 1: Check for errors in terminal**
1. Look at Terminal 1
2. Do you see red text/errors?
3. If yes, copy the error message
4. Search the troubleshooting guide

**Fix 2: Kill old server and restart**
```bash
# Kill any existing process
netstat -ano | findstr :3000
taskkill /PID <number> /F

# Start fresh
npm start
```

**Fix 3: Check server.js syntax**
```bash
# Run just the server validation
node -c scripts/server.js
# Should return: (no errors = syntax OK)
```

**Verify:**
```bash
curl -X POST http://localhost:3000/api/automation/proposal-submitted \
  -H "Content-Type: application/json" \
  -d '{"clientName":"John Smith"}'

# Should return: {"success":true}
```

---

## 3. N8N Issues

### **Problem: "n8n start fails"**

**Symptoms:**
```
Error: Cannot start N8N
Port 5678 already in use
N8N won't initialize
```

**Causes:**
- Another N8N already running
- Port 5678 in use
- Database locked
- Corrupted N8N config

**Solutions:**

**Fix 1: Kill existing N8N process**
```bash
# Find process on port 5678
netstat -ano | findstr :5678

# Kill it
taskkill /PID <number> /F

# Try again
n8n start
```

**Fix 2: Clear N8N cache**
```bash
# Stop N8N first (Ctrl + C in terminal)
# Then:
rm -r ~/.n8n
n8n start
```

**Fix 3: Use different port**
```bash
n8n start --port 5679

# Then access at: http://localhost:5679
```

**Fix 4: Full reinstall N8N**
```bash
npm uninstall -g n8n
npm install -g n8n
n8n start
```

**Verify:**
```bash
# In browser, go to: http://localhost:5678
# You should see N8N dashboard
```

---

### **Problem: "N8N runs but workflows don't execute"**

**Symptoms:**
```
N8N running, workflows exist
But they don't run at scheduled time
Manual execution works
```

**Causes:**
- Workflow disabled
- CRON schedule wrong
- N8N paused
- License issue

**Solutions:**

**Fix 1: Enable workflow**
1. Go to: http://localhost:5678
2. Click workflow name
3. Look for toggle/switch (top right)
4. Make sure it's ON (blue)
5. Click "Save"

**Fix 2: Check CRON schedule**
1. Click workflow
2. Click CRON trigger node
3. Check the schedule:
   - `0 8 * * *` = 8:00 AM ✅
   - `0 14 * * *` = 2:00 PM ✅
   - `0 18 * * *` = 6:00 PM ✅
4. If wrong, edit and save

**Fix 3: Check N8N isn't paused**
1. In N8N dashboard top right
2. Look for "Pause/Resume" button
3. Make sure it's in "Resume" mode

**Fix 4: Manually trigger to test**
1. Go to: http://localhost:5678
2. Click workflow
3. Click "Execute Workflow" button
4. If it works manually, scheduler needs attention
5. Check that server time matches your time zone

**Verify:**
```bash
# Check N8N is running
curl http://localhost:5678

# Check server time
date

# Make sure your computer time is correct
```

---

### **Problem: "Workflow executes but nothing happens"**

**Symptoms:**
```
Workflow shows as successful
But no proposals sent, no logs created
```

**Causes:**
- Step 7/8/9 scripts not executing
- LinkedIn session expired
- Scripts have errors
- Working directory wrong

**Solutions:**

**Fix 1: Check script execution**
1. Click workflow
2. Click Step 7 node
3. Check the command field
4. Does it have the full path?
5. Should be: `node scripts/step7_submit_proposal_loop.js ...`

**Fix 2: Test script manually**
```bash
# Stop N8N first (Ctrl + C)
# Test Step 7
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1

# If this fails, N8N won't work either
# Fix the script error first
```

**Fix 3: Check working directory**
1. Click Step 7 node
2. Check if "Working directory" is set
3. Should be: `C:\Users\YourName\Desktop\linkedin-automation`

**Fix 4: Check environment variables**
1. Click Step 7 node
2. Check if environment variables are passed
3. Should include auth_state.json path

**Verify:**
```bash
# Check if script works standalone
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1

# Check if logs were created
ls -la activity_logs.json

# Check if metrics updated
cat n8n_metrics.json
```

---

### **Problem: "Can't access N8N dashboard"**

**Symptoms:**
```
http://localhost:5678 shows: "Cannot reach this site"
Connection refused
```

**Causes:**
- N8N not running
- Port 5678 blocked
- Browser issue
- N8N crashed

**Solutions:**

**Fix 1: Check if N8N is running**
1. Look at Terminal 2
2. Do you see "N8N ready"?
3. If not, run: `n8n start`

**Fix 2: Check port**
```bash
netstat -ano | findstr :5678
# Should show N8N process
# If nothing, N8N not running
```

**Fix 3: Check for errors in terminal**
1. Look at Terminal 2
2. Do you see error messages?
3. Copy and search the guide

**Fix 4: Clear browser cache**
1. Press `Ctrl + Shift + Delete`
2. Click "All time"
3. Check "Cookies" and "Cache"
4. Click "Clear data"
5. Try again

**Verify:**
```bash
# N8N health check
curl http://localhost:5678

# If returns HTML, N8N is running
```

---

## 4. LinkedIn Issues

### **Problem: "LinkedIn not logged in / No service requests"**

**Symptoms:**
```
Script runs but says: "No proposals found"
No "Submit Proposal" buttons visible
```

**Causes:**
- LinkedIn session expired
- Not logged into correct account
- No clients requesting service
- LinkedIn IP blocked
- Browser cookies cleared

**Solutions:**

**Fix 1: Manual login**
1. Open Firefox or Chrome
2. Go to: https://www.linkedin.com/
3. Click "Sign in"
4. Enter your career coaching account email
5. Enter password
6. Complete 2FA if needed
7. You should be logged in

**Fix 2: Go to Service Marketplace**
1. After login, go to: https://www.linkedin.com/service-marketplace/provider/requests/
2. Do you see any "Submit Proposal" buttons?
3. If YES → Script should work
4. If NO → No clients requesting right now

**Fix 3: Clear LinkedIn cookies**
1. Go to LinkedIn
2. Press `Ctrl + Shift + Delete`
3. Select "Cookies and other site data"
4. Check only "linkedin.com"
5. Click "Clear"
6. Log in again

**Fix 4: Check if LinkedIn blocked you**
1. Try clicking "Submit Proposal" manually on LinkedIn
2. If you get error → LinkedIn blocked you
3. Wait 2-3 hours before trying again
4. After waiting, close and reopen browser
5. Log back in

**Fix 5: Use incognito/private window**
1. Open new incognito window (Ctrl + Shift + N)
2. Go to LinkedIn
3. Log in
4. If this works → Clear cache in normal window

**Verify:**
```bash
# Try script with max=1 to test
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1

# If it works, you're good
# If fails, check the error message
```

---

### **Problem: "LinkedIn says I sent too many requests"**

**Symptoms:**
```
Error: "Too many requests"
Error: "You've exceeded the rate limit"
LinkedIn temporarily blocked
```

**Causes:**
- Ran script too frequently
- Too many proposals sent
- Changed delay times (made them shorter)
- Multiple sessions sending requests

**Solutions:**

**Fix 1: Wait for block to expire**
- LinkedIn blocks for **2-3 hours typically**
- Don't run script during this time
- Wait, then try again
- Blocks usually expire after a few hours

**Fix 2: Don't run script multiple times per hour**
- Each script run waits 2-3 seconds between requests
- For 20 proposals: takes ~40-60 minutes
- Don't run another script while one is running
- Space out runs at least 2 hours apart

**Fix 3: Reduce proposal count**
Instead of `--max=20`, use `--max=5`:
```bash
node scripts/step7_submit_proposal_loop.js --confirm=true --max=5
```

**Fix 4: Check you didn't change delays**
Scripts have built-in delays to avoid blocking:
- ❌ DON'T edit code to remove delays
- ❌ DON'T add `--slowMo=0`
- ✅ Keep default delays (2-3 seconds)

**Fix 5: Don't run multiple terminals**
- Only run ONE script at a time
- Close other command prompt windows
- Only use ONE N8N workflow per time slot

**Prevent Future Blocks:**
- ✅ Run once per slot (8am, 2pm, 6pm)
- ✅ Don't run manually between scheduled times
- ✅ Keep delays at default (don't speed up)
- ✅ Check script output before running again
- ✅ Monitor `activity_logs.json`

**Verify:**
```bash
# After 2-3 hour wait:
# Try manually:
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1

# Should work if block expired
```

---

### **Problem: "LinkedIn UI changed / Script fails"**

**Symptoms:**
```
Script was working, now returns:
"Button not found"
"Cannot click element"
"Timeout waiting for selector"
```

**Causes:**
- LinkedIn redesigned interface
- HTML structure changed
- Selectors don't match anymore
- LinkedIn rolled out A/B test

**Solutions:**

**Fix 1: Check if it's widespread**
1. Try manually on LinkedIn
2. Can you click "Submit Proposal" button yourself?
3. If YES → UI is same, script has bug
4. If NO → LinkedIn changed UI

**Fix 2: Run with screenshot debugging**
```bash
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1

# Look for debug_*.png files
# These show what the screen looked like
# Open them to see if UI changed
```

**Fix 3: Report to developer**
1. Collect debug files: `debug_*.png`
2. Note when it started failing
3. Take screenshots of current LinkedIn
4. Send to developer to update selectors

**Fix 4: Temporary workaround**
1. Do proposals manually on LinkedIn
2. Log them via API:
   ```bash
   curl -X POST http://localhost:3000/api/automation/proposal-submitted \
     -H "Content-Type: application/json" \
     -d '{"clientName":"John Smith"}'
   ```
3. Continue until script updated

---

## 5. Google Issues

### **Problem: "google_token.json not found"**

**Symptoms:**
```
Error: Cannot read property of undefined
Error: google_token.json not found
Google authentication failed
```

**Causes:**
- setup_oauth.js never run
- File deleted
- Saved in wrong location
- Token expired

**Solutions:**

**Fix 1: Run OAuth setup**
```bash
node scripts/setup_oauth.js

# A browser window will open
# Click "Allow" or "Grant access"
# Complete all permission prompts
# Wait for success message
# Check that google_token.json was created
```

**Fix 2: Check file exists**
```bash
# Windows: Show hidden files
# File Explorer → View → Check "Hidden items"
# Look for google_token.json in your automation folder

# If not there, run setup_oauth.js again
```

**Fix 3: File in wrong location**
```bash
# Correct location:
C:\Users\YourName\Desktop\linkedin-automation\google_token.json

# If in wrong location, move it to correct folder
```

**Fix 4: Token expired**
```bash
# If file exists but errors happen:
# Delete it:
del google_token.json

# Rerun setup:
node scripts/setup_oauth.js
```

**Verify:**
```bash
# Check file exists
dir google_token.json

# Should show:
#  Volume in drive C is Windows
#  Directory of C:\Users\...\linkedin-automation
#  google_token.json
```

---

### **Problem: ".env file missing or not found"**

**Symptoms:**
```
Error: GOOGLE_CLIENT_ID not configured
Error: OPENAI_API_KEY not configured
All env variables missing
```

**Causes:**
- .env file never created
- File has wrong name
- In wrong location
- Hidden/not visible

**Solutions:**

**Fix 1: Create .env file**
1. Open Notepad
2. Paste this:
   ```
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
   OPENAI_API_KEY=your_openai_key_here
   GOOGLE_SHEET_ID=your_sheet_id_here
   ```
3. File → Save As
4. **Filename:** `.env` (with the dot!)
5. **Location:** `C:\Users\YourName\Desktop\linkedin-automation`
6. **Save as type:** "All Files (*.*)" (not Text Documents!)
7. Click "Save"

**Fix 2: Show hidden files to see it**
1. Open File Explorer
2. Click "View" menu
3. Check "Hidden items"
4. Now you can see `.env`

**Fix 3: Check file name**
- ❌ Wrong: `env` (no dot)
- ❌ Wrong: `env.txt`
- ✅ Correct: `.env`

**Fix 4: Edit existing .env**
1. Right-click `.env`
2. Select "Open with Notepad"
3. Add missing variables
4. Save (Ctrl + S)
5. Restart terminal

**Verify:**
```bash
# Check file exists
type .env

# Should show contents:
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...
# etc
```

---

### **Problem: "OPENAI_API_KEY not valid"**

**Symptoms:**
```
Error: Invalid API key
Error: 401 Unauthorized
OpenAI API request failed
```

**Causes:**
- API key wrong format
- API key expired
- Account has no credits
- Wrong key pasted

**Solutions:**

**Fix 1: Get valid API key**
1. Go to: https://platform.openai.com/api-keys
2. Sign in (create account if needed)
3. Add payment method ($5+ credit card required)
4. Click "Create new secret key"
5. **Copy immediately** (you won't see it again!)
6. Add to `.env`: `OPENAI_API_KEY=sk-...`

**Fix 2: Check key format**
- Should start with: `sk-`
- Should be ~50 characters long
- No spaces before/after

**Fix 3: Check account has credits**
1. Go to: https://platform.openai.com/account/billing/overview
2. Check "Credits" or "Billing"
3. If $0.00 balance, add payment method
4. Add at least $5 credit

**Fix 4: Regenerate key**
1. If old key doesn't work:
2. Go to: https://platform.openai.com/api-keys
3. Delete old key
4. Click "Create new secret key"
5. Copy new key
6. Update `.env`

**Verify:**
```bash
# Test with Step 9 (uses OpenAI)
node scripts/step9_complete_resume_workflow.js --confirm=true --max=1

# Should work if key is valid
```

---

### **Problem: "Cannot write to Google Sheets"**

**Symptoms:**
```
Webhook failed
Data not logged to Sheets
Error connecting to Sheets
```

**Causes:**
- Server not running
- Google Sheets not configured
- GOOGLE_SHEET_ID wrong
- No write permissions
- Sheet is read-only

**Solutions:**

**Fix 1: Start server first**
```bash
# Terminal 1:
npm start

# Wait for: ✅ Server running on http://localhost:3000

# Then run scripts in Terminal 2
```

**Fix 2: Configure GOOGLE_SHEET_ID**
1. Go to: https://docs.google.com/spreadsheets/
2. Create new blank spreadsheet
3. In the URL, find the ID:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
                                        ^^^^^^^^^^^^^^^^^
   ```
4. Copy that ID
5. Add to `.env`: `GOOGLE_SHEET_ID=SHEET_ID_HERE`
6. Save `.env`

**Fix 3: Check Sheet permissions**
1. Open your Google Sheet
2. Click "Share" (top right)
3. Make sure it's shared with your Google account
4. Don't restrict access

**Fix 4: Grant permissions to Gmail API**
1. Google Cloud Console
2. Click "APIs & Services"
3. Search "Gmail API"
4. Click "Enable"
5. Run: `node scripts/setup_oauth.js` again
6. Grant Gmail permissions

**Fix 5: Data still logs locally**
- Even if Sheets fails, data saves to:
  - `activity_logs.json` (always works)
  - `n8n_metrics.json` (always works)
- Sheets is optional for tracking
- System works fine without it

**Verify:**
```bash
# Check server is running
curl http://localhost:3000/health

# Should show: {"status":"OK","sheetsConnected":true/false}

# Check Sheets connection
curl http://localhost:3000/api/sheets/status

# Should return sheet info
```

---

## 6. Script Issues

### **Problem: "Step 7/8/9 scripts fail or timeout"**

**Symptoms:**
```
Script runs but stops halfway
Timeout waiting for selector
Button not found
Page didn't load
```

**Causes:**
- LinkedIn taking too long to load
- Network too slow
- Browser closed
- Session expired
- Too many scripts running

**Solutions:**

**Fix 1: Increase timeout**
1. Edit the script file
2. Find: `page.setDefaultTimeout(60000)`
3. Change to: `page.setDefaultTimeout(120000)` (2 minutes)
4. Save and try again

**Fix 2: Keep LinkedIn browser open**
1. Open Chrome or Firefox
2. Go to: https://www.linkedin.com/service-marketplace/provider/requests/
3. Log in
4. **Keep this tab open**
5. Run script in command prompt
6. Script uses this open session

**Fix 3: Check internet speed**
1. Open: https://www.speedtest.net/
2. Test your internet
3. Need at least 5 Mbps
4. If slower, wait for better connection

**Fix 4: Run with fewer proposals**
```bash
# Instead of:
node scripts/step7_submit_proposal_loop.js --confirm=true --max=20

# Try:
node scripts/step7_submit_proposal_loop.js --confirm=true --max=5
```

**Fix 5: Check if LinkedIn blocked you**
1. Log into LinkedIn manually
2. Try clicking "Submit Proposal" yourself
3. If error → LinkedIn blocked you
4. Wait 2 hours, try again

**Verify:**
```bash
# Try with very small batch
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1

# If this works, issue is handling large batches
# Run smaller batches more frequently
```

---

### **Problem: "Resume download fails"**

**Symptoms:**
```
Error downloading file
Download timeout
Resume file corrupted
Cannot save file
```

**Causes:**
- LinkedIn blocked downloads
- File too large
- Disk space full
- Permissions issue
- File type not supported

**Solutions:**

**Fix 1: Check disk space**
```bash
# Check available space
disk usage

# Need at least 1 GB free
# If full, delete old resumes or other files
```

**Fix 2: Check folder permissions**
1. Right-click `downloads` folder
2. Properties → Security
3. Check "Full Control" is enabled
4. Click "Apply"

**Fix 3: Check file type**
- System downloads: `.pdf` and `.docx`
- ❌ Skips: `.doc`, `.txt`, image files
- Uploaded resume might be wrong type
- Ask client to upload as PDF

**Fix 4: File too large**
- Resumes should be < 5 MB
- If larger, system skips it
- Corruption likely
- Ask client to re-upload

**Fix 5: Check downloads folder exists**
```bash
# Should exist:
C:\Users\YourName\Desktop\linkedin-automation\downloads\resumes\

# If not, create it:
mkdir downloads
mkdir downloads\resumes
```

**Verify:**
```bash
# Run Step 9 and check for downloaded files
node scripts/step9_complete_resume_workflow.js --confirm=true --max=1

# Check if files exist:
dir downloads\resumes\
```

---

## 7. Data Issues

### **Problem: "activity_logs.json file is empty or missing"**

**Symptoms:**
```
No activity_logs.json file
File exists but empty: []
No proposals logged
```

**Causes:**
- File never created
- Script errors before logging
- Permissions issue
- Wrong location

**Solutions:**

**Fix 1: Check file location**
```bash
# Should be here:
C:\Users\YourName\Desktop\linkedin-automation\activity_logs.json

# Check if exists:
dir activity_logs.json

# If not found, run script first (creates file automatically)
```

**Fix 2: Create file manually**
```bash
# If missing, create it:
# Open Notepad, paste:
{
  "proposals": [],
  "followups": [],
  "downloads": [],
  "drafts": []
}

# Save as: activity_logs.json
# Location: C:\Users\YourName\Desktop\linkedin-automation\
```

**Fix 3: Check file permissions**
1. Right-click `activity_logs.json`
2. Properties
3. Security tab
4. Click "Edit"
5. Select your user
6. Check "Full Control"
7. Click "Apply"

**Fix 4: Run script to populate**
```bash
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1

# After this, activity_logs.json should have data
```

**Verify:**
```bash
# Check file exists and has data
type activity_logs.json

# Should show something like:
# {
#   "proposals": [
#     { "name": "John Smith", ... }
#   ],
#   ...
# }
```

---

### **Problem: "n8n_metrics.json shows all zeros"**

**Symptoms:**
```
n8n_metrics.json exists
But all counts are 0
Metrics not updating
```

**Causes:**
- Workflows running but not logging
- Server not running
- Logging endpoint failing
- updateMetric not called

**Solutions:**

**Fix 1: Make sure server is running**
```bash
# Terminal 1 should show:
npm start
# ✅ Server running on http://localhost:3000

# If not, start it
npm start
```

**Fix 2: Run script and check logs**
```bash
# Run a script
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1

# Check if metrics updated
type n8n_metrics.json

# Should show counts > 0
```

**Fix 3: Check logging isn't disabled**
1. Open the script file
2. Search for: `updateMetric`
3. Make sure it's not commented out
4. If you see: `// updateMetric(...)` remove the `//`

**Fix 4: Manually test logging**
```bash
node scripts/n8n-metrics-logger.js --slot=slot1 --metric=proposals --value=1

# Check if metrics.json updated:
type n8n_metrics.json

# slot1 proposals should now be 1
```

**Verify:**
```bash
# After running a script, check:
type n8n_metrics.json

# Should show counts > 0
# Example:
# "slot1": { "proposals": 5, "followups": 3, ... }
```

---

### **Problem: "Debug files (debug_*.png) not created"**

**Symptoms:**
```
Script fails but no debug_*.png files
Can't see what went wrong
No screenshots saved
```

**Causes:**
- Debug logging disabled
- Permissions issue
- Headful mode false (headless browser)

**Solutions:**

**Fix 1: Run in headful mode**
```bash
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1 --headful=true

# headful=true shows browser window
# headful=false runs in background (headless)
# Need headful=true for debugging
```

**Fix 2: Check permissions**
1. Your automation folder should be writable
2. Right-click folder → Properties → Security
3. Check "Full Control"
4. Click "Apply"

**Fix 3: Check for debug files in right place**
```bash
# They save in main folder:
C:\Users\YourName\Desktop\linkedin-automation\debug_*.png

# Not in scripts folder
# Not in downloads folder

# Search for them:
dir debug_*.png
```

**Verify:**
```bash
# Run with errors to create debug files:
node scripts/step7_submit_proposal_loop.js --confirm=true --max=1 --headful=true

# Check for files:
dir debug_*.png

# Should show files like:
# debug_filled_proposal_success_1705484330000.png
```

---

## 8. Performance Issues

### **Problem: "Scripts run very slowly"**

**Symptoms:**
```
1 proposal takes 10+ minutes
Process seems to hang
System very sluggish
```

**Causes:**
- Deliberate delays (by design)
- Slow internet
- Computer overloaded
- LinkedIn API slow
- Too many browser tabs open

**Solutions:**

**Fix 1: Understand the delays (by design)**
- 2-3 second delay between proposals ✅ REQUIRED
- 1-2 second delay between follow-ups ✅ REQUIRED
- These prevent LinkedIn blocking
- ❌ DON'T remove delays
- ❌ DON'T use `--slowMo=0`

**For 10 proposals:**
- Expected time: 5-15 minutes ✅ NORMAL
- Don't interrupt or close terminal

**Fix 2: Close other applications**
1. Close Chrome/Firefox (except LinkedIn tab)
2. Close Spotify, Discord, etc
3. Close File Explorer windows
4. Close other programs
5. Frees up RAM and CPU

**Fix 3: Restart computer**
1. Save work
2. Restart Windows
3. Wait 2 minutes after startup
4. Then run script
5. Often fixes slowness

**Fix 4: Check internet speed**
1. Go to: https://www.speedtest.net/
2. Need at least 10 Mbps
3. If slower, wait for better connection
4. Can't speed up script on slow internet

**Fix 5: Use smaller batches**
```bash
# Instead of:
node scripts/step7_submit_proposal_loop.js --confirm=true --max=20

# Use:
node scripts/step7_submit_proposal_loop.js --confirm=true --max=5

# Run multiple times with breaks
```

**Verify:**
```bash
# Check process is still running:
# Look at Terminal - should show messages updating
# Don't close terminal if it seems slow
# Let it run to completion (can take 30+ minutes for large batches)
```

---

### **Problem: "System running out of memory"**

**Symptoms:**
```
System very slow
Chrome using 2GB+ RAM
Computer freezes
Hard drive light stuck on
```

**Causes:**
- Too many browser tabs
- Memory leak in script
- Computer low RAM overall
- Running too many processes

**Solutions:**

**Fix 1: Close unnecessary programs**
```bash
# Close:
- Chrome/Firefox (except LinkedIn)
- Spotify
- Discord
- Games
- Large applications
```

**Fix 2: Close browser tabs**
1. In Chrome/Firefox, close all tabs except:
   - LinkedIn (https://www.linkedin.com/...)
2. Close other websites
3. Frees up 1GB+ RAM

**Fix 3: Restart browser**
1. Close all browser windows
2. Wait 30 seconds
3. Reopen browser
4. Only open LinkedIn tab
5. Run script

**Fix 4: Restart computer**
1. Save all work
2. Restart Windows
3. Wait 2 minutes
4. Then run script

**Fix 5: Run smaller batches**
```bash
# Instead of max=20, use max=5
node scripts/step7_submit_proposal_loop.js --confirm=true --max=5
```

---

## 9. Windows-Specific Issues

### **Problem: "PowerShell/Command Prompt not recognizing commands"**

**Symptoms:**
```
'npm' is not recognized
'node' is not recognized
'git' is not recognized
```

**Causes:**
- PATH not updated
- Need to restart after install
- Using wrong terminal type

**Solutions:**

**Fix 1: Restart Windows**
- This fixes 80% of path issues
- Restart → try command again

**Fix 2: Use Command Prompt, not PowerShell**
- ❌ PowerShell sometimes doesn't recognize commands
- ✅ Use "Command Prompt" (cmd.exe)
- Press `Windows Key + R`
- Type: `cmd`
- Press Enter

**Fix 3: Check PATH manually**
1. Press `Windows Key`
2. Type: `Environment Variables`
3. Click "Edit the system environment variables"
4. Click "Environment Variables" button
5. Under "System variables", find "Path"
6. Click "Edit"
7. Look for:
   - `C:\Program Files\nodejs\`
   - `C:\Program Files\git\cmd\`
8. If missing, click "New" and add them
9. Click OK, OK, OK
10. Restart Windows

---

### **Problem: "File path errors with backslashes"**

**Symptoms:**
```
Error: Invalid escape sequence
Unrecognized path
Path has weird characters
```

**Causes:**
- Using backslashes in quotes
- Copy-paste issue
- Path has spaces

**Solutions:**

**Fix 1: Use correct path format**
```bash
# ❌ Wrong:
cd C:\Users\Your Name\Desktop\linkedin-automation

# ✅ Correct (no space in path):
cd C:\Users\YourName\Desktop\linkedin-automation

# ✅ Or use quotes:
cd "C:\Users\Your Name\Desktop\linkedin-automation"
```

**Fix 2: Find path without spaces**
1. Create folder without spaces
2. Example: `linkedin-automation-2025`
3. Extract files there
4. Use that path

**Fix 3: Use forward slashes (Windows 10+)**
```bash
cd C:/Users/YourName/Desktop/linkedin-automation
# Works in modern Windows
```

---

### **Problem: "Permission denied when saving files"**

**Symptoms:**
```
Error: Permission denied
Cannot write to file
Access is denied
```

**Causes:**
- Running as wrong user
- File is read-only
- Antivirus blocking
- File in use by another program

**Solutions:**

**Fix 1: Run Command Prompt as Administrator**
1. Press `Windows Key`
2. Type: `cmd`
3. Right-click "Command Prompt"
4. Click "Run as administrator"
5. Click "Yes"
6. Try command again

**Fix 2: Remove read-only flag**
1. Right-click file
2. Properties
3. Uncheck "Read-only"
4. Click "Apply"
5. Click "OK"

**Fix 3: Disable antivirus temporarily**
1. Open Windows Defender
2. Click "Virus & threat protection"
3. Click "Manage settings"
4. Turn off "Real-time protection"
5. Try command
6. Turn it back on after

**Fix 4: Restart and clear locks**
1. Restart Windows
2. All files will be unlocked
3. Try command again

---

### **Problem: "Special characters in file names cause errors"**

**Symptoms:**
```
Error: Name contains invalid characters
Cannot create file with name
File name not accepted
```

**Causes:**
- Client name has special characters
- File path has special characters
- Client name not validated

**Solutions:**

**Fix 1: Rename files/folders**
Remove special characters from:
- Folder names
- File names

Invalid characters:
```
< > : " | ? * / \
```

**Fix 2: Use client name validation**
- System validates names automatically
- Names like "John Smith" work
- Names like "John@Smith" rejected
- This is intentional (prevents errors)

**Fix 3: When logging manually**
```bash
# Use only alphanumeric and spaces
curl -X POST http://localhost:3000/api/automation/proposal-submitted \
  -H "Content-Type: application/json" \
  -d '{"clientName":"John Smith"}'
  # ✅ Works

# Not:
curl -X POST http://localhost:3000/api/automation/proposal-submitted \
  -H "Content-Type: application/json" \
  -d '{"clientName":"John@Smith#123"}'
  # ❌ Fails
```

---

## 🆘 Still Not Fixed?

### **Collect This Information**

Before asking for help, gather:

1. **Error message**
   - Copy exact error text
   - Screenshot if possible

2. **Command you ran**
   - Exact command that failed
   - Full path if relevant

3. **Verification output**
   ```bash
   node scripts/verify_system.js
   ```
   - Copy entire output
   - Even if shows ❌

4. **Debug files**
   - Any `debug_*.png` files
   - Share these images

5. **Log files**
   - `activity_logs.json` (last 10 entries)
   - `n8n_metrics.json` (entire file)

6. **System info**
   - Windows version (Settings → System)
   - Node version: `node --version`
   - npm version: `npm --version`

### **Where to Get Help**

1. Search this guide first (Ctrl + F)
2. Check the relevant section above
3. Try all fixes in that section
4. If still broken, contact support with:
   - Error message
   - Steps to reproduce
   - Information collected above

---

## ✅ Quick Fix Checklist

**When something breaks:**

- [ ] Run `node scripts/verify_system.js`
- [ ] Check if servers running: `npm start` + `n8n start`
- [ ] Test with `--max=1` (minimal run)
- [ ] Check `activity_logs.json` for what happened
- [ ] Look for `debug_*.png` files
- [ ] Search this guide for your error
- [ ] Try the "Fix 1" for your problem
- [ ] Restart if nothing else works
- [ ] Collect info and contact support

---

## 📚 Related Documentation

- **README.md** - Setup guide
- **WORKFLOW.md** - N8N workflows
- **API.md** - API endpoints
- **TROUBLESHOOTING.md** - This file

---

**Last Updated:** January 2026
**Troubleshooting Guide Version:** 1.0