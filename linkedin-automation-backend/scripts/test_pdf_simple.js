// scripts/test_pdf_simple.js
const fs = require('fs');
const pdf = require('pdf-parse');

async function testPDF() {
  try {
    console.log('🔍 Testing PDF parsing with pdf-parse...\n');
    
    // Test with one of your downloaded resumes
    const testFile = './downloads/resumes/unreadable/resume_Bahaa_Aldwaikat_1764169390284.pdf';
    
    if (!fs.existsSync(testFile)) {
      console.log('❌ Test file not found');
      return;
    }
    
    console.log('📄 Reading PDF file...');
    const dataBuffer = fs.readFileSync(testFile);
    
    console.log('🔧 Parsing PDF...');
    const data = await pdf(dataBuffer);
    
    console.log('✅ SUCCESS! PDF parsed successfully');
    console.log(`📝 Text length: ${data.text.length} characters`);
    console.log(`📄 Pages: ${data.numpages}`);
    console.log(`🔤 First 500 chars:\n${data.text.substring(0, 500)}...`);
    
  } catch (error) {
    console.log('❌ PDF parsing failed:', error.message);
    console.log('Error stack:', error.stack);
  }
}

testPDF();