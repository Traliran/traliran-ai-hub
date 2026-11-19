// Traliran AI RAG Playground - JS Logic
// All comments and user-facing strings are in English.
let knowledgeBase = [];
let ragSessions = [];
let currentRagSessionId = null;
let currentAbortController = null;

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
        session.messages.forEach(msg => renderMessage(msg.role, msg.content));
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
    const provider = resolveProviderName(STORAGE.getItem('gem_provider') || 'groq');
    const model = STORAGE.getItem(`gem_selected_model_${provider}`) || 'unknown';
    const botName = STORAGE.getItem('gem_bot_name') || 'RAG Assistant';

    activeModelDisplay.textContent = `${botName} | ${provider.toUpperCase()} | ${model}`;

    return {
        provider,
        model,
        botName,
        apiKey: STORAGE.getItem(`gem_key_${provider}`) || '',
        endpoint: STORAGE.getItem(`gem_endpoint_${provider}`) || getProviderDescriptor(provider).url,
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
    SYNC_MANAGER.pushToCloud('rag_knowledge');
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
    knowledgeBase.forEach((file) => {
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
            // Resolve by identity so a stale render can never remove the wrong file.
            const idx = knowledgeBase.indexOf(file);
            if (idx > -1) knowledgeBase.splice(idx, 1);
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

// Chat attachments use the same shared mechanics as the Hub.
const attachmentInput = document.getElementById('attachmentInput');
CHAT_ATTACHMENTS.mount({ indicatorId: 'fileIndicator', cardsId: 'attachmentCards' });
if (attachmentInput) {
    attachmentInput.addEventListener('change', async (e) => {
        await CHAT_ATTACHMENTS.addFiles(e.target.files);
        e.target.value = '';
    });
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

function renderMessage(role, content) {
    // Hide the welcome banner whenever a real message is rendered.
    welcomeMessage.classList.add('hidden');
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex flex-col ${role === 'user' ? 'items-end' : 'items-start'} w-full`;

    const bgClass = role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-100';
    const isUser = role === 'user';

    let bodyHtml = '';
    let attachmentEl = null;
    if (isUser) {
        const parsed = CHAT_ATTACHMENTS.parseUserContent(content);
        bodyHtml = escapeHtml(parsed.text).replace(/\n/g, '<br>');
        if (parsed.attachments.length) {
            attachmentEl = CHAT_ATTACHMENTS.createCardsElement(parsed.attachments);
        }
    } else {
        bodyHtml = renderMarkdown(typeof content === 'string' ? content : normalizeContentToText(content));
    }

    const bubbleHtml = (bodyHtml || !isUser) ? `
        <div class="msg-bubble max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md ${bgClass} overflow-hidden break-words">
            <div class="md-content">${bodyHtml}</div>
        </div>
    ` : '';

    msgDiv.innerHTML = `
        <span class="text-xs text-gray-500 mb-1 px-1">${isUser ? 'You' : 'AI'}</span>
        ${bubbleHtml}
    `;
    if (attachmentEl) {
        const bubble = msgDiv.querySelector('.msg-bubble');
        msgDiv.insertBefore(attachmentEl, bubble || null);
    }
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// ---------- RAG knowledge base tools (grep-style retrieval) ----------
const RAG_SEARCH_ROUNDS = 5;
const RAG_EXTRA_SEARCH_ROUNDS = 2;
const RAG_MAX_MATCHES = 30;
const RAG_MAX_LINE_LENGTH = 240;
const RAG_MAX_PATTERN_LENGTH = 500;

const RAG_TOOLS = [
    {
        name: 'grep',
        description: 'Searches all uploaded knowledge base files for a case-insensitive literal phrase and returns matching file names, line numbers, and lines.',
        parameters: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Literal text to search for' },
                file: { type: 'string', description: 'Optional file name filter' }
            },
            required: ['pattern'],
            additionalProperties: false
        },
        execute: async (args) => grepKnowledgeBase(args)
    }
];

function grepKnowledgeBase(args) {
    const pattern = String(args?.pattern || '');
    if (!pattern.trim()) {
        return JSON.stringify({ success: false, error: 'Search pattern is required.' }, null, 2);
    }
    if (pattern.length > RAG_MAX_PATTERN_LENGTH) {
        return JSON.stringify({ success: false, error: 'Search pattern is too long.' }, null, 2);
    }

    const needle = pattern.toLowerCase();
    const fileFilter = String(args?.file || '').trim().toLowerCase();
    const files = fileFilter
        ? knowledgeBase.filter((file) => String(file.name || '').toLowerCase().includes(fileFilter))
        : knowledgeBase;
    const matches = [];
    let totalMatches = 0;

    for (const file of files) {
        const lines = String(file.content || '').split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
            if (!lines[i].toLowerCase().includes(needle)) continue;
            totalMatches++;
            if (matches.length >= RAG_MAX_MATCHES) continue;
            matches.push({
                file: file.name,
                line: i + 1,
                text: lines[i].slice(0, RAG_MAX_LINE_LENGTH)
            });
        }
    }

    return JSON.stringify({
        success: true,
        matches,
        total_matches: totalMatches,
        truncated: totalMatches > matches.length
    }, null, 2);
}

function buildRagToolDescriptions() {
    return RAG_TOOLS.map((tool) => {
        const params = tool.parameters.properties || {};
        const paramList = Object.entries(params).map(([name, schema]) => {
            const type = schema.type || 'string';
            const desc = schema.description || '';
            const required = tool.parameters.required?.includes(name) ? '(required)' : '(optional)';
            return `  - ${name} (${type}, ${required}): ${desc}`;
        }).join('\n');

        return `### ${tool.name}\nDescription: ${tool.description}\nParameters:\n${paramList}`;
    }).join('\n\n');
}

function buildRagSystemPrompt(config, hasKnowledge) {
    const personalContext = config.personalInfo ? `[About the user]:\n${config.personalInfo}\n\n` : '';
    if (!hasKnowledge) {
        return `${personalContext}${config.systemPrompt}

You are operating in RAG (Retrieval Augmented Generation) mode, but no knowledge base files are uploaded. Answer normally and do not claim to have searched files.`;
    }

    return `${personalContext}${config.systemPrompt}

You are operating in RAG (Retrieval Augmented Generation) mode.
The knowledge base is NOT preloaded into this context. You must search it with the grep tool below.
Use short, distinctive literal phrases; the pattern is matched as a literal substring, not a regular expression. Search results include file names, line numbers, and matching lines.
You have up to ${RAG_SEARCH_ROUNDS} search rounds. If those are not enough, you may make up to ${RAG_EXTRA_SEARCH_ROUNDS} extra rounds, but you will be warned to answer with the information you already have.
Base your answer on the search results. If the answer is not in the knowledge base, say that you don't know based on the provided files, but you may provide general knowledge if helpful.

### TOOLS
${buildRagToolDescriptions()}

To call a tool, respond with a JSON object in this exact format:
{"tool": "grep", "arguments": {"pattern": "text to find"}}

Only output the JSON object when you want to call a tool. Do not include any other text.
If you need multiple searches, wait for the result before making the next call.
When you have enough information, answer normally without a tool call.`;
}

function parseRagToolCalls(content) {
    if (!content) return [];

    try {
        // Extract the outermost JSON object without regex backtracking.
        const start = content.indexOf('{');
        const end = content.lastIndexOf('}');
        const candidate = start !== -1 && end > start ? content.slice(start, end + 1) : '';
        if (candidate.includes('"tool"')) {
            const parsed = JSON.parse(candidate);
            if (parsed.tool && parsed.arguments) {
                return [{
                    id: 'tool_' + Date.now(),
                    type: 'function',
                    function: {
                        name: parsed.tool,
                        arguments: JSON.stringify(parsed.arguments)
                    }
                }];
            }
        }
    } catch (e) {
        // Not a valid JSON tool call.
    }

    return [];
}

function renderRagToolNotification(toolName, args) {
    const div = document.createElement('div');
    div.className = 'bg-gray-900/60 border border-gray-800 rounded-lg p-2 text-[10px] text-gray-500';
    let argStr = Object.entries(args || {}).map(([key, value]) => `${key}: ${value}`).join(', ');
    if (argStr.length > 80) argStr = argStr.substring(0, 77) + '...';
    div.innerHTML = `🔧 <span class="text-emerald-400">${escapeHtml(toolName)}</span>(${escapeHtml(argStr)})`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function renderRagLimitNotice(extraNumber) {
    const div = document.createElement('div');
    div.className = 'bg-amber-950/40 border border-amber-900/50 rounded-lg p-2 text-[10px] text-amber-400';
    div.textContent = `⚠️ Search limit exceeded (${RAG_SEARCH_ROUNDS} rounds). Extra search ${extraNumber}/${RAG_EXTRA_SEARCH_ROUNDS} — answer with the information already found.`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function requestRagCompletion(config, messages, onDelta, statusText) {
    streamingStatus.textContent = statusText;
    let accumulated = '';

    const result = await fetchStreamingCompletion(
        config.endpoint,
        config.apiKey,
        providerRequiresKey(config.provider),
        {
            model: config.model,
            messages,
            temperature: 0.7,
            max_tokens: 4096,
            stream_options: { include_usage: true }
        },
        config.provider,
        currentAbortController.signal,
        (delta) => {
            accumulated += delta;
            if (onDelta) onDelta(delta, accumulated);
        },
        (usage) => {
            const total = usage.total_tokens ?? usage.output_tokens ?? 0;
            const prompt = usage.input_tokens ?? usage.prompt_tokens ?? 0;
            const completion = usage.output_tokens ?? usage.completion_tokens ?? 0;
            usageInfo.textContent = `Tokens: ${total} (P: ${prompt}, C: ${completion})`;
        }
    );

    return result.content || accumulated;
}

async function runRagToolLoop(config, messages, placeholderDiv, contentDiv) {
    const maxRounds = RAG_SEARCH_ROUNDS + RAG_EXTRA_SEARCH_ROUNDS;
    let rounds = 0;
    let finalContent = '';

    while (rounds < maxRounds) {
        rounds++;
        const isExtra = rounds > RAG_SEARCH_ROUNDS;
        const status = isExtra
            ? `Search limit exceeded: extra search ${rounds - RAG_SEARCH_ROUNDS}/${RAG_EXTRA_SEARCH_ROUNDS}...`
            : `Searching knowledge base... (${rounds}/${RAG_SEARCH_ROUNDS})`;

        let holdingToolJson = false;
        placeholderDiv.classList.remove('hidden');
        contentDiv.textContent = '';

        const responseContent = await requestRagCompletion(
            config,
            messages,
            (delta, accumulated) => {
                // Hide a streamed tool call so only the final answer is visible.
                const looksLikeToolCall = accumulated.includes('"tool"') && accumulated.includes('"arguments"');
                if (!holdingToolJson && (accumulated.trimStart().startsWith('{') || looksLikeToolCall)) {
                    holdingToolJson = true;
                    placeholderDiv.classList.add('hidden');
                }
                if (!holdingToolJson) {
                    contentDiv.textContent = accumulated;
                    chatWindow.scrollTop = chatWindow.scrollHeight;
                }
            },
            status
        );

        const toolCalls = parseRagToolCalls(responseContent);
        if (!toolCalls.length) {
            finalContent = responseContent;
            placeholderDiv.classList.remove('hidden');
            contentDiv.textContent = finalContent;
            chatWindow.scrollTop = chatWindow.scrollHeight;
            break;
        }

        placeholderDiv.classList.add('hidden');
        contentDiv.textContent = '';

        for (const toolCall of toolCalls) {
            const toolName = toolCall.function?.name || '';
            const tool = RAG_TOOLS.find((entry) => entry.name === toolName);
            let args = {};
            try {
                args = JSON.parse(toolCall.function?.arguments || '{}');
            } catch (e) {
                args = {};
            }

            renderRagToolNotification(toolName, args);
            const result = tool
                ? await tool.execute(args)
                : JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` }, null, 2);
            const limitNote = isExtra
                ? `\n\n[System note]: Search limit exceeded (${RAG_SEARCH_ROUNDS} rounds). This is extra search ${rounds - RAG_SEARCH_ROUNDS} of ${RAG_EXTRA_SEARCH_ROUNDS}. Prefer answering with the information you already have.`
                : '';
            messages.push({
                role: 'user',
                content: `[Tool result from ${toolName}]: ${result}${limitNote}`
            });
        }

        if (isExtra) renderRagLimitNotice(rounds - RAG_SEARCH_ROUNDS);
    }

    if (finalContent) return finalContent;

    // The model kept requesting tools after all allowed rounds; force a final answer.
    messages.push({
        role: 'user',
        content: '[System note]: Tool use is now disabled. Do not output JSON or request any more tools. Answer the user in natural language using the information already gathered.'
    });
    placeholderDiv.classList.remove('hidden');
    contentDiv.textContent = '';
    return await requestRagCompletion(
        config,
        messages,
        (delta, accumulated) => {
            contentDiv.textContent = accumulated;
            chatWindow.scrollTop = chatWindow.scrollHeight;
        },
        'Preparing final answer...'
    );
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text && !CHAT_ATTACHMENTS.hasFiles()) return;

    let session = getActiveRagSession();
    if (!session) {
        createNewRagSession();
        session = getActiveRagSession();
    }
    if (!session) return;

    const config = loadConfig();
    if (providerRequiresKey(config.provider) && !config.apiKey) {
        notifyWarning('API Key missing! Please configure it in the Hub.');
        return;
    }

    const pendingAttachments = CHAT_ATTACHMENTS.getPending();
    const fullUserContent = CHAT_ATTACHMENTS.buildUserContent(text);

    userInput.value = '';
    userInput.style.height = 'auto';
    renderMessage('user', fullUserContent);
    session.messages.push({ role: 'user', content: fullUserContent });

    // Auto-rename untitled chats from the first user message.
    if (session.name.startsWith('Chat #') && (text || pendingAttachments.length)) {
        const baseName = text || pendingAttachments[0]?.name || 'Attachment';
        session.name = baseName.slice(0, 28) + (baseName.length > 28 ? '...' : '');
    }
    saveRagSessionsToStorage();
    renderRagSessionsList();
    if (ragActiveChatName) ragActiveChatName.textContent = session.name;
    CHAT_ATTACHMENTS.clear();

    // The first request contains prompts only; knowledge base content is retrieved through tools.
    const hasKnowledge = knowledgeBase.length > 0;
    const ragSystemPrompt = buildRagSystemPrompt(config, hasKnowledge);

    const messages = [
        { role: 'system', content: ragSystemPrompt },
        ...session.messages.map(msg => ({ role: msg.role, content: normalizeContentForApi(msg.content) }))
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
        <div class="msg-bubble max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md bg-gray-900 border border-gray-800 text-gray-100 overflow-hidden break-words">
            <div class="streaming-content whitespace-pre-wrap"></div>
        </div>
    `;
    chatWindow.appendChild(placeholderDiv);
    const contentDiv = placeholderDiv.querySelector('.streaming-content');
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        document.getElementById('usageIndicator').classList.remove('hidden');
        document.getElementById('usageIndicator').classList.add('flex');

        const finalContent = hasKnowledge
            ? await runRagToolLoop(config, messages, placeholderDiv, contentDiv)
            : await requestRagCompletion(
                config,
                messages,
                (delta, accumulated) => {
                    contentDiv.textContent = accumulated;
                    chatWindow.scrollTop = chatWindow.scrollHeight;
                },
                'Streaming...'
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
            placeholderDiv.classList.remove('hidden');
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
        <div><strong>Provider:</strong> ${escapeHtml(config.provider)}</div>
        <div><strong>Model:</strong> ${escapeHtml(config.model)}</div>
        <div><strong>Bot Name:</strong> ${escapeHtml(config.botName)}</div>
        <div><strong>Key:</strong> ${config.apiKey ? '********' : 'Missing'}</div>
    `;
    settingsModal.classList.remove('hidden');
});

closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
refreshConfigBtn.addEventListener('click', () => {
    loadConfig();
    openSettingsBtn.click();
});

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
    CHAT_ATTACHMENTS.initFontScale(chatWindow, { sliderId: 'chatFontSize', valueId: 'chatFontSizeValue' });
    if (typeof CHAT_SEARCH !== 'undefined') {
        CHAT_SEARCH.mount({
            storageKey: 'gem_rag_sessions',
            triggerId: 'chatSearchBtn',
            accent: '#34d399',
            onSelect: sessionId => selectRagSession(sessionId),
            getMessageContainer: () => chatWindow
        });
    }
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

