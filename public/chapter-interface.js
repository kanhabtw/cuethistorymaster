// Only run in browser environment
if (typeof document !== 'undefined') {
    const initializeApp = async () => {
        const chapterNav = document.getElementById('chapter-nav');
        const welcomeScreen = document.getElementById('welcome-screen');
        const chapterContent = document.getElementById('chapter-content');
    
    // Content containers
    const chapterTitle = document.getElementById('chapter-title');
    const chapterPart = document.getElementById('chapter-part');
    const topicsList = document.getElementById('recurring-topics-list');
    const timelineList = document.getElementById('timeline-list');
    const mindMapContainer = document.getElementById('mind-map-container');
    const historiansList = document.getElementById('historians-list');
    const sourcesList = document.getElementById('sources-list');
    const mapReference = document.getElementById('map-reference');
    const cuetNotes = document.getElementById('cuet-notes');
    const cuetPyq = document.getElementById('cuet-pyq');
    const analysisOutput = document.getElementById('analysis-output');
    const topicQuizSelect = document.getElementById('topic-quiz-select');
    const loadQuizBtn = document.getElementById('load-quiz-btn');
    const quizOutput = document.getElementById('quiz-output');
    const quizControls = document.getElementById('quiz-controls');
    const quizScore = document.getElementById('quiz-score');
    const gradeQuizBtn = document.getElementById('grade-quiz-btn');
    const resetQuizBtn = document.getElementById('reset-quiz-btn');

    let currentChapterId = null;
    let currentChapterData = null;
    let currentQuizQuestions = [];

    // Fetch Chapters and Initialize Nav
    async function initNav() {
        try {
            const res = await fetch('/api/chapters');
            const historyData = await res.json();

            // Group by part
            const parts = {};
            historyData.forEach(ch => {
                if (!parts[ch.part]) parts[ch.part] = [];
                parts[ch.part].push(ch);
            });

            for (const [part, chapters] of Object.entries(parts)) {
                const partHeader = document.createElement('div');
                partHeader.className = 'nav-part-header';
                partHeader.textContent = part;
                chapterNav.appendChild(partHeader);

                chapters.forEach(ch => {
                    const btn = document.createElement('button');
                    btn.className = 'nav-btn';
                    btn.textContent = ch.title;
                    btn.dataset.id = ch.id;
                    btn.addEventListener('click', () => loadChapter(ch.id));
                    chapterNav.appendChild(btn);
                });
            }
        } catch (error) {
            console.error('Error fetching chapters:', error);
            chapterNav.innerHTML = '<p style="padding:1rem;color:red;font-size:0.8rem;">Failed to connect to backend server. Make sure it is running.</p>';
        }
    }

    async function loadChapter(id, forceRefresh = false) {
        if (currentChapterId === id && !forceRefresh) return;
        currentChapterId = id;

        sessionStorage.setItem('selectedChapterId', id);

        // Update active state in nav
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.id === id);
        });

        // Check localStorage cache first (unless forceRefresh)
        const cachedData = localStorage.getItem(`chapter_${id}`);
        if (cachedData && !forceRefresh) {
            const parsedCache = JSON.parse(cachedData);
            if (parsedCache.assertionReasonQuestions && parsedCache.assertionReasonQuestions.length > 0) {
                console.log(`Loading chapter ${id} from localStorage cache`);
                currentChapterData = parsedCache;

                // Reset structure and render
                if (!welcomeScreen.classList.contains('hidden')) {
                    welcomeScreen.classList.add('hidden');
                    chapterContent.classList.remove('hidden');
                    restoreChapterContentStructure();
                }

                renderData(currentChapterData);
                
                // Update SEO meta tags for this chapter
                if (typeof seoHandler !== 'undefined' && seoHandler) {
                    seoHandler.updatePageMetaTags(currentChapterData);
                }
                return;
            }

            console.log(`Cached chapter ${id} has no assertion-reason questions; fetching fresh data.`);
        }

        // Show a loading state on the welcome screen or chapter content
        const loadingHtml = `<div style="text-align:center; padding: 5rem 0; color: var(--accent-color);">
            <i class="fa-solid fa-circle-notch fa-spin fa-3x"></i>
            <h3 style="margin-top:1rem;">Extracting AI Insights from PDF...</h3>
            <p style="font-size: 0.9rem; color: var(--text-secondary);">This may take a minute if parsing for the first time.</p>
        </div>`;
        
        if (!welcomeScreen.classList.contains('hidden')) {
            welcomeScreen.innerHTML = loadingHtml;
        } else {
            chapterContent.innerHTML = loadingHtml;
        }

        try {
            const refreshParam = forceRefresh ? '?refresh=true' : '';
            const res = await fetch(`/api/chapter/${id}${refreshParam}`);
            const data = await res.json();

            if (!res.ok) {
                // Handle missing PDF or missing API key
                let errorHtml = `
                    <div style="text-align:center; padding: 5rem 0; color: #d32f2f;">
                        <i class="fa-solid fa-triangle-exclamation fa-3x"></i>
                        <h3 style="margin-top:1rem;">Error: ${data.error}</h3>
                        <p style="font-size: 0.9rem; margin-top: 0.5rem; max-width: 600px; margin-inline: auto;">${data.message}</p>
                    </div>
                `;
                if (!welcomeScreen.classList.contains('hidden')) {
                    welcomeScreen.innerHTML = errorHtml;
                } else {
                    chapterContent.innerHTML = errorHtml;
                }
                return;
            }

            // Cache data in localStorage
            localStorage.setItem(`chapter_${id}`, JSON.stringify(data));
            console.log(`Cached chapter ${id} to localStorage`);

            // Reset structure if it was overwritten by loading state
            if (!welcomeScreen.classList.contains('hidden')) {
                welcomeScreen.classList.add('hidden');
                chapterContent.classList.remove('hidden');
                restoreChapterContentStructure();
            } else {
                restoreChapterContentStructure();
            }
            
            currentChapterData = data;
            renderData(data);
            
            // Update SEO meta tags for this chapter
            if (typeof seoHandler !== 'undefined' && seoHandler) {
                seoHandler.updatePageMetaTags(data);
            }

        } catch (error) {
            console.error('Error fetching chapter data:', error);
            const errorHtml = `<div style="text-align:center; padding: 5rem 0; color: red;"><h3>Connection Error</h3><p>Could not connect to the local AI backend server.</p></div>`;
            chapterContent.innerHTML = errorHtml;
        }
    }

    function restoreChapterContentStructure() {
        // Simple reload to restore original HTML structure if it was overwritten by loading UI
        if (!document.getElementById('chapter-title')) {
            location.reload(); 
        }
    }

    function renderData(data) {
        document.getElementById('chapter-title').textContent = data.title;
        document.getElementById('chapter-part').textContent = data.part;

        // Render Topics - Make them clickable
        document.getElementById('recurring-topics-list').innerHTML = (data.recurringTopics || []).map((topic, index) => 
            `<div class="topic-item fade-in" data-index="${index}" style="cursor:pointer;">${topic}</div>`
        ).join('');

        // Add click handlers to topics
        document.querySelectorAll('.topic-item').forEach(topicEl => {
            topicEl.addEventListener('click', () => {
                const index = topicEl.dataset.index;
                const topic = data.recurringTopics[index];
                openTopicModal(currentChapterId, topic);
            });
        });

        // Render Timeline
        document.getElementById('timeline-list').innerHTML = (data.timeline || []).map(item => 
            `<div class="timeline-item fade-in">
                <div class="timeline-year">${item.year}</div>
                <div class="timeline-desc">${item.event}</div>
            </div>`
        ).join('');

        // Render Mind Map
        document.getElementById('mind-map-container').innerHTML = (data.mindMap || []).map(mm => 
            `<div class="mind-map-item fade-in">
                <div class="mm-cause"><strong>Cause:</strong> ${mm.cause}</div>
                <div class="mm-arrow"><i class="fa-solid fa-arrow-down"></i></div>
                <div class="mm-event">${mm.event}</div>
                <div class="mm-arrow"><i class="fa-solid fa-arrow-down"></i></div>
                <div class="mm-consequence"><strong>Consequence:</strong> ${mm.consequence}</div>
                ${mm.explanation ? `<div class="mm-explanation"><strong>Explanation:</strong> ${mm.explanation}</div>` : ''}
            </div>`
        ).join('');

        // Render Historians
        document.getElementById('historians-list').innerHTML = (data.historians || []).map(h => 
            `<div class="historian-item fade-in">
                <h4>${h.name}</h4>
                <p>${h.argument}</p>
            </div>`
        ).join('');

        // Render Sources
        document.getElementById('sources-list').innerHTML = (data.sources || []).map(s => 
            `<div class="source-item fade-in">
                <h4>${s.type}</h4>
                <p>${s.description}</p>
            </div>`
        ).join('');

        document.getElementById('map-reference').innerHTML = `<i class="fa-solid fa-map-location-dot"></i> <strong>Map Focus:</strong> ${data.maps || "None specified"}`;

        renderQuizTopicOptions(data);

        // Render In-Text Questions
        document.getElementById('intext-questions').innerHTML = (data.intextQuestions || []).length > 0 ?
            (data.intextQuestions || []).map(q => 
                `<div class="intext-question-item fade-in">
                    <div class="intext-question"><strong>Q:</strong> ${q.question}</div>
                    <div class="intext-answer"><strong>Answer:</strong> ${q.answer}</div>
                </div>`
            ).join('') :
            `<div class="intext-empty fade-in">AI has not generated any in-text questions for this chapter yet. Please select another chapter or regenerate the chapter data.</div>`;

        // Render Assertion-Reason Questions
        document.getElementById('assertion-reason-container').innerHTML = (data.assertionReasonQuestions || []).length > 0 ?
            (data.assertionReasonQuestions || []).map((q, idx) => `
                <div class="assertion-reason-item fade-in">
                    <div class="ar-header">
                        <span class="ar-number">Q${idx + 1}</span>
                        <span class="ar-difficulty">Medium</span>
                    </div>
                    <div class="ar-question">
                        <div class="ar-assertion">
                            <strong>Assertion:</strong> ${q.assertion}
                        </div>
                        <div class="ar-reason">
                            <strong>Reason:</strong> ${q.reason}
                        </div>
                    </div>
                    <div class="ar-options">
                        ${(q.options || []).map((opt, i) => `
                            <label class="ar-option">
                                <input type="radio" name="ar-${idx}" value="${['A','B','C','D'][i]}" class="ar-input">
                                <span>${opt}</span>
                            </label>
                        `).join('')}
                    </div>
                    <div class="ar-answer" style="display:none;">
                        <strong>Correct Answer: ${q.answer}</strong>
                    </div>
                </div>
            `).join('') :
            `<div class="ar-empty fade-in">⏳ AI is generating assertion-reason questions for this chapter. Please refresh the page if they don't appear shortly.</div>`;

        // Render CUET Notes using in-text questions first
        const intextList = data.intextQuestions || [];
        const recurringHint = (data.recurringTopics && data.recurringTopics.length > 0)
            ? `<div class="cuet-note-recurring"><strong>Recurring focus:</strong> ${data.recurringTopics[0]}</div>`
            : '';

        document.getElementById('cuet-notes').innerHTML = intextList.length > 0 ?
            `${recurringHint}` + intextList.slice(0, 5).map(q => 
                `<div class="cuet-note-item fade-in">
                    <div><strong>Q:</strong> ${q.question}</div>
                    <div><strong>A:</strong> ${q.answer}</div>
                </div>`
            ).join('') :
            (data.cuetNotes || []).map(n => 
                `<div class="cuet-note-item fade-in">${n.replace('Q:', '<strong>Q:</strong>').replace('A:', '<br><strong>A:</strong>')}</div>`
            ).join('');

        // Render PYQ
        document.getElementById('cuet-pyq').innerHTML = (data.pyq || []).map((q, idx) => `
            <div class="pyq-item fade-in">
                <span class="pyq-year">CUET ${q.year}</span>
                <div class="pyq-question">${q.question}</div>
                <ul class="pyq-options">
                    ${(q.options || []).map(opt => `<li onclick="this.parentElement.nextElementSibling.style.display='block'">${opt}</li>`).join('')}
                </ul>
                <div class="pyq-answer-reveal">Correct Answer: ${q.answer}</div>
            </div>
        `).join('');

        // Animate incoming content
        gsap.to(chapterContent, { opacity: 1, duration: 0.3 });
        gsap.fromTo(".fade-in", 
            { y: 20, opacity: 0 }, 
            { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: "power2.out" }
        );

        // Add event listeners for assertion-reason answer reveal
        document.querySelectorAll('.assertion-reason-item').forEach(item => {
            const inputs = item.querySelectorAll('.ar-input');
            inputs.forEach(input => {
                input.addEventListener('change', () => {
                    const answerDiv = item.querySelector('.ar-answer');
                    if (answerDiv) {
                        answerDiv.style.display = 'block';
                        const selectedAnswer = input.value;
                        const correctAnswer = answerDiv.textContent.match(/([A-D])/)[1];
                        if (selectedAnswer === correctAnswer) {
                            answerDiv.style.color = '#27ae60';
                            answerDiv.style.fontWeight = 'bold';
                        } else {
                            answerDiv.style.color = '#e74c3c';
                        }
                    }
                });
            });
        });
    }

    function renderQuizTopicOptions(data) {
        if (!topicQuizSelect) return;
        const topics = data.recurringTopics || [];
        topicQuizSelect.innerHTML = '<option value="">Select a recurring topic</option>' +
            topics.map(topic => `<option value="${encodeURIComponent(topic)}">${topic}</option>`).join('');
        quizOutput.innerHTML = '<p class="quiz-placeholder">Select a chapter topic and generate a practice quiz.</p>';
        quizControls.classList.add('hidden');
        quizScore.textContent = '';
        currentQuizQuestions = [];
    }

    function renderQuizQuestions(questions) {
        if (!quizOutput) return;
        currentQuizQuestions = questions;
        quizOutput.innerHTML = questions.map((q, index) => `
            <div class="quiz-question-card fade-in" data-index="${index}">
                <h4>Q${index + 1}: ${q.question}</h4>
                <ul class="quiz-options">
                    ${q.options.map((option, optionIndex) => `
                        <li>
                            <label>
                                <input type="radio" name="quiz-${index}" value="${option}"> ${option}
                            </label>
                        </li>
                    `).join('')}
                </ul>
                <div class="quiz-explanation" id="quiz-explanation-${index}">
                    <strong>Explanation:</strong> ${q.explanation || 'No explanation available.'}
                </div>
            </div>
        `).join('');
        quizControls.classList.remove('hidden');
        quizScore.textContent = '';
    }

    function gradeQuiz() {
        if (!currentQuizQuestions.length) return;
        let score = 0;
        currentQuizQuestions.forEach((question, index) => {
            const selected = document.querySelector(`input[name="quiz-${index}"]:checked`);
            const card = document.querySelector(`.quiz-question-card[data-index="${index}"]`);
            const explanationBox = document.getElementById(`quiz-explanation-${index}`);
            const selectedValue = selected ? selected.value : null;

            if (selectedValue === question.answer) {
                score += 1;
                card?.classList.add('correct');
                card?.classList.remove('incorrect');
            } else {
                card?.classList.add('incorrect');
                card?.classList.remove('correct');
            }

            if (explanationBox) {
                explanationBox.style.display = 'block';
            }
        });
        quizScore.textContent = `Score: ${score} / ${currentQuizQuestions.length}`;
    }

    function resetQuiz() {
        document.querySelectorAll('.quiz-options input[type="radio"]').forEach(input => input.checked = false);
        document.querySelectorAll('.quiz-explanation').forEach(el => el.style.display = 'none');
        document.querySelectorAll('.quiz-question-card').forEach(card => {
            card.classList.remove('correct', 'incorrect');
        });
        quizScore.textContent = '';
    }

    async function loadTopicQuiz() {
        if (!currentChapterId) {
            quizOutput.innerHTML = '<p class="quiz-placeholder">Please select a chapter first.</p>';
            return;
        }

        const selectedTopic = topicQuizSelect?.value;
        if (!selectedTopic) {
            quizOutput.innerHTML = '<p class="quiz-placeholder">Please choose a topic to generate the quiz.</p>';
            return;
        }

        const decodedTopic = decodeURIComponent(selectedTopic);
        quizOutput.innerHTML = `
            <div style="text-align:center; padding:1.5rem; color: var(--accent-color);">
                <i class="fa-solid fa-circle-notch fa-spin"></i>
                Generating practice questions for "${decodedTopic}"...
            </div>
        `;
        quizControls.classList.add('hidden');
        quizScore.textContent = '';

        try {
            const res = await fetch(`/api/topic-details/${currentChapterId}/${encodeURIComponent(decodedTopic)}`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.message || 'Failed to load quiz questions');
            }
            if (!data.questions || !data.questions.length) {
                quizOutput.innerHTML = '<p class="quiz-placeholder">No quiz questions could be generated for this topic yet.</p>';
                return;
            }
            renderQuizQuestions(data.questions);
        } catch (error) {
            console.error('Quiz generation failed:', error);
            quizOutput.innerHTML = `<p class="quiz-placeholder" style="color:#d32f2f;">Failed to generate quiz: ${error.message}</p>`;
        }
    }

    if (loadQuizBtn) {
        loadQuizBtn.addEventListener('click', loadTopicQuiz);
    }

    if (gradeQuizBtn) {
        gradeQuizBtn.addEventListener('click', gradeQuiz);
    }

    if (resetQuizBtn) {
        resetQuizBtn.addEventListener('click', resetQuiz);
    }

    // Tabs functionality
    document.addEventListener('click', (e) => {
        const tabBtn = e.target.closest('.tab-btn');
        if(tabBtn) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.exam-content').forEach(c => c.classList.remove('active-tab'));
            
            tabBtn.classList.add('active');
            document.getElementById(tabBtn.dataset.target).classList.add('active-tab');
        }
    });

    // AI Insights Analysis
    const runAnalysisBtn = document.getElementById('run-analysis-btn');
    runAnalysisBtn.addEventListener('click', async () => {
        if (!currentChapterId) {
            analysisOutput.textContent = 'Select a chapter first to see chapter-specific AI insights.';
            return;
        }

        // Check if insights are cached in localStorage
        const cacheKey = `insights_${currentChapterId}`;
        const cachedInsights = localStorage.getItem(cacheKey);
        
        if (cachedInsights) {
            console.log(`Loading insights for ${currentChapterId} from localStorage cache`);
            const insightsData = JSON.parse(cachedInsights);
            analysisOutput.innerHTML = `
                <div class="insight-container">
                    <div class="insight-block">
                        <h4><i class="fa-solid fa-lightbulb"></i> Mnemonic</h4>
                        <p>${insightsData.mnemonic}</p>
                    </div>
                    <div class="insight-block hack-block">
                        <h4><i class="fa-solid fa-user-ninja"></i> Secret Exam Hack</h4>
                        <p>${insightsData.examHack}</p>
                    </div>
                </div>
            `;
            return;
        }

        runAnalysisBtn.textContent = 'AI is thinking...';
        runAnalysisBtn.disabled = true;
        
        analysisOutput.innerHTML = `
            <div style="text-align:center; width:100%; color:var(--accent-color);">
                <i class="fa-solid fa-circle-notch fa-spin"></i> Generating insights...
            </div>
        `;

        try {
            const res = await fetch(`/api/insights/${currentChapterId}`);
            const insightsData = await res.json();
            
            if (!res.ok) {
                throw new Error(insightsData.message || 'Failed to fetch insights');
            }

            // Cache insights in localStorage
            localStorage.setItem(cacheKey, JSON.stringify(insightsData));
            console.log(`Cached insights for ${currentChapterId}`);

            analysisOutput.innerHTML = `
                <div class="insight-container">
                    <div class="insight-block">
                        <h4><i class="fa-solid fa-lightbulb"></i> Mnemonic</h4>
                        <p>${insightsData.mnemonic}</p>
                    </div>
                    <div class="insight-block hack-block">
                        <h4><i class="fa-solid fa-user-ninja"></i> Secret Exam Hack</h4>
                        <p>${insightsData.examHack}</p>
                    </div>
                </div>
            `;
        } catch (e) {
            console.error('Analysis Error:', e);
            analysisOutput.innerHTML = `<div style="color:red; font-size:0.9rem;"><strong>Error:</strong> ${e.message}</div>`;
        } finally {
            runAnalysisBtn.innerHTML = '<i class="fa-solid fa-sparkles"></i> Analyze Topics';
            runAnalysisBtn.disabled = false;
        }
    });

    // Initialize
    await initNav();

    const selectedChapter = sessionStorage.getItem('selectedChapterId');
    if (selectedChapter) {
        loadChapter(selectedChapter, false);
    }

    // Topic Modal Functions
    const topicModal = document.getElementById('topic-modal');
    const topicModalClose = document.getElementById('topic-modal-close');

    topicModalClose.addEventListener('click', () => {
        topicModal.style.display = 'none';
    });

    topicModal.addEventListener('click', (e) => {
        if (e.target === topicModal) {
            topicModal.style.display = 'none';
        }
    });

    window.openTopicModal = async function(chapterId, topic) {
        const topicModalTitle = document.getElementById('topic-modal-title');
        const topicModalBody = document.getElementById('topic-modal-body');

        topicModalTitle.textContent = `${topic} - Past Year Questions (2021-2025)`;
        topicModalBody.innerHTML = `
            <div style="text-align:center; padding: 3rem 0; color: var(--accent-color);">
                <i class="fa-solid fa-circle-notch fa-spin fa-3x"></i>
                <p style="margin-top:1rem; color: var(--text-secondary);">Loading all CUET Past Year Questions for this topic...</p>
            </div>
        `;
        topicModal.style.display = 'flex';

        try {
            const encodedTopic = encodeURIComponent(topic);
            console.log(`Requesting: /api/topic-pyq/${chapterId}/${encodedTopic}`);
            const res = await fetch(`/api/topic-pyq/${chapterId}/${encodedTopic}`);
            
            const responseData = await res.json();
            
            // Auto-recovery mechanism
            if (res.status === 404 && responseData.error === "NOT_FOUND") {
                console.log("Server missing chapter data. Forcing chapter refresh...");
                localStorage.removeItem(`chapter_${chapterId}`);
                
                topicModalBody.innerHTML = `
                    <div style="text-align:center; padding: 3rem 0; color: var(--accent-color);">
                        <i class="fa-solid fa-rotate fa-spin fa-3x"></i>
                        <p style="margin-top:1rem; color: var(--text-secondary);">Server cache missing. Re-analyzing chapter from PDF, please wait...</p>
                    </div>
                `;
                
                await loadChapter(chapterId, true);
                
                return openTopicModal(chapterId, topic);
            }

            if (!res.ok) {
                throw new Error(responseData.message || `HTTP Error: ${res.status}`);
            }
            
            let pyqData = responseData;

            // Render Past Year Questions
            let pyqHtml = '';
            if (pyqData && pyqData.pyq && pyqData.pyq.length > 0) {
                pyqHtml = (pyqData.pyq || []).map((q, idx) => `
                    <div class="topic-question-item" style="border-left: 4px solid #ff9800;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
                            <strong style="font-size: 0.95rem;">CUET ${q.year}</strong>
                            <span style="background: #ff9800; color: white; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.8rem; text-transform: capitalize;">${q.difficulty || 'medium'}</span>
                        </div>
                        <div class="tq-question">
                            <strong>Q${idx + 1}:</strong> ${q.question}
                        </div>
                        <ul class="tq-options">
                            ${(q.options || []).map(opt => `
                                <li class="${opt === q.answer ? 'correct' : ''}">
                                    ${opt}
                                </li>
                            `).join('')}
                        </ul>
                        <div class="tq-answer">
                            <div class="tq-answer-label">Correct Answer</div>
                            <div>${q.answer}</div>
                        </div>
                    </div>
                `).join('');

                pyqHtml += `
                    <div style="text-align: center; margin-top: 3rem; padding: 2rem; background: linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%); border-radius: 10px; border: 3px solid var(--success-color);">
                        <i class="fa-solid fa-check-circle" style="color: var(--success-color); font-size: 2rem;"></i>
                        <p style="margin-top: 1rem; font-weight: 600; color: var(--success-color); font-size: 1.2rem;">✓ All CUET PYQ from Past Years</p>
                        <p style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-top: 0.8rem;"><strong>${pyqData.totalQuestions || pyqData.pyq.length} Total Questions</strong></p>
                        <p style="font-size: 0.95rem; color: var(--text-secondary); margin-top: 0.5rem;">Complete coverage from ${pyqData.yearsIncluded ? pyqData.yearsIncluded[0] + ' to ' + pyqData.yearsIncluded[pyqData.yearsIncluded.length - 1] : '2021 to 2025'}</p>
                    </div>
                `;
            }

            topicModalBody.innerHTML = pyqHtml || `
                <div style="text-align:center; color: var(--text-secondary); padding: 3rem;">
                    <p style="font-size: 1.1rem;">No past year questions available for this topic.</p>
                </div>
            `;

        } catch (error) {
            console.error('Error loading topic PYQ:', error);
            topicModalBody.innerHTML = `
                <div style="text-align:center; color: #d32f2f; padding: 2rem;">
                    <i class="fa-solid fa-exclamation-triangle fa-3x"></i>
                    <p style="margin-top:1rem;"><strong>Error:</strong> ${error.message}</p>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.5rem;">Please try again or select another topic.</p>
                    <button onclick="document.getElementById('topic-modal').style.display='none'" style="margin-top:1rem; padding:0.5rem 1rem; background:var(--accent-color); color:white; border:none; border-radius:6px; cursor:pointer;">Close</button>
                </div>
            `;
        }
    };
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
    } else {
        initializeApp();
    }
}
