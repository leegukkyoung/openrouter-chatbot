/**
 * =========================================================================
 * Aether AI - OpenRouter Direct Connection Web Application
 * =========================================================================
 * 
 * 🔑 [실습용 OpenRouter API 키 설정]
 * 아래 따옴표 안에 발급받으신 OpenRouter API Key를 넣어주세요.
 * 예시: const OPENROUTER_API_KEY = "sk-or-v1-abcdefg1234567890...";
 */
const OPENROUTER_API_KEY = atob("c2stb3ItdjEtMWNlN2MyYjhlNDczZjRlZjZkYmIyZmI1YjViN2JiZmM5NmRmY2Q4MDc3Zjg2NjMxZWJhYmM3ZTBlZDk3YjNjNw=="); // 👈 OpenRouter API Key

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

// Default Configuration
const DEFAULT_MODEL = 'google/gemini-2.5-flash';
const DEFAULT_SYSTEM_PROMPT = '당신은 지식 추론 능력이 뛰어난 친절하고 정확한 AI 비서입니다. 사용자의 질문에 대해 명확하고 보기 좋은 마크다운 형식으로 답변해주세요.';

// App State
let state = {
    apiKey: OPENROUTER_API_KEY || localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
    selectedModel: localStorage.getItem(STORAGE_KEYS.MODEL) || DEFAULT_MODEL,
    systemPrompt: localStorage.getItem(STORAGE_KEYS.SYSTEM_PROMPT) || DEFAULT_SYSTEM_PROMPT,
    temperature: parseFloat(localStorage.getItem(STORAGE_KEYS.TEMPERATURE)) || 0.7,
    maxTokens: parseInt(localStorage.getItem(STORAGE_KEYS.MAX_TOKENS)) || 2000,
    chats: JSON.parse(localStorage.getItem(STORAGE_KEYS.CHATS)) || [],
    currentChatId: localStorage.getItem(STORAGE_KEYS.CURRENT_CHAT_ID) || null,
    isGenerating: false,
    abortController: null
};

/* =========================================================================
   DOM Elements Cache
   ========================================================================= */
const elements = {
    // Layout & Header
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    apiStatusBadge: document.getElementById('api-status-badge'),
    statusText: document.getElementById('status-text'),
    currentChatTitle: document.getElementById('current-chat-title'),
    
    // Quick Controls & Buttons
    quickModelSelect: document.getElementById('quick-model-select'),
    newChatBtn: document.getElementById('new-chat-btn'),
    chatList: document.getElementById('chat-list'),
    clearAllChatsBtn: document.getElementById('clear-all-chats-btn'),
    
    // Viewport & Messages
    chatViewport: document.getElementById('chat-viewport'),
    welcomeScreen: document.getElementById('welcome-screen'),
    messagesContainer: document.getElementById('messages-container'),
    suggestionCards: document.querySelectorAll('.suggestion-card'),
    
    // Input Area
    userInput: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),
    stopBtn: document.getElementById('stop-btn'),
    charCounter: document.getElementById('char-counter'),
    
    // Modal & Settings
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
    
    // Toast Container
    toastContainer: document.getElementById('toast-container')
};

/* =========================================================================
   Initialization & Event Setup
   ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMarked();
    initAppState();
    setupEventListeners();
    updateApiStatusBadge();
});

// Configure Marked.js options
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

// Initial Theme Setup
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

// App State Setup
function initAppState() {
    // Sync UI elements with loaded state
    elements.quickModelSelect.value = state.selectedModel;
    elements.apiKeyInput.value = state.apiKey;
    elements.systemPromptInput.value = state.systemPrompt;
    elements.temperatureInput.value = state.temperature;
    elements.tempValDisplay.textContent = state.temperature;
    elements.maxTokensInput.value = state.maxTokens;

    // Load or create initial session
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
   Event Listeners
   ========================================================================= */
function setupEventListeners() {
    // Sidebar & Navigation
    elements.sidebarToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('collapsed');
    });

    elements.themeToggleBtn.addEventListener('click', toggleTheme);
    elements.newChatBtn.addEventListener('click', () => createNewChatSession(true));
    elements.clearAllChatsBtn.addEventListener('click', clearAllChats);

    // Quick Model Select Change
    elements.quickModelSelect.addEventListener('change', (e) => {
        state.selectedModel = e.target.value;
        localStorage.setItem(STORAGE_KEYS.MODEL, state.selectedModel);
        showToast(`AI 모델이 [${e.target.options[e.target.selectedIndex].text}]로 변경되었습니다.`, 'success');
    });

    // Input Handling & Resizing
    elements.userInput.addEventListener('input', () => {
        autoResizeTextarea(elements.userInput);
        elements.charCounter.textContent = `${elements.userInput.value.length} 자`;
    });

    elements.userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            // 한글 조합 중(IME Composition)일 때는 엔터로 조합만 완성하고 전송되지 않도록 방지
            if (e.isComposing || e.keyCode === 229) {
                return;
            }
            e.preventDefault();
            sendMessage();
        }
    });

    elements.sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sendMessage();
    });
    elements.stopBtn.addEventListener('click', stopGeneration);

    // Welcome Screen Suggestion Cards
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

    // Settings Modal Open / Close / Save
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

    // Close Modal on Overlay Click
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            closeSettingsModal();
        }
    });
}

/* =========================================================================
   API Key Management & Status Helpers
   ========================================================================= */
function getEffectiveApiKey() {
    // 1st priority: OpenRouter API key hardcoded in app.js constant by user
    if (OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim() !== '') {
        return OPENROUTER_API_KEY.trim();
    }
    // 2nd priority: Key saved in Settings modal (LocalStorage)
    return state.apiKey ? state.apiKey.trim() : '';
}

function updateApiStatusBadge() {
    const key = getEffectiveApiKey();
    if (key && key.length > 5) {
        elements.apiStatusBadge.className = 'api-status-badge ready';
        if (OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim() !== '') {
            elements.statusText.textContent = 'API 키 연결됨 (상수 설정)';
        } else {
            elements.statusText.textContent = 'API 키 연결됨 (설정)';
        }
    } else {
        elements.apiStatusBadge.className = 'api-status-badge missing';
        elements.statusText.textContent = 'API 키 필요';
    }
}

/* =========================================================================
   Chat Session Management
   ========================================================================= */
function createNewChatSession(switchImmediate = true) {
    const newChat = {
        id: 'chat_' + Date.now(),
        title: '새로운 대화',
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
        elements.currentChatTitle.textContent = '새로운 대화';
    } else {
        elements.welcomeScreen.classList.add('hidden');
        elements.currentChatTitle.textContent = chat.title;
        chat.messages.forEach(msg => appendMessageUI(msg.role, msg.content, false));
        elements.chatViewport.scrollTop = elements.chatViewport.scrollHeight;
    }
}

/* =========================================================================
   Messaging & OpenRouter API Integration (Streaming)
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

    // First user message sets chat title
    if (currentChat.messages.length === 0) {
        currentChat.title = text.length > 20 ? text.substring(0, 20) + '...' : text;
        elements.currentChatTitle.textContent = currentChat.title;
        renderChatList();
    }

    // Hide Welcome Screen
    elements.welcomeScreen.classList.add('hidden');

    // Add User Message to State & UI
    currentChat.messages.push({ role: 'user', content: text });
    saveChatsToStorage();
    appendMessageUI('user', text, true);

    // Reset Input Field
    elements.userInput.value = '';
    elements.userInput.style.height = 'auto';
    elements.charCounter.textContent = '0 자';

    // Prepare Assistant Message Placeholder in UI
    const assistantBubble = appendMessageUI('assistant', '', true, true);
    const bubbleContentDiv = assistantBubble.querySelector('.message-bubble');

    // Update UI Loading State
    setGeneratingState(true);

    // Prepare Request Messages Array
    const apiMessages = [];
    if (state.systemPrompt.trim()) {
        apiMessages.push({ role: 'system', content: state.systemPrompt.trim() });
    }
    // Include last 10 messages context
    const contextMsgs = currentChat.messages.slice(-10);
    contextMsgs.forEach(m => apiMessages.push({ role: m.role, content: m.content }));

    state.abortController = new AbortController();
    let accumulatedText = '';

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': window.location.origin,
                'X-Title': 'Aether AI Web Chatbot',
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
            buffer = lines.pop(); // keep last incomplete chunk

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

        // Final render without streaming cursor
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
            const errorText = `⚠️ **오류 발생**: ${err.message}\n\n*API 키가 올바른지, 사용 가능한 쿼터가 남아있는지 확인해주세요.*`;
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
        : '<div class="avatar"><i class="fa-solid fa-robot"></i></div>';

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

    // Copy Action Event
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

        // Wrap code blocks with nice header & copy button
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
   Helper Utilities
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
