/**
 * Resume Critique Template Module
 * 
 * IMPORTANT: Uses ONLY your custom template - NO AI analysis
 * Same critique template is applied to ALL resumes
 * 
 * This template is sent via Gmail to candidates
 */

const fs = require('fs');
const path = require('path');

// ===========================================
// YOUR CUSTOM CRITIQUE TEMPLATE
// Used for ALL resumes - no AI analysis
// ===========================================
const CRITIQUE_TEMPLATE = `1. Strong Experience, Weak Positioning
The résumé contains meaningful experience and effort, but the overall positioning does not clearly communicate the candidate's value. Instead of presenting a compelling professional narrative, the document reads like a record of activities and responsibilities. Recruiters and hiring managers look for impact, decision-making, and outcomes, which are currently under-emphasized.
The résumé should position the candidate as someone who delivers results, not just someone who performs tasks.

2. Lack of Clear Professional Branding
The résumé does not establish a strong professional identity in the opening section. Without a clear headline or summary that defines expertise, strengths, and direction, the candidate's profile feels generic and difficult to differentiate.
A résumé must immediately answer:
Who is this candidate?
What problems do they solve?
Why should they be considered for the next level?
Without this clarity, even strong profiles risk being overlooked.

3. Achievements Are Present but Not Highlighted
There are valuable accomplishments throughout the résumé, but they are embedded within long paragraphs or routine job descriptions. Key outcomes such as improvements, optimizations, innovations, or contributions are not visually or structurally emphasized.
Recruiters scan, not read.
Achievements must be clearly visible, concise, and outcome-focused, ideally showing business, technical, academic, or operational impact.

4. Overemphasis on Responsibilities Instead of Results
Most sections focus on what the candidate was responsible for rather than what the candidate achieved. This creates the impression of passive involvement instead of ownership and accountability.
A strong résumé demonstrates:
What was improved
What was solved
What value was created
What changed because of the candidate's contribution
Without this shift, the profile appears operational rather than impactful.

5. Leadership and Initiative Are Underrepresented
The résumé does not clearly articulate leadership behaviors such as ownership, initiative, collaboration, or influence. Even when leadership experience exists, it is not explicitly stated.
In the absence of clear leadership signals, hiring managers may assume the candidate is suited only for execution-level roles, limiting opportunities for growth-oriented positions.

6. Length and Information Density Reduce Effectiveness
The résumé includes more information than necessary, which reduces clarity and focus. Extended descriptions, repetitive content, or detailed lists overwhelm the reader and dilute key strengths.
An effective résumé prioritizes relevance over completeness. Supporting details should enhance the profile, not dominate it.

7. Supporting Content Lacks Strategic Context
Sections such as projects, publications, certifications, or additional work are listed without explaining their relevance or impact. Without context, these elements appear informational rather than valuable.
Every section should answer a simple question:
"How does this strengthen the candidate's profile for the role they are targeting?"

8. Overall Narrative Needs Strategic Alignment
The résumé does not clearly guide the reader toward the candidate's next logical role. There is no strong storyline connecting skills, experience, and future potential.
A well-positioned résumé should naturally lead the reader to conclude:
"This candidate is ready for greater responsibility and impact."

FINAL ASSESSMENT
This résumé reflects effort and capability but lacks strategic presentation. Due to weak positioning, dense content, and limited emphasis on outcomes and leadership, the candidate's potential is not fully visible.
As a result, the résumé risks being evaluated below the candidate's true capability level.

KEY RECOMMENDATIONS
Introduce a strong opening summary that clearly defines professional value
Shift from responsibility-based descriptions to impact-driven achievements
Highlight leadership, ownership, and cross-functional collaboration
Reduce length and remove low-impact or repetitive content
Structure the résumé to tell a clear, forward-looking career story

CONCLUSION
This résumé does not suffer from a lack of experience or skill, but from how that experience is communicated. With improved structure, clarity, and outcome-focused storytelling, the same profile can compete more effectively and unlock higher-quality opportunities.`;

/**
 * Get the critique template for a candidate
 * @param {string} candidateName - Name of the candidate
 * @param {object} options - Optional customization
 * @returns {string} Formatted critique
 */
function getCritique(candidateName, options = {}) {
  const {
    includeHeader = true,
    includeName = true,
    customNote = ''
  } = options;

  let critique = '';

  if (includeHeader) {
    critique += 'RESUME CRITIQUE\n';
    critique += '─'.repeat(60) + '\n\n';
  }

  if (includeName && candidateName) {
    critique += `Candidate: ${candidateName}\n`;
    critique += '─'.repeat(60) + '\n\n';
  }

  critique += CRITIQUE_TEMPLATE;

  if (customNote) {
    critique += '\n\n' + customNote;
  }

  return critique;
}

/**
 * Get short version (first 4 points) for quick feedback
 * @param {string} candidateName - Name of the candidate
 */
function getShortCritique(candidateName) {
  const shortPoints = [
    "1. Strong Experience, Weak Positioning",
    "The résumé contains meaningful experience but lacks clear value communication. Recruiters look for impact, decision-making, and outcomes.",
    "",
    "2. Lack of Clear Professional Branding",
    "No clear headline or summary that defines expertise. A résumé must immediately answer: Who is this candidate? What problems do they solve?",
    "",
    "3. Achievements Are Present but Not Highlighted",
    "Accomplishments are embedded in paragraphs. Key outcomes are not visually emphasized. Recruiters scan, not read.",
    "",
    "4. Overemphasis on Responsibilities Instead of Results",
    "Focus is on what was responsible for rather than what was achieved. Shows passive involvement, not ownership."
  ];

  let critique = `RESUME CRITIQUE - ${candidateName}\n`;
  critique += '─'.repeat(40) + '\n\n';
  critique += shortPoints.join('\n');
  critique += '\n\n[See full critique for points 5-8 and recommendations]';

  return critique;
}

/**
 * Get Gmail-ready version (pre-formatted for email)
 * @param {string} candidateName - Name of the candidate
 * @param {string} senderName - Your name/company
 */
function getGmailCritique(candidateName, senderName = 'Your Company') {
  const critique = `Dear ${candidateName},

Thank you for sharing your resume with us. After careful review, I would like to provide you with some feedback to help strengthen your application.

${CRITIQUE_TEMPLATE}

Please feel free to reach out if you would like to discuss any of these points in more detail.

Best regards,
${senderName}`;

  return critique;
}

/**
 * Save critique to file
 * @param {string} candidateName - Name of candidate
 * @param {string} critique - Critique text
 * @param {string} outputDir - Output directory
 */
function saveCritique(candidateName, critique, outputDir = 'critiques') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sanitizedName = candidateName.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = Date.now();
  const filePath = path.join(outputDir, `critique_${sanitizedName}_${timestamp}.txt`);

  fs.writeFileSync(filePath, critique);
  return filePath;
}

/**
 * Extract candidate name from resume
 * @param {string} resumeText - Raw resume text
 * @returns {string} Candidate name
 */
function extractCandidateName(resumeText) {
  const lines = resumeText.split('\n').filter(l => l.trim().length > 0);
  
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    // Simple heuristic: name is short, no special chars
    if (firstLine.length > 2 && firstLine.length < 50 && !/[@•\-\d]/.test(firstLine)) {
      return firstLine;
    }
  }
  
  return 'Candidate';
}

/**
 * Get template statistics
 */
function getTemplateStats() {
  const lines = CRITIQUE_TEMPLATE.split('\n').length;
  const words = CRITIQUE_TEMPLATE.split(/\s+/).length;
  
  return {
    points: 8,
    lines: lines,
    words: words,
    hasFinalAssessment: CRITIQUE_TEMPLATE.includes('FINAL ASSESSMENT'),
    hasRecommendations: CRITIQUE_TEMPLATE.includes('KEY RECOMMENDATIONS'),
    hasConclusion: CRITIQUE_TEMPLATE.includes('CONCLUSION')
  };
}

module.exports = {
  CRITIQUE_TEMPLATE,
  getCritique,
  getShortCritique,
  getGmailCritique,
  saveCritique,
  extractCandidateName,
  getTemplateStats
};

