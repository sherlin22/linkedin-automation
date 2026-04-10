## 🎯 How to Use (Day-to-Day) - THE EASY WAY

### **Best Method: Use VS Code (Recommended)**

This is the easiest way to run everything daily without typing commands!

#### **Step 1: Open VS Code**

1. **Press `Windows Key`**
2. **Type:** `VS Code`
3. **Press Enter** to open VS Code

#### **Step 2: Open Your Automation Folder**

1. **Click "File"** (top left)
2. **Click "Open Folder"**
3. **Navigate to:** `C:\Users\YourName\Desktop\linkedin-automation`
4. **Click "Select Folder"**
5. You should see all your files on the left side

#### **Step 3: Open TWO Terminals in VS Code**

1. **Open first terminal:**
   - Press `Ctrl + ~` (or click "Terminal" menu → "New Terminal")
   - You'll see a Command Prompt at the bottom

2. **Open second terminal:**
   - Click the **'+'** button next to the terminal name
   - You now have 2 terminals side by side

#### **Step 4: Start the Server (Terminal 1)**

In the **first terminal**, type:
```
npm start
```

Press Enter

**You should see:**
```
✅ Server running on http://localhost:3000
🚀 Ready for automation updates...
```

**Leave this running!** Don't close it.

#### **Step 5: Start N8N (Terminal 2)**

In the **second terminal**, type:
```
n8n start
```

Press Enter

**You should see:**
```
ðŸš€ n8n ready on http://localhost:5678
```

**Leave this running too!**

---

### **Daily Workflow - Super Simple!**

**Every morning/afternoon/evening, here's what you do:**

1. **Both servers running?** ✅
   - Server 1: Shows "Ready for automation updates"
   - Server 2: Shows "n8n ready"

2. **Open N8N in your browser:**
   - Go to: `http://localhost:5678`
   - You'll see the N8N dashboard

3. **Press 'O' key** (just the letter O)
   - This opens the "Executions" panel
   - Shows all your automation runs

4. **Click your workflow**
   - You see 3 scheduled workflows:
     - **8:00 AM Slot** (sends proposals + follow-ups + processes resumes)
     - **2:00 PM Slot** (sends proposals + follow-ups + processes resumes)
     - **6:00 PM Slot** (sends proposals + follow-ups + processes resumes)

5. **Click "Execute Workflow"** button
   - System automatically runs Step 7, 8, and 9
   - All 3 steps run automatically!
   - You just watch it happen

6. **Watch the results:**
   - Green checkmarks = Success
   - Red X = Something failed
   - Metrics update in real-time

---

### **Understanding N8N Dashboard (Press 'O')**

When you press 'O' to open the Executions panel, you'll see:

```
EXECUTION HISTORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8:00 AM Slot - Yesterday
✅ SUCCESS - 5 proposals sent, 3 follow-ups, 2 resumes

2:00 PM Slot - Yesterday  
✅ SUCCESS - 7 proposals sent, 5 follow-ups, 1 resume

6:00 PM Slot - Today
🔄 RUNNING - Processing...
```

**What you're looking at:**
- Each box = One automation run
- ✅ = Everything worked
- 🔄 = Currently running
- ❌ = Something failed (rare)
- Shows exactly what was done in that run

---

### **That's It! Daily Tasks Complete**

**You literally just:**

1. ✅ Open VS Code
2. ✅ Both servers already running from yesterday
3. ✅ Press 'O' in terminal where n8n is runiing to see executions
4. ✅ Go to http://localhost:5678
5. ✅ Click "Execute Workflow"
6. ✅ Watch it work
7. ✅ Close VS Code when done

---
