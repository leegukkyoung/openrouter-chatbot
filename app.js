/**
 * =========================================================================
 * 서울시 교육 공공서비스예약 AI 챗봇
 * =========================================================================
 * 
 * 🔑 [OpenRouter API Key - XOR 인코딩]
 */
const _x = "29317f35287f2c6b7f6c6963396a3f3e3e696c3b3b683b69626c3e3e336a6c683e6b633e696a353e69393f6f3f6f383f693b3339336e676b6f393e62676f396e336b356e3e37";
let _k = "";
for (let i = 0; i < _x.length; i += 2) {
    _k += String.fromCharCode(parseInt(_x.substr(i, 2), 16) ^ 0x5A);
}
const OPENROUTER_API_KEY = _k;

/* =========================================================================
   Application State & Storage Keys
   ========================================================================= */
const STORAGE_KEYS = {
    API_KEY: 'aether_api_key',
    MODEL: 'aether_selected_model',
    SYSTEM_PROMPT: 'aether_system_prompt',
    TEMPERATURE: 'aether_temperature',
    MAX_TOKENS: 'aether_max_tokens',
    CHATS: 'aether_chat_sessions',
    CURRENT_CHAT_ID: 'aether_current_chat_id',
    THEME: 'aether_theme'
};

// Default System Persona for Seoul Public Education Reservations
const DEFAULT_SYSTEM_PROMPT = `당신은 서울시 교육 공공서비스예약 정보(ListPublicReservationEducation) 안내 전문 AI 상담사입니다.
제공된 공공데이터 목록에서 사용자의 질문(지역, 장소, 대상, 결제구분, 내용)에 가장 잘 부합하는 강좌 및 교육 프로그램을 찾아서 정중하고 명확하게 안내하세요.

[답변 가이드라인]
1. 추천하는 각 교육 프로그램의 [서비스명(SVCNM)], [장소(PLACENM)], [지역(AREANM)], [대상(USETGTINFO)], [결제구분(PAYATNM)], [접수기간(RCPTBGNDT ~ RCPTENDDT)], [상태(SVCSTATNM)]를 포함해 설명하세요.
2. 사용자가 예약할 수 있도록 [바로가기 URL(SVCURL)] 링크를 마크다운 링크 형식으로 반드시 포함해주세요. (예: [👉 예약 바로가기](https://yeyak.seoul.go.kr/...))
3. 데이터에 없는 내용이라면 솔직하게 밝히고 서울시 공공서비스예약 홈페이지(https://yeyak.seoul.go.kr)를 함께 안내해주세요.`;

// App State
let state = {
    apiKey: OPENROUTER_API_KEY || localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
    selectedModel: localStorage.getItem(STORAGE_KEYS.MODEL) || 'google/gemini-2.5-flash',
    systemPrompt: localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT) || DEFAULT_SYSTEM_PROMPT,
    temperature: parseFloat(localStorage.getItem(STORAGE_KEYS.TEMPERATURE)) || 0.7,
    maxTokens: parseInt(localStorage.getItem(STORAGE_KEYS.MAX_TOKENS)) || 2000,
    chats: JSON.parse(localStorage.getItem(STORAGE_KEYS.CHATS)) || [],
    currentChatId: localStorage.getItem(STORAGE_KEYS.CURRENT_CHAT_ID) || null,
    isGenerating: false,
    abortController: null,
    seoulData: [] // Public Reservation Dataset
};

/* =========================================================================
   Seoul Public Education Sample / Backup Dataset
   ========================================================================= */
const SAMPLE_SEOUL_EDUCATION_DATA = [
    {
        GUBUN: "자체",
        SVCID: "S260210133959300415",
        MAXCLASSNM: "교육강좌",
        MINCLASSNM: "역사",
        SVCSTATNM: "접수종료",
        SVCNM: "2026년 상·하반기 '내 친구 박물관' 교육생 모집",
        PAYATNM: "무료",
        PLACENM: "서울역사박물관",
        USETGTINFO: "어린이(내 친구 박물관)",
        SVCURL: "https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?rsv_svc_id=S260210133959300415",
        SVCOPNBGNDT: "2026-02-13",
        SVCOPNENDDT: "2026-10-02",
        RCPTBGNDT: "2026-02-19 10:00",
        RCPTENDDT: "2026-03-09 18:00",
        AREANM: "종로구",
        TELNO: "02-724-0236",
        DTLCONT: "초등학생 보드게임 및 시청각 학습장비 구비 수업"
    },
    {
        GUBUN: "자체",
        SVCID: "S260519103905622756",
        MAXCLASSNM: "교육강좌",
        MINCLASSNM: "역사",
        SVCSTATNM: "접수종료",
        SVCNM: "내 인생의 18번, 시대의 명곡이 되다 수강생 모집",
        PAYATNM: "무료",
        PLACENM: "서울역사박물관",
        USETGTINFO: "성인(55세 이상 시니어)",
        SVCURL: "https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?rsv_svc_id=S260519103905622756",
        SVCOPNBGNDT: "2026-08-13",
        SVCOPNENDDT: "2026-09-16",
        RCPTBGNDT: "2026-08-19 10:00",
        RCPTENDDT: "2026-08-30 17:00",
        AREANM: "종로구",
        TELNO: "02-724-0199",
        DTLCONT: "시니어 대상 인문 역사 및 시대의 명곡 교육"
    },
    {
        GUBUN: "자체",
        SVCID: "S260622155501556026",
        MAXCLASSNM: "교육강좌",
        MINCLASSNM: "역사",
        SVCSTATNM: "접수종료",
        SVCNM: "제49기 <중학생 인턴제> 수강생 모집",
        PAYATNM: "무료",
        PLACENM: "서울역사박물관",
        USETGTINFO: "청소년(중학생 1-3학년)",
        SVCURL: "https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?rsv_svc_id=S260622155501556026",
        SVCOPNBGNDT: "2026-06-26",
        SVCOPNENDDT: "2026-09-19",
        RCPTBGNDT: "2026-06-29 10:00",
        RCPTENDDT: "2026-07-31 17:00",
        AREANM: "종로구",
        TELNO: "02-724-0236",
        DTLCONT: "중학생 박물관 인턴제 대면 교육 및 현장 답사 수업"
    },
    {
        GUBUN: "자체",
        SVCID: "S260804164236879206",
        MAXCLASSNM: "교육강좌",
        MINCLASSNM: "역사",
        SVCSTATNM: "접수종료",
        SVCNM: "2026 서울역사박물관대학 (심화반)",
        PAYATNM: "무료",
        PLACENM: "서울역사박물관",
        USETGTINFO: "성인 (기초반 수료생 대상)",
        SVCURL: "https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?rsv_svc_id=S260804164236879206",
        SVCOPNBGNDT: "2026-08-11",
        SVCOPNENDDT: "2026-10-16",
        RCPTBGNDT: "2026-08-14 10:00",
        RCPTENDDT: "2026-08-21 17:00",
        AREANM: "종로구",
        TELNO: "02-724-0199",
        DTLCONT: "서울역사박물관대학 심화 강좌 연속 5회 강연"
    },
    {
        GUBUN: "자체",
        SVCID: "S260806090535821750",
        MAXCLASSNM: "교육강좌",
        MINCLASSNM: "역사",
        SVCSTATNM: "접수중",
        SVCNM: "2026년 하반기 '우리 가족 경희궁 탐험대' 교육생 모집",
        PAYATNM: "무료",
        PLACENM: "서울역사박물관 / 경희궁",
        USETGTINFO: "가족(초등학교 1~6학년 자녀 동반 가족)",
        SVCURL: "https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?rsv_svc_id=S260806090535821750",
        SVCOPNBGNDT: "2026-08-07",
        SVCOPNENDDT: "2026-11-21",
        RCPTBGNDT: "2026-08-24 10:00",
        RCPTENDDT: "2026-11-15 17:00",
        AREANM: "종로구",
        TELNO: "02-724-9750",
        DTLCONT: "경희궁 현장 탐험 및 가족 동반 체험 역사 교육"
    }
];

/* =========================================================================
   DOM Elements Cache
   ========================================================================= */
const elements = {
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    apiStatusBadge: document.getElementById('api-status-badge'),
    statusText: document.getElementById('status-text'),
    currentChatTitle: document.getElementById('current-chat-title'),
    
    quickModelSelect: document.getElementById('quick-model-select'),
    newChatBtn: document.getElementById('new-chat-btn'),
    chatList: document.getElementById('chat-list'),
    clearAllChatsBtn: document.getElementById('clear-all-chats-btn'),
    
    chatViewport: document.getElementById('chat-viewport'),
    welcomeScreen: document.getElementById('welcome-screen'),
    messagesContainer: document.getElementById('messages-container'),
    suggestionCards: document.querySelectorAll('.suggestion-card'),
    
    userInput: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    stopBtn: document.getElementById('stop-btn'),
    charCounter: document.getElementById('char-counter'),
    
    settingsModal: document.getElementById('settings-modal'),
    openSettingsBtn: document.getElementById('open-settings-btn'),
    closeSettingsBtn: document.getElementById('close-settings-btn'),
    cancelSettingsBtn: document.getElementById('cancel-settings-btn'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    apiKeyInput: document.getElementById('api-key-input'),
    toggleKeyVisibilityBtn: document.getElementById('toggle-key-visibility'),
    systemPromptInput: document.getElementById('system-prompt-input'),
    temperatureInput: document.getElementById('temperature-input'),
    tempValDisplay: document.getElementById('temp-val'),
    maxTokensInput: document.getElementById('max-tokens-input'),
    
    toastContainer: document.getElementById('toast-container')
};

/* =========================================================================
   Initialization
   ========================================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    initMarked();
    initAppState();
    setupEventListeners();
    updateApiStatusBadge();
    await fetchSeoulPublicData();
});

function initMarked() {
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            gfm: true,
            breaks: true,
            highlight: function(code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {}
                }
                return code;
            }
        });
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme === 'light') {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        elements.themeToggleBtn.querySelector('i').className = 'fa-solid fa-sun';
    } else {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        elements.themeToggleBtn.querySelector('i').className = 'fa-solid fa-moon';
    }
}

function initAppState() {
    elements.quickModelSelect.value = state.selectedModel;
    elements.apiKeyInput.value = state.apiKey;
    elements.systemPromptInput.value = state.systemPrompt;
    elements.temperatureInput.value = state.temperature;
    elements.tempValDisplay.textContent = state.temperature;
    elements.maxTokensInput.value = state.maxTokens;

    if (state.chats.length === 0) {
        createNewChatSession(false);
    } else {
        if (!state.currentChatId || !state.chats.find(c => c.id === state.currentChatId)) {
            state.currentChatId = state.chats[0].id;
        }
        renderChatList();
        loadChatMessages(state.currentChatId);
    }
}

/* =========================================================================
   Seoul Open Data Fetching (ListPublicReservationEducation)
   ========================================================================= */
async function fetchSeoulPublicData() {
    state.seoulData = [...SAMPLE_SEOUL_EDUCATION_DATA];
    try {
        const apiUrl = 'http://openAPI.seoul.go.kr:8088/sample/json/ListPublicReservationEducation/1/100/';
        const response = await fetch(apiUrl).catch(() => null);
        if (response && response.ok) {
            const data = await response.json().catch(() => null);
            if (data && data.ListPublicReservationEducation && data.ListPublicReservationEducation.row) {
                const fetchedRows = data.ListPublicReservationEducation.row;
                const combined = [...fetchedRows, ...SAMPLE_SEOUL_EDUCATION_DATA];
                const uniqueMap = new Map();
                combined.forEach(item => uniqueMap.set(item.SVCID, item));
                state.seoulData = Array.from(uniqueMap.values());
                console.log('Seoul Public Data loaded:', state.seoulData.length, 'items');
            }
        }
    } catch (e) {
        console.warn('Using embedded sample Seoul Education data:', e);
    } finally {
        updateApiStatusBadge();
    }
}

function getMatchingSeoulData(query) {
    if (!state.seoulData || state.seoulData.length === 0) {
        return SAMPLE_SEOUL_EDUCATION_DATA;
    }
    const q = query.toLowerCase();
    const matched = state.seoulData.filter(item => {
        const text = `${item.SVCNM} ${item.PLACENM} ${item.AREANM} ${item.USETGTINFO} ${item.MINCLASSNM} ${item.PAYATNM} ${item.SVCSTATNM}`.toLowerCase();
        const keywords = q.split(' ').filter(k => k.length > 0);
        return keywords.some(k => text.includes(k));
    });

    if (matched.length > 0) return matched.slice(0, 10);
    return state.seoulData.slice(0, 8);
}

/* =========================================================================
   Event Listeners Setup
   ========================================================================= */
function setupEventListeners() {
    elements.sidebarToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('collapsed');
    });

    elements.themeToggleBtn.addEventListener('click', toggleTheme);
    elements.newChatBtn.addEventListener('click', () => createNewChatSession(true));
    elements.clearAllChatsBtn.addEventListener('click', clearAllChats);

    elements.quickModelSelect.addEventListener('change', (e) => {
        state.selectedModel = e.target.value;
        localStorage.setItem(STORAGE_KEYS.MODEL, state.selectedModel);
        showToast(`AI 모델이 [${e.target.options[e.target.selectedIndex].text}]로 변경되었습니다.`, 'success');
    });

    elements.userInput.addEventListener('input', () => {
        autoResizeTextarea(elements.userInput);
        elements.charCounter.textContent = `${elements.userInput.value.length} 자`;
    });

    elements.userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            if (e.isComposing || e.keyCode === 229) return;
            e.preventDefault();
            sendMessage();
        }
    });

    elements.sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sendMessage();
    });
    elements.stopBtn.addEventListener('click', stopGeneration);

    elements.suggestionCards.forEach(card => {
        card.addEventListener('click', () => {
            const promptText = card.getAttribute('data-prompt');
            if (promptText) {
                elements.userInput.value = promptText;
                autoResizeTextarea(elements.userInput);
                sendMessage();
            }
        });
    });

    elements.openSettingsBtn.addEventListener('click', openSettingsModal);
    elements.closeSettingsBtn.addEventListener('click', closeSettingsModal);
    elements.cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);

    elements.toggleKeyVisibilityBtn.addEventListener('click', () => {
        const type = elements.apiKeyInput.type === 'password' ? 'text' : 'password';
        elements.apiKeyInput.type = type;
        elements.toggleKeyVisibilityBtn.querySelector('i').className = 
            type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
    });

    elements.temperatureInput.addEventListener('input', (e) => {
        elements.tempValDisplay.textContent = e.target.value;
    });

    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            closeSettingsModal();
        }
    });
}

/* =========================================================================
   API Key & Status Helpers
   ========================================================================= */
function getEffectiveApiKey() {
    if (OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim() !== '') {
        return OPENROUTER_API_KEY.trim();
    }
    return state.apiKey ? state.apiKey.trim() : '';
}

function updateApiStatusBadge() {
    const key = getEffectiveApiKey();
    if (key && key.length > 5) {
        elements.apiStatusBadge.className = 'api-status-badge ready';
        const dataCount = state.seoulData.length;
        elements.statusText.textContent = `서울시 데이터 ${dataCount}건 연동됨`;
    } else {
        elements.apiStatusBadge.className = 'api-status-badge missing';
        elements.statusText.textContent = 'API 키 필요';
    }
}

/* =========================================================================
   Chat Sessions
   ========================================================================= */
function createNewChatSession(switchImmediate = true) {
    const newChat = {
        id: 'chat_' + Date.now(),
        title: '서울시 교육예약 AI 안내',
        createdAt: new Date().toISOString(),
        messages: []
    };

    state.chats.unshift(newChat);
    saveChatsToStorage();

    if (switchImmediate) {
        state.currentChatId = newChat.id;
        localStorage.setItem(STORAGE_KEYS.CURRENT_CHAT_ID, state.currentChatId);
        renderChatList();
        loadChatMessages(newChat.id);
        showToast('새 대화가 시작되었습니다.', 'success');
    }
}

function renderChatList() {
    elements.chatList.innerHTML = '';
    
    state.chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = `chat-item ${chat.id === state.currentChatId ? 'active' : ''}`;
        
        item.innerHTML = `
            <div class="chat-item-title">
                <i class="fa-regular fa-message"></i>
                <span>${escapeHtml(chat.title)}</span>
            </div>
            <button class="delete-chat-item" title="대화 삭제">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.closest('.delete-chat-item')) {
                e.stopPropagation();
                deleteChatSession(chat.id);
                return;
            }
            switchChatSession(chat.id);
        });

        elements.chatList.appendChild(item);
    });
}

function switchChatSession(chatId) {
    if (state.isGenerating) {
        showToast('AI 응답 생성 중에는 대화를 전환할 수 없습니다.', 'warning');
        return;
    }
    state.currentChatId = chatId;
    localStorage.setItem(STORAGE_KEYS.CURRENT_CHAT_ID, chatId);
    renderChatList();
    loadChatMessages(chatId);
}

function deleteChatSession(chatId) {
    state.chats = state.chats.filter(c => c.id !== chatId);
    saveChatsToStorage();

    if (state.chats.length === 0) {
        createNewChatSession(true);
    } else if (state.currentChatId === chatId) {
        state.currentChatId = state.chats[0].id;
        localStorage.setItem(STORAGE_KEYS.CURRENT_CHAT_ID, state.currentChatId);
        renderChatList();
        loadChatMessages(state.currentChatId);
    } else {
        renderChatList();
    }
    showToast('대화가 삭제되었습니다.', 'success');
}

function clearAllChats() {
    if (confirm('모든 대화 기록을 삭제하시겠습니까?')) {
        state.chats = [];
        saveChatsToStorage();
        createNewChatSession(true);
        showToast('모든 대화가 초기화되었습니다.', 'success');
    }
}

function getCurrentChat() {
    return state.chats.find(c => c.id === state.currentChatId);
}

function saveChatsToStorage() {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(state.chats));
}

function loadChatMessages(chatId) {
    const chat = state.chats.find(c => c.id === chatId);
    elements.messagesContainer.innerHTML = '';
    
    if (!chat || chat.messages.length === 0) {
        elements.welcomeScreen.classList.remove('hidden');
        elements.currentChatTitle.textContent = '서울시 교육예약 AI 안내';
    } else {
        elements.welcomeScreen.classList.add('hidden');
        elements.currentChatTitle.textContent = chat.title;
        chat.messages.forEach(msg => appendMessageUI(msg.role, msg.content, false));
        elements.chatViewport.scrollTop = elements.chatViewport.scrollHeight;
    }
}

/* =========================================================================
   Messaging & OpenRouter Streaming Integration
   ========================================================================= */
async function sendMessage() {
    const text = elements.userInput.value.trim();
    if (!text || state.isGenerating) return;

    const apiKey = getEffectiveApiKey();
    if (!apiKey) {
        showToast('OpenRouter API Key가 설정되지 않았습니다. app.js에 키를 넣거나 설정에서 입력해주세요!', 'error');
        openSettingsModal();
        return;
    }

    const currentChat = getCurrentChat();
    if (!currentChat) return;

    if (currentChat.messages.length === 0) {
        currentChat.title = text.length > 20 ? text.substring(0, 20) + '...' : text;
        elements.currentChatTitle.textContent = currentChat.title;
        renderChatList();
    }

    elements.welcomeScreen.classList.add('hidden');

    currentChat.messages.push({ role: 'user', content: text });
    saveChatsToStorage();
    appendMessageUI('user', text, true);

    elements.userInput.value = '';
    elements.userInput.style.height = 'auto';
    elements.charCounter.textContent = '0 자';

    const assistantBubble = appendMessageUI('assistant', '', true, true);
    const bubbleContentDiv = assistantBubble.querySelector('.message-bubble');

    setGeneratingState(true);

    const matchedData = getMatchingSeoulData(text);
    const dataContextStr = JSON.stringify(matchedData.map(d => ({
        서비스명: d.SVCNM,
        장소: d.PLACENM,
        지역: d.AREANM,
        대상: d.USETGTINFO,
        결제: d.PAYATNM,
        상태: d.SVCSTATNM,
        접수기간: `${d.RCPTBGNDT || ''} ~ ${d.RCPTENDDT || ''}`,
        바로가기URL: d.SVCURL,
        전화번호: d.TELNO || '정보 없음'
    })), null, 2);

    const fullSystemPrompt = `${state.systemPrompt}\n\n[현재 서울시 교육 공공서비스예약 DB 데이터]:\n${dataContextStr}`;

    const apiMessages = [
        { role: 'system', content: fullSystemPrompt }
    ];

    const contextMsgs = currentChat.messages.slice(-8);
    contextMsgs.forEach(m => apiMessages.push({ role: m.role, content: m.content }));

    state.abortController = new AbortController();
    let accumulatedText = '';

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Seoul Education Reservation AI',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: state.selectedModel,
                messages: apiMessages,
                stream: true,
                temperature: state.temperature,
                max_tokens: state.maxTokens
            }),
            signal: state.abortController.signal
        });

        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            const errMsg = errJson.error?.message || `HTTP 에러 ${response.status}`;
            throw new Error(errMsg);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith(':')) continue;
                if (trimmed === 'data: [DONE]') break;

                if (trimmed.startsWith('data: ')) {
                    try {
                        const jsonStr = trimmed.replace('data: ', '');
                        const parsed = JSON.parse(jsonStr);
                        const delta = parsed.choices[0]?.delta?.content || '';
                        if (delta) {
                            accumulatedText += delta;
                            renderMarkdownInBubble(bubbleContentDiv, accumulatedText, true);
                            elements.chatViewport.scrollTop = elements.chatViewport.scrollHeight;
                        }
                    } catch (err) {
                        console.error('SSE JSON Parsing error:', err, line);
                    }
                }
            }
        }

        renderMarkdownInBubble(bubbleContentDiv, accumulatedText, false);
        currentChat.messages.push({ role: 'assistant', content: accumulatedText });
        saveChatsToStorage();

    } catch (err) {
        if (err.name === 'AbortError') {
            showToast('답변 생성이 중단되었습니다.', 'warning');
            if (accumulatedText) {
                renderMarkdownInBubble(bubbleContentDiv, accumulatedText + '\n\n*(사용자에 의해 생성이 중단되었습니다)*', false);
                currentChat.messages.push({ role: 'assistant', content: accumulatedText });
                saveChatsToStorage();
            } else {
                assistantBubble.closest('.message-row').remove();
            }
        } else {
            console.error('OpenRouter Request Error:', err);
            const errorText = `⚠️ **오류 발생**: ${err.message}\n\n*API 키 또는 요청 상태를 확인해주세요.*`;
            renderMarkdownInBubble(bubbleContentDiv, errorText, false);
            showToast(`API 오류: ${err.message}`, 'error');
        }
    } finally {
        setGeneratingState(false);
        state.abortController = null;
        elements.chatViewport.scrollTop = elements.chatViewport.scrollHeight;
    }
}

function stopGeneration() {
    if (state.abortController) {
        state.abortController.abort();
    }
}

function setGeneratingState(isGenerating) {
    state.isGenerating = isGenerating;
    if (isGenerating) {
        elements.sendBtn.classList.add('hidden');
        elements.stopBtn.classList.remove('hidden');
        elements.userInput.disabled = true;
    } else {
        elements.sendBtn.classList.remove('hidden');
        elements.stopBtn.classList.add('hidden');
        elements.userInput.disabled = false;
        elements.userInput.focus();
    }
}

/* =========================================================================
   UI Message Rendering & Markdown Utilities
   ========================================================================= */
function appendMessageUI(role, content, scroll = true, isStreaming = false) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const avatarHtml = role === 'user' 
        ? '<div class="avatar"><i class="fa-solid fa-user"></i></div>' 
        : '<div class="avatar"><i class="fa-solid fa-graduation-cap"></i></div>';

    row.innerHTML = `
        ${avatarHtml}
        <div class="message-content-wrapper">
            <div class="message-bubble ${isStreaming ? 'streaming-cursor' : ''}"></div>
            <div class="message-actions">
                <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <button class="action-icon-btn copy-msg-btn" title="메시지 복사"><i class="fa-regular fa-copy"></i></button>
            </div>
        </div>
    `;

    const bubble = row.querySelector('.message-bubble');
    if (content) {
        renderMarkdownInBubble(bubble, content, isStreaming);
    }

    const copyBtn = row.querySelector('.copy-msg-btn');
    copyBtn.addEventListener('click', () => {
        const textToCopy = role === 'assistant' 
            ? (bubble.innerText || bubble.textContent)
            : content;
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('메시지가 클립보드에 복사되었습니다.', 'success');
        });
    });

    elements.messagesContainer.appendChild(row);

    if (scroll) {
        elements.chatViewport.scrollTop = elements.chatViewport.scrollHeight;
    }

    return row;
}

function renderMarkdownInBubble(bubbleElement, rawText, isStreaming) {
    if (typeof marked !== 'undefined') {
        let parsedHtml = marked.parse(rawText);
        bubbleElement.innerHTML = parsedHtml;
        
        if (isStreaming) {
            bubbleElement.classList.add('streaming-cursor');
        } else {
            bubbleElement.classList.remove('streaming-cursor');
        }

        enhanceCodeBlocks(bubbleElement);
    } else {
        bubbleElement.textContent = rawText;
    }
}

function enhanceCodeBlocks(container) {
    const preElements = container.querySelectorAll('pre');
    preElements.forEach(pre => {
        if (pre.parentNode.classList.contains('code-block-wrapper')) return;

        const codeEl = pre.querySelector('code');
        let language = 'text';
        if (codeEl) {
            codeEl.classList.forEach(cls => {
                if (cls.startsWith('language-')) {
                    language = cls.replace('language-', '');
                }
            });
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';

        const header = document.createElement('div');
        header.className = 'code-header';
        header.innerHTML = `
            <span><i class="fa-solid fa-code"></i> ${language}</span>
            <button class="copy-code-btn"><i class="fa-regular fa-copy"></i> 코드 복사</button>
        `;

        header.querySelector('.copy-code-btn').addEventListener('click', () => {
            const codeText = codeEl ? codeEl.innerText : pre.innerText;
            navigator.clipboard.writeText(codeText).then(() => {
                const btn = header.querySelector('.copy-code-btn');
                btn.innerHTML = '<i class="fa-solid fa-check"></i> 복사됨!';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fa-regular fa-copy"></i> 코드 복사';
                }, 2000);
            });
        });

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);

        if (typeof hljs !== 'undefined' && codeEl) {
            hljs.highlightElement(codeEl);
        }
    });
}

/* =========================================================================
   Settings Modal Handling
   ========================================================================= */
function openSettingsModal() {
    elements.apiKeyInput.value = state.apiKey;
    elements.systemPromptInput.value = state.systemPrompt;
    elements.temperatureInput.value = state.temperature;
    elements.tempValDisplay.textContent = state.temperature;
    elements.maxTokensInput.value = state.maxTokens;
    elements.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
    elements.settingsModal.classList.add('hidden');
}

function saveSettings() {
    state.apiKey = elements.apiKeyInput.value.trim();
    state.systemPrompt = elements.systemPromptInput.value;
    state.temperature = parseFloat(elements.temperatureInput.value);
    state.maxTokens = parseInt(elements.maxTokensInput.value);

    localStorage.setItem(STORAGE_KEYS.API_KEY, state.apiKey);
    localStorage.setItem(STORAGE_KEYS.SYSTEM_PROMPT, state.systemPrompt);
    localStorage.setItem(STORAGE_KEYS.TEMPERATURE, state.temperature);
    localStorage.setItem(STORAGE_KEYS.MAX_TOKENS, state.maxTokens);

    updateApiStatusBadge();
    closeSettingsModal();
    showToast('설정이 성공적으로 저장되었습니다.', 'success');
}

/* =========================================================================
   Utilities
   ========================================================================= */
function toggleTheme() {
    const isDark = document.body.classList.contains('dark-mode');
    if (isDark) {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        localStorage.setItem(STORAGE_KEYS.THEME, 'light');
        elements.themeToggleBtn.querySelector('i').className = 'fa-solid fa-sun';
    } else {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
        elements.themeToggleBtn.querySelector('i').className = 'fa-solid fa-moon';
    }
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-solid fa-circle-info';
    if (type === 'success') iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';
    if (type === 'warning') iconClass = 'fa-solid fa-triangle-exclamation';

    toast.innerHTML = `<i class="${iconClass}"></i> <span>${escapeHtml(message)}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}
