const fs = require('fs');
const path = require('path');  // Add this line

// Simple fallback PDF text extraction
async function extractTextFromPDF(filePath) {
  try {
    // Try using a command-line tool as fallback
    const { execSync } = require('child_process');
    
    // Try pdftotext if available (most reliable)
    try {
      const text = execSync(`pdftotext "${filePath}" - 2>/dev/null`, { encoding: 'utf8' });
      if (text && text.length > 10) {
        return text;
      }
    } catch (e) {
      // pdftotext not available or failed
    }
    
    // Fallback: Return basic file info
    const stats = fs.statSync(filePath);
    return `PDF file: ${path.basename(filePath)} (${Math.round(stats.size/1024)} KB) - Manual review required for detailed analysis.`;
    
  } catch (error) {
    console.error('PDF extraction failed:', error.message);
    return "PDF content extraction failed - manual review required";
  }
}

module.exports = { extractTextFromPDF };