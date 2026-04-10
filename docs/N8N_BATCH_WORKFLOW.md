# N8N Batch Workflow Architecture

This document describes the batch-based, time-segmented LinkedIn outreach automation system.

---

## Overview

The n8n workflow is designed as a **Batch-Based, Time-Segmented LinkedIn Outreach Automation System** that:

- **Runs 3 times per day** at scheduled intervals
- **Sends new proposals** to potential clients
- **Sends follow-up messages** to engaged prospects
- **Controls daily limits** to prevent over-automation
- **Adds human-like delays** to avoid detection
- **Logs & finalizes** all processing
- **Resets for next batch** automatically

---

## Daily Schedule

| Slot   | Time | Purpose         |
| ------ | ---- | --------------- |
| slot_1 | 8 AM | Morning batch   |
| slot_2 | 2 PM | Afternoon batch |
| slot_3 | 6 PM | Evening batch   |

Each slot runs **independently** and executes the same automation logic.

---

## Workflow Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    N8N LINKEDIN AUTOMATION                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│   │   CRON       │    │   CRON       │    │   CRON       │          │
│   │   slot_1     │    │   slot_2     │    │   slot_3     │          │
│   │   8:00 AM    │    │   2:00 PM    │    │   6:00 PM    │          │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘          │
│          │                   │                   │                  │
│          ▼                   ▼                   ▼                  │
│   ┌─────────────────────────────────────────────────────┐          │
│   │              Edit Fields (Per Slot)                  │          │
│   │  • slot → slot_1 / slot_2 / slot_3                  │          │
│   │  • slot_name → label for logging                    │          │
│   │  • max_proposals → e.g., 30                         │          │
│   └──────────────────────────┬──────────────────────────┘          │
│                              │                                       │
│                              ▼                                       │
│   ┌─────────────────────────────────────────────────────┐          │
│   │              Merge Node (Append Mode)                │          │
│   │  Combines all 3 slots into one pipeline             │          │
│   └──────────────────────────┬──────────────────────────┘          │
│                              │                                       │
│                              ▼                                       │
│   ┌─────────────────────────────────────────────────────┐          │
│   │    Proposals & Follow-ups (Execute Command)         │          │
│   │  • step7_submit_proposal_loop.js                     │          │
│   │  • sleep 60                                         │          │
│   │  • step8_followup_message_loop.js                    │          │
│   └──────────────────────────┬──────────────────────────┘          │
│                              │                                       │
│                              ▼                                       │
│   ┌─────────────────────────────────────────────────────┐          │
│   │              Switch Node (Slot Routing)             │          │
│   │  Routes based on: {{$node.Merge.json.slot}}        │          │
│   └──────┬────────────────┬────────────────┬───────────┘          │
│          │                │                │                        │
│   ┌──────┴─────┐   ┌──────┴─────┐   ┌──────┴─────┐                │
│   │   Wait     │   │   Wait     │   │   Wait     │                │
│   │  slot_1   │   │  slot_2    │   │  slot_3    │                │
│   │ 30 sec    │   │ 30 sec     │   │ 30 sec     │                │
│   └──────┬─────┘   └──────┬─────┘   └──────┬─────┘                │
│          │                │                │                        │
│          └────────────────┴────────────────┘                        │
│                           │                                         │
│                           ▼                                         │
│   ┌─────────────────────────────────────────────────────┐          │
│   │              Merge1 (Recombine Paths)               │          │
│   └──────────────────────────┬──────────────────────────┘          │
│                              │                                       │
│                              ▼                                       │
│   ┌─────────────────────────────────────────────────────┐          │
│   │        Resume Processing (Final Script)             │          │
│   │  • step9_complete_resume_workflow.js                │          │
│   └─────────────────────────────────────────────────────┘          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Node Details

### 1. Scheduled Triggers (slot_1, slot_2, slot_3)

**Purpose:** Wake up the workflow at specific times each day.

**Configuration:**

| Slot   | Cron Expression | Time |
| ------ | --------------- | ---- |
| slot_1 | `0 8 * * *`     | 8:00 AM |
| slot_2 | `0 14 * * *`    | 2:00 PM |
| slot_3 | `0 18 * * *`    | 6:00 PM |

**Behavior:**
- Each trigger runs automatically every day
- Starts the automation independently
- Acts as the entry point for its respective batch

---

### 2. Edit Fields (Per Slot Configuration)

**Purpose:** Define batch-specific parameters.

**Configuration per slot:**

```javascript
{
  "slot": "slot_1",           // Identifies which batch is running
  "slot_name": "Morning",     // Label for logging
  "max_proposals": 30        // Number of proposals to send
}
```

**This defines:**
- Which batch is running (slot_1, slot_2, or slot_3)
- How many proposals to send in this batch
- What name appears in logs

---

### 3. Merge Node (Append Mode)

**Purpose:** Combine all 3 slot paths into a single pipeline.

**Why?**
- After defining slot details, the processing logic is the same
- Allows one common automation engine
- Cleaner design
- Easier maintenance

**Configuration:**
- Mode: Append
- Inputs: slot_1, slot_2, slot_3

---

### 4. Proposals & Follow-ups (Execute Command Node)

**Purpose:** The main automation engine that executes backend scripts.

**Command:**

```bash
cd ~/Desktop/linkedin-automation/linkedin-automation-backend && \
node scripts/step7_submit_proposal_loop.js \
  --auth=auth_state.json \
  --confirm=true \
  --max=30 && \
sleep 60 && \
node scripts/step8_followup_message_loop.js \
  --auth=auth_state.json \
  --confirm=true \
  --max=30
```

**What it does:**

1. **Step 7 - Submit Proposals:**
   - Finds service requests on LinkedIn
   - Sends personalized proposals to potential clients
   - Respects `--max` parameter (e.g., 30 proposals)

2. **Wait 60 seconds:**
   - Brief pause between proposal and follow-up phases

3. **Step 8 - Follow-up Messages:**
   - Sends follow-up messages to people who received proposals
   - Asks them to share resumes or respond
   - Respects `--max` parameter (e.g., 30 follow-ups)

---

### 5. Switch Node (Slot Routing)

**Purpose:** Route each slot through its own delay path.

**Configuration:**

```javascript
// Check the slot value
{{$node.Merge.json.slot}}

// Routes:
// - slot_1
// - slot_2
// - slot_3
```

**Why?**
- To send each slot through its own delay path
- Better control over each batch
- Separate wait timing for each slot
- Clear logical branching

---

### 6. Wait Nodes (Human Simulation Layer)

**Purpose:** Anti-ban safety layer to avoid LinkedIn detection.

**Configuration:**

```
Wait: 30 seconds
```

**Why?**
- Avoid LinkedIn detection
- Mimic natural user behavior
- Prevent burst activity
- Reduce risk of account restriction

**Each slot has its own Wait node** so they can be configured differently if needed.

---

### 7. Merge1 (Recombine Paths)

**Purpose:** Rejoin all slot paths after the delay.

**Configuration:**
- Mode: Merge
- Inputs: Wait slot_1, Wait slot_2, Wait slot_3

**This ensures:**
- No matter which slot ran, the workflow continues to final processing
- Maintains execution flow after the human-like delay

---

### 8. Resume Processing (Final Script)

**Purpose:** Process any resumes received and prepare for the next batch.

**Command:**

```bash
cd ~/Desktop/linkedin-automation/linkedin-automation-backend && \
node scripts/step9_complete_resume_workflow.js \
  --auth=auth_state.json \
  --confirm=true \
  --max=100 \
  --headful=true
```

**What it does:**
- Downloads resumes from LinkedIn
- Analyzes resumes with AI
- Creates Gmail drafts
- Uploads to Google Drive
- Processes up to 100 resumes per batch

---

## Daily Operation Example

### What Happens In One Day

#### At 8 AM (slot_1 - Morning Batch):
```
→ Sends up to 30 proposals
→ Sends up to 30 follow-ups  
→ Waits 30 seconds (human simulation)
→ Processes resumes (up to 100)
→ Logs results
→ Completes and waits for next slot
```

#### At 2 PM (slot_2 - Afternoon Batch):
```
→ Sends up to 30 proposals
→ Sends up to 30 follow-ups
→ Waits 30 seconds (human simulation)
→ Processes resumes (up to 100)
→ Logs results
→ Completes and waits for next slot
```

#### At 6 PM (slot_3 - Evening Batch):
```
→ Sends up to 30 proposals
→ Sends up to 30 follow-ups
→ Waits 30 seconds (human simulation)
→ Processes resumes (up to 100)
→ Logs results
→ Completes for the day
```

### Daily Totals (Maximum):
- **Proposals:** 90 per day (30 × 3 slots)
- **Follow-ups:** 90 per day (30 × 3 slots)
- **Resumes Processed:** 300 per day (100 × 3 slots)

---

## Configuration Parameters

### Edit Fields Configuration

| Parameter | Description | Example |
|-----------|-------------|---------|
| `slot` | Slot identifier | `slot_1`, `slot_2`, `slot_3` |
| `slot_name` | Human-readable label | `Morning`, `Afternoon`, `Evening` |
| `max_proposals` | Max proposals per batch | `30` |

### Execute Command Parameters

| Script | Parameter | Description | Example |
|--------|-----------|-------------|---------|
| step7 | `--auth` | Auth state file | `auth_state.json` |
| step7 | `--confirm` | Auto-confirm sending | `true` |
| step7 | `--max` | Max proposals to send | `30` |
| step8 | `--auth` | Auth state file | `auth_state.json` |
| step8 | `--confirm` | Auto-confirm sending | `true` |
| step8 | `--max` | Max follow-ups to send | `30` |
| step9 | `--auth` | Auth state file | `auth_state.json` |
| step9 | `--confirm` | Auto-confirm processing | `true` |
| step9 | `--max` | Max resumes to process | `100` |
| step9 | `--headful` | Run in headed mode | `true` |

### Wait Node Configuration

| Slot | Wait Time | Purpose |
|------|-----------|---------|
| slot_1 | 30 seconds | Human-like delay |
| slot_2 | 30 seconds | Human-like delay |
| slot_3 | 30 seconds | Human-like delay |

---

## Monitoring & Logging

### What Gets Logged

Each slot execution logs:

```json
{
  "timestamp": "2025-01-17T08:00:15Z",
  "slot": "slot_1",
  "slot_name": "Morning",
  "max_proposals": 30,
  "proposals_sent": 28,
  "followups_sent": 25,
  "resumes_processed": 15,
  "duration_minutes": 45,
  "status": "success"
}
```

### Viewing Execution Results

1. Go to http://localhost:5678
2. Press 'O' to see executions
3. Click on the specific execution to view details

---

## Safety Features

### Anti-Ban Measures

1. **Time-Based Scheduling:** Spread activity across the day
2. **Human-Like Delays:** 30-second waits between batches
3. **Proposal Limits:** Configurable max per batch (default: 30)
4. **Follow-up Limits:** Configurable max per batch (default: 30)
5. **Resume Processing Limits:** Configurable max per batch (default: 100)

### Rate Limiting

| Action | Default Limit | Configurable |
|--------|---------------|--------------|
| Proposals per slot | 30 | Yes |
| Follow-ups per slot | 30 | Yes |
| Resumes per slot | 100 | Yes |
| Total per day | 90 proposals / 90 follow-ups / 300 resumes | Yes |

---

## Customization Guide

### Changing Proposal Limits

To change the number of proposals per slot:

1. Click on the Edit Fields node for the slot
2. Change `max_proposals` to desired value
3. Save and deploy

Example: Change from 30 to 20 proposals:
```javascript
{
  "slot": "slot_1",
  "slot_name": "Morning",
  "max_proposals": 20  // Changed from 30
}
```

### Changing Wait Times

To adjust the human-like delay:

1. Click on the Wait node for the slot
2. Change the wait duration
3. Save and deploy

Recommended: 30-60 seconds for optimal safety.

### Changing Schedule Times

To modify when slots run:

1. Click on the CRON trigger node
2. Update the cron expression:

| Time | Cron Expression |
|------|-----------------|
| 7:00 AM | `0 7 * * *` |
| 8:00 AM | `0 8 * * *` |
| 9:00 AM | `0 9 * * *` |
| 12:00 PM | `0 12 * * *` |
| 2:00 PM | `0 14 * * *` |
| 6:00 PM | `0 18 * * *` |
| 8:00 PM | `0 20 * * *` |

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Workflow not triggering | N8N not running | Run `n8n start` |
| Proposals not sending | LinkedIn session expired | Re-authenticate |
| Follow-ups failing | No proposals to follow up | Check step 7 output |
| Resumes not processing | No resumes available | Wait for candidates to respond |
| Account restricted | Too many actions | Increase wait times |

### Checking Logs

1. **N8N Executions:** Press 'O' in N8N dashboard
2. **Activity Logs:** Check `linkedin-automation-backend/activity_logs.json`
3. **Script Output:** Check console output in N8N

---

## File Structure

```
linkedin-automation/
├── docs/
│   └── N8N_BATCH_WORKFLOW.md    # This file
├── n8n/
│   └── workflows/
│       └── LinkedIn Automation  # The n8n workflow
└── linkedin-automation-backend/
    └── scripts/
        ├── step7_submit_proposal_loop.js   # Send proposals
        ├── step8_followup_message_loop.js   # Send follow-ups
        └── step9_complete_resume_workflow.js # Process resumes
```

---

## Summary

This batch-based workflow system provides:

- ✅ **Automated Scheduling** - Runs 3x daily without manual intervention
- ✅ **Slot-Based Processing** - Each slot has configurable parameters
- ✅ **Rate Limiting** - Prevents over-automation with configurable limits
- ✅ **Human-Like Behavior** - Delays mimic real user activity
- ✅ **Comprehensive Logging** - All activities are logged for monitoring
- ✅ **Safety Features** - Built-in anti-ban measures
- ✅ **Easy Maintenance** - Single pipeline after merge for simpler logic

**The system is designed to run autonomously while maintaining safety and efficiency.**

---

