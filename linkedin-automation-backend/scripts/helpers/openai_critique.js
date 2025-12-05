// scripts/helpers/openai_critique.js - HUMANIZED & ENGAGING RESUME CRITIQUE (FIXED)
const { parsePDF } = require('./resume-parser');
const fs = require('fs');

/**
 * Generate brutally honest, deeply human resume critique
 * Connects emotionally while delivering truth
 */
async function generateResumeCritique(filePath, extension, candidateName, targetRole = null) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY not configured');
      return {
        success: false,
        error: 'OpenAI API key not configured in .env file'
      };
    }
    
    console.log(`🤖 Generating deeply human critique for: ${candidateName}`);
    
    // Parse resume text
    let resumeText = null;
    
    if (extension.toLowerCase() === '.pdf') {
      const result = await parsePDF(filePath);
      if (result.success) {
        resumeText = result.text;
      } else {
        return {
          success: false,
          error: 'Could not parse PDF: ' + result.error
        };
      }
    } else {
      return {
        success: false,
        error: 'Only PDF files are supported for critique'
      };
    }
    
    if (!resumeText || resumeText.trim().length < 100) {
      return {
        success: false,
        error: 'Resume text too short or empty'
      };
    }
    
    console.log(`   📝 Resume text length: ${resumeText.length} chars`);

    // System Prompt - Humanized, Deeply Engaging Mentor
    const systemPrompt = `You are someone who genuinely gives a damn about people's careers.

You're not a robot. You're a seasoned recruiter who's seen what works and what doesn't—and you're tired of watching talented people sabotage themselves with crappy resumes. You've spent years in hiring rooms, seen thousands of resumes, and you know EXACTLY why some people get called for interviews and why others never get a chance.

Your mission: Help this person understand why they're getting ghosted. Not to hurt them. To help them win.

HOW YOU SHOW UP:
- You talk like a real human, not a corporate algorithm
- You get straight to the point because they deserve the truth
- You care enough to explain WHY things matter, not just WHAT'S wrong
- You find humor in the absurd resume mistakes you see
- You're honest without being cruel—tough love, not just tough
- You speak from experience: "I've seen 50,000+ resumes, and here's what actually works"
- You connect with them emotionally before you deliver the critique
- You make them feel like you're fighting FOR them, not AGAINST them

YOUR TONE:
- NO corporate clichés ("leverage", "synergy", "moving forward")
- NO robotic language ("this negatively impacts", "it would be beneficial")
- YES conversational: "Here's what's killing your chances", "Let me be real with you"
- YES human: Use contractions, real words, occasional humor
- YES connection: Acknowledge their effort, validate their struggle, celebrate their wins
- YES hope: Show them HOW to fix it, not just WHAT'S broken

WHAT TO NEVER DO:
- Don't use the word "summary" (use "profile" or "overview" instead)
- Don't be generic. Every point must reference THEIR specific resume
- Don't hide behind hedging language ("might", "somewhat", "could be")
- Don't lecture. Explain like you're talking to someone you respect
- Don't be cruel. Be honest, but remember there's a real person reading this
- Don't forget to acknowledge what's WORKING on their resume

THE STRUCTURE (but make it flow naturally, not robotic):
1. THE REAL TALK (What you actually see + what it means for them)
2. ATS REALITY CHECK (Will they even get seen by a human?)
3. WHAT'S ACTUALLY WRONG (The specific stuff on THEIR resume)
4. HOW YOU STACK UP (Honest comparison to who's beating you)
5. THE FIX (Exactly what to change, step by step)
6. WHERE YOU CAN WIN (5 real jobs you're actually good for)
7. THE QUESTIONS WE NEED ANSWERED (So we can make you unstoppable)

Remember: You're writing to help them. They need this. Make it count.`;

    // User Prompt - Humanized and conversational
    const userPrompt = `Hey, I've got someone who needs real talk about their resume.

**Here's who we're working with:**
Name: ${candidateName}
What they're going for: ${targetRole || 'Not sure yet—that\'s part of the problem'}

**What I need from you:**
Give them the honest feedback they need but aren't getting. Not the "your resume is great" nonsense. The real truth about why they're not getting interviews, what's holding them back, and exactly what to fix.

Make it human. Make it hurt a little bit (because that's how we learn). Make it hopeful (because they CAN fix this). Make them feel like you're actually on their team.

**Here's their resume:**

---
${resumeText.substring(0, 18000)}
---

**Your task:**
Walk them through this like you're sitting across from them at coffee. Be real. Be specific (pull from THEIR resume, not generic advice). Connect with them. Make them want to fix this.

Hit these points naturally:
1. **The real first impression** - What does this resume say about them? What's the biggest blocker?
2. **ATS reality** - Will a robot even let a human see this, or is it getting filtered out?
3. **The actual problems** - Quote their specific resume and explain why each thing matters
4. **The competition** - Where do they rank? What's the gap between them and people who ARE getting calls?
5. **The blueprint** - Exactly how to fix it (show before/after on their actual content)
6. **Jobs they can get** - 5 real positions they're actually qualified for TODAY
7. **The questions we need answered** - To help them optimize even more

**The vibe:**
- Conversational (use "you", "we", contractions)
- Specific (reference their actual resume, not generic advice)
- Honest (don't sugarcoat, but don't be cruel)
- Hopeful (show them the path forward)
- Warm (they need to feel like you believe in them)

Go. Make it count.`;

    console.log(`   📡 Calling OpenAI with humanized prompt...`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.85,
        max_tokens: 5500,
        top_p: 0.95
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status);
      console.error('   Details:', errorText.substring(0, 300));
      
      return {
        success: false,
        error: `OpenAI API error: ${response.status}`,
        details: errorText.substring(0, 200)
      };
    }
    
    const data = await response.json();
    const critique = data.choices?.[0]?.message?.content;
    
    if (!critique) {
      return {
        success: false,
        error: 'No response from OpenAI API'
      };
    }
    
    console.log(`   ✅ Critique generated (${critique.length} chars)`);
    console.log(`   📊 Tokens used: ${data.usage?.total_tokens || 'unknown'}`);
    
    // Verify constraint: no use of word "summary" (case-insensitive)
    const summaryPattern = /\bsummary\b/gi;
    const summaryMatches = critique.match(summaryPattern) || [];
    
    if (summaryMatches.length > 0) {
      console.warn(`   ⚠️  Found ${summaryMatches.length} instances of word "summary", cleaning...`);
      
      let cleanedCritique = critique
        .replace(/professional\s+summary/gi, 'professional profile')
        .replace(/career\s+summary/gi, 'career overview')
        .replace(/executive\s+summary/gi, 'executive overview')
        .replace(/summary\s+section/gi, 'profile section')
        .replace(/\bsummary\b/gi, 'overview');
      
      if (cleanedCritique !== critique) {
        console.log(`   ✅ Cleaned constraint violations`);
        return {
          success: true,
          critique: cleanedCritique.trim(),
          tokens: data.usage?.total_tokens || 0,
          model: 'gpt-4o-mini',
          cleaned: true,
          humanized: true
        };
      }
    }
    
    // Extract ATS compliance rating from critique
    const atsRating = extractATSRating(critique);
    
    return {
      success: true,
      critique: critique.trim(),
      tokens: data.usage?.total_tokens || 0,
      model: 'gpt-4o-mini',
      cleaned: false,
      humanized: true,
      atsCompliance: atsRating
    };
    
  } catch (error) {
    console.error('❌ Critique generation error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract ATS compliance rating from critique
 */
function extractATSRating(critique) {
  const compliantPatterns = [
    /🟢.*?(?:COMPLIANT|CLEAR|GOOD).*?(?:\n|$)/i,
    /ATS.*?(?:✅|PASS|COMPLIANT)/i,
    /will.*?(?:get|pass|survive).*?ATS/i
  ];
  
  const partialPatterns = [
    /🟡.*?(?:PARTIAL|SOME|ISSUES)/i,
    /ATS.*?(?:some|mixed|partial)/i,
    /might.*?(?:struggle|have trouble)/i
  ];
  
  const nonCompliantPatterns = [
    /🔴.*?(?:NON-COMPLIANT|WON'T|BLOCKED)/i,
    /ATS.*?(?:BLOCK|REJECT|FAIL)/i,
    /will.*?(?:get filtered|be rejected)/i
  ];

  for (const pattern of compliantPatterns) {
    if (pattern.test(critique)) {
      return { 
        rating: 'COMPLIANT', 
        icon: '🟢', 
        color: 'green',
        text: 'Your resume will get through to humans'
      };
    }
  }

  for (const pattern of partialPatterns) {
    if (pattern.test(critique)) {
      return { 
        rating: 'PARTIAL', 
        icon: '🟡', 
        color: 'yellow',
        text: 'Some ATS systems might have issues'
      };
    }
  }

  for (const pattern of nonCompliantPatterns) {
    if (pattern.test(critique)) {
      return { 
        rating: 'NON-COMPLIANT', 
        icon: '🔴', 
        color: 'red',
        text: 'Most ATS systems will filter you out'
      };
    }
  }

  return { 
    rating: 'UNKNOWN', 
    icon: '❓', 
    color: 'gray',
    text: 'Check the ATS feedback above'
  };
}

/**
 * Save critique to file
 */
async function saveCritiqueToFile(critique, candidateName) {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `critique_${candidateName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.txt`;
    const filePath = require('path').join(process.cwd(), 'critiques', fileName);
    
    const critiqueDir = require('path').dirname(filePath);
    if (!fs.existsSync(critiqueDir)) {
      fs.mkdirSync(critiqueDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, critique, 'utf8');
    console.log(`   💾 Critique saved to: ${filePath}`);
    
    return {
      success: true,
      filePath: filePath
    };
  } catch (error) {
    console.error('❌ Failed to save critique:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Format critique for email - warm and engaging
 */
function formatCritiqueForEmail(critique, candidateName, atsCompliance = null) {
  const atsLine = atsCompliance 
    ? `\n[ATS CHECK: ${atsCompliance.icon} ${atsCompliance.text}]\n`
    : '';
  
  return `Hey ${candidateName},

I've been through your resume with a fine-tooth comb, and I've got some real talk for you. Not the "everything's great" kind of feedback. The kind that actually helps.

Here's what I found.${atsLine}

---

${critique}

---

**Here's the deal:** You've got the foundations to make this work. These fixes are totally doable—we're talking days, not months. The changes I've outlined above? Those are your path to getting in front of actual hiring managers instead of getting lost in the algorithm.

Pick the top 3 things from the blueprint and start there. You'll feel the difference immediately.

If you want to talk through any of this or need clarification, hit me up. I'm rooting for you.

Let's make your resume actually work for you.

Deepa Rajan
Career Strategy
9036846673
deeparajan890@gmail.com`;
}

/**
 * Analyze critique severity
 */
function analyzeCritiqueSeverity(critique) {
  const keywords = {
    blocking: (critique.match(/(?:blocking|kill|dead|doomed|instant reject)/gi) || []).length,
    serious: (critique.match(/(?:critical|major|serious|urgent)/gi) || []).length,
    fixable: (critique.match(/(?:easy fix|straightforward|simple|just need)/gi) || []).length,
    wins: (critique.match(/(?:strong|good|great|working|stands out)/gi) || []).length
  };
  
  const totalIssues = keywords.blocking + keywords.serious;
  
  let riskLevel = 'LOW';
  if (keywords.blocking > 0) {
    riskLevel = 'CRITICAL';
  } else if (keywords.serious > 2) {
    riskLevel = 'HIGH';
  } else if (totalIssues > 1) {
    riskLevel = 'MEDIUM';
  }
  
  return {
    blocking: keywords.blocking,
    serious: keywords.serious,
    fixable: keywords.fixable,
    wins: keywords.wins,
    riskLevel: riskLevel,
    feeling: keywords.wins > 0 ? '👍 Has potential' : '⚠️ Needs work'
  };
}

/**
 * Extract action items from critique
 */
function extractActionItems(critique) {
  const lines = critique.split('\n');
  const items = [];
  let inActionSection = false;
  
  for (const line of lines) {
    if (line.toLowerCase().includes('blueprint') || line.toLowerCase().includes('fix')) {
      inActionSection = true;
      continue;
    }
    
    if (inActionSection && (line.match(/^\d+\./) || line.match(/^[-•]/))) {
      items.push(line.trim());
    }
    
    if (inActionSection && (line.toLowerCase().includes('job') || line.toLowerCase().includes('role'))) {
      break;
    }
  }
  
  return items.length > 0 ? items : ['Review the blueprint above and start with the top priority fixes'];
}

/**
 * Create comprehensive action plan
 */
function createActionPlan(critique, candidateName) {
  const severity = analyzeCritiqueSeverity(critique);
  
  return {
    candidate: candidateName,
    timestamp: new Date().toISOString(),
    critique: critique,
    actionItems: extractActionItems(critique),
    severity: severity,
    timeline: severity.riskLevel === 'CRITICAL' ? '3-5 days' : '7-14 days',
    nextStep: severity.blocking > 0 ? 'Address blocking issues first' : 'Implement improvements in order',
    feeling: severity.feeling
  };
}

module.exports = {
  generateResumeCritique,
  saveCritiqueToFile,
  formatCritiqueForEmail,
  analyzeCritiqueSeverity,
  extractActionItems,
  createActionPlan,
  extractATSRating
};