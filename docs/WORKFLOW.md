# 🔄 N8N Workflow Configuration Guide

This guide explains how to set up, configure, and manage N8N workflows for the LinkedIn automation system.

---

## 📋 What is N8N?

**N8N** is a workflow automation platform that:
- Runs scripts automatically on a schedule (8am, 2pm, 6pm)
- Monitors and logs all activity
- Provides a visual dashboard
- Handles errors gracefully
- Stores execution history

**Why we use it:** Instead of manually running commands, N8N does everything automatically!

---

## 🚀 Quick Start (N8N Already Running)

If you've followed the README:

1. **Terminal running:** `n8n start`
2. **Go to:** http://localhost:5678
3. **Press 'O'** to see executions
4. **Done!** It's already working

---

## 📊 N8N Dashboard Overview

### **When you go to http://localhost:5678, you see:**

```
N8N DASHBOARD
┌────────────────────────────────────────────────────┐
│  Workflows (Left Sidebar)                          │
│  ├─ LinkedIn Automation [Active]                   │
│  ├─ Proposal Sender [Disabled]                     │
│  └─ Resume Processor [Disabled]                    │
├────────────────────────────────────────────────────┤
│  Main Area: LinkedIn Automation Workflow           │
│                                                    │
│  [Node 1: Trigger 8:00 AM]                         │
│           ⬇️                                       │
│  [Node 2: Step 7 - Send Proposals]                 │
│           ⬇️                                       │
│  [Node 3: Step 8 - Send Follow-ups]                │
│           ⬇️                                       │
│  [Node 4: Step 9 - Process Resumes]                │
│           ⬇️                                       │
│  [Node 5: Log Results to Sheets]                   │
│                                                    │
│  [Execute] [Save] [Deploy]                         │
└────────────────────────────────────────────────────┘
```

---

## ⚙️ Workflow Structure

Your workflows are organized into **3 separate scheduled runs:**

### **Workflow 1: 8:00 AM Slot**

**Schedule:** Every day at 8:00 AM

**Steps executed in order:**
1. **CRON Trigger** - Wakes up at 8:00 AM
2. **Step 7 Execute** - Sends 5-10 proposals
3. **Step 8 Execute** - Sends 3-5 follow-ups
4. **Step 9 Execute** - Processes 2-5 resumes
5. **Metrics Log** - Updates statistics
6. **Email Notification** (Optional) - Sends you email with results

---

### **Workflow 2: 2:00 PM Slot**

**Schedule:** Every day at 2:00 PM

**Steps:** Same as 8:00 AM workflow
- Sends more proposals
- Sends more follow-ups
- Processes more resumes

---

### **Workflow 3: 6:00 PM Slot**

**Schedule:** Every day at 6:00 PM

**Steps:** Same as 8:00 AM workflow
- Final round of proposals
- Final round of follow-ups
- Final resume batch processing

---

## 🔧 Viewing Workflow Details

### **Click on a Workflow Name**

1. **Go to:** http://localhost:5678
2. **Click "LinkedIn Automation 8AM"** (in left sidebar)
3. **You'll see the workflow diagram:**

```
Workflow Diagram View
┌─────────────────────────────────────────────────┐
│                                                 │
│  [CRON: Every day 8:00 AM]                      │
│          │                                      │
│                                                 │
│  [Execute Command: Step 7]                      │
│    Command: node scripts/step7_...js            │
│          │                                      │
│                                                 │
│  [Execute Command: Step 8]                      │
│    Command: node scripts/step8_...js            │
│          │                                      │
│                                                 │
│  [Execute Command: Step 9]                      │
│    Command: node scripts/step9_...js            │
│          │                                      │
│                                                 │
│  [HTTP Request: Log to Sheets]                  │
│    URL: http://localhost:3000/api/...           │
│          │                                      │
│                                                 │
│  [End]                                          │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 📍 Understanding Workflow Nodes

### **Node 1: CRON Trigger**

```
Type: Cron
Schedule: 0 8 * * *  (8:00 AM daily)
```

**What it does:**
- Wakes up at exactly 8:00 AM
- Triggers all downstream nodes
- Ignores the workflow if time hasn't reached 8am

**Edit the time:**
1. Click on the CRON node
2. Change the expression:
   - `0 8 * * *` = 8:00 AM
   - `0 14 * * *` = 2:00 PM
   - `0 18 * * *` = 6:00 PM

---

### **Node 2: Execute Step 7 (Proposals)**

```
Type: Execute Command
Command: 
  node scripts/step7_submit_proposal_loop.js 
    --confirm=true 
    --max=10 
    --auth=auth_state.json
```

**What it does:**
- Finds service requests on LinkedIn
- Sends personalized proposals
- Max 10 proposals per run
- Takes 5-15 minutes

**Customize:**
- Change `--max=10` to send more/fewer proposals
- Example: `--max=20` sends 20 proposals
- Example: `--max=5` sends just 5

---

### **Node 3: Execute Step 8 (Follow-ups)**

```
Type: Execute Command
Command: 
  node scripts/step8_followup_message_loop.js 
    --confirm=true 
    --max=10 
    --auth=auth_state.json
```

**What it does:**
- Messages people who got proposals
- Asks them to share resumes
- Tracks who was contacted
- Takes 5-10 minutes

---

### **Node 4: Execute Step 9 (Resumes)**

```
Type: Execute Command
Command: 
  node scripts/step9_complete_resume_workflow.js 
    --confirm=true 
    --max=10 
    --auth=auth_state.json
```

**What it does:**
- Downloads resumes from LinkedIn
- Analyzes with AI
- Creates Gmail drafts
- Uploads to Google Drive
- Takes 20-40 minutes (slowest step)

---

### **Node 5: Log Results**

```
Type: HTTP Request
Method: POST
URL: http://localhost:3000/api/automation/metrics
```

**What it does:**
- Sends results to your tracking sheet
- Updates statistics
- Records execution time
- Non-critical (skippable if fails)

---

## ▶️ Running Workflows

### **Automatic Running (Default)**

Workflows run automatically at scheduled times:
- **8:00 AM** - First run of the day
- **2:00 PM** - Second run of the day
- **6:00 PM** - Third run of the day

**You don't do anything!** They just run.

---

### **Manual Running (When You Want)**

**To run a workflow immediately:**

1. **Go to:** http://localhost:5678
2. **Click the workflow name** in left sidebar
3. **Click the blue "Execute Workflow" button** (top right)
4. **Watch it run in real-time**

**Status indicators:**
- 🔵 Blue running = Currently executing
- ✅ Green checkmark = Successful
- ❌ Red X = Failed

---

### **Pressing 'O' to See Executions**

**This is the fastest way to check results:**

1. **Go to:** http://localhost:5678
2. **Press 'O' key** (just the letter O)
3. **Executions panel opens** showing all past runs

**What you see:**

```
EXECUTIONS PANEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Workflow: LinkedIn Automation 8AM
├─ Status: ✅ SUCCESS
├─ Started: 2:45 PM
├─ Duration: 45 minutes
├─ Proposals Sent: 7
├─ Follow-ups Sent: 5
└─ Resumes Processed: 3

Workflow: LinkedIn Automation 2PM
├─ Status: ✅ SUCCESS
├─ Started: 14:00 (2:00 PM)
├─ Duration: 52 minutes
├─ Proposals Sent: 5
├─ Follow-ups Sent: 4
└─ Resumes Processed: 2

Workflow: LinkedIn Automation 6PM
├─ Status: 🔄 RUNNING
├─ Started: 30 seconds ago
└─ Please wait...
```

---

## ⚙️ Customizing Workflows

### **Change Proposal Limit**

**Step 7 sends up to 10 proposals per run**

To change to 20 proposals:

1. **Click the Step 7 node**
2. **Find the command field**
3. **Change `--max=10` to `--max=20`**
4. **Click "Save Workflow"**

Next run will send 20 proposals.

---

### **Change Follow-up Limit**

**Step 8 follows up with up to 10 people**

To change to 15:

1. **Click the Step 8 node**
2. **Change `--max=10` to `--max=15`**
3. **Save**

---

### **Change Resume Processing Limit**

**Step 9 processes up to 10 resumes**

To change to 20:

1. **Click the Step 9 node**
2. **Change `--max=10` to `--max=20`**
3. **Save**

---

### **Change Scheduled Time**

**Want to run at different times?**

1. **Click the CRON trigger node**
2. **Change the schedule:**

| Time | Cron Expression |
|------|-----------------|
| 7:00 AM | `0 7 * * *` |
| 9:00 AM | `0 9 * * *` |
| 12:00 PM (Noon) | `0 12 * * *` |
| 3:00 PM | `0 15 * * *` |
| 7:00 PM | `0 19 * * *` |
| 10:00 PM | `0 22 * * *` |

3. **Save and deploy**

---

## 📊 Monitoring Executions

### **View Execution History**

1. **Press 'O'** in N8N dashboard
2. **See all past runs** with:
   - Start time
   - Duration
   - Success/failure status
   - Number of items processed

### **Click on an Execution**

Click any execution to see **detailed logs:**

```
EXECUTION DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Start Time: 8:00:15 AM
End Time: 8:47:30 AM
Duration: 47 minutes 15 seconds
Status: ✅ SUCCESS

Step 7 Output:
├─ Found 8 proposals available
├─ Sent to John Smith ✅
├─ Sent to Sarah Johnson ✅
├─ Sent to Michael Chen ✅
├─ ... 5 more sent
└─ Total: 8 proposals

Step 8 Output:
├─ Follow-ups ready: 6
├─ Sent to John Smith ✅
├─ ... 5 more sent
└─ Total: 6 follow-ups

Step 9 Output:
├─ Resumes found: 3
├─ Downloaded from John Smith
├─ Analyzed: Readable ✅
├─ Created Gmail draft ✅
├─ Uploaded to Drive ✅
└─ Total: 3 resumes processed

Logging:
├─ Results sent to Sheets ✅
└─ Metrics updated ✅
```

---

## 🚨 Troubleshooting Workflows

### **Problem: Workflow Not Running at Scheduled Time**

**Causes:**
- N8N not running
- Server crashed
- Port blocked

**Fix:**
1. Check Terminal 2: Does it say "N8N ready"?
2. If not: `n8n start`
3. Restart N8N: Kill the process and restart
4. Try different port: `n8n start --port 5679`

---

### **Problem: Workflow Runs But Fails Halfway**

**Causes:**
- LinkedIn session expired
- API key invalid
- Network interrupted
- Insufficient data on LinkedIn

**Fix:**
1. Check which node failed (look at red X)
2. Review the error message
3. Check `activity_logs.json` for context
4. Manually run that step to test
5. Report with error details

---

### **Problem: Proposals/Follow-ups Not Sent**

**Causes:**
- LinkedIn blocked the account
- No clients requesting service
- Session expired
- LinkedIn UI changed

**Fix:**
1. Log in to LinkedIn manually
2. Try clicking "Submit Proposal" yourself
3. If you're blocked, wait 2 hours
4. Check `activity_logs.json`
5. Review `debug_*.png` files for UI issues

---

### **Problem: "Execute Command Failed"**

**Causes:**
- Node.js not installed
- Script has error
- Wrong file path
- Permission denied

**Fix:**
1. Test command manually:
   ```
   cd C:\Users\YourName\Desktop\linkedin-automation
   node scripts/step7_submit_proposal_loop.js --max=1
   ```
2. If it works manually, issue is with N8N
3. Check that script paths are correct
4. Reinstall dependencies: `npm install`

---

### **Problem: "HTTP Request Failed" (Step Logging)**

**Causes:**
- Server not running (`npm start`)
- Different port
- Firewall blocking

**Fix:**
1. Check Terminal 1: `npm start` running?
2. If not: Start it
3. Test: Go to http://localhost:3000 in browser
4. If page loads, server is fine
5. Check N8N HTTP node configuration

---

## 📈 Monitoring Metrics

### **What Gets Tracked**

Each workflow execution logs:

```json
{
  "timestamp": "2025-01-17T08:00:15Z",
  "workflow": "LinkedIn Automation 8AM",
  "slot": "slot1",
  "metrics": {
    "proposals_sent": 8,
    "followups_sent": 6,
    "resumes_downloaded": 3,
    "ai_critiques_generated": 3,
    "gmail_drafts_created": 3
  },
  "duration_minutes": 47,
  "status": "success"
}
```

### **View Metrics**

1. **Open file:** `n8n_metrics.json`
2. **See counts per time slot:**

```json
{
  "slots": {
    "slot1": {
      "time": "8am",
      "proposals": 45,
      "followups": 32,
      "downloads": 18,
      "drafts": 15
    },
    "slot2": {
      "time": "2pm",
      "proposals": 38,
      "followups": 28,
      "downloads": 12,
      "drafts": 10
    },
    "slot3": {
      "time": "6pm",
      "proposals": 52,
      "followups": 35,
      "downloads": 14,
      "drafts": 12
    }
  },
  "lastUpdate": "2025-01-17T18:47:30Z"
}
```

---

## 🔐 Security & Best Practices

### **DO:**
✅ Keep N8N password secure
✅ Don't share workflow export files
✅ Regularly backup `n8n_metrics.json`
✅ Monitor execution logs for errors
✅ Update scripts if LinkedIn UI changes

### **DON'T:**
❌ Share N8N access with untrusted people
❌ Change sensitive commands
❌ Disable error notifications
❌ Run multiple workflows simultaneously
❌ Modify auth credentials in workflows

---

## 📋 Workflow Checklist

### **Daily:**
- [ ] Both servers running (npm start + n8n start)
- [ ] Press 'O' to check executions
- [ ] Verify all 3 slots completed successfully
- [ ] Check `activity_logs.json` for updates

### **Weekly:**
- [ ] Review metrics in `n8n_metrics.json`
- [ ] Check if pattern changes (more/fewer proposals)
- [ ] Verify Gmail drafts are being created
- [ ] Monitor response rates from clients

### **Monthly:**
- [ ] Back up `n8n_metrics.json`
- [ ] Review all executions for errors
- [ ] Update script parameters if needed
- [ ] Check if LinkedIn UI has changed

---

## 🎯 Advanced Customization

### **Add Email Notifications**

Want N8N to email you when workflows complete?

1. **Click on "LinkedIn Automation 8AM" workflow**
2. **Add a new node:**
   - Type: "Email"
   - To: your@email.com
   - Subject: "LinkedIn Automation 8AM Complete"
   - Body: "Proposals sent: {step7.output}, ..."
3. **Save and deploy**

Now you get daily emails with results!

---

### **Add Slack Notifications**

Want Slack messages instead?

1. **Set up Slack webhook:**
   - Go to your Slack workspace settings
   - Create an incoming webhook
   - Copy the URL

2. **Add N8N Slack node:**
   - Type: "HTTP Request"
   - Method: POST
   - URL: Your Slack webhook URL
   - Body: Your execution data
3. **Save and deploy**

---

### **Create Custom Schedules**

Want to run at specific times only?

**Example: Run only weekdays at 8am**

Change CRON to: `0 8 * * 1-5` (Monday-Friday)

**Example: Run every 2 hours**

Change CRON to: `0 */2 * * *` (Every 2 hours)

**Example: Run every 30 minutes**

Change CRON to: `*/30 * * * *` (Every 30 minutes)

---

## 📞 Support & Help

### **Check Workflow Logs**

1. **Go to:** http://localhost:5678
2. **Press 'O'**
3. **Click failed execution**
4. **Read the error message**

### **Get Execution Details**

Click any execution to see:
- Start/end times
- Duration
- Success/failure
- Detailed output from each node
- Error messages if failed

### **Common Error Messages**

| Error | Meaning | Fix |
|-------|---------|-----|
| "Cannot find module" | Script missing | Run `npm install` |
| "Connection timeout" | LinkedIn blocked | Wait 2 hours |
| "HTTP 429" | Too many requests | Increase delays |
| "Directory not found" | Wrong file path | Check paths |
| "Command failed" | Script error | Test manually |

---

## 📚 Workflow Reference

### **Workflow File Locations**

All workflows are stored in:
```
~/.n8n/workflows/
```

### **Export Workflow**

1. **Click workflow name**
2. **Click "..." menu** (top right)
3. **Click "Download"**
4. **Saves as JSON file**

### **Import Workflow**

1. **Go to N8N home**
2. **Click "Import"**
3. **Select JSON file**
4. **Activate if needed**

---

## ✨ Summary

**Your N8N workflow:**
- ✅ Runs automatically 3x daily (8am, 2pm, 6pm)
- ✅ Executes all 3 steps in sequence
- ✅ Logs all results
- ✅ Updates metrics
- ✅ Handles errors gracefully
- ✅ Provides execution history

**All you need to do:**
- Start N8N: `n8n start`
- Check progress: Press 'O' to view executions
- That's it! 🚀

---
