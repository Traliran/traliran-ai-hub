// Traliran AI IDE - Core JS logic
let projectFiles = {};
let activeFileName = "index.html";
let proposedChanges = null;
let aiApiCallCount = 0;

// DOM Elements
const apiProvider = document.getElementById('apiProvider');
const callCountIndicator = document.getElementById('callCountIndicator');
const botModelSelect = document.getElementById('botModel');
const refreshModelsBtn = document.getElementById('refreshModelsBtn');
const runCodeBtn = document.getElementById('runCodeBtn');
const addNewFileBtn = document.getElementById('addNewFileBtn');
const fileList = document.getElementById('fileList');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const resetProjectBtn = document.getElementById('resetProjectBtn');
const activeFileNameSpan = document.getElementById('activeFileName');
const tabEditor = document.getElementById('tabEditor');
const tabPreview = document.getElementById('tabPreview');
const editorContainer = document.getElementById('editorContainer');
const previewContainer = document.getElementById('previewContainer');
const codeEditor = document.getElementById('codeEditor');
const lineCounter = document.getElementById('lineCounter');
const projectIframe = document.getElementById('projectIframe');

const btnAiGenerate = document.getElementById('btnAiGenerate');
const btnAiRefactor = document.getElementById('btnAiRefactor');
const btnAiExplain = document.getElementById('btnAiExplain');
const btnAiFix = document.getElementById('btnAiFix');
const aiChatWindow = document.getElementById('aiChatWindow');
const aiInput = document.getElementById('aiInput');
const aiSendBtn = document.getElementById('aiSendBtn');
const aiStopBtn = document.getElementById('aiStopBtn');
const changesIndicator = document.getElementById('changesIndicator');
const applyChangesBtn = document.getElementById('applyChangesBtn');
const keyWarningModal = document.getElementById('keyWarningModal');

// Modal Elements for API Configuration
const ideApiSettingsBtn = document.getElementById('ideApiSettingsBtn');
const modalApiProvider = document.getElementById('modalApiProvider');
const modalApiKeyContainer = document.getElementById('modalApiKeyContainer');
const modalApiKeyValue = document.getElementById('modalApiKeyValue');
const modalEndpointContainer = document.getElementById('modalEndpointContainer');
const modalApiEndpoint = document.getElementById('modalApiEndpoint');
const modalSaveBtn = document.getElementById('modalSaveBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');

let currentAiAbortController = null;

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

const DEFAULT_FILES = {
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Traliran Sandbox App</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen flex flex-col items-center justify-center p-4">
    <div class="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl text-center space-y-6">
        <div class="space-y-2">
            <span class="text-5xl inline-block animate-bounce">⚡</span>
            <h1 id="title" class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                Interactive IDE
            </h1>
            <p class="text-gray-400 text-xs">A live interactive sandbox page. Modify and build with AI Copilot!</p>
        </div>

        <div class="bg-gray-950 p-4 rounded-xl border border-gray-800/80 font-mono text-left text-xs space-y-2">
            <div class="flex justify-between text-gray-500">
                <span>File Path:</span>
                <span class="text-violet-400">index.html</span>
            </div>
            <div class="flex justify-between text-gray-500">
                <span>Styles:</span>
                <span class="text-emerald-400">styles.css</span>
            </div>
            <div class="flex justify-between text-gray-500">
                <span>Interactive:</span>
                <span class="text-amber-400">script.js</span>
            </div>
        </div>

        <div class="flex flex-col gap-2 pt-2">
            <button id="actionBtn" class="bg-violet-600 hover:bg-violet-500 active:scale-95 text-white font-bold py-2.5 px-6 rounded-xl transition cursor-pointer">
                Push Trigger
            </button>
            <p id="counter" class="text-xs text-gray-500 font-medium">Click Counter: 0</p>
        </div>
    </div>
    <script src="script.js"></script>
</body>
</html>`,
    "styles.css": `/* Custom project styling */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap');

body {
    font-family: 'Space Grotesk', sans-serif;
}

button {
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4);
    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}`,
    "script.js": `// Interactive behaviors
let counterValue = 0;
const actionBtn = document.getElementById('actionBtn');
const counterDisplay = document.getElementById('counter');
const titleDisplay = document.getElementById('title');

if (actionBtn) {
    actionBtn.addEventListener('click', () => {
        counterValue++;
        counterDisplay.textContent = \`Click Counter: \${counterValue}\`;
        
        // Dynamic title change
        const colors = [
            'from-violet-400 to-fuchsia-400',
            'from-emerald-400 to-teal-400',
            'from-amber-400 to-orange-400',
            'from-sky-400 to-indigo-400'
        ];
        
        const randomColor = colors[counterValue % colors.length];
        titleDisplay.className = \`text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r \${randomColor}\`;
    });
}`
};

// Markdown support for copilot text
marked.use({ breaks: true, gfm: true });

function initWorkspace() {
    const saved = localStorage.getItem('ide_project_files');
    if (saved) {
        try {
            projectFiles = JSON.parse(saved);
        } catch (e) {
            projectFiles = { ...DEFAULT_FILES };
        }
    } else {
        projectFiles = { ...DEFAULT_FILES };
    }
    
    // Fallback if index.html is missing
    if (!projectFiles["index.html"]) {
        projectFiles["index.html"] = DEFAULT_FILES["index.html"];
    }

    // Set active file
    const lastActive = localStorage.getItem('ide_active_file');
    if (lastActive && projectFiles[lastActive]) {
        activeFileName = lastActive;
    } else {
        activeFileName = Object.keys(projectFiles)[0] || "index.html";
    }

    renderFileList();
    selectFile(activeFileName);
    checkApiConfiguration();
}

function saveWorkspace() {
    // Save active file content first
    if (activeFileName && projectFiles[activeFileName] !== undefined) {
        projectFiles[activeFileName] = codeEditor.value;
    }
    localStorage.setItem('ide_project_files', JSON.stringify(projectFiles));
    localStorage.setItem('ide_active_file', activeFileName);
}

// Render File List with conditional delete option
function renderFileList() {
    fileList.innerHTML = '';
    Object.keys(projectFiles).sort().forEach(filename => {
        const isActive = filename === activeFileName;
        const div = document.createElement('div');
        div.className = `group flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
            isActive ? 'bg-violet-600/20 border border-violet-500/40 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
        }`;
        div.onclick = () => selectFile(filename);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'text-xs font-mono truncate flex-1';
        nameSpan.textContent = filename;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 px-1 text-[11px] transition cursor-pointer';
        deleteBtn.textContent = '🗑️';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteFile(filename);
        };

        div.appendChild(nameSpan);
        // Prevent deletion of index.html to maintain project sanity
        if (filename !== "index.html") {
            div.appendChild(deleteBtn);
        }
        fileList.appendChild(div);
    });
}

function selectFile(filename) {
    if (activeFileName && projectFiles[activeFileName] !== undefined) {
        projectFiles[activeFileName] = codeEditor.value;
    }

    activeFileName = filename;
    activeFileNameSpan.textContent = filename;
    codeEditor.value = projectFiles[filename] || "";
    
    // Save and re-render file list to update selection styling
    localStorage.setItem('ide_active_file', filename);
    renderFileList();
    
    // Update lines Counter
    updateLineNumbers();
}

function deleteFile(filename) {
    if (filename === "index.html") return;
    if (confirm(`Are you sure you want to delete ${filename}?`)) {
        delete projectFiles[filename];
        if (activeFileName === filename) {
            activeFileName = "index.html";
        }
        saveWorkspace();
        renderFileList();
        selectFile(activeFileName);
        runPreview();
    }
}

addNewFileBtn.addEventListener('click', () => {
    const filename = prompt("Enter new file name (e.g., config.json, contact.html):");
    if (!filename) return;
    const cleanName = filename.trim().replace(/\s+/g, '_');
    if (!cleanName) return;

    if (projectFiles[cleanName]) {
        alert("File already exists!");
        return;
    }

    projectFiles[cleanName] = `// New ${cleanName} content\n`;
    saveWorkspace();
    renderFileList();
    selectFile(cleanName);
});

// Line numbers logic
function updateLineNumbers() {
    const lines = codeEditor.value.split('\n');
    const totalLines = lines.length;
    let numbersHtml = '';
    for (let i = 1; i <= totalLines; i++) {
        numbersHtml += `<div>${i}</div>`;
    }
    lineCounter.innerHTML = numbersHtml;
}

codeEditor.addEventListener('input', () => {
    updateLineNumbers();
    // Auto save on type
    projectFiles[activeFileName] = codeEditor.value;
    localStorage.setItem('ide_project_files', JSON.stringify(projectFiles));
});

codeEditor.addEventListener('scroll', () => {
    lineCounter.scrollTop = codeEditor.scrollTop;
});

// Assembly & Preview Logic
function getPreviewHtml() {
    let html = projectFiles["index.html"] || "<h1>No index.html found</h1>";

    // Inline custom css files
    Object.entries(projectFiles).forEach(([filename, content]) => {
        if (filename.endsWith('.css')) {
            // Replace exact link tag or inject right before head
            const regex = new RegExp(`<link[^>]*href=["']${filename}["'][^>]*>`, 'gi');
            if (regex.test(html)) {
                html = html.replace(regex, `<style>\n${content}\n</style>`);
            } else {
                html = html.replace('</head>', `<style>\n${content}\n</style>\n</head>`);
            }
        }
    });

    // Inline custom javascript files
    Object.entries(projectFiles).forEach(([filename, content]) => {
        if (filename.endsWith('.js')) {
            const regex = new RegExp(`<script[^>]*src=["']${filename}["'][^>]*><\/script>`, 'gi');
            if (regex.test(html)) {
                html = html.replace(regex, `<script>\n${content}\n</script>`);
            } else {
                html = html.replace('</body>', `<script>\n${content}\n</script>\n</body>`);
            }
        }
    });

    return html;
}

function runPreview() {
    const content = getPreviewHtml();
    projectIframe.srcdoc = content;
}

// Tab Switches
tabEditor.addEventListener('click', () => {
    tabEditor.className = "px-3 py-1 rounded-md bg-violet-600 text-white font-semibold transition";
    tabPreview.className = "px-3 py-1 rounded-md text-gray-400 font-semibold transition hover:text-gray-200";
    editorContainer.classList.remove('hidden');
    previewContainer.classList.add('hidden');
});

tabPreview.addEventListener('click', () => {
    tabPreview.className = "px-3 py-1 rounded-md bg-violet-600 text-white font-semibold transition";
    tabEditor.className = "px-3 py-1 rounded-md text-gray-400 font-semibold transition hover:text-gray-200";
    previewContainer.classList.remove('hidden');
    editorContainer.classList.add('hidden');
    runPreview();
});

runCodeBtn.addEventListener('click', () => {
    tabPreview.click();
});

// ZIP/Files download helper
downloadZipBtn.addEventListener('click', () => {
    // We can export files as a simple combined JSON or separate downloads
    // To make it super easy for the user, let's export all files inside a single combined JSON config or trigger downloading files individually.
    // Let's create a downloader that saves a JSON file with all code, or triggers file downloads one by one!
    // A beautiful solution is a single project backup. Let's do that!
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(projectFiles, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'traliran-ide-project.json');
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
});

resetProjectBtn.addEventListener('click', () => {
    if (confirm("Reset current workspace to default state? This will clear all your custom files!")) {
        projectFiles = { ...DEFAULT_FILES };
        activeFileName = "index.html";
        saveWorkspace();
        renderFileList();
        selectFile(activeFileName);
        runPreview();
    }
});

// API Settings Alignment with Main page
function checkApiConfiguration() {
    const provider = localStorage.getItem('gem_provider') || 'groq';
    apiProvider.value = provider;
    if (modalApiProvider) {
        modalApiProvider.value = provider;
    }

    const details = PROVIDERS[provider];
    const key = localStorage.getItem(`gem_key_${provider}`) || '';

    if (details.hasKey && !key) {
        keyWarningModal.classList.remove('hidden');
        showModalApiDetails(provider);
    } else {
        keyWarningModal.classList.add('hidden');
    }

    fetchActiveModels();
}

function showModalApiDetails(provider) {
    if (!modalApiProvider || !modalApiKeyValue || !modalApiEndpoint) return;

    modalApiProvider.value = provider;
    const details = PROVIDERS[provider];

    if (details.hasKey) {
        modalApiKeyContainer.classList.remove('hidden');
        modalEndpointContainer.classList.add('hidden');
    } else {
        modalApiKeyContainer.classList.add('hidden');
        modalEndpointContainer.classList.remove('hidden');
    }

    modalApiKeyValue.value = localStorage.getItem(`gem_key_${provider}`) || '';
    modalApiEndpoint.value = localStorage.getItem(`gem_endpoint_${provider}`) || details.url;
}

if (ideApiSettingsBtn) {
    ideApiSettingsBtn.addEventListener('click', () => {
        const provider = localStorage.getItem('gem_provider') || 'groq';
        showModalApiDetails(provider);
        keyWarningModal.classList.remove('hidden');
    });
}

if (modalApiProvider) {
    modalApiProvider.addEventListener('change', (e) => {
        showModalApiDetails(e.target.value);
    });
}

if (modalSaveBtn) {
    modalSaveBtn.addEventListener('click', () => {
        const provider = modalApiProvider.value;
        const key = modalApiKeyValue.value.trim();
        const endpoint = modalApiEndpoint.value.trim();
        localStorage.setItem('gem_provider', provider);
        localStorage.setItem(`gem_key_${provider}`, key);
        localStorage.setItem(`gem_endpoint_${provider}`, endpoint);

        // Sync header select
        apiProvider.value = provider;

        keyWarningModal.classList.add('hidden');
        fetchActiveModels();
    });
}

if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
        keyWarningModal.classList.add('hidden');
    });
}

apiProvider.addEventListener('change', (e) => {
    const provider = e.target.value;
    localStorage.setItem('gem_provider', provider);

    // Auto-update modal if it is open
    if (!keyWarningModal.classList.contains('hidden')) {
        showModalApiDetails(provider);
    }

    checkApiConfiguration();
});

botModelSelect.addEventListener('change', () => {
    const provider = apiProvider.value;
    localStorage.setItem(`gem_selected_model_${provider}`, botModelSelect.value);
});

async function fetchActiveModels() {
    const provider = apiProvider.value;
    const hasKey = PROVIDERS[provider].hasKey;
    const key = localStorage.getItem(`gem_key_${provider}`) || '';
    const endpoint = localStorage.getItem(`gem_endpoint_${provider}`) || PROVIDERS[provider].url;

    if (hasKey && !key) {
        botModelSelect.innerHTML = '<option value="">(Key missing)</option>';
        return;
    }
    botModelSelect.innerHTML = '<option value="">Loading...</option>';
    try {
        if (provider === 'claude') {
            const fallbackModels = ['claude-3-5-sonnet-latest', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'];
            botModelSelect.innerHTML = '';
            fallbackModels.forEach(model => botModelSelect.add(new Option(model, model)));
            botModelSelect.value = localStorage.getItem(`gem_selected_model_${provider}`) || fallbackModels[0];
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
    } catch (err) {
        console.error(err);
        botModelSelect.innerHTML = '<option value="">Defaulting to standard...</option>';
        const defaultModels = ['gpt-4o', 'claude-3-5-sonnet', 'deepseek-chat', 'llama3-70b-8192'];
        defaultModels.forEach(model => botModelSelect.add(new Option(model, model)));
    }
}

refreshModelsBtn.addEventListener('click', fetchActiveModels);

// API Core Call Integration (Same as chat, optimized to 1 API Call)
async function fetchCompletion(messages, signal) {
    const providerName = apiProvider.value;
    const provider = PROVIDERS[providerName] || PROVIDERS.openai;
    const hasKey = provider.hasKey;
    const apiKey = localStorage.getItem(`gem_key_${providerName}`) || '';
    const endpoint = localStorage.getItem(`gem_endpoint_${providerName}`) || provider.url;

    const temperature = parseFloat(localStorage.getItem('gem_temp') || '0.7');
    const topP = parseFloat(localStorage.getItem('gem_topp') || '1.0');
    // Set default high token limit (e.g. 90000 or custom) to support extremely large files/payloads
    const maxTokens = 90000;
    const model = botModelSelect.value;

    if (hasKey && !apiKey) {
        throw new Error('Missing API Key. Please click settings on the main page.');
    }

    if (provider.type === 'anthropic') {
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        };

        const systemMessage = messages.find(msg => msg.role === 'system');
        // Claude typically supports up to 8192 output tokens max depending on model, so we cap it appropriately
        const anthropicPayload = {
            model: model || 'claude-3-5-sonnet-latest',
            max_tokens: Math.min(maxTokens, 8192),
            messages: messages.filter(msg => msg.role !== 'system').map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
            })),
            temperature,
            top_p: topP
        };

        if (systemMessage) {
            anthropicPayload.system = systemMessage.content;
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

    const bodyPayload = {
        model: model || 'gpt-4o',
        messages,
        temperature,
        top_p: topP,
        max_tokens: maxTokens
    };

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

function extractAiResponse(response) {
    const providerName = apiProvider.value;
    if (providerName === 'claude') {
        if (Array.isArray(response.content)) {
            return response.content.filter(part => part.type === 'text').map(part => part.text).join('\n');
        }
        return response.content || '';
    }
    return response.choices?.[0]?.message?.content || '';
}

// Parsing AI response files
// Format: <<<FILE_START: path/to/file>>>file contents<<<FILE_END>>>
function setAiCallCount(count) {
    aiApiCallCount = count;
    if (callCountIndicator) {
        callCountIndicator.textContent = `API Calls: ${count}/5`;
    }
}

function tryParseJson(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function stripFileMarkers(responseText) {
    return responseText
        .replace(/<<<FILE_START:\s*.*?\s*>>>([\s\S]*?)<<<FILE_END>>>/g, '')
        .replace(/```\w*\s*<<<FILE_START[\s\S]*?<<<FILE_END>>>\s*```/g, '')
        .trim();
}

function parseFileTags(responseText) {
    const fileRegex = /<<<FILE_START:\s*(.*?)\s*>>>([\s\S]*?)<<<FILE_END>>>/g;
    let match;
    const extractedFiles = {};

    while ((match = fileRegex.exec(responseText)) !== null) {
        const filePath = match[1].trim();
        let fileContent = match[2];

        if (fileContent.startsWith('\r\n')) fileContent = fileContent.substring(2);
        else if (fileContent.startsWith('\n')) fileContent = fileContent.substring(1);
        if (fileContent.endsWith('\r\n')) fileContent = fileContent.substring(0, fileContent.length - 2);
        else if (fileContent.endsWith('\n')) fileContent = fileContent.substring(0, fileContent.length - 1);

        extractedFiles[filePath] = fileContent;
    }
    return extractedFiles;
}

function parseJsonFileInstructions(responseText) {
    let jsonText = responseText.trim();
    let parsed = null;

    if (!jsonText.startsWith('{')) {
        const jsonMatch = responseText.match(/\{[\s\S]*?"files"\s*:\s*\{[\s\S]*?\}\s*\}/);
        if (jsonMatch) {
            jsonText = jsonMatch[0];
        }
    }

    parsed = tryParseJson(jsonText);
    if (!parsed || typeof parsed !== 'object') return {};

    const payload = parsed.files || parsed.file_updates || parsed.updates;
    if (!payload || typeof payload !== 'object') return {};

    const extractedFiles = {};
    Object.entries(payload).forEach(([filename, content]) => {
        if (typeof content === 'string') {
            extractedFiles[filename.trim()] = content.trim();
        }
    });
    return extractedFiles;
}

function parseMarkdownFenceFiles(responseText) {
    const extractedFiles = {};
    const fenceRegex = /(?:^|\n)([^\n`]+?\.(?:html|css|js|json|txt|md))\s*\n```(?:[\w+-]*)\n([\s\S]*?)\n```/gi;
    let match;
    while ((match = fenceRegex.exec(responseText)) !== null) {
        extractedFiles[match[1].trim()] = match[2].replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
    }
    return extractedFiles;
}

function parseFallbackActiveFile(responseText) {
    const activeExtension = activeFileName.split('.').pop().toLowerCase();
    const supportedExtensions = ['html', 'css', 'js', 'json', 'md', 'txt'];
    if (!supportedExtensions.includes(activeExtension)) return {};

    const codeFenceRegex = /```(?:[\w+-]*)\n([\s\S]*?)\n```/;
    const fenceMatch = responseText.match(codeFenceRegex);
    if (fenceMatch && fenceMatch[1] && fenceMatch[1].trim()) {
        return {
            [activeFileName]: fenceMatch[1].replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '')
        };
    }

    if (activeExtension === 'html') {
        const htmlMatch = responseText.match(/(<(?:!doctype|html|head|body)[\s\S]*)/i);
        if (htmlMatch && htmlMatch[1] && htmlMatch[1].trim()) {
            return {
                [activeFileName]: htmlMatch[1].replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '')
            };
        }
    }

    return {};
}

function parseAndExtractFiles(responseText) {
    const fileTags = parseFileTags(responseText);
    if (Object.keys(fileTags).length > 0) {
        return {
            cleanText: stripFileMarkers(responseText),
            files: fileTags
        };
    }

    const jsonFiles = parseJsonFileInstructions(responseText);
    if (Object.keys(jsonFiles).length > 0) {
        return {
            cleanText: stripFileMarkers(responseText),
            files: jsonFiles
        };
    }

    const fenceFiles = parseMarkdownFenceFiles(responseText);
    if (Object.keys(fenceFiles).length > 0) {
        return {
            cleanText: stripFileMarkers(responseText),
            files: fenceFiles
        };
    }

    const fallbackFiles = parseFallbackActiveFile(responseText);
    if (Object.keys(fallbackFiles).length > 0) {
        return {
            cleanText: stripFileMarkers(responseText),
            files: fallbackFiles
        };
    }

    return {
        cleanText: responseText.trim(),
        files: {}
    };
}

async function runAiAgentRequest(userPromptText) {
    const maxCalls = 5;
    let attemptPrompt = userPromptText;
    const baseSystemPrompt = `You are Traliran AI operating in a browser IDE. You have full access to the workspace files and can modify or create files directly.

Current workspace files:
${Object.entries(projectFiles).map(([filename, content]) => `--- FILE: ${filename} ---\n${content}`).join('\n\n')}

Active file: ${activeFileName}

Write updates using one of these formats only:
1) <<<FILE_START: filename>>>\n...file contents...\n<<<FILE_END>>>
2) JSON object with a top-level \"files\" field mapping filenames to content.

Do not include any extra text outside of the file output blocks unless you are providing a short explanation. If you need to retry, respond with file outputs only.`;

    let lastResult = { cleanText: '', files: {}, rawText: '' };
    for (let attempt = 1; attempt <= maxCalls; attempt++) {
        setAiCallCount(attempt);
        const messages = [
            { role: 'system', content: baseSystemPrompt },
            { role: 'user', content: attemptPrompt }
        ];

        try {
            const response = await fetchCompletion(messages, currentAiAbortController.signal);
            const rawText = extractAiResponse(response);
            const parsed = parseAndExtractFiles(rawText);

            lastResult = { cleanText: parsed.cleanText, files: parsed.files, rawText };
            if (Object.keys(parsed.files).length > 0) {
                return { ...lastResult, calls: attempt };
            }
    } catch (e) {
            if (e.name === 'AbortError') throw e;
            // If one attempt fails, we might try the next one unless it's an abort
        }

        if (attempt < maxCalls) {
            attemptPrompt = `The previous response did not contain any parseable file updates. Please resend the updated file contents using either the exact <<<FILE_START: filename>>>...<<<FILE_END>>> format or a valid JSON object with a top-level \"files\" mapping. Do not provide extra commentary.\n\nPrevious AI response:\n${lastResult.rawText}`;
        }
    }
    return { ...lastResult, calls: maxCalls };
}

// UI Message rendering
function renderCopilotMessage(role, text) {
    const welcomeMsg = document.getElementById('ideWelcomeMessage');
    if (welcomeMsg) welcomeMsg.remove();
    const msgDiv = document.createElement('div');
    msgDiv.className = `flex flex-col ${role === 'user' ? 'items-end' : 'items-start'} w-full space-y-1`;

    const sender = role === 'user' ? 'You' : 'AI';
    const bgClass = role === 'user' ? 'bg-violet-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-100';

    const customRenderer = new marked.Renderer();
    customRenderer.code = function(codeArg, language) {
        let codeText = (codeArg && typeof codeArg === 'object') ? codeArg.text : codeArg;
        let codeLang = (codeArg && typeof codeArg === 'object') ? codeArg.lang : language;
        codeText = codeText || '';
        codeLang = codeLang || '';
        return `
            <div class="relative group/code my-2 w-full text-left">
                <div class="text-[10px] bg-gray-950/80 px-3 py-0.5 text-gray-400 rounded-t-lg font-mono border-t border-x border-gray-800">${codeLang || 'code'}</div>
                <pre class="!mt-0 !rounded-t-none text-xs"><code class="language-${codeLang}">${escapeHtml(codeText)}</code></pre>
            </div>
        `;
    };

    const formattedContent = role === 'user' 
        ? escapeHtml(text).replace(/\n/g, '<br>')
        : marked.parse(text, { renderer: customRenderer });

    msgDiv.innerHTML = `
        <span class="text-[10px] text-gray-500 font-mono px-1">${sender}</span>
        <div class="max-w-[95%] rounded-xl px-3 py-2 text-xs shadow-md ${bgClass} overflow-hidden break-words w-full">
            <div class="md-content leading-relaxed">${formattedContent}</div>
        </div>
    `;
    aiChatWindow.appendChild(msgDiv);
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function handleAiRequest(customPrompt = "") {
    const userPromptText = customPrompt || aiInput.value.trim();
    if (!userPromptText) return;

    if (!customPrompt) {
        aiInput.value = '';
        aiInput.style.height = 'auto';
    }

    renderCopilotMessage('user', userPromptText);

    if (activeFileName && projectFiles[activeFileName] !== undefined) {
        projectFiles[activeFileName] = codeEditor.value;
        saveWorkspace();
    }

    aiInput.disabled = true;
    aiSendBtn.disabled = true;
    aiSendBtn.classList.add('hidden');
    aiStopBtn.classList.remove('hidden');

    currentAiAbortController = new AbortController();

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'text-xs text-violet-400 italic px-1 animate-pulse';
    loadingDiv.id = 'copilotLoading';
    loadingDiv.textContent = 'Analyzing codebase & generating edits...';
    aiChatWindow.appendChild(loadingDiv);
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;

    try {
        const result = await runAiAgentRequest(userPromptText);
        if (loadingDiv) loadingDiv.remove();

        const parsed = { cleanText: result.cleanText, files: result.files };
        const responseSummary = result.cleanText || `Received ${Object.keys(parsed.files).length} file updates.`;
        const callInfo = ` (API calls used: ${result.calls})`;

        renderCopilotMessage('assistant', responseSummary + callInfo);

        const extractedFilesCount = Object.keys(parsed.files).length;
        if (extractedFilesCount > 0) {
            proposedChanges = parsed.files;
            applyProposedChanges();
        } else {
            const noChangeDiv = document.createElement('div');
            noChangeDiv.className = 'bg-amber-950/40 border border-amber-900 text-amber-300 p-2.5 rounded-lg text-xs';
            noChangeDiv.textContent = 'No valid file updates were extracted from the AI response.';
            aiChatWindow.appendChild(noChangeDiv);
            aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
        }
    } catch (e) {
        if (loadingDiv) loadingDiv.remove();
        console.error(e);
        if (e.name === 'AbortError') {
            // Для IDE: ничего не отображаем и игнорируем ответ
        } else {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'bg-rose-950/40 border border-rose-900 text-rose-300 p-2.5 rounded-lg text-xs';
            errorDiv.textContent = `AI error: ${e.message}`;
            aiChatWindow.appendChild(errorDiv);
        }
    } finally {
        aiInput.disabled = false;
        aiSendBtn.disabled = false;
        aiSendBtn.classList.remove('hidden');
        aiStopBtn.classList.add('hidden');
        currentAiAbortController = null;
        aiInput.focus();
    }
}

function applyProposedChanges() {
    if (!proposedChanges) return;

    Object.entries(proposedChanges).forEach(([filepath, content]) => {
        projectFiles[filepath] = content;
    });

    saveWorkspace();
    renderFileList();
    
    // Refresh current selected file editor
    if (projectFiles[activeFileName] !== undefined) {
        codeEditor.value = projectFiles[activeFileName];
        updateLineNumbers();
    }

    proposedChanges = null;
    changesIndicator.classList.add('hidden');
    changesIndicator.classList.remove('flex');

    // Display mini status indicator
    const notifyDiv = document.createElement('div');
    notifyDiv.className = 'bg-emerald-950/40 border border-emerald-900 text-emerald-300 p-2 rounded-lg text-[11px] font-medium animate-pulse';
    notifyDiv.textContent = '✓ Workspace files updated! Running preview...';
    aiChatWindow.appendChild(notifyDiv);
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;

    // Trigger preview update
    runPreview();
    
    // Switch to preview tab automatically so user can see live results!
    tabPreview.click();
}

// Attach listeners to AI Quick Actions
btnAiGenerate.addEventListener('click', () => {
    handleAiRequest("Please generate a beautiful interactive dashboard or complete frontend component with interactive state for index.html, with corresponding styled classes in styles.css and interactive listeners in script.js.");
});

btnAiRefactor.addEventListener('click', () => {
    handleAiRequest(`Please optimize, refactor, and format the active file (${activeFileName}) to improve structure, performance, and modern practices.`);
});

btnAiExplain.addEventListener('click', () => {
    handleAiRequest(`Can you explain the logic, purpose, and structure of the code in the active file (${activeFileName})?`);
});

btnAiFix.addEventListener('click', () => {
    handleAiRequest(`Please review the active file (${activeFileName}) for potential logic bugs, syntax issues, styling errors, or visual glitches and provide the correct complete file fixes.`);
});

aiSendBtn.addEventListener('click', () => handleAiRequest());
aiInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAiRequest();
    }
});

aiStopBtn.addEventListener('click', () => {
    if (currentAiAbortController) {
        currentAiAbortController.abort();
    }
});

applyChangesBtn.addEventListener('click', applyProposedChanges);

aiInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initWorkspace();
});

