const PAID_ASSISTANTS_CONFIG = [
    {
        name: "Markdown assistant - $5",
        description: "A productivity tool that automates knowledge management methods like Zettelkasten or P.A.R.A. by converting unformatted text and links into structured Markdown files for Obsidian or Notion. ",
        link: "https://whop.com/joined/traliran-ai-huub/products/markdown-assistant/"
    },
    {
        name: "Text Game Master (Co-writer for Authors) - $5",
        description: "An AI-powered lore keeper and consistency editor for writers and screenwriters that ensures narrative logic and internal world rules are strictly followed.",
        link: "https://whop.com/joined/traliran-ai-huub/products/text-game-master-co-writer-for-authors/"
    },
    {
        name: "Short-Form Video Scriptwriter - $5",
        description: "An AI marketing strategist designed to generate high-retention, non-generic scripts for short-form video platforms like TikTok, Reels, and Shorts, specifically targeted at the English-speaking market.",
        link: "https://whop.com/joined/traliran-ai-huub/products/short-form-video-scriptwriter/"
    },
    {
        name: "Mind-Map & Pin-Card Designer - $5",
        description: "An analytical AI assistant specialized in information architecture, helping users transform raw data and complex ideas into logical, highly structured hierarchical diagrams.",
        link: "https://whop.com/joined/traliran-ai-huub/products/mind-map-pin-card-designer/"
    },
    {
        name: "Deep Script Analyst - $4",
        description: "An advanced structural and narrative analytics AI designed for professional screenwriters, script doctors, and script supervisors. It deconstructs feature-length or episodic screenplays to analyze pacing, thematic cohesion, and character arc metrics without modifying the writer's creative voice.",
        link: "https://whop.com/joined/traliran-ai-huub/products/deep-script-analyst/"
    },
    {
        name: "AI Knowledge Auditor - $6",
        description: "An advanced educational AI designed to battle information hoarding. Instead of just organizing notes, it audits the user's actual understanding of their saved materials through adaptive, Socratic-style testing and conceptual stress-tests.",
        link: "https://whop.com/joined/traliran-ai-huub/products/ai-knowledge-auditor/"
    }
];

let sessions = [];
let currentSessionId = null;
let attachedFileContent = null;
let attachedFileName = "";
let attachedFileType = "";
let selectedMultiModels = [];
let currentAbortController = null;

const apiProvider = document.getElementById('apiProvider');
const apiKeyValue = document.getElementById('apiKeyValue');
const apiEndpoint = document.getElementById('apiEndpoint');
const apiKeyContainer = document.getElementById('apiKeyContainer');
const endpointContainer = document.getElementById('endpointContainer');
const botModelSelect = document.getElementById('botModel');
const refreshModelsBtn = document.getElementById('refreshModelsBtn');
const botNameInput = document.getElementById('botName');
const botPromptInput = document.getElementById('botPrompt');
const tempInput = document.getElementById('botTemperature');
const tempValue = document.getElementById('tempValue');
const topPInput = document.getElementById('botTopP');
const topPValue = document.getElementById('topPValue');
const tokensInput = document.getElementById('botMaxTokens');
const tokensValue = document.getElementById('tokensValue');
const themeSelector = document.getElementById('themeSelector');
const helpModal = document.getElementById('helpModal');
const openHelpBtn = document.getElementById('openHelpBtn');
const closeHelpModal = document.getElementById('closeHelpModal');
const closeHelpModalBtn = document.getElementById('closeHelpModalBtn');
const startIntroBtn = document.getElementById('startIntroBtn');
const storeModal = document.getElementById('storeModal');
const openStoreBtn = document.getElementById('openStoreBtn');
const closeStoreModal = document.getElementById('closeStoreModal');
const paidBotsContainer = document.getElementById('paidBotsContainer');

const openMultiModelBtn = document.getElementById('openMultiModelBtn');
const multiModelModal = document.getElementById('multiModelModal');
const closeMultiModelModal = document.getElementById('closeMultiModelModal');
const multiModelList = document.getElementById('multiModelList');
const saveMultiModelsBtn = document.getElementById('saveMultiModels');
const clearMultiModelsBtn = document.getElementById('clearMultiModels');
const multiModelBadge = document.getElementById('multiModelBadge');

const openGroupChatBtn = document.getElementById('openGroupChatBtn');
const groupChatModal = document.getElementById('groupChatModal');
const closeGroupChatModal = document.getElementById('closeGroupChatModal');
const groupIdeaInput = document.getElementById('groupIdeaInput');
const startGroupDebateBtn = document.getElementById('startGroupDebateBtn');

const toggleSandboxBtn = document.getElementById('toggleSandboxBtn');
const sandboxColumn = document.getElementById('sandboxColumn');
const closeSandboxBtn = document.getElementById('closeSandboxBtn');
const tabEditor = document.getElementById('tabEditor');
const tabPreview = document.getElementById('tabPreview');
const sandboxEditorContainer = document.getElementById('sandboxEditorContainer');
const sandboxPreviewContainer = document.getElementById('sandboxPreviewContainer');
const sandboxCode = document.getElementById('sandboxCode');
const sandboxIframe = document.getElementById('sandboxIframe');
const runCodeBtn = document.getElementById('runCodeBtn');

const chatWindow = document.getElementById('chatWindow');
const welcomeMessage = document.getElementById('welcomeMessage');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const clearChatBtn = document.getElementById('clearChat');
const chatsList = document.getElementById('chatsList');
const newChatBtn = document.getElementById('newChatBtn');
const attachmentInput = document.getElementById('attachmentInput');
const fileIndicator = document.getElementById('fileIndicator');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const removeFileBtn = document.getElementById('removeFileBtn');
const sidebar = document.getElementById('sidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const closeSidebarBtn = document.getElementById('closeSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const chatsPanel = document.getElementById('chatsPanel');
const toggleChatsBtn = document.getElementById('toggleChats');
const chatsOverlay = document.getElementById('chatsOverlay');
const exportJsonBtn = document.getElementById('exportJson');
const importJsonInput = document.getElementById('importJson');
const activeStatusText = document.getElementById('activeStatusText');

marked.use({ breaks: true, gfm: true });

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

function safeEncode(str) {
    if (!str) return '';
    return encodeURIComponent(str).replace(/'/g, '%27');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalizeContentToText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(part => {
            if (typeof part === 'string') return part;
            if (part?.type === 'text' || part?.type === 'input_text') return part.text || part.content || '';
            if (part?.type === 'image_url' || part?.type === 'image' || part?.type === 'input_image') return '[Image attachment]';
            if (part?.type === 'video_url' || part?.type === 'video' || part?.type === 'input_video') return '[Video attachment]';
            return '';
        }).filter(Boolean).join('\n');
    }
    return '';
}

function buildMediaHtmlFromContent(content) {
    if (!Array.isArray(content)) return '';

    return content.map(part => {
        if (typeof part === 'string' || !part) return '';

        const source = part.image_url?.url || part.video_url?.url || part.url || part.src || '';
        if (!source) return '';

        if (part.type === 'image_url' || part.type === 'image' || part.type === 'input_image') {
            return `<div class="media-block my-3"><img src="${escapeHtml(source)}" alt="Generated image" class="rounded-lg border border-gray-700 max-w-full h-auto shadow-lg"></div>`;
        }

        if (part.type === 'video_url' || part.type === 'video' || part.type === 'input_video') {
            return `<div class="media-block my-3"><video controls preload="metadata" class="rounded-lg border border-gray-700 max-w-full bg-black shadow-lg"><source src="${escapeHtml(source)}"></video></div>`;
        }

        return '';
    }).filter(Boolean).join('');
}

function renderPaidStoreBots() {
    paidBotsContainer.innerHTML = '';
    PAID_ASSISTANTS_CONFIG.forEach(bot => {
        const botCard = document.createElement('div');
        botCard.className = 'bg-gray-950 border border-gray-800 rounded-xl p-4 flex flex-col justify-between h-36 relative overflow-hidden group';
        botCard.innerHTML = `
            <div>
                <h4 class="font-bold text-amber-400 text-sm">${bot.name}</h4>
                <p class="text-xs text-gray-400 mt-1.5 line-clamp-2">${bot.description}</p>
            </div>
            <div class="flex justify-end mt-2">
                <a href="${bot.link}" target="_blank" class="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition text-center min-w-[70px]">Buy</a>
            </div>
        `;
        paidBotsContainer.appendChild(botCard);
    });
}

window.installFreeAssistant = function(name, promptText) {
    botNameInput.value = name;
    botPromptInput.value = promptText;
    saveApiSettings();
    storeModal.classList.add('hidden');
    createNewSession();
    alert(`Assistant Profile "${name}" is now online!`);
};

openStoreBtn.addEventListener('click', () => {
    renderPaidStoreBots();
    storeModal.classList.remove('hidden');
});
closeStoreModal.addEventListener('click', () => { storeModal.classList.add('hidden'); });

function loadApiSettings() {
    const provider = localStorage.getItem('gem_provider') || 'groq';
    apiProvider.value = provider;
    handleProviderChange(provider);

    apiKeyValue.value = localStorage.getItem(`gem_key_${provider}`) || '';
    apiEndpoint.value = localStorage.getItem(`gem_endpoint_${provider}`) || PROVIDERS[provider].url;
    botNameInput.value = localStorage.getItem('gem_bot_name') || 'System AI';
    botPromptInput.value = localStorage.getItem('gem_system_prompt') || '';

    const savedTemp = localStorage.getItem('gem_temp') || '0.7';
    tempInput.value = savedTemp; tempValue.textContent = savedTemp;

    const savedTopP = localStorage.getItem('gem_topp') || '1.0';
    topPInput.value = savedTopP; topPValue.textContent = savedTopP;

    const savedTokens = localStorage.getItem('gem_tokens') || '2048';
    tokensInput.value = savedTokens; tokensValue.textContent = savedTokens;

    const savedTheme = localStorage.getItem('gem_theme') || 'default';
    themeSelector.value = savedTheme;
    applyTheme(savedTheme);

    fetchActiveModels();
}

function saveApiSettings() {
    const provider = apiProvider.value;
    localStorage.setItem('gem_provider', provider);
    localStorage.setItem(`gem_key_${provider}`, apiKeyValue.value.trim());
    localStorage.setItem(`gem_endpoint_${provider}`, apiEndpoint.value.trim());
    localStorage.setItem('gem_bot_name', botNameInput.value.trim());
    localStorage.setItem('gem_system_prompt', botPromptInput.value.trim());
    localStorage.setItem('gem_temp', tempInput.value);
    localStorage.setItem('gem_topp', topPInput.value);
    localStorage.setItem('gem_tokens', tokensInput.value);
    updateStatusCard();
}

function applyTheme(theme) {
    document.body.className = `bg-gray-950 text-gray-100 font-sans h-screen flex flex-col overflow-hidden theme-${theme}`;
    if (theme === 'default') {
        document.body.classList.remove('theme-cyberpunk', 'theme-matrix', 'theme-light');
    }
    localStorage.setItem('gem_theme', theme);
}

themeSelector.addEventListener('change', (e) => {
    applyTheme(e.target.value);
});

function handleProviderChange(provider) {
    const details = PROVIDERS[provider];
    if (details.hasKey) {
        apiKeyContainer.classList.remove('hidden');
        endpointContainer.classList.add('hidden');
    } else {
        apiKeyContainer.classList.add('hidden');
        endpointContainer.classList.remove('hidden');
    }
    apiEndpoint.value = localStorage.getItem(`gem_endpoint_${provider}`) || details.url;
    apiKeyValue.value = localStorage.getItem(`gem_key_${provider}`) || '';
    selectedMultiModels = [];
    updateMultiModelUI();
}

openMultiModelBtn.addEventListener('click', () => {
    multiModelList.innerHTML = '';
    const options = Array.from(botModelSelect.options);
    if (options.length === 0 || options[0].value === '') {
        multiModelList.innerHTML = '<p class="text-xs text-gray-500">Please fetch models using a valid API key first.</p>';
    } else {
        options.forEach(opt => {
            const modelId = opt.value;
            const item = document.createElement('label');
            item.className = 'flex items-center gap-2 p-1.5 hover:bg-gray-900 rounded text-xs text-gray-300 cursor-pointer';
            const isChecked = selectedMultiModels.includes(modelId);
            item.innerHTML = `<input type="checkbox" value="${modelId}" ${isChecked ? 'checked' : ''} class="accent-indigo-500"> <span>${modelId}</span>`;
            multiModelList.appendChild(item);
        });
    }
    multiModelModal.classList.remove('hidden');
});

closeMultiModelModal.addEventListener('click', () => multiModelModal.classList.add('hidden'));
clearMultiModelsBtn.addEventListener('click', () => {
    selectedMultiModels = [];
    updateMultiModelUI();
    multiModelModal.classList.add('hidden');
});

saveMultiModelsBtn.addEventListener('click', () => {
    const checkboxes = multiModelList.querySelectorAll('input[type="checkbox"]:checked');
    selectedMultiModels = Array.from(checkboxes).map(cb => cb.value);
    updateMultiModelUI();
    multiModelModal.classList.add('hidden');
});

function updateMultiModelUI() {
    if (selectedMultiModels.length > 0) {
        multiModelBadge.textContent = `⚡ Parallel Mode Active: ${selectedMultiModels.length} models`;
        multiModelBadge.classList.remove('hidden');
        botModelSelect.disabled = true;
    } else {
        multiModelBadge.classList.add('hidden');
        botModelSelect.disabled = false;
    }
    updateStatusCard();
}

function loadSessions() {
    const saved = localStorage.getItem('gem_sessions');
    if (saved) {
        try { sessions = JSON.parse(saved); } catch (e) { sessions = []; }
    }
    if (sessions.length === 0) {
        createNewSession();
    } else {
        currentSessionId = sessions[0].id;
        renderSessionsList();
        loadActiveSessionChat();
    }
}

function saveSessionsToStorage() {
    localStorage.setItem('gem_sessions', JSON.stringify(sessions));
}

function createNewSession() {
    const id = 'session_' + Date.now();
    const newSession = {
        id,
        name: `Chat #${sessions.length + 1}`,
        messages: [],
        systemPrompt: botPromptInput.value.trim(),
        botName: botNameInput.value.trim() || 'Default AI'
    };
    sessions.unshift(newSession);
    currentSessionId = id;
    saveSessionsToStorage();
    renderSessionsList();
    loadActiveSessionChat();
    closeSidebarUniversal();
}

function selectSession(id) {
    currentSessionId = id;
    loadActiveSessionChat();
    renderSessionsList();
    chatsPanel.classList.add('-translate-x-full');
    chatsOverlay.classList.add('hidden');
}

function deleteSession(id, event) {
    event.stopPropagation();
    sessions = sessions.filter(s => s.id !== id);
    if (sessions.length === 0) {
        createNewSession();
    } else {
        if (currentSessionId === id) currentSessionId = sessions[0].id;
        saveSessionsToStorage();
        renderSessionsList();
        loadActiveSessionChat();
    }
}

function renameSession(id, newName) {
    const session = sessions.find(s => s.id === id);
    if (session) {
        session.name = newName;
        saveSessionsToStorage();
        renderSessionsList();
    }
}

function renderSessionsList() {
    chatsList.innerHTML = '';
    sessions.forEach(session => {
        const isActive = session.id === currentSessionId;
        const itemDiv = document.createElement('div');
        itemDiv.className = `group flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${isActive ? 'bg-emerald-600/20 border border-emerald-500/40 text-white' : 'hover:bg-gray-800 text-gray-300'}`;
        itemDiv.onclick = () => selectSession(session.id);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'text-xs font-medium truncate flex-1 pr-2';
        nameSpan.textContent = session.name;

        const renameBtn = document.createElement('button');
        renameBtn.className = 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white px-1 text-[11px] transition';
        renameBtn.textContent = '✏️';
        renameBtn.onclick = (e) => {
            e.stopPropagation();
            const promptName = prompt('Enter new chat name:', session.name);
            if (promptName && promptName.trim() !== '') renameSession(session.id, promptName.trim());
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 px-1 text-[11px] transition';
        deleteBtn.textContent = '🗑️';
        deleteBtn.onclick = (e) => deleteSession(session.id, e);

        itemDiv.appendChild(nameSpan);
        itemDiv.appendChild(renameBtn);
        itemDiv.appendChild(deleteBtn);
        chatsList.appendChild(itemDiv);
    });
}

function loadActiveSessionChat() {
    const session = sessions.find(s => s.id === currentSessionId);
    chatWindow.innerHTML = '';
    if (!session || session.messages.length === 0) {
        welcomeMessage.classList.remove('hidden');
        return;
    }
    welcomeMessage.classList.add('hidden');
    session.messages.forEach((msg, idx) => {
        renderMessageToDOM(msg.role, msg.content, session.botName, idx);
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function fetchActiveModels() {
    const provider = apiProvider.value;
    const hasKey = PROVIDERS[provider].hasKey;
    const key = apiKeyValue.value.trim();
    const endpoint = apiEndpoint.value.trim();

    if (hasKey && !key) {
        botModelSelect.innerHTML = '<option value="">(Provide API key for models)</option>';
        return;
    }
    botModelSelect.innerHTML = '<option value="">Loading models...</option>';

    try {
        if (provider === 'claude') {
            const fallbackModels = ['claude-3-5-sonnet-latest', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'];
            botModelSelect.innerHTML = '';
            fallbackModels.forEach(model => botModelSelect.add(new Option(model, model)));
            botModelSelect.selectedIndex = 0;
            localStorage.setItem(`gem_selected_model_${provider}`, botModelSelect.value);
            updateStatusCard();
            return;
        }

        const headers = { 'Content-Type': 'application/json' };
        if (hasKey) headers.Authorization = `Bearer ${key}`;

        const response = await fetch(`${endpoint}/models`, { method: 'GET', headers });
        if (!response.ok) throw new Error(`Status Error: ${response.status}`);

        const json = await response.json();
        let models = json.data && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);

        models = models.filter(m => {
            const id = (m.id || m.name || '').toLowerCase();
            return !id.includes('whisper') && !id.includes('tts') && !id.includes('embed') && !id.includes('guard');
        });

        if (models.length === 0) {
            botModelSelect.innerHTML = '<option value="">No models found</option>';
            return;
        }

        const savedSelected = localStorage.getItem(`gem_selected_model_${provider}`);
        botModelSelect.innerHTML = '';
        models.forEach(m => {
            const modelId = m.id || m.name;
            botModelSelect.add(new Option(modelId, modelId));
        });

        if (savedSelected && [...botModelSelect.options].some(o => o.value === savedSelected)) {
            botModelSelect.value = savedSelected;
        } else {
            botModelSelect.selectedIndex = 0;
        }
        localStorage.setItem(`gem_selected_model_${provider}`, botModelSelect.value);
        updateStatusCard();
    } catch (err) {
        console.error(err);
        botModelSelect.innerHTML = '<option value="">Error fetching model list</option>';
    }
}

function copyTextToClipboard(text, successMessage = 'Copied to clipboard!') {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        alert(successMessage);
    } catch (err) {
        console.error(err);
    }
    document.body.removeChild(textArea);
}

function runSandboxCode() {
    const code = sandboxCode.value;
    const iframeDoc = sandboxIframe.contentDocument || sandboxIframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(code);
    iframeDoc.close();
}

tabEditor.addEventListener('click', () => {
    tabEditor.classList.add('border-emerald-500', 'text-gray-200');
    tabEditor.classList.remove('border-transparent', 'text-gray-400');
    tabPreview.classList.add('border-transparent', 'text-gray-400');
    tabPreview.classList.remove('border-emerald-500', 'text-gray-200');
    sandboxEditorContainer.classList.remove('hidden');
    sandboxPreviewContainer.classList.add('hidden');
});

tabPreview.addEventListener('click', () => {
    tabPreview.classList.add('border-emerald-500', 'text-gray-200');
    tabPreview.classList.remove('border-transparent', 'text-gray-400');
    tabEditor.classList.add('border-transparent', 'text-gray-400');
    tabEditor.classList.remove('border-emerald-500', 'text-gray-200');
    sandboxPreviewContainer.classList.remove('hidden');
    sandboxEditorContainer.classList.add('hidden');
    runSandboxCode();
});

runCodeBtn.addEventListener('click', () => tabPreview.click());
toggleSandboxBtn.addEventListener('click', () => sandboxColumn.classList.toggle('hidden'));
closeSandboxBtn.addEventListener('click', () => sandboxColumn.classList.add('hidden'));

window.sendToSandbox = function(encodedCode) {
    sandboxCode.value = decodeURIComponent(encodedCode);
    sandboxColumn.classList.remove('hidden');
    tabPreview.click();
};

let currentIntroStep = 0;
const introSteps = [
    { element: 'step-provider', text: '1. Select your AI provider here: cloud-based Groq, Gemini, OpenAI, OpenRouter, or a local instance running on your PC via Ollama.' },
    { element: 'step-key', text: "2. Paste the API token for the selected provider here. Remember, local Ollama setups do not require a key entry!" },
    { element: 'step-model', text: '3. The model list is populated dynamically straight from the API. Click "Refresh Model List" to force a reload.' },
    { element: 'step-prompt', text: '4. Set a system prompt (instruction) to fine-tune the persona and character of your bot companion.' }
];

function startIntro() {
    currentIntroStep = 0;
    openSidebarUniversal();
    showIntroStep();
}

function showIntroStep() {
    if (currentIntroStep >= introSteps.length) {
        alert("Congratulations! You've completed the tour.");
        closeSidebarUniversal();
        return;
    }
    const step = introSteps[currentIntroStep];
    const el = document.getElementById(step.element);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-emerald-400', 'p-1', 'rounded');
        setTimeout(() => {
            confirm(`${step.text}\n\n[Click OK to proceed]`);
            el.classList.remove('ring-2', 'ring-emerald-400', 'p-1', 'rounded');
            currentIntroStep++;
            showIntroStep();
        }, 400);
    } else {
        currentIntroStep++;
        showIntroStep();
    }
}

startIntroBtn.addEventListener('click', startIntro);

function renderMessageToDOM(role, content, botName, index) {
    welcomeMessage.classList.add('hidden');
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex flex-col ${role === 'user' ? 'items-end' : 'items-start'} w-full group/msg`;

    const senderName = role === 'user' ? 'You' : botName;
    const bgClass = role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-100';

    let formattedContent = '';

    if (role === 'user') {
        const textValue = typeof content === 'string' ? content : normalizeContentToText(content);
        const mediaHtml = Array.isArray(content) ? buildMediaHtmlFromContent(content) : '';
        formattedContent = `${escapeHtml(textValue).replace(/\n/g, '<br>')}${mediaHtml ? `<div class="mt-2">${mediaHtml}</div>` : ''}`;
    } else {
        const textValue = typeof content === 'string' ? content : normalizeContentToText(content);
        let thinkingHtml = '';
        let cleanText = textValue;

        const thinkRegex = /<think>([\s\S]*?)<\/think>/i;
        const match = textValue.match(thinkRegex);

        if (match) {
            const thinkingContent = match[1].trim();
            cleanText = textValue.replace(thinkRegex, '').trim();
            if (thinkingContent) {
                thinkingHtml = `
                    <details class="thinking-block w-full mb-3 bg-gray-950/60 border border-gray-800 rounded-lg p-2.5 transition">
                        <summary class="text-xs text-amber-400/80 font-medium select-none cursor-pointer hover:text-amber-300 flex items-center justify-between">
                            <span class="flex items-center gap-1.5">💡 Model Thinking...</span>
                            <span class="text-[10px] text-gray-500 uppercase tracking-wider">Expand</span>
                        </summary>
                        <div class="mt-2 text-xs text-gray-400 border-t border-gray-900 pt-2 whitespace-pre-wrap leading-relaxed italic font-sans">
                            ${escapeHtml(thinkingContent)}
                        </div>
                    </details>
                `;
            }
        }

        const customRenderer = new marked.Renderer();
        customRenderer.code = function(codeArg, language) {
            let codeText = (codeArg && typeof codeArg === 'object') ? codeArg.text : codeArg;
            let codeLang = (codeArg && typeof codeArg === 'object') ? codeArg.lang : language;
            codeText = codeText || '';
            codeLang = codeLang || '';
            const encodedCode = safeEncode(codeText);
            const isRunnable = ['html', 'js', 'css', 'javascript', 'svg'].includes(codeLang.toLowerCase());

            return `
                <div class="relative group/code my-4">
                    <div class="absolute right-2 top-2 z-10 flex gap-2 opacity-0 group-hover/code:opacity-100 transition-opacity">
                        <button onclick="copyTextToClipboard(decodeURIComponent('${encodedCode}'), 'Code copied!')" class="bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs px-2 py-1 rounded border border-gray-700 cursor-pointer transition">📋 Copy</button>
                        ${isRunnable ? `<button onclick="window.sendToSandbox('${encodedCode}')" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2 py-1 rounded cursor-pointer transition">▶ Sandbox</button>` : ''}
                    </div>
                    <div class="text-[11px] bg-gray-950/80 px-4 py-1 text-gray-400 rounded-t-lg font-mono border-t border-x border-gray-800">${codeLang || 'code'}</div>
                    <pre class="!mt-0 !rounded-t-none"><code class="language-${codeLang}">${escapeHtml(codeText)}</code></pre>
                </div>
            `;
        };

        const mediaHtml = buildMediaHtmlFromContent(content);
        formattedContent = `${thinkingHtml}<div class="md-content">${marked.parse(cleanText, { renderer: customRenderer })}</div>${mediaHtml ? `<div class="mt-3">${mediaHtml}</div>` : ''}`;
    }

    const encodedText = safeEncode(typeof content === 'string' ? content : normalizeContentToText(content));
    const regenerateBtnHtml = (role !== 'user' && index !== undefined) ? `
        <button onclick="window.regenerateMessage(${index})" class="text-[11px] text-gray-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition">🔄 Regenerate</button>
    ` : '';

    const copyResponseButton = role !== 'user' ? `
        <div class="flex justify-end mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity gap-3">
            <button onclick="copyTextToClipboard(decodeURIComponent('${encodedText}'), 'Response copied!')" class="text-[11px] text-gray-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition">📋 Copy Response</button>
            ${regenerateBtnHtml}
        </div>
    ` : '';

    messageDiv.innerHTML = `
        <span class="text-xs text-gray-500 mb-1 px-1">${senderName}</span>
        <div class="max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md ${bgClass} overflow-hidden break-words">
            ${formattedContent}
            ${copyResponseButton}
        </div>
    `;
    chatWindow.appendChild(messageDiv);
}

function extractAssistantContent(response, providerName) {
    if (providerName === 'claude') {
        const content = Array.isArray(response.content) ? response.content : (response.content || '');
        const text = Array.isArray(response.content)
            ? response.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
            : (response.content || '');
        return { content, reasoning_content: '' };
    }

    const choice = response.choices?.[0]?.message || {};
    return {
        content: choice.content || '',
        reasoning_content: choice.reasoning_content || choice.thinking_content || ''
    };
}

function buildLanguageHint(sourceText = '') {
    const baseHint = 'Answer in the same language as the user\'s prompt and keep the response complete, without cutting off the answer mid-sentence.';
    if (/[А-Яа-яЁё]/.test(sourceText)) {
        return `Ответь на русском языке. ${baseHint}`;
    }
    return baseHint;
}

function convertContentForAnthropic(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return normalizeContentToText(content);

    return content.map(part => {
        if (typeof part === 'string') return { type: 'text', text: part };
        if (part?.type === 'text' || part?.type === 'input_text') return { type: 'text', text: part.text || part.content || '' };
        if (part?.type === 'image_url' || part?.type === 'image' || part?.type === 'input_image') {
            const dataUrl = part.image_url?.url || part.url || '';
            if (dataUrl.startsWith('data:')) {
                const [meta, payload] = dataUrl.split(',');
                const mime = meta.match(/data:(.+);/)?.[1] || 'image/png';
                return { type: 'image', source: { type: 'base64', media_type: mime, data: payload } };
            }
            return { type: 'text', text: '[Image attachment]' };
        }
        if (part?.type === 'video_url' || part?.type === 'video' || part?.type === 'input_video') {
            return { type: 'text', text: '[Video attachment]' };
        }
        return { type: 'text', text: '' };
    }).filter(item => item && (item.text || item.type === 'image'));
}

async function fetchSingleCompletion(endpoint, apiKey, hasKey, bodyPayload, providerName, signal) {
    const provider = PROVIDERS[providerName] || PROVIDERS.openai;
    if (provider.type === 'anthropic') {
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        };

        const systemMessage = bodyPayload.messages.find(msg => msg.role === 'system');
        const anthropicPayload = {
            model: bodyPayload.model,
            max_tokens: bodyPayload.max_tokens || 1024,
            messages: bodyPayload.messages.filter(msg => msg.role !== 'system').map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: convertContentForAnthropic(msg.content)
            })),
            temperature: bodyPayload.temperature,
            top_p: bodyPayload.top_p
        };

        if (systemMessage) {
            anthropicPayload.system = typeof systemMessage.content === 'string' ? systemMessage.content : normalizeContentToText(systemMessage.content);
        }

        const response = await fetch(`${endpoint}/messages`, {
            method: 'POST',
            headers,
            body: JSON.stringify(anthropicPayload),
            signal
        });

        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error?.message || `HTTP ${response.status}`);
        }
        return response.json();
    }

    const headers = { 'Content-Type': 'application/json' };
    if (hasKey && apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal
    });

    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${response.status}`);
    }
    return response.json();
}

async function triggerAiResponse(session) {
    const providerName = apiProvider.value;
    const hasKey = PROVIDERS[providerName].hasKey;
    const apiKey = apiKeyValue.value.trim();
    const endpoint = apiEndpoint.value.trim();
    const temperature = parseFloat(tempInput.value);
    const topP = parseFloat(topPInput.value);
    const maxTokens = parseInt(tokensInput.value);

    if (hasKey && !apiKey) {
        alert('Please enter your API key!');
        openSidebarUniversal();
        return;
    }

    const activeModels = selectedMultiModels.length > 0 ? selectedMultiModels : [botModelSelect.value];
    if (activeModels.length === 1 && !activeModels[0]) {
        alert('Please select an AI model!');
        openSidebarUniversal();
        return;
    }

    userInput.disabled = true;
    sendBtn.disabled = true;
    sendBtn.classList.add('hidden');
    stopBtn.classList.remove('hidden');

    currentAbortController = new AbortController();

    let messagesToSend = [];
    if (session.systemPrompt) messagesToSend.push({ role: 'system', content: session.systemPrompt });
    session.messages.forEach(msg => messagesToSend.push({ role: msg.role, content: typeof msg.content === 'string' ? msg.content : msg.content }));

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'text-xs text-gray-500 italic px-1 animate-pulse';
    loadingDiv.id = 'apiLoading';
    loadingDiv.innerText = `Connecting to endpoints [${activeModels.join(', ')}]...`;
    chatWindow.appendChild(loadingDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        const requests = activeModels.map(modelId => {
            const payload = {
                model: modelId,
                messages: messagesToSend,
                temperature,
                top_p: topP,
                max_tokens: maxTokens
            };
            return fetchSingleCompletion(endpoint, apiKey, hasKey, payload, providerName, currentAbortController.signal)
                .then(res => ({ success: true, model: modelId, data: res }))
                .catch(err => {
                    if (err.name === 'AbortError') throw err;
                    return { success: false, model: modelId, error: err.message };
                });
        });

        const results = await Promise.all(requests);
        if (loadingDiv) loadingDiv.remove();

        if (results.length === 1) {
            const res = results[0];
            if (!res.success) throw new Error(res.error);

            const parsed = extractAssistantContent(res.data, providerName);
            let content = parsed.content || '';
            const thinking = parsed.reasoning_content || '';
            if (thinking) content = `<think>${thinking}</think>\n${content}`;

            session.messages.push({ role: 'assistant', content });
            saveSessionsToStorage();
            renderMessageToDOM('assistant', content, session.botName, session.messages.length - 1);
        } else {
            let multiMarkdown = '### 📊 Multi-Model Performance Comparison\n\n';
            results.forEach(res => {
                multiMarkdown += `#### 🤖 Model: \`${res.model}\`\n`;
                if (res.success) {
                    const parsed = extractAssistantContent(res.data, providerName);
                    let text = parsed.content || '';
                    const thinking = parsed.reasoning_content || '';
                    if (thinking) {
                        multiMarkdown += `<details class="mb-2"><summary class="text-amber-400 text-xs cursor-pointer">View Reasoning Log</summary><div class="p-2 bg-gray-950 text-xs italic text-gray-400 border border-gray-800 rounded mt-1">${thinking}</div></details>\n`;
                    }
                    multiMarkdown += `${text}\n\n---\n`;
                } else {
                    multiMarkdown += `❌ *API Error Encountered:* \`${res.error}\`\n\n---\n`;
                }
            });

            session.messages.push({ role: 'assistant', content: multiMarkdown });
            saveSessionsToStorage();
            renderMessageToDOM('assistant', multiMarkdown, 'Hub Comparator', session.messages.length - 1);
        }
        chatWindow.scrollTop = chatWindow.scrollHeight;
    } catch (error) {
        console.error(error);
        if (document.getElementById('apiLoading')) document.getElementById('apiLoading').remove();

        if (error.name === 'AbortError') {
            const stopDiv = document.createElement('div');
            stopDiv.className = 'text-xs text-gray-500 italic px-1';
            stopDiv.innerText = 'Generation stopped by user.';
            chatWindow.appendChild(stopDiv);
        } else {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'bg-rose-950/40 border border-rose-900 text-rose-300 p-3 rounded-lg text-xs max-w-xl';
            errorDiv.innerText = `Execution Interrupted: ${error.message}`;
            chatWindow.appendChild(errorDiv);
        }
    } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
        sendBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        currentAbortController = null;
        userInput.focus();
    }
}

async function sendMessage() {
    let text = userInput.value.trim();
    if (!text && !attachedFileContent) return;

    let session = sessions.find(s => s.id === currentSessionId);
    if (!session) {
        createNewSession();
        session = sessions[0];
    }

    let fullUserContent = text;
    if (attachedFileContent) {
        if (attachedFileType.startsWith('image/') || attachedFileType.startsWith('video/')) {
            fullUserContent = {
                role: 'user',
                content: [
                    { type: 'text', text: text || `Attached ${attachedFileType.startsWith('image/') ? 'image' : 'video'}: ${attachedFileName}` },
                    { type: attachedFileType.startsWith('image/') ? 'image_url' : 'video_url', url: attachedFileContent }
                ]
        };
    } else {
            fullUserContent += `\n\n[Attached File: ${attachedFileName}]\n\`\`\`\n${attachedFileContent}\n\`\`\``;
    }
}

    userInput.value = '';
    userInput.style.height = 'auto';
    renderMessageToDOM('user', fullUserContent, 'You', session.messages.length);
    session.messages.push({ role: 'user', content: fullUserContent });

    if (session.name.startsWith('Chat #')) {
        session.name = text.slice(0, 24) + (text.length > 24 ? '...' : '...');
    }

    const baseSystemPrompt = botPromptInput.value.trim();
    const userLanguageHint = buildLanguageHint(typeof fullUserContent === 'string' ? fullUserContent : text);
    session.systemPrompt = baseSystemPrompt
        ? `${baseSystemPrompt}\n\n${userLanguageHint}`
        : userLanguageHint;
    session.botName = botNameInput.value.trim() || 'Default AI';

    saveSessionsToStorage();
    renderSessionsList();
    removeAttachedFile();
    await triggerAiResponse(session);
}

async function regenerateMessage(index) {
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session || index < 0 || index >= session.messages.length) return;
    session.messages = session.messages.slice(0, index);
    saveSessionsToStorage();
    loadActiveSessionChat();
    await triggerAiResponse(session);
}
window.regenerateMessage = regenerateMessage;

openGroupChatBtn.addEventListener('click', () => groupChatModal.classList.remove('hidden'));
closeGroupChatModal.addEventListener('click', () => groupChatModal.classList.add('hidden'));

startGroupDebateBtn.addEventListener('click', async () => {
    const idea = groupIdeaInput.value.trim();
    if (!idea) {
        alert('Please formulate your thesis/idea first!');
        return;
    }

    const providerName = apiProvider.value;
    const apiKey = apiKeyValue.value.trim();
    const endpoint = apiEndpoint.value.trim();
    const model = botModelSelect.value;
    if (!model) {
        alert('Please select an active model in the configuration panel first!');
        groupChatModal.classList.add('hidden');
        openSidebarUniversal();
        return;
    }

    groupChatModal.classList.add('hidden');
    createNewSession();
    let session = sessions[0];
    session.name = '👥 Debate: ' + idea.slice(0, 20) + '...';
    renderSessionsList();

    renderMessageToDOM('user', `**[Initiating AI Panel Evaluation]** For the following proposition:\n> ${idea}`, 'System Operator');
    session.messages.push({ role: 'user', content: `Proposition for debate:\n${idea}` });

    const languageHint = 'Answer in the same language as the user\'s proposition. If the proposition is in Russian, respond in Russian; if it is in English, respond in English. Do not switch languages and keep your output complete, avoiding cut-off fragments.';
    const agents = [
        { name: '🌟 Agent Optimist', prompt: `You are an optimistic market strategist. Analyze the given idea, highlight its strongest disruptive potentials, hidden opportunities, and scalable micro-advantages. Keep your response brief, targeted, and focused entirely on potential success vectors. ${languageHint}` },
        { name: '🛡️ Agent Critic', prompt: `You are a ruthless risk analyst and security architect. Deconstruct the user\'s idea to find conceptual faults, operational vulnerabilities, security pitfalls, and hidden execution expenses. Be brutally honest. ${languageHint}` },
        { name: '🔧 Agent Technologist', prompt: `You are a pragmatic solutions engineer. Evaluate the architectural feasibility of the idea, map out a realistic software/hardware stack layout, data handling structures, and step-by-step developer pipeline roadmap. ${languageHint}` }
    ];

    userInput.disabled = true;
    sendBtn.disabled = true;

    for (let round = 1; round <= 2; round++) {
        for (const agent of agents) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'text-xs text-indigo-400 italic px-1 animate-pulse';
            loadingDiv.id = 'agentLoading';
            loadingDiv.innerText = `${agent.name} is evaluating the current state (Round ${round}/2)...`;
            chatWindow.appendChild(loadingDiv);
            chatWindow.scrollTop = chatWindow.scrollHeight;

            let currentContext = [{ role: 'system', content: agent.prompt }];
            session.messages.forEach(m => currentContext.push({ role: m.role, content: m.content }));

            try {
                const maxTokens = Math.max(1500, parseInt(tokensInput.value, 10) || 2048);
                const payload = {
                    model,
                    messages: currentContext,
                    temperature: 0.8,
                    top_p: 0.95,
                    max_tokens: maxTokens
                };
                const res = await fetchSingleCompletion(endpoint, apiKey, PROVIDERS[providerName].hasKey, payload, providerName);
                if (loadingDiv) loadingDiv.remove();

                const rawContent = res.choices[0].message.content || '';
                const thinking = res.choices[0].message.reasoning_content || res.choices[0].message.thinking_content || '';
                const finalContent = thinking ? `<think>${thinking}</think>\n${rawContent}` : rawContent;

                session.messages.push({ role: 'assistant', content: `**[${agent.name}]**\n\n${finalContent}` });
                saveSessionsToStorage();
                renderMessageToDOM('assistant', finalContent, agent.name, session.messages.length - 1);
                chatWindow.scrollTop = chatWindow.scrollHeight;
            } catch (e) {
                if (loadingDiv) loadingDiv.remove();
                console.error(e);
            }
        }
    }
    userInput.disabled = false;
    sendBtn.disabled = false;
    groupIdeaInput.value = '';
});

apiProvider.addEventListener('change', (e) => {
    handleProviderChange(e.target.value);
    saveApiSettings();
    fetchActiveModels();
});
apiKeyValue.addEventListener('input', () => { saveApiSettings(); });
apiKeyValue.addEventListener('change', () => { fetchActiveModels(); });
apiEndpoint.addEventListener('input', () => { saveApiSettings(); });
apiEndpoint.addEventListener('change', () => { fetchActiveModels(); });
botNameInput.addEventListener('input', saveApiSettings);
botPromptInput.addEventListener('input', saveApiSettings);
botModelSelect.addEventListener('change', () => {
    localStorage.setItem(`gem_selected_model_${apiProvider.value}`, botModelSelect.value);
    updateStatusCard();
});

tempInput.addEventListener('input', (e) => { tempValue.textContent = e.target.value; saveApiSettings(); });
topPInput.addEventListener('input', (e) => { topPValue.textContent = e.target.value; saveApiSettings(); });
tokensInput.addEventListener('input', (e) => { tokensValue.textContent = e.target.value; saveApiSettings(); });

refreshModelsBtn.addEventListener('click', fetchActiveModels);
clearChatBtn.addEventListener('click', () => {
    const session = sessions.find(s => s.id === currentSessionId);
    if (session) {
        session.messages = [];
        saveSessionsToStorage();
        loadActiveSessionChat();
    }
});
newChatBtn.addEventListener('click', createNewSession);

toggleChatsBtn.addEventListener('click', () => {
    if (window.innerWidth >= 768) {
        chatsPanel.classList.toggle('md:hidden');
    } else {
        chatsPanel.classList.toggle('-translate-x-full');
        chatsOverlay.classList.toggle('hidden');
    }
});
chatsOverlay.addEventListener('click', () => {
    chatsPanel.classList.add('-translate-x-full');
    chatsOverlay.classList.add('hidden');
});

toggleSidebarBtn.addEventListener('click', () => {
    if (window.innerWidth >= 1024) {
        sidebar.classList.toggle('lg:hidden');
    } else {
        sidebar.classList.remove('translate-x-full');
        sidebarOverlay.classList.remove('hidden');
    }
});
closeSidebarBtn.addEventListener('click', closeSidebarUniversal);
sidebarOverlay.addEventListener('click', closeSidebarUniversal);

function openSidebarUniversal() {
    if (window.innerWidth >= 1024) {
        sidebar.classList.remove('lg:hidden');
    } else {
        sidebar.classList.remove('translate-x-full');
        sidebarOverlay.classList.remove('hidden');
    }
}

function closeSidebarUniversal() {
    if (window.innerWidth >= 1024) {
        sidebar.classList.add('lg:hidden');
    } else {
        sidebar.classList.add('translate-x-full');
        sidebarOverlay.classList.add('hidden');
    }
}

attachmentInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    attachedFileName = file.name;
    attachedFileType = file.type || '';

    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = function(event) {
            attachedFileContent = event.target.result;
            fileNameDisplay.textContent = attachedFileName;
            fileIndicator.classList.remove('hidden');
            fileIndicator.classList.add('flex');
        };
        reader.readAsDataURL(file);
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        attachedFileContent = event.target.result;
        fileNameDisplay.textContent = attachedFileName;
        fileIndicator.classList.remove('hidden');
        fileIndicator.classList.add('flex');
    };
    reader.readAsText(file);
});

function removeAttachedFile() {
    attachedFileContent = null;
    attachedFileName = '';
    attachedFileType = '';
    attachmentInput.value = '';
    fileIndicator.classList.add('hidden');
    fileIndicator.classList.remove('flex');
}
removeFileBtn.addEventListener('click', removeAttachedFile);

userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});
sendBtn.addEventListener('click', sendMessage);
stopBtn.addEventListener('click', () => {
    if (currentAbortController) {
        currentAbortController.abort();
    }
});
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
        e.preventDefault();
        sendMessage();
    }
});

openHelpBtn.addEventListener('click', () => { helpModal.classList.remove('hidden'); });
closeHelpModal.addEventListener('click', () => { helpModal.classList.add('hidden'); });
closeHelpModalBtn.addEventListener('click', () => { helpModal.classList.add('hidden'); });

exportJsonBtn.addEventListener('click', () => {
    const config = {
        provider: apiProvider.value,
        apiKey: apiKeyValue.value.trim(),
        endpoint: apiEndpoint.value.trim(),
        botName: botNameInput.value.trim(),
        systemPrompt: botPromptInput.value.trim(),
        selectedModel: botModelSelect.value,
        temperature: parseFloat(tempInput.value),
        topP: parseFloat(topPInput.value),
        maxTokens: parseInt(tokensInput.value)
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', config.botName ? `config-${config.botName.toLowerCase().replace(/\s+/g, '-')}.json` : 'hub-config.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
});

importJsonInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const config = JSON.parse(event.target.result);
            if (config.provider) apiProvider.value = config.provider;
            handleProviderChange(apiProvider.value);
            if (config.apiKey) apiKeyValue.value = config.apiKey;
            if (config.endpoint) apiEndpoint.value = config.endpoint;
            if (config.botName) botNameInput.value = config.botName;
            if (config.systemPrompt) botPromptInput.value = config.systemPrompt;
            if (config.temperature !== undefined) { tempInput.value = config.temperature; tempValue.textContent = config.temperature; }
            if (config.topP !== undefined) { topPInput.value = config.topP; topPValue.textContent = config.topP; }
            if (config.maxTokens !== undefined) { tokensInput.value = config.maxTokens; tokensValue.textContent = config.maxTokens; }
            saveApiSettings();
            if (config.selectedModel) localStorage.setItem(`gem_selected_model_${config.provider}`, config.selectedModel);
            fetchActiveModels();
            alert('Configuration Loaded!');
            closeSidebarUniversal();
        } catch (error) {
            alert('Invalid structure.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

function updateStatusCard() {
    const provider = apiProvider.value.toUpperCase();
    const model = selectedMultiModels.length > 0 ? `[Multi Mode: ${selectedMultiModels.length} models]` : (botModelSelect.value || 'no active model');
    const name = botNameInput.value.trim() || 'Default AI';
    const prompt = botPromptInput.value.trim();
    if (!prompt) {
        activeStatusText.innerHTML = `${name} (No Prompt)<br><span class="text-[10px] text-gray-500 font-mono">Provider: ${provider} | ${model}</span>`;
    } else {
        activeStatusText.innerHTML = `<strong class="text-emerald-400">${name}</strong><br><span class="text-gray-400 block truncate text-[11px]">${prompt}</span><span class="text-[10px] text-gray-500 font-mono block">Provider: ${provider} | ${model}</span>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadApiSettings();
    loadSessions();
});

