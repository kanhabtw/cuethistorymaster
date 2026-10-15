require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function generateQuestions(chapterData, chapterTitle) {
  const prompt = `You are a CUET history exam expert. Generate assertion-reason questions for this chapter.

Chapter: ${chapterTitle}

Topics: ${chapterData.recurringTopics.join(', ')}

Timeline: ${chapterData.timeline.map(t => t.year + ': ' + t.event).join(' | ')}

Generate 20-30 assertion-reason questions. Each has assertion, reason, and 4 options.
Answer options: A=both true + reason explains, B=both true + reason doesn't explain, C=assertion true + reason false, D=both false

Ensure every recurring topic appears in at least one question and cover timeline, mind map, historians, and sources where possible.
Make the questions capture the chapter's main themes and key ideas so students learn the chapter's crux while answering, and ensure they read like CUET assertion-reason items.

Return ONLY valid JSON array with no other text:
[{"question_id":1,"assertion":"...","reason":"...","options":["A....","B....","C....","D...."],"answer":"A"}]`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{role: 'user', content: prompt}],
      temperature: 0.7,
      max_tokens: 3000
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,        'X-Title': 'CUET-Generator',
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          let json;
          try {
            json = JSON.parse(body);
          } catch (parseErr) {
            try {
              fs.writeFileSync('debug_api_generator_body.txt', body, 'utf8');
            } catch (wErr) {
              console.error('Unable to write debug file:', wErr.message);
            }
            return reject(new Error('Failed to parse API response body as JSON: ' + parseErr.message));
          }

          const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
          const jsonMatch = content ? content.match(/\[[\s\S]*\]/) : null;
          if (jsonMatch) {
            try {
              resolve(JSON.parse(jsonMatch[0]));
            } catch (e) {
              try {
                fs.writeFileSync('debug_api_generator_content.txt', jsonMatch[0], 'utf8');
              } catch (wErr) {
                console.error('Unable to write debug file:', wErr.message);
              }
              return reject(new Error('Failed to parse JSON array from AI content: ' + e.message));
            }
          } else {
            reject(new Error('No JSON array found in AI content'));
          }
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

async function main() {
  const chapterPath = path.join(__dirname, 'database', 'bhakti-sufi.json');
  const chapter = JSON.parse(fs.readFileSync(chapterPath, 'utf8'));

  console.log(`Generating for: ${chapter.title}...`);
  
  try {
    const questions = await generateQuestions(chapter, chapter.title);
    
    if (chapter.assertionReasonQuestions) {
      delete chapter.assertionReasonQuestions;
    }
    
    chapter.assertionReasonQuestions = questions;
    fs.writeFileSync(chapterPath, JSON.stringify(chapter, null, 2));
    
    console.log(`✅ Added ${questions.length} assertion-reason questions!`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();

