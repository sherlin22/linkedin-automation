/**
 * Groq High-Conversion Resume Critique Module
 * Uses the elite resume critic prompt for AI-powered analysis
 * 
 * Optimized for: Groq Llama 3.3 70B (FREE)
 */

const { GROQ_CONFIG, chat } = require('./groq-client');

/**
 * High-Conversion Resume Critique System Prompt
 * This prompt triggers identity gaps and mirrors recruiter psychology
 */
const RESUME_CRITIQUE_SYSTEM_PROMPT = `You are an elite resume critic with 15+ years of experience as:

🎯 A senior hiring manager screening 1,000+ resumes across leadership, tech, and corporate roles
🚀 A career transformation coach who helped professionals secure 40-100% salary jumps
🔍 An ATS optimization expert who reverse-engineers recruiter search behavior

Your task is NOT to be polite.
Your task is to explain exactly why this CV is being rejected — and what must change to make it interview-worthy.

═══════════════════════════════════════════════════════════════
CRITIQUE FORMAT (FOLLOW EXACTLY)
═══════════════════════════════════════════════════════════════

## 1. RECRUITER REALITY CHECK (Opening - 3-4 sentences)
• Identify the target role/domain this CV appears to aim for
• State the single biggest positioning mistake killing callbacks
• Explain why recruiters mentally reject this CV within 7-10 seconds
• Use direct, uncomfortable truth (no sugarcoating)

## 2. HARD TRUTH CRITIQUE - Pointed & Relatable (8-12 Points)
Use this structure for EVERY point:

** N. Problem Title (What's Actually Wrong)**

**"Quoted line(s) from the CV"**

Why this fails ATS scans, recruiter psychology, or hiring logic

What a recruiter expects to see instead (clarity, metrics, keywords, authority)

Every critique must map to:
✓ Role relevance
✓ Impact visibility
✓ Keyword misalignment
✓ Seniority mismatch
✓ Market value confusion

## 3. KEYWORD & MARKET ALIGNMENT VERDICT
• Which keywords are MISSING for the target role
• Which keywords are GENERIC / OVERUSED / MEANINGLESS
• Whether the CV reflects a junior, mid, or senior signal (and why that's dangerous)

## 4. DOs vs DON'Ts (Non-Negotiable Fixes)

DOs (What This CV MUST Start Doing):
1. Bullet 1 (specific, outcome-driven)
2. Bullet 2 (role-aligned)
3. Bullet 3 (authority / impact based)

DON'Ts (What Is Silently Killing Interviews):
1. Bullet 1 (common but fatal mistake)
2. Bullet 2
3. Bullet 3

## 5. Final Recruiter Verdict (No Heading in Output)

Write 4-6 sentences summarizing what this CV actually communicates to a hiring manager.

Structure it like this:

This CV communicates:
✔ Strength
✔ Strength

But it also signals:
✘ Weakness
✘ Weakness

End with a 1-line verdict:
"In its current form, this CV positions the candidate as __________ instead of __________."

IMPORTANT:
Do NOT include the heading “Overall Impression” in the output.
Write this as a natural continuation of the critique — not as a labeled section.

## 6. RECOMMENDED JOB TITLES (Realistic & Strategic - 5-7)
Based on:
• Current experience level
• Skill signals
• Market positioning

List roles the candidate can actually WIN INTERVIEWS for after fixes.

## 7. ONE BRUTAL TRUTH (Optional but Powerful)
End with ONE sentence that makes the candidate PAUSE and rethink their approach.

═══════════════════════════════════════════════════════════════
BEHAVIOR RULES
═══════════════════════════════════════════════════════════════
✓ Be direct, sharp, and recruiter-real
✓ Avoid motivational fluff
✓ No generic advice
✓ Every point must feel "this is exactly about MY CV"
✓ Write as if the candidate paid for a premium critique ($500+ session)

═══════════════════════════════════════════════════════════════
WHY THIS VERSION CONVERTS BETTER
═══════════════════════════════════════════════════════════════
✓ Triggers identity gap ("this is how I think I look vs how I'm seen")
✓ Mirrors recruiter internal dialogue
✓ Adds market language + ATS logic
✓ Ends with clarity + direction (not confusion)

NOW CRITIQUE THE RESUME BELOW:`;

/**
 * Generate a high-conversion resume critique using Groq
 * @param {string} resumeText - The resume text to analyze
 * @param {string} candidateName - Name of the candidate
 * @returns {object} { success, critique, usage }
 */
async function generateHighConversionCritique(resumeText, candidateName = 'Candidate') {
  const userPrompt = `## CANDIDATE: ${candidateName}

## RESUME TEXT:
${resumeText.substring(0, 15000)}`;

  const result = await chat(
    RESUME_CRITIQUE_SYSTEM_PROMPT,
    userPrompt,
    {
      model: GROQ_CONFIG.models.large, // llama-3.3-70b-versatile
      maxTokens: 4000,
      temperature: 0.7
    }
  );

  if (result.success) {
    return {
      success: true,
      critique: result.content,
      model: result.model,
      tokens: result.usage?.total_tokens || 0,
      critiqueType: 'high-conversion'
    };
  }

  return {
    success: false,
    error: result.error,
    critiqueType: 'high-conversion'
  };
}

/**
 * Generate a quick triage critique (lighter version)
 * @param {string} resumeText - The resume text to analyze
 * @param {string} candidateName - Name of the candidate
 * @returns {object} { success, critique, usage }
 */
async function generateQuickCritique(resumeText, candidateName = 'Candidate') {
  const quickPrompt = `You are an elite resume critic. Analyze this resume and provide a quick triage:

## CANDIDATE: ${candidateName}

## RESUME:
${resumeText.substring(0, 10000)}

Reply with exactly:
### SCORE: /10
### TOP 3 ISSUES:
1. ...
2. ...
3. ...
### ONE FIX TO MAKE NOW:`;

  const result = await chat(
    "Be direct and honest. No fluff.",
    quickPrompt,
    {
      model: GROQ_CONFIG.models.medium, // llama-3.1-70b-versatile
      maxTokens: 500,
      temperature: 0.5
    }
  );

  if (result.success) {
    return {
      success: true,
      critique: result.content,
      model: result.model,
      tokens: result.usage?.total_tokens || 0,
      critiqueType: 'quick-triage'
    };
  }

  return {
    success: false,
    error: result.error,
    critiqueType: 'quick-triage'
  };
}

/**
 * Generate an ATS optimization report
 * @param {string} resumeText - The resume text to analyze
 * @param {string} targetRole - The role being applied for
 * @returns {object} { success, critique, usage }
 */
async function generateATSReport(resumeText, targetRole = 'General') {
  const atsPrompt = `You are an ATS optimization expert. Analyze this resume for ATS performance:

## TARGET ROLE: ${targetRole}

## RESUME:
${resumeText.substring(0, 12000)}

Reply with exactly:
### ATS SCORE: /100
### MISSING KEYWORDS (5-10):
-
### KEYWORD DENSITY ISSUES:
-
### FORMAT PROBLEMS:
-
### RECOMMENDED KEYWORDS TO ADD:`;

  const result = await chat(
    "Be technical about ATS algorithms. No fluff.",
    atsPrompt,
    {
      model: GROQ_CONFIG.models.large,
      maxTokens: 800,
      temperature: 0.3
    }
  );

  if (result.success) {
    return {
      success: true,
      critique: result.content,
      model: result.model,
      tokens: result.usage?.total_tokens || 0,
      critiqueType: 'ats-optimization'
    };
  }

  return {
    success: false,
    error: result.error,
    critiqueType: 'ats-optimization'
  };
}

module.exports = {
  RESUME_CRITIQUE_SYSTEM_PROMPT,
  generateHighConversionCritique,
  generateQuickCritique,
  generateATSReport
};

