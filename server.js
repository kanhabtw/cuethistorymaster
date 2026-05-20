require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const compression = require('compression');
const helmet = require('helmet');

// PDF parsing helper
async function parsePDF(dataBuffer) {
    try {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: dataBuffer });
        return await parser.getText();
    } catch (error) {
        console.error('PDF parsing error:', error);
        throw new Error('Failed to parse PDF: ' + error.message);
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure necessary directories exist
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const pdfDir = path.join(__dirname, 'ncert_pdfs');
if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serve static frontend files

// ==================== SEO OPTIMIZATION MIDDLEWARE ====================

// 1. GZIP Compression
app.use(compression());

// 2. Security Headers for SEO & Safety
app.use(helmet({
    contentSecurityPolicy: false, // Configure based on your needs
}));

// 3. Add X-Robots-Tag header
app.use((req, res, next) => {
    res.set('X-Robots-Tag', 'index, follow');
    next();
});

// 4. Remove X-Powered-By header (security)
app.disable('x-powered-by');

// 5. Add proper Content-Type headers
app.use((req, res, next) => {
    if (req.path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (req.path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
    next();
});

// 6. Add Cache Headers for Static Files
app.use(express.static(path.join(__dirname), {
    maxAge: '1d',
    etag: false
}));

// 7. Sitemap Route
app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml');
    res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// 8. Robots.txt Route
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.sendFile(path.join(__dirname, 'robots.txt'));
});

// =====================================================================

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 'MISSING_KEY';

// List of chapters based on todolist.txt
const chapters = [
    { id: "harappan", title: "Harappan Civilisation and Archaeology", part: "Part 1" },
    { id: "early-states", title: "Political and Economic Systems in Early States: Inscriptional evidences", part: "Part 1" },
    { id: "social-histories", title: "Social histories of early societies: Mahabharata", part: "Part 1" },
    { id: "buddhism-jainism", title: "History of Buddhism and Jainism: Cultural developments", part: "Part 1" },
    { id: "medieval-travellers", title: "Medieval Society through Travellers Accounts", part: "Part 2" },
    { id: "bhakti-sufi", title: "Religious History: Bhakti-Sufi Traditions", part: "Part 2" },
    { id: "vijayanagara", title: "Vijayanagara Empire: Politics, Economy and Architecture", part: "Part 2" },
    { id: "mughal-agrarian", title: "The Mughal Empire and Agrarian Society", part: "Part 2" },
    { id: "colonialism-rural", title: "Colonialism and Rural Society: Evidence from Official Reports", part: "Part 3" },
    { id: "revolt-1857", title: "Revolt of 1857: Patterns and Representations", part: "Part 3" },
    { id: "gandhi-national", title: "Mahatma Gandhi and National Movements", part: "Part 3" },
    { id: "constitution", title: "The Making of the Constitution", part: "Part 3" }
];

app.get('/api/chapters', (req, res) => {
    res.json(chapters);
});

app.get('/api/chapter/:id', async (req, res) => {
    const { id } = req.params;
    const dbPath = path.join(__dirname, 'database', `${id}.json`);
    const pdfPath = path.join(__dirname, 'ncert_pdfs', `${id}.pdf`);

    const refresh = req.query.refresh === 'true';

    // 1. Check if we already processed this chapter and refresh was not requested
    if (fs.existsSync(dbPath) && !refresh) {
        console.log(`Serving cached data for ${id}`);
        let data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        if (!data.assertionReasonQuestions || data.assertionReasonQuestions.length === 0) {
            console.log(`Assertion-reason questions missing for ${id}, generating now...`);
            const generated = await generateAssertionReasonQuestions(dbPath);
            if (generated) {
                data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            }
        }

        return res.json(data);
    }
    if (refresh && fs.existsSync(dbPath)) {
        console.log(`Refreshing cache for ${id} due to refresh request.`);
    }

    // 2. If not, check if the PDF exists
    if (!fs.existsSync(pdfPath)) {
        return res.status(404).json({
            error: "PDF_MISSING",
            message: `Could not find ncert_pdfs/${id}.pdf. Please upload the chapter PDF to the ncert_pdfs folder and try again.`
        });
    }

    // 3. Process the PDF
    try {
        if (OPENROUTER_API_KEY === 'MISSING_KEY' || !process.env.OPENROUTER_API_KEY) {
            return res.status(500).json({ error: "API_KEY_MISSING", message: "Please set your OPENROUTER_API_KEY in the .env file." });
        }

        console.log(`Parsing PDF for ${id}...`);
        const dataBuffer = fs.readFileSync(pdfPath);
        
        const pdfData = await parsePDF(dataBuffer);
        let text = pdfData.text;

        // Truncate text to prevent 413 Payload Too Large errors
        const MAX_TEXT_LENGTH = 50000;
        if (text.length > MAX_TEXT_LENGTH) {
            console.log(`Text truncated from ${text.length} to ${MAX_TEXT_LENGTH} characters`);
            text = text.substring(0, MAX_TEXT_LENGTH) + '\n[... text truncated for API limits ...]';
        }

        console.log(`Sending data to OpenRouter for ${id}...`);

        const prompt = `
You are an expert history educator preparing students for the CUET exam based strictly on the NCERT syllabus.
Generate exactly 5 past year questions (one for each year: 2021, 2022, 2023, 2024, 2025) based on this chapter text.

Return ONLY this JSON (no markdown, no explanations):
{
    "id": "${id}",
    "title": "Chapter Title",
    "part": "Part 1, 2, or 3",
    "recurringTopics": ["topic 1", "topic 2", "topic 3", "topic 4", "topic 5", "topic 6"],
    "timeline": [{"year": "Year/Date", "event": "Description"}],
    "mindMap": [
        {"cause": "...", "event": "...", "consequence": "...", "explanation": "How they connect"},
        {"cause": "...", "event": "...", "consequence": "...", "explanation": "How they connect"},
        {"cause": "...", "event": "...", "consequence": "...", "explanation": "How they connect"}
    ],
    "historians": [{"name": "Name", "argument": "Their argument"}],
    "sources": [{"type": "Type", "description": "Description"}],
    "maps": "Map locations mentioned",
    "cuetNotes": ["Q: Question A: Answer"],
    "intextQuestions": [{"question": "Question?", "answer": "Complete answer"}],
    "pyq": [
        {"year": 2021, "question": "Question from 2021?", "options": ["A", "B", "C", "D"], "answer": "A"},
        {"year": 2022, "question": "Question from 2022?", "options": ["A", "B", "C", "D"], "answer": "B"},
        {"year": 2023, "question": "Question from 2023?", "options": ["A", "B", "C", "D"], "answer": "C"},
        {"year": 2024, "question": "Question from 2024?", "options": ["A", "B", "C", "D"], "answer": "D"},
        {"year": 2025, "question": "Question from 2025?", "options": ["A", "B", "C", "D"], "answer": "A"}
    ]
}

REQUIREMENTS:
- Identify 6-10 highly probable recurring topics for the CUET exam based on this chapter
- Generate 5-8 highly relevant "mindMap" (Conceptual Links) connections crucial for the CUET exam
- Generate exactly 5 PYQ questions (2021, 2022, 2023, 2024, 2025) - no more, no less
- Generate 4-6 in-text questions with COMPLETE answers (1-3 sentences each)
- Ensure the in-text questions focus on the chapter's main crux and central ideas, not only minor facts
- Make the questions teach the core themes so students learn the main message while answering them
- Create cuetNotes that highlight key takeaways and the main chapter essence
- Each PYQ must have unique question, 4 distinct options, and correct answer
- Use ONLY chapter content - no external information
- All answers must be filled (no empty fields)

Chapter text:
${text}
`;

        const result = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
            },
            {
                headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 60000
            }
        );

        let responseText = result.data?.choices?.[0]?.message?.content || '';

        // Clean up markdown code blocks if the AI includes them
        responseText = responseText.replace(/```json\n?|```/g, '').trim();

        let jsonData;
        try {
            jsonData = JSON.parse(responseText);
        } catch (err) {
            console.error('Failed to parse AI response JSON:', err.message);
            const preview = responseText ? responseText.slice(0, 1000) : '<empty>';
            try {
                fs.writeFileSync(path.join(__dirname, 'debug_ai_response.txt'), responseText, 'utf8');
            } catch (writeErr) {
                console.error('Unable to write debug_ai_response.txt:', writeErr.message);
            }
            return res.status(500).json({ error: 'AI_RESPONSE_PARSE_ERROR', message: `Failed to parse AI JSON response. Preview: ${preview}` });
        }

        // Validate and fix missing answers in intextQuestions
        if (jsonData.intextQuestions && Array.isArray(jsonData.intextQuestions)) {
            jsonData.intextQuestions = jsonData.intextQuestions.filter(q => q && q.question).map(q => ({
                question: q.question,
                answer: q.answer || "Answer not provided by AI"
            }));
        }

        // Validate pyq has answers and options
        if (jsonData.pyq && Array.isArray(jsonData.pyq)) {
            jsonData.pyq = jsonData.pyq.filter(q => q && q.question && q.options && q.answer);
        }

        // Save to database folder
        fs.writeFileSync(dbPath, JSON.stringify(jsonData, null, 2));

        if (!jsonData.assertionReasonQuestions || jsonData.assertionReasonQuestions.length === 0) {
            console.log(`Assertion-reason questions not present in generated chapter data for ${id}, generating now...`);
            await generateAssertionReasonQuestions(dbPath);
            jsonData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        }

        console.log(`Successfully generated and cached data for ${id}`);
        res.json(jsonData);

    } catch (error) {
        console.error("Error processing PDF:", {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
            code: error.code
        });
        
        let errorMessage = error.response?.data?.message || error.message;
        if (error.response?.status === 401) {
            errorMessage = "Invalid API key. Please check your OPENROUTER_API_KEY.";
        } else if (error.response?.status === 402) {
            errorMessage = "Payment required / billing issue. Please check your OpenRouter account balance and plan.";
        } else if (error.response?.status === 429) {
            errorMessage = "Rate limit exceeded. Please try again later.";
        }
        
        res.status(500).json({ error: "PROCESSING_FAILED", message: errorMessage });
    }
});

app.get('/api/insights/:id', async (req, res) => {
    const { id } = req.params;
    const dbPath = path.join(__dirname, 'database', `${id}.json`);

    if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: "NOT_FOUND", message: "Chapter data not found. Please load the chapter first." });
    }

    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        // If we already generated insights, return them
        if (data.aiInsights) {
            console.log(`Returning cached insights for ${id}`);
            return res.json(data.aiInsights);
        }

        if (OPENROUTER_API_KEY === 'MISSING_KEY' || !process.env.OPENROUTER_API_KEY) {
            return res.status(500).json({ error: "API_KEY_MISSING", message: "Please set your OPENROUTER_API_KEY in the .env file." });
        }

        console.log(`Generating AI Insights for ${id}...`);

        const prompt = `You are an expert history tutor preparing students for the CUET exam.
I will provide you with extracted JSON data for a history chapter.
Your task is to analyze this data and generate two highly useful study aids:
1. "mnemonic": A clever, easy-to-remember mnemonic to help remember the key dates, events, or lists in this chapter.
2. "examHack": A 'secret exam hack' detailing how examiners typically frame questions from this chapter or what trap to avoid.

Return the result strictly as a JSON object matching this schema:
{
    "mnemonic": "Your clever mnemonic here...",
    "examHack": "Your exam hack here..."
}
Do not include any markdown formatting outside the JSON.

Chapter Data:
${JSON.stringify({
    title: data.title,
    recurringTopics: data.recurringTopics,
    timeline: data.timeline,
    historians: data.historians,
    sources: data.sources
})}`;

        const result = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
            },
            {
                headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'CUET-History-Master/1.0'
                },
                timeout: 30000
            }
        );

        let responseText = result.data?.choices?.[0]?.message?.content || '';
        
        if (!responseText) {
            throw new Error('Empty response from API');
        }

        responseText = responseText.replace(/```json\n?|```/g, '').trim();

        const insightsData = JSON.parse(responseText);

        // Validate response has required fields
        if (!insightsData.mnemonic || !insightsData.examHack) {
            throw new Error('Response missing required fields: mnemonic or examHack');
        }

        // Cache insights in the database
        data.aiInsights = insightsData;
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

        console.log(`Successfully generated AI insights for ${id}`);
        res.json(insightsData);

    } catch (error) {
        console.error("Error generating insights:", {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
            code: error.code
        });
        
        let errorMessage = "Failed to generate AI insights.";
        if (error.response?.status === 401) {
            errorMessage = "Invalid API key. Please verify your OPENROUTER_API_KEY.";
        } else if (error.response?.status === 402) {
            errorMessage = "Payment required / billing issue. Please check your OpenRouter account balance and plan.";
        } else if (error.response?.status === 429) {
            errorMessage = "Rate limit exceeded. Please try again in a moment.";
        } else if (error.response?.status === 500) {
            errorMessage = "API server error. Please try again later.";
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = "Request timeout. API server is slow. Please try again.";
        } else if (error.message === 'Empty response from API') {
            errorMessage = "API returned empty response. Please try again.";
        } else if (error instanceof SyntaxError) {
            errorMessage = "Invalid JSON response from API. Please try again.";
        }
        
        res.status(500).json({ error: "PROCESSING_FAILED", message: errorMessage });
    }
});

app.get('/api/topic-details/:id/:topic', async (req, res) => {
    const { id, topic } = req.params;
    const dbPath = path.join(__dirname, 'database', `${id}.json`);

    if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: "NOT_FOUND", message: "Chapter data not found." });
    }

    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        if (OPENROUTER_API_KEY === 'MISSING_KEY' || !process.env.OPENROUTER_API_KEY) {
            return res.status(500).json({ error: "API_KEY_MISSING", message: "Please set your OPENROUTER_API_KEY." });
        }

        console.log(`Generating AI CUET questions for topic: ${topic}...`);

        const prompt = `You are an expert CUET (Common University Entrance Test) history exam tutor with deep knowledge of NCERT syllabus.

Chapter: ${data.title}
Topic: "${topic}"

Your task: Generate 5-8 CUET-style multiple-choice questions focusing on the most recurring and highly tested questions from the ENTIRE chapter, rather than just this specific topic. You can use "${topic}" as a starting point, but broaden the scope to the whole chapter's most important recurring questions.

IMPORTANT REQUIREMENTS:
- Questions should test understanding of the chapter's most recurring NCERT concepts and past trends
- Each question must have exactly 4 options
- Include one correct answer and 3 plausible but incorrect distractors
- Options should be realistic and similar in length
- Make questions similar to actual CUET past papers
- Include explanations based on NCERT

Return ONLY valid JSON (no markdown or extra text):
{
    "topic": "${topic}",
    "questions": [
        {
            "question": "What was...",
            "options": ["Option A", "Option B", "Correct answer", "Option D"],
            "answer": "Correct answer",
            "explanation": "Explanation from NCERT perspective"
        }
    ]
}`;

        const result = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
            },
            {
                headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'CUET-History-Master/1.0'
                },
                timeout: 45000
            }
        );

        let responseText = result.data?.choices?.[0]?.message?.content || '';
        
        if (!responseText) {
            throw new Error('Empty response from API');
        }

        responseText = responseText.replace(/```json\n?|```/g, '').trim();
        const topicDetails = JSON.parse(responseText);

        // Validate response
        if (!topicDetails.questions || !Array.isArray(topicDetails.questions)) {
            throw new Error('Invalid response format from API');
        }

        console.log(`Generated ${topicDetails.questions.length} questions for topic: ${topic}`);
        res.json(topicDetails);

    } catch (error) {
        console.error("Error generating topic questions:", {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
            code: error.code
        });
        
        let errorMessage = "Failed to generate questions for this topic.";
        if (error.response?.status === 401) {
            errorMessage = "Invalid API key. Please check OPENROUTER_API_KEY in .env file.";
        } else if (error.response?.status === 402) {
            errorMessage = "Payment required / billing issue. Please check your OpenRouter account balance and plan.";
        } else if (error.response?.status === 429) {
            errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
        } else if (error.response?.status === 500) {
            errorMessage = "API server error. Please try again later.";
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = "Request timeout. API is taking too long.";
        } else if (error instanceof SyntaxError) {
            errorMessage = "Invalid response format. Please try again.";
        } else if (error.message === 'Empty response from API') {
            errorMessage = "API returned empty response. Try again.";
        } else {
            errorMessage = error.message || "Unknown error occurred.";
        }
        
        res.status(500).json({ error: "PROCESSING_FAILED", message: errorMessage });
    }
});

app.get('/api/topic-pyq/:id/:topic', async (req, res) => {
    const { id, topic } = req.params;
    const dbPath = path.join(__dirname, 'database', `${id}.json`);

    if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ error: "NOT_FOUND", message: "Chapter data not found." });
    }

    try {
        const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

        if (OPENROUTER_API_KEY === 'MISSING_KEY' || !process.env.OPENROUTER_API_KEY) {
            return res.status(500).json({ error: "API_KEY_MISSING", message: "Please set your OPENROUTER_API_KEY." });
        }

        console.log(`Generating comprehensive CUET Past Year Questions for topic: ${topic}...`);

        const prompt = `You are a CUET history exam expert with access to all CUET papers from 2021-2025.

Chapter: ${data.title}
Topic: "${topic}"

Your task: Generate ALL realistic CUET past year questions (2021-2025) related to "${topic}". This should be comprehensive - generate as many questions as would realistically appear in CUET exams for this specific topic across the 5 years.

REQUIREMENTS:
- DO NOT limit the number of questions. If there are 50+ questions from this topic in the past 5 years, generate all of them.
- Each question must have exactly 4 options
- Distribute across years: 2021, 2022, 2023, 2024, 2025
- Include various difficulty levels and question types
- Test different aspects: facts, concepts, applications, analysis
- Questions should be realistic based on actual CUET patterns

Return ONLY valid JSON:
{
    "topic": "${topic}",
    "pyq": [
        {
            "year": 2025,
            "question": "What was...",
            "options": ["Answer A", "Answer B", "Answer C", "Answer D"],
            "answer": "Answer B",
            "difficulty": "medium"
        },
        {
            "year": 2024,
            "question": "Which of the following...",
            "options": ["A", "B", "C", "D"],
            "answer": "C",
            "difficulty": "hard"
        }
    ],
    "totalQuestions": 5,
    "yearsIncluded": [2021, 2022, 2023, 2024, 2025]
}`;

        const result = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.9,
            },
            {
                headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'CUET-History-Master/1.0'
                },
                timeout: 90000
            }
        );

        let responseText = result.data?.choices?.[0]?.message?.content || '';
        
        if (!responseText) {
            throw new Error('Empty response from API');
        }

        responseText = responseText.replace(/```json\n?|```/g, '').trim();
        const pyqData = JSON.parse(responseText);

        // Validate response
        if (!pyqData.pyq || !Array.isArray(pyqData.pyq)) {
            throw new Error('Invalid response format from API');
        }

        console.log(`Generated ${pyqData.pyq.length} comprehensive PYQ for topic: ${topic}`);
        res.json(pyqData);

    } catch (error) {
        console.error("Error generating topic PYQ:", {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        
        let errorMessage = "Failed to generate past year questions.";
        if (error.response?.status === 401) {
            errorMessage = "Invalid API key.";
        } else if (error.response?.status === 402) {
            errorMessage = "Payment required / billing issue. Please check your OpenRouter account balance and plan.";
        } else if (error.response?.status === 429) {
            errorMessage = "Rate limit exceeded. Please wait and try again.";
        } else if (error instanceof SyntaxError) {
            errorMessage = "Invalid response format.";
        } else {
            errorMessage = error.message || "Unknown error.";
        }
        
        res.status(500).json({ error: "PROCESSING_FAILED", message: errorMessage });
    }
});

// Function to generate assertion-reason questions for a chapter
async function generateAssertionReasonQuestions(chapterPath) {
    try {
        const chapter = JSON.parse(fs.readFileSync(chapterPath, 'utf8'));
        const chapterId = chapter.id;

        if (chapter.assertionReasonQuestions && chapter.assertionReasonQuestions.length > 0) {
            console.log(`✓ Assertion-reason questions already exist for ${chapter.title}`);
            return true;
        }

        console.log(`⏳ Generating assertion-reason questions for ${chapter.title}...`);

        const prompt = `Generate 20-30 CUET assertion-reason questions for: ${chapter.title}

Topics: ${chapter.recurringTopics.join(', ')}

Timeline: ${chapter.timeline.map(t => t.year + ': ' + t.event).join(' | ')}

Mind Map: ${chapter.mindMap.map(m => m.cause + ' → ' + m.consequence).join(' | ')}

Key Figures: ${chapter.historians.map(h => h.name + ': ' + h.argument).join(' | ')}

STRICT REQUIREMENTS:
1. Return ONLY a valid JSON array starting with [ and ending with ]
2. No markdown, no explanations, no extra text
3. Each question must have: question_id (number), assertion (string), reason (string), options (array of 4 strings: "A. ...", "B. ...", "C. ...", "D. ..."), answer (string: A/B/C/D)
4. Cover each recurring topic at least once, and include timeline, mind map, historian, and source concepts.
5. Focus on the chapter's core themes and crux, so the questions teach the most important ideas while testing knowledge, and ensure the format matches CUET assertion-reason style.
6. Mix difficulty levels: 30% easy, 50% medium, 20% hard
7. Answer distribution: ~40% A, ~25% B, ~20% C, ~15% D

JSON format:
[
  {
    "question_id": 1,
    "assertion": "...",
    "reason": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "answer": "A"
  }
]`;

        const result = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
                max_tokens: 3500
            },
            {
                headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'CUET-History-Master/1.0',                    'X-Title': 'CUET-Generator'
                },
                timeout: 60000
            }
        );

        let responseText = result.data?.choices?.[0]?.message?.content || '';
        
        if (!responseText) {
            throw new Error('Empty response from API');
        }

        // Extract JSON array
        responseText = responseText.replace(/```json\n?|```/g, '').trim();
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        
        if (!jsonMatch) {
            throw new Error('No valid JSON array found in response');
        }

        const questions = JSON.parse(jsonMatch[0]);

        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Invalid questions format');
        }

        // Add to chapter and save
        chapter.assertionReasonQuestions = questions;
        fs.writeFileSync(chapterPath, JSON.stringify(chapter, null, 2));

        console.log(`✓ Generated ${questions.length} assertion-reason questions for ${chapter.title}`);
        return true;

    } catch (error) {
        console.error(`✗ Error generating assertion-reason questions:`, error.message);
        return false;
    }
}

// Auto-generate assertion-reason questions for all chapters on startup
async function autoGenerateAssertionReasons() {
    console.log('\n📚 Checking chapters for assertion-reason questions...\n');
    
    try {
        const dbDir = path.join(__dirname, 'database');
        const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.json'));

        if (files.length === 0) {
            console.log('No chapters found in database folder.');
            return;
        }

        for (const file of files) {
            const filePath = path.join(dbDir, file);
            await generateAssertionReasonQuestions(filePath);
            
            // Add delay between API calls to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('\n✨ Assertion-reason question generation complete!\n');
    } catch (error) {
        console.error('Error in autoGenerateAssertionReasons:', error.message);
    }
}

app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Ensure you have added your API key to the .env file.`);
    console.log(`Ensure you have placed your PDFs in the 'ncert_pdfs' directory named like 'harappan.pdf', 'early-states.pdf', etc.`);
    
    // Auto-generate assertion-reason questions after a brief delay
    setTimeout(() => {
        autoGenerateAssertionReasons();
    }, 1000);
});

