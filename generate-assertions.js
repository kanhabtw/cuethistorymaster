require('dotenv').config();
require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error('Missing OPENROUTER_API_KEY in .env');
  process.exit(1);
}

async function generateAssertionReasons(chapterData, chapterTitle) {
  const prompt = `You are a CUET history exam expert. Generate assertion-reason questions for the following chapter.

Chapter: ${chapterTitle}

Recurring Topics: ${chapterData.recurringTopics.join(', ')}

Timeline Events:
${chapterData.timeline.map(t => `- ${t.year}: ${t.event}`).join('\n')}

Key Concepts from Mind Map:
${chapterData.mindMap.map(m => `- ${m.cause} → ${m.consequence}: ${m.explanation}`).join('\n')}

Historians/Arguments:
${chapterData.historians.map(h => `- ${h.name}: ${h.argument}`).join('\n')}

Sources:
${chapterData.sources.map(s => `- ${s.type}: ${s.description}`).join('\n')}

Generate 20-30 assertion-reason questions in VALID JSON format ONLY.

Requirements:
1. Each question must have: question_id, assertion, reason, options (array of 4), answer (A/B/C/D)
2. Cover each recurring topic at least once, and include timeline events, mind map concepts, historians, and sources.
3. Focus on the chapter's central themes and crux, and make the questions strongly aligned with CUET exam style and learning objectives.
4. Mix difficulty levels (easy, medium, hard)
4. Use realistic CUET-style language and distinct questions.
5. Answer distribution: ~40% A, ~25% B, ~20% C, ~15% D

Return ONLY valid JSON array, no other text:
[
  {
    "question_id": 1,
    "assertion": "...",
    "reason": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "answer": "A"
  }
]`;

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,          'X-Title': 'CUET Assertion-Reason Generator'
        }
      }
    );

    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      throw new Error('No valid JSON found in response');
    }

    const questions = JSON.parse(jsonMatch[0]);
    return questions;
  } catch (error) {
    console.error(`Error generating questions for ${chapterTitle}:`, error.message);
    return null;
  }
}

async function processAllChapters() {
  const dbPath = path.join(__dirname, 'database');
  const files = fs.readdirSync(dbPath).filter(f => f.endsWith('.json'));

  console.log(`Found ${files.length} chapter(s) to process\n`);

  for (const file of files) {
    const filePath = path.join(dbPath, file);
    const chapterData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    console.log(`⏳ Generating questions for: ${chapterData.title}...`);

    const questions = await generateAssertionReasons(chapterData, chapterData.title);

    if (questions) {
      // Remove old assertionReasonQuestions if exists
      if (chapterData.assertionReasonQuestions) {
        delete chapterData.assertionReasonQuestions;
      }

      // Add new questions
      chapterData.assertionReasonQuestions = questions;

      // Write back to file
      fs.writeFileSync(filePath, JSON.stringify(chapterData, null, 2));
      console.log(`✅ Added ${questions.length} questions to ${chapterData.title}\n`);
    } else {
      console.log(`❌ Failed to generate questions for ${chapterData.title}\n`);
    }

    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('🎉 All chapters processed!');
}

// Run the script
processAllChapters().catch(console.error);

