// Traliran AI RAG Playground - JS Logic
// All comments and user-facing strings are in English.
let knowledgeBase = [];
let ragSessions = [];
let currentRagSessionId = null;
let currentAbortController = null;

const PROVIDERS = {
    groq: { url: 'https://api.groq.com/openai/v1', hasKey: true, type: 'openai' },
    google: { url: 'https://generativelanguage.googleapis.com/v1beta/openai', hasKey: true, type: 'openai' },
    openrouter: { url: 'https://openrouter.ai/api/v1', hasKey: true, type: 'openai' },
    openai: { url: 'https://api.openai.com/v1', hasKey: true, type: 'openai' },
    deepseek: { url: 'https://api.deepseek.com/v1', hasKey: true, type: 'openai' },
    qwen: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', hasKey: true, type: 'openai' },
    glm: { url: 'https://open.bigmodel.cn/api/paas/v4', hasKey: true, type: 'openai' },
    claude: { url: 'https://api.anthropic.com/v1', hasKey: true, type: 'anthropic' },
    ollama: { url: 'http://localhost:11434/v1', hasKey: false, type: 'openai' },
    llamacpp: { url: 'http://localhost:8080/v1', hasKey: false, type: 'openai' }
};

// DOM Elements
const kbUpload = document.getElementById('kbUpload');
const kbFileList = document.getElementById('kbFileList');
const clearKbBtn = document.getElementById('clearKbBtn');
const kbPanel = document.getElementById('kbPanel');
const kbOverlay = document.getElementById('kbOverlay');
const toggleKbBtn = document.getElementById('toggleKbBtn');
const closeKbBtn = document.getElementById('closeKbBtn');
const kbUploadModal = document.getElementById('kbUploadModal');
const kbFileListModal = document.getElementById('kbFileListModal');
const clearKbModalBtn = document.getElementById('clearKbModalBtn');
const chatWindow = document.getElementById('chatWindow');
const welcomeMessage = document.getElementById('welcomeMessage');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const usageInfo = document.getElementById('usageInfo');
const streamingStatus = document.getElementById('streamingStatus');
const activeModelDisplay = document.getElementById('activeModelDisplay');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const currentConfigDisplay = document.getElementById('currentConfigDisplay');
const refreshConfigBtn = document.getElementById('refreshConfigBtn');
const ragChatsList = document.getElementById('ragChatsList');
const newRagChatBtn = document.getElementById('newRagChatBtn');
const newRagChatTopBtn = document.getElementById('newRagChatTopBtn');
const ragActiveChatName = document.getElementById('ragActiveChatName');

marked.use({ breaks: true, gfm: true });

// ---------- RAG chat sessions (multi-chat history) ----------
function getActiveRagSession() {
    return ragSessions.find(s => s.id === currentRagSessionId) || null;
}

function saveRagSessionsToStorage() {
    STORAGE.setItem('gem_rag_sessions', JSON.stringify(ragSessions));
    if (typeof SYNC_MANAGER !== 'undefined' && SYNC_MANAGER.pushToCloud) {
        SYNC_MANAGER.pushToCloud('rag_sessions');
    }
}

function createNewRagSession() {
    const id = 'rag_' + Date.now();
    const newSession = {
        id,
        name: `Chat #${ragSessions.length + 1}`,
        messages: [],
        createdAt: Date.now()
    };
    ragSessions.unshift(newSession);
    currentRagSessionId = id;
    saveRagSessionsToStorage();
    renderRagSessionsList();
    loadActiveRagSession();
    if (typeof closeKbDrawer === 'function' && window.innerWidth < 1024) closeKbDrawer();
}

function selectRagSession(id) {
    currentRagSessionId = id;
    renderRagSessionsList();
    loadActiveRagSession();
    if (window.innerWidth < 1024) closeKbDrawer();
}

async function deleteRagSession(id, event) {
    if (event) event.stopPropagation();
    const session = ragSessions.find(s => s.id === id);
    const confirmed = await showAppConfirm(`Delete chat "${session?.name || ''}"?`, {
        title: 'Delete chat',
        confirmText: 'Delete',
        danger: true
    });
    if (!confirmed) return;
    ragSessions = ragSessions.filter(s => s.id !== id);
    if (ragSessions.length === 0) {
        createNewRagSession();
        return;
    }
    if (currentRagSessionId === id) currentRagSessionId = ragSessions[0].id;
    saveRagSessionsToStorage();
    renderRagSessionsList();
    loadActiveRagSession();
}

async function renameRagSession(id) {
    const session = ragSessions.find(s => s.id === id);
    if (!session) return;
    const newName = await showAppPrompt('Enter new chat name:', session.name, {
        title: 'Rename chat',
        placeholder: 'Chat name',
        confirmText: 'Rename'
    });
    if (newName && newName.trim() !== '') {
        session.name = newName.trim();
        saveRagSessionsToStorage();
        renderRagSessionsList();
        loadActiveRagSession();
    }
}

function renderRagSessionsList() {
    if (!ragChatsList) return;
    ragChatsList.innerHTML = '';
    ragSessions.forEach(session => {
        const isActive = session.id === currentRagSessionId;
        const item = document.createElement('div');
        item.className = `group flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${isActive ? 'bg-emerald-600/20 border border-emerald-500/40 text-white' : 'hover:bg-gray-800 text-gray-300'}`;
        item.onclick = () => selectRagSession(session.id);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'text-xs font-medium truncate flex-1 pr-2';
        nameSpan.textContent = session.name;

        const renameBtn = document.createElement('button');
        renameBtn.className = 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white px-1 text-[11px] transition shrink-0';
        renameBtn.textContent = 'Rename';
        renameBtn.onclick = (e) => { e.stopPropagation(); renameRagSession(session.id); };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 px-1 text-[11px] transition shrink-0';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = (e) => deleteRagSession(session.id, e);

        item.appendChild(nameSpan);
        item.appendChild(renameBtn);
        item.appendChild(deleteBtn);
        ragChatsList.appendChild(item);
    });
}

function loadActiveRagSession() {
    const session = getActiveRagSession();
    chatWindow.innerHTML = '';
    if (!session || session.messages.length === 0) {
        welcomeMessage.classList.remove('hidden');
        chatWindow.appendChild(welcomeMessage);
    } else {
        welcomeMessage.classList.add('hidden');
        session.messages.forEach(msg => renderMessage(msg.role, msg.content, true));
    }
    if (ragActiveChatName) ragActiveChatName.textContent = session ? session.name : 'New Chat';
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function loadRagSessions() {
    const saved = STORAGE.getItem('gem_rag_sessions');
    if (saved) {
        try { ragSessions = JSON.parse(saved); } catch (e) { ragSessions = []; }
    }
    if (!Array.isArray(ragSessions) || ragSessions.length === 0) {
        ragSessions = [];
        createNewRagSession();
    } else {
        currentRagSessionId = ragSessions[0].id;
        renderRagSessionsList();
        loadActiveRagSession();
    }
}

if (newRagChatBtn) newRagChatBtn.addEventListener('click', createNewRagSession);
if (newRagChatTopBtn) newRagChatTopBtn.addEventListener('click', createNewRagSession);

function loadConfig() {
    const provider = STORAGE.getItem('gem_provider') || 'groq';
    const model = STORAGE.getItem(`gem_selected_model_${provider}`) || 'unknown';
    const botName = STORAGE.getItem('gem_bot_name') || 'RAG Assistant';
    
    activeModelDisplay.textContent = `${botName} | ${provider.toUpperCase()} | ${model}`;
    
    return {
        provider,
        model,
        botName,
        apiKey: STORAGE.getItem(`gem_key_${provider}`) || '',
        endpoint: STORAGE.getItem(`gem_endpoint_${provider}`) || PROVIDERS[provider].url,
        systemPrompt: STORAGE.getItem('gem_system_prompt') || 'You are a knowledgeable AI assistant.',
        personalInfo: STORAGE.getItem('gem_personal_info') || ''
    };
}

function loadKnowledgeBase() {
    const saved = STORAGE.getItem('gem_rag_kb');
    if (saved) {
        try {
            knowledgeBase = JSON.parse(saved);
        } catch (e) {
            knowledgeBase = [];
        }
    }
    renderKbFiles();
}

function saveKnowledgeBase() {
    STORAGE.setItem('gem_rag_kb', JSON.stringify(knowledgeBase));
    renderKbFiles();
}

function renderKbFiles() {
    renderKbListInto(kbFileList);
    renderKbListInto(kbFileListModal);
}

function renderKbListInto(container) {
    if (!container) return;
    container.innerHTML = '';
    if (knowledgeBase.length === 0) {
        container.innerHTML = '<p class="text-[10px] text-gray-600 italic">No files loaded.</p>';
        return;
    }
    knowledgeBase.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'flex items-center justify-between p-2 bg-gray-800 border border-gray-700 rounded-lg text-xs group';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'truncate pr-2 text-gray-300';
        nameSpan.textContent = file.name;
        const removeBtn = document.createElement('button');
        removeBtn.className = 'text-rose-400 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 hover:text-rose-300 transition cursor-pointer shrink-0';
        removeBtn.textContent = 'Remove';
        removeBtn.setAttribute('aria-label', 'Remove ' + file.name);
        removeBtn.onclick = () => {
            knowledgeBase.splice(index, 1);
            saveKnowledgeBase();
        };
        div.appendChild(nameSpan);
        div.appendChild(removeBtn);
        container.appendChild(div);
    });
}

// Knowledge base drawer: hidden slide-over on phones, static column on desktop.
function openKbDrawer() {
    if (!kbPanel) return;
    if (window.innerWidth >= 1024) return;
    kbPanel.classList.remove('-translate-x-full');
    if (kbOverlay) kbOverlay.classList.remove('hidden');
}

function closeKbDrawer() {
    if (!kbPanel) return;
    if (window.innerWidth >= 1024) return;
    kbPanel.classList.add('-translate-x-full');
    if (kbOverlay) kbOverlay.classList.add('hidden');
}

if (toggleKbBtn) toggleKbBtn.addEventListener('click', openKbDrawer);
if (closeKbBtn) closeKbBtn.addEventListener('click', closeKbDrawer);
if (kbOverlay) kbOverlay.addEventListener('click', closeKbDrawer);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeKbDrawer();
});

async function addFilesToKnowledgeBase(fileList) {
    const files = Array.from(fileList || []);
    for (const file of files) {
        const content = await file.text();
        knowledgeBase.push({ name: file.name, content });
    }
    if (files.length) saveKnowledgeBase();
}

kbUpload.addEventListener('change', async (e) => {
    await addFilesToKnowledgeBase(e.target.files);
    e.target.value = '';
});

if (kbUploadModal) kbUploadModal.addEventListener('change', async (e) => {
    await addFilesToKnowledgeBase(e.target.files);
    e.target.value = '';
});

clearKbBtn.addEventListener('click', async () => {
    const confirmed = await showAppConfirm('Clear all knowledge base files?', {
        title: 'Clear knowledge base',
        confirmText: 'Clear',
        danger: true
    });
    if (confirmed) {
        knowledgeBase = [];
        saveKnowledgeBase();
    }
});

if (clearKbModalBtn) clearKbModalBtn.addEventListener('click', async () => {
    const confirmed = await showAppConfirm('Clear all knowledge base files?', {
        title: 'Clear knowledge base',
        confirmText: 'Clear',
        danger: true
    });
    if (confirmed) {
        knowledgeBase = [];
        saveKnowledgeBase();
    }
});

function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMessage(role, content, fromHistory) {
    // Hide the welcome banner whenever a real message is rendered.
    welcomeMessage.classList.add('hidden');
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex flex-col ${role === 'user' ? 'items-end' : 'items-start'} w-full`;
    
    const bgClass = role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-100';
    
    msgDiv.innerHTML = `
        <span class="text-xs text-gray-500 mb-1 px-1">${role === 'user' ? 'You' : 'AI'}</span>
        <div class="max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md ${bgClass} overflow-hidden break-words">
            <div class="md-content">${role === 'user' ? escapeHtml(content).replace(/\\n/g, '<br>') : marked.parse(content)}</div>
        </div>
    `;
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function fetchStreamingCompletion(config, messages, signal, onDelta) {
    const { provider, apiKey, endpoint, model } = config;
    const providerDetails = PROVIDERS[provider];
    
    const headers = { 'Content-Type': 'application/json' };
    if (providerDetails.hasKey && apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const body = {
        model: model,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
        stream_options: { "include_usage": true }
    };

    // Simple handler for Claude (non-openai) if needed, but here we focus on OpenAI-compatible
    const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                try {
                    const json = JSON.parse(data);

                    if (json.usage) {
                        const { prompt_tokens, completion_tokens, total_tokens } = json.usage;
                        usageInfo.textContent = `Tokens: ${total_tokens} (P: ${prompt_tokens}, C: ${completion_tokens})`;
                    }

                    if (json.choices && json.choices[0]?.delta?.content) {
                        const delta = json.choices[0].delta.content;
                        accumulated += delta;
                        onDelta(delta);
                    }
                } catch (e) {}
            }
        }
    }
    return accumulated;
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    let session = getActiveRagSession();
    if (!session) {
        createNewRagSession();
        session = getActiveRagSession();
    }
    if (!session) return;

    const config = loadConfig();
    if (PROVIDERS[config.provider].hasKey && !config.apiKey) {
        notifyWarning('API Key missing! Please configure it in the Hub.');
        return;
    }

    userInput.value = '';
    userInput.style.height = 'auto';
    renderMessage('user', text);
    session.messages.push({ role: 'user', content: text });

    // Auto-rename untitled chats from the first user message.
    if (session.name.startsWith('Chat #') && text) {
        session.name = text.slice(0, 28) + (text.length > 28 ? '...' : '');
    }
    saveRagSessionsToStorage();
    renderRagSessionsList();
    if (ragActiveChatName) ragActiveChatName.textContent = session.name;

    // Build RAG System Prompt
    const personalContext = config.personalInfo ? `[About the user]:\n${config.personalInfo}\n\n` : '';
    const kbContext = knowledgeBase.map(f => `File: ${f.name}\nContent:\n${f.content}`).join('\n\n---\n\n');
    const ragSystemPrompt = `
${personalContext}${config.systemPrompt}

You are now operating in RAG (Retrieval Augmented Generation) mode. 
Below is the provided knowledge base. Use it as your primary source of truth. 
If the answer is not in the knowledge base, state that you don't know based on the provided files, but you can provide general knowledge if helpful.

### KNOWLEDGE BASE:
${kbContext || 'No files uploaded yet.'}
`;

    const messages = [
        { role: 'system', content: ragSystemPrompt },
        ...session.messages
    ];

    userInput.disabled = true;
    sendBtn.disabled = true;
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');
    
    currentAbortController = new AbortController();

    // Placeholder for streaming
    const placeholderDiv = document.createElement('div');
    placeholderDiv.className = 'flex flex-col items-start w-full';
    placeholderDiv.innerHTML = `
        <span class="text-xs text-gray-500 mb-1 px-1">AI</span>
        <div class="max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md bg-gray-900 border border-gray-800 text-gray-100 overflow-hidden break-words">
            <div class="streaming-content whitespace-pre-wrap"></div>
        </div>
    `;
    chatWindow.appendChild(placeholderDiv);
    const contentDiv = placeholderDiv.querySelector('.streaming-content');
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        document.getElementById('usageIndicator').classList.remove('hidden');
        document.getElementById('usageIndicator').classList.add('flex');
        streamingStatus.textContent = 'Streaming...';

        const finalContent = await fetchStreamingCompletion(
            config, 
            messages, 
            currentAbortController.signal, 
            (delta) => {
                contentDiv.textContent += delta;
                chatWindow.scrollTop = chatWindow.scrollHeight;
            }
        );

        session.messages.push({ role: 'assistant', content: finalContent });
        saveRagSessionsToStorage();
        
        // Transition from plain text to rendered markdown
        placeholderDiv.remove();
        renderMessage('assistant', finalContent);

    } catch (e) {
        if (e.name === 'AbortError') {
            placeholderDiv.remove();
        } else {
            console.error(e);
            placeholderDiv.querySelector('.streaming-content').textContent = 'Error: ' + e.message;
        }
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        sendBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        streamingStatus.textContent = '';
        currentAbortController = null;
        userInput.focus();
    }
}

sendBtn.addEventListener('click', sendMessage);
stopBtn.addEventListener('click', () => {
    if (currentAbortController) currentAbortController.abort();
});

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});

// Settings Modal
openSettingsBtn.addEventListener('click', () => {
    const config = loadConfig();
    currentConfigDisplay.innerHTML = `
        <div><strong>Provider:</strong> ${config.provider}</div>
        <div><strong>Model:</strong> ${config.model}</div>
        <div><strong>Bot Name:</strong> ${config.botName}</div>
        <div><strong>Key:</strong> ${config.apiKey ? '********' : 'Missing'}</div>
    `;
    settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
refreshConfigBtn.addEventListener('click', () => {
    loadConfig();
    openSettingsBtn.click();
});

saveKnowledgeBase = SYNC_MANAGER.wrapStorageSave(saveKnowledgeBase, 'rag_knowledge');

function setupPlaygroundSync() {
    const loginIndicator = document.createElement('div');
    loginIndicator.className = 'text-[10px] text-gray-500 ml-2 cursor-pointer hover:text-emerald-400 transition';
    loginIndicator.id = 'playgroundSyncStatus';
    loginIndicator.textContent = '';

    const configStatus = document.getElementById('configStatus');
    if (configStatus) configStatus.appendChild(loginIndicator);

    SYNC_MANAGER.setStatusCallback((text, isError) => {
        loginIndicator.textContent = text || '';
        loginIndicator.style.color = isError ? '#f87171' : '#34d399';
    });
}

window.addEventListener('storage', (e) => {
    if (e.key === 'gem_rag_kb') {
        loadKnowledgeBase();
    }
    if (e.key === 'gem_rag_sessions') {
        loadRagSessions();
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    await STORAGE.ready();
    loadConfig();
    loadKnowledgeBase();
    loadRagSessions();
    setupPlaygroundSync();

    if (SYNC_MANAGER.isLoggedIn()) {
        SYNC_MANAGER.pullFromCloud('rag_knowledge').then(() => {
            loadKnowledgeBase();
        }).catch(e => console.error('Initial RAG sync error:', e));
        SYNC_MANAGER.pullFromCloud('rag_sessions').then((data) => {
            if (data) loadRagSessions();
        }).catch(e => console.error('Initial RAG sessions sync error:', e));
    }
});

