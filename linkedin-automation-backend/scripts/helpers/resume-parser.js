// helpers/resume-parser.js - FIXED VERSION (DOCX Support + Safe URI Decode)
const fs = require('fs');

// Try multiple parsing methods for PDF and DOCX
async function parseDocument(filePath, fileExtension) {
  try {
    const ext = fileExtension.toLowerCase();
    
    if (ext === '.pdf') {
      return await parsePDF(filePath);
    } else if (ext === '.docx') {
      return await parseDOCX(filePath);
    } else {
      return {
        success: false,
        text: '',
        method: 'unsupported',
        error: `Unsupported file type: ${ext}`
      };
    }
  } catch (error) {
    return {
      success: false,
      text: '',
      method: 'error',
      error: error.message
    };
  }
}

// ✅ NEW: Parse DOCX files using mammoth
async function parseDOCX(filePath) {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    
    if (result && result.value) {
      console.log('✅ DOCX parsed successfully with mammoth');
      return {
        success: true,
        text: result.value,
        method: 'mammoth'
      };
    }
    
    throw new Error('No text extracted from DOCX');
    
  } catch (error) {
    console.log('📄 mammoth DOCX parsing failed:', error.message);
    return {
      success: false,
      text: '',
      method: 'mammoth',
      error: error.message
    };
  }
}

// Try multiple PDF parsing methods
async function parsePDF(filePath) {
  try {
    // Method 1: Try pdf-parse first (most reliable)
    try {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      console.log('✅ PDF parsed successfully with pdf-parse');
      return { success: true, text: data.text, method: 'pdf-parse' };
    } catch (error) {
      console.log('📄 pdf-parse failed:', error.message);
    }

    // Method 2: Try pdf2json (FIXED - Safe URI decode with try-catch)
    try {
      const PDFParser = require('pdf2json');
      return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser();
        
        pdfParser.on('pdfParser_dataError', errData => 
          reject(new Error(errData.parserError))
        );
        
        pdfParser.on('pdfParser_dataReady', pdfData => {
          let text = '';
          try {
            pdfData.Pages.forEach(page => {
              page.Texts.forEach(textItem => {
                try {
                  // ✅ CRITICAL FIX: Safe URI decode with try-catch
                  const decodedText = safeDecodeURI(textItem.R[0].T);
                  text += decodedText + ' ';
                } catch (decodeError) {
                  // If decode fails, use the raw text
                  console.warn('   ⚠️  Failed to decode text item, using raw:', textItem.R[0].T.substring(0, 50));
                  text += (textItem.R[0].T || '') + ' ';
                }
              });
              text += '\n';
            });
            
            console.log('✅ PDF parsed successfully with pdf2json');
            resolve({ success: true, text: text.trim(), method: 'pdf2json' });
          } catch (processingError) {
            reject(new Error('Error processing PDF data: ' + processingError.message));
          }
        });
        
        pdfParser.loadPDF(filePath);
      });
    } catch (error) {
      console.log('📄 pdf2json failed:', error.message);
    }

    // Method 3: Fallback - use command line tool
    try {
      const { execSync } = require('child_process');
      
      // Try pdftotext (most reliable if installed)
      try {
        const text = execSync(`pdftotext "${filePath}" - 2>/dev/null`, { 
          encoding: 'utf8', 
          maxBuffer: 10 * 1024 * 1024 
        });
        if (text && text.trim().length > 10) {
          console.log('✅ PDF parsed successfully with pdftotext');
          return { success: true, text: text, method: 'pdftotext' };
        }
      } catch (e) {
        console.log('📄 pdftotext not available');
      }
      
      // Final fallback - return basic info
      const stats = fs.statSync(filePath);
      console.log('❌ All PDF parsing methods failed');
      return { 
        success: false, 
        text: `PDF file (${Math.round(stats.size/1024)} KB) - Manual extraction required`,
        method: 'fallback',
        error: 'No PDF parser available'
      };
      
    } catch (error) {
      console.log('📄 Command line fallback failed:', error.message);
      return { 
        success: false, 
        text: 'PDF parsing failed', 
        method: 'none',
        error: error.message 
      };
    }
    
  } catch (error) {
    console.log('📄 Overall PDF parsing error:', error.message);
    return { 
      success: false, 
      text: 'PDF parsing error', 
      method: 'error',
      error: error.message 
    };
  }
}

/**
 * ✅ CRITICAL FIX: Safe URI decode that doesn't throw on malformed input
 */
function safeDecodeURI(encodedString) {
  if (!encodedString) return '';
  
  try {
    // Try normal decoding first
    return decodeURIComponent(encodedString);
  } catch (error) {
    // If it fails, it's likely not properly URI-encoded
    // Return the original string or a sanitized version
    console.warn('   ⚠️  decodeURIComponent failed, using fallback for:', encodedString.substring(0, 30));
    
    try {
      // Try decoding as UTF-8 manually
      return Buffer.from(encodedString, 'utf8').toString('utf8');
    } catch (e) {
      // Last resort: return as-is
      return String(encodedString);
    }
  }
}

async function extractEmailFromResume(filePath, fileExtension) {
  try {
    console.log(`🔍 [Email Extraction] Starting for: ${filePath}`);
    
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    // Use parseDocument for both PDF and DOCX
    const result = await parseDocument(filePath, fileExtension);
    console.log(`📄 [Email Extraction] Used method: ${result.method}`);
    
    if (!result.success) {
      return { success: false, error: result.error || 'Document parsing failed' };
    }
    
    const text = result.text || '';
    console.log(`🔍 [Email Extraction] Text length: ${text.length} chars`);
    
    // Email regex pattern
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex);
    
    console.log(`🔍 [Email Extraction] Found emails:`, emails);
    
    if (emails && emails.length > 0) {
      console.log(`✅ [Email Extraction] Email found: ${emails[0]}`);
      return { success: true, email: emails[0] };
    }
    
    return { success: false, error: 'No email found' };
    
  } catch (error) {
    console.error('❌ [Email Extraction] Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function extractExperienceYears(filePath, fileExtension) {
  try {
    console.log(`🔍 [Experience Extraction] Starting for: ${filePath}`);
    
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: 'File not found', years: 0 };
    }

    // Use parseDocument for both PDF and DOCX
    const result = await parseDocument(filePath, fileExtension);
    
    if (!result.success) {
      return { success: false, error: result.error, years: 0 };
    }
    
    const text = result.text || '';
    
    // Enhanced experience extraction
    const experiencePatterns = [
      /(\d+)\s*\+?\s*years?[\s\w]*experience/gi,
      /experience.*?(\d+)\s*\+?\s*years?/gi,
      /(\d+)\s*\+?\s*years?.*?(?:experience|work|industry)/gi
    ];
    
    let maxYears = 0;
    
    for (const pattern of experiencePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const yearMatch = match.match(/\d+/);
          if (yearMatch) {
            const years = parseInt(yearMatch[0]);
            if (years > maxYears && years < 50) { // Sanity check
              maxYears = years;
            }
          }
        });
      }
    }
    
    console.log(`✅ [Experience Extraction] Found: ${maxYears} years`);
    return { success: true, years: maxYears || 0 };
    
  } catch (error) {
    console.error('❌ [Experience Extraction] Error:', error.message);
    return { success: false, error: error.message, years: 0 };
  }
}

module.exports = {
  extractEmailFromResume,
  extractExperienceYears,
  parsePDF,
  parseDocument,
  parseDOCX,
  safeDecodeURI
};