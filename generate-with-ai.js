require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,        'X-Title': 'CUET-Generator',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(body);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function generateQuestionsForChapter(chapterPath) {
  try {
    const chapter = JSON.parse(fs.readFileSync(chapterPath, 'utf8'));
    const chapterTitle = chapter.title;
    
    console.log(`\n📚 Processing: ${chapterTitle}`);
    console.log('⏳ Calling OpenRouter API...');

    const prompt = `Generate 20-30 CUET assertion-reason questions for: ${chapterTitle}

Topics: ${chapter.recurringTopics.join(', ')}

Timeline: ${chapter.timeline.map(t => t.year + ': ' + t.event).join(' | ')}

Mind Map: ${chapter.mindMap.map(m => m.cause + ' → ' + m.consequence).join(' | ')}

Key Figures: ${chapter.historians.map(h => h.name + ': ' + h.argument).join(' | ')}

STRICT REQUIREMENTS:
1. Return ONLY a valid JSON array
2. No markdown, no explanations, just the JSON array
3. Each question must have: question_id (number), assertion (string), reason (string), options (array of 4 strings starting with A., B., C., D.), answer (string: A/B/C/D)
4. Cover each recurring topic at least once, and include timeline, mind map, historian, and source concepts.
5. Focus on the chapter's core message and crux—questions should teach key ideas, reflect the NCERT chapter, and match CUET exam style.
6. Mix difficulty levels
6. Answer distribution: ~40% A, ~25% B, ~20% C, ~15% D

Start with [ and end with ]`;

    const requestBody = JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 3500
    });

    const response = await makeRequest(requestBody);
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch (err) {
      try {
        fs.writeFileSync('debug_generate_with_ai_response.txt', response, 'utf8');
      } catch (wErr) {
        console.error('Unable to write debug file:', wErr.message);
      }
      throw new Error('Failed to parse API response JSON: ' + err.message);
    }

    if (!parsed.choices || !parsed.choices[0]) {
      throw new Error('Invalid API response structure');
    }

    const content = parsed.choices[0].message.content;
    console.log('✅ API Response received');
    console.log('🔍 Extracting JSON...');

    // Extract JSON array from content
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response: ' + content.substring(0, 200));
    }

    let questions;
    try {
      questions = JSON.parse(jsonMatch[0]);
    } catch (err) {
      try {
        fs.writeFileSync('debug_generate_with_ai_content.txt', jsonMatch[0], 'utf8');
      } catch (wErr) {
        console.error('Unable to write debug file:', wErr.message);
      }
      throw new Error('Failed to parse JSON array from AI content: ' + err.message);
    }
    console.log(`📝 Generated ${questions.length} questions`);

    // Remove old questions if exist
    if (chapter.assertionReasonQuestions) {
      delete chapter.assertionReasonQuestions;
    }

    // Add new questions
    chapter.assertionReasonQuestions = questions;

    // Write back
    fs.writeFileSync(chapterPath, JSON.stringify(chapter, null, 2));
    console.log(`✅ Saved to file!`);

    return true;
  } catch (error) {
    console.error(`❌ Error:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 CUET Assertion-Reason Question Generator');
  console.log('==========================================\n');

  const dbPath = path.join(__dirname, 'database');
  const files = fs.readdirSync(dbPath).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('❌ No chapter files found in database folder');
    return;
  }

  console.log(`Found ${files.length} chapter(s)\n`);

  for (const file of files) {
    const filePath = path.join(dbPath, file);
    const success = await generateQuestionsForChapter(filePath);
    
    if (success) {
      // Wait before next request to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n✨ All chapters processed!');
}

main().catch(console.error);

