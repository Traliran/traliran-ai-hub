// Traliran AI IDE - Core JS logic
let projectFiles = {};
let activeFileName = "index.html";
let proposedChanges = null;
let selectedFilesForAI = {}; // Track which files to send to AI
let gitCommits = []; // Git history

// Bot Store State
let customBots = [];
let activeBotId = null;

const OFFICIAL_BOTS = [
    {
        name: "UX Forge AI",
        description: "UX Forge AI analyzes your code inside the IDE and suggests bold, non‑template, high‑impact UX and product improvements. No generic tips – only truly creative, useful ideas.",
        link: "https://whop.com/traliran-ai-huub/ux-forge-ai"
    }
];
        
// DOM Elements
const apiProvider = document.getElementById('apiProvider');
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
const tabFiles = document.getElementById('tabFiles');
const tabGit = document.getElementById('tabGit');
const filesPanel = document.getElementById('filesPanel');
const gitPanel = document.getElementById('gitPanel');
const commitMessage = document.getElementById('commitMessage');
const createCommitBtn = document.getElementById('createCommitBtn');
const gitHistory = document.getElementById('gitHistory');
const commitCount = document.getElementById('commitCount');
const clearGitBtn = document.getElementById('clearGitBtn');
const restoreFileInput = document.getElementById('restoreFileInput');
const restoreFromFileBtn = document.getElementById('restoreFromFileBtn');
const editorContainer = document.getElementById('editorContainer');
const previewContainer = document.getElementById('previewContainer');
const codeEditorElement = document.getElementById('codeEditor');
let codeEditor = null;
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

// Bot Store DOM Elements
const openBotStoreBtn = document.getElementById('openBotStoreBtn');
const botStoreModal = document.getElementById('botStoreModal');
const closeBotStoreModal = document.getElementById('closeBotStoreModal');
const botStoreGrid = document.getElementById('botStoreGrid');
const createNewBotBtn = document.getElementById('createNewBotBtn');
const exportBotsBtn = document.getElementById('exportBotsBtn');
const importBotsInput = document.getElementById('importBotsInput');
const botEditorModal = document.getElementById('botEditorModal');
const closeBotEditorModal = document.getElementById('closeBotEditorModal');
const botEditorTitle = document.getElementById('botEditorTitle');
const editBotName = document.getElementById('editBotName');
const editBotPrompt = document.getElementById('editBotPrompt');
const editBotModel = document.getElementById('editBotModel');
const editBotTemp = document.getElementById('editBotTemp');
const saveBotBtn = document.getElementById('saveBotBtn');
const deleteBotBtn = document.getElementById('deleteBotBtn');

let editingBotId = null;

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

// Initialize workspace with Git history
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

    // Load git commits
    const savedGit = localStorage.getItem('ide_git_commits');
    if (savedGit) {
        try {
            gitCommits = JSON.parse(savedGit);
        } catch (e) {
            gitCommits = [];
        }
    }
    
    // Load selected files for AI
    const savedSelected = localStorage.getItem('ide_selected_files_for_ai');
    if (savedSelected) {
        try {
            selectedFilesForAI = JSON.parse(savedSelected);
        } catch (e) {
            selectedFilesForAI = {};
        }
    }
    // By default, all files are selected
    Object.keys(projectFiles).forEach(filename => {
        if (!(filename in selectedFilesForAI)) {
            selectedFilesForAI[filename] = true;
        }
    });
    
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

    // Load Custom Bots
    const savedBots = localStorage.getItem('ide_custom_bots');
    if (savedBots) {
        try {
            customBots = JSON.parse(savedBots);
    } catch (e) {
            customBots = [];
    }
}

    const savedActiveBot = localStorage.getItem('ide_active_bot_id');
    activeBotId = savedActiveBot;
    renderFileList();
    renderGitHistory();
    selectFile(activeFileName);
    checkApiConfiguration();
}

function saveWorkspace() {
    // Save active file content first
    if (activeFileName && projectFiles[activeFileName] !== undefined && codeEditor) {
        projectFiles[activeFileName] = codeEditor.getValue();
    }
    localStorage.setItem('ide_project_files', JSON.stringify(projectFiles));
    localStorage.setItem('ide_active_file', activeFileName);
}

// Render File List with conditional delete option & checkboxes for AI context
function renderFileList() {
    fileList.innerHTML = '';
    Object.keys(projectFiles).sort().forEach(filename => {
        const isActive = filename === activeFileName;
        const isSelectedForAI = selectedFilesForAI[filename] !== false; // Default to true
        const div = document.createElement('div');
        div.className = `group flex items-center justify-between p-2 rounded-lg transition ${
            isActive ? 'bg-violet-600/20 border border-violet-500/40 text-white' : 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
        }`;

        // Checkbox for AI context selection
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = isSelectedForAI;
        checkbox.className = 'w-3.5 h-3.5 mr-1.5 cursor-pointer rounded accent-violet-500';
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            selectedFilesForAI[filename] = e.target.checked;
            localStorage.setItem('ide_selected_files_for_ai', JSON.stringify(selectedFilesForAI));
        });

        // File name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'text-xs font-mono truncate flex-1 cursor-pointer';
        nameSpan.textContent = filename;
        nameSpan.style.marginLeft = '0.25rem';
        nameSpan.onclick = (e) => {
            e.stopPropagation();
            selectFile(filename);
                };
                
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 px-1 text-[11px] transition cursor-pointer';
        deleteBtn.textContent = '🗑️';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteFile(filename);
        };

        div.appendChild(checkbox);
        div.appendChild(nameSpan);
        div.appendChild(deleteBtn);
        fileList.appendChild(div);
    });
}

function selectFile(filename) {
    if (activeFileName && projectFiles[activeFileName] !== undefined && codeEditor) {
        projectFiles[activeFileName] = codeEditor.getValue();
    }

    activeFileName = filename;
    activeFileNameSpan.textContent = filename;
    localStorage.setItem('ide_active_file', filename);
    renderFileList();

    if (codeEditor) {
        const fileContent = projectFiles[filename] || "";
        codeEditor.setValue(fileContent);
        const model = codeEditor.getModel();
        if (model) {
            monaco.editor.setModelLanguage(model, getLanguageForFile(filename));
        }
    }
}

function deleteFile(filename) {
    if (confirm(`Are you sure you want to delete ${filename}?`)) {
        delete projectFiles[filename];
        if (activeFileName === filename) {
            const remaining = Object.keys(projectFiles);
            activeFileName = remaining.length > 0 ? remaining[0] : "index.html";
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
function getLanguageForFile(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
        case 'html': return 'html';
        case 'css': return 'css';
        case 'js': return 'javascript';
        case 'json': return 'json';
        case 'md': return 'markdown';
        case 'ts': return 'typescript';
        case 'py': return 'python';
        default: return 'plaintext';
    }
}

function initializeMonaco() {
    if (!window.require || !codeEditorElement) return;
    require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.44.0/min/vs' } });
    require(['vs/editor/editor.main'], function () {
        codeEditor = monaco.editor.create(codeEditorElement, {
            value: '',
            language: getLanguageForFile(activeFileName),
            theme: 'vs-dark',
            automaticLayout: true,
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            formatOnType: true,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
        });

        codeEditor.onDidChangeModelContent(() => {
            if (activeFileName && projectFiles[activeFileName] !== undefined) {
                projectFiles[activeFileName] = codeEditor.getValue();
                localStorage.setItem('ide_project_files', JSON.stringify(projectFiles));
            }
        });

        selectFile(activeFileName);
    });
}

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
    setupErrorListener(); // Initialize error detection for this preview
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

// Bot Store Logic
function renderBotStore() {
    botStoreGrid.innerHTML = '';

    // 1. OFFICIAL / PAID BOTS SECTION
    const officialSection = document.createElement('div');
    officialSection.className = "col-span-full space-y-3 mb-6";
    officialSection.innerHTML = `
        <h3 class="text-xs font-bold uppercase text-amber-500 tracking-widest border-b border-amber-500/30 pb-1">💎 Premium Presets</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            ${OFFICIAL_BOTS.map(bot => `
                <div class="bg-gray-950 border border-amber-900/50 rounded-xl p-4 flex flex-col justify-between h-40 relative group transition hover:border-amber-500/50 overflow-hidden">
                    <div class="absolute top-0 right-0 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-bl-lg">PREMIUM</div>
                    <div>
                        <h4 class="font-bold text-amber-400 text-sm">${escapeHtml(bot.name)}</h4>
                        <p class="text-xs text-gray-400 mt-1.5 line-clamp-3">${escapeHtml(bot.description)}</p>
                    </div>
                    <div class="flex justify-end mt-2">
                        <a href="${bot.link}" target="_blank" class="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition cursor-pointer shadow-lg shadow-amber-900/20">
                            Get Access 🔓
                        </a>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    botStoreGrid.appendChild(officialSection);

    // 2. CUSTOM BOTS SECTION
    const customSection = document.createElement('div');
    customSection.className = "col-span-full space-y-3";
    customSection.innerHTML = `<h3 class="text-xs font-bold uppercase text-gray-500 tracking-widest border-b border-gray-800 pb-1">🛠️ My Custom Assistants</h3>`;

    const customGrid = document.createElement('div');
    customGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-4";

    if (customBots.length === 0) {
        customGrid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center p-12 text-center space-y-3 border-2 border-dashed border-gray-800 rounded-2xl">
                <span class="text-4xl">🏪</span>
                <p class="text-gray-400 text-sm">Your custom store is empty.<br>Create your first assistant or import a preset!</p>
            </div>
        `;
    } else {
        customBots.forEach(bot => {
            const isActive = bot.id === activeBotId;
            const div = document.createElement('div');
            div.className = `bg-gray-950 border ${isActive ? 'border-amber-500 ring-1 ring-amber-500/50' : 'border-gray-800'} rounded-xl p-4 flex flex-col justify-between h-40 relative group transition hover:border-gray-700`;

            div.innerHTML = `
                <div>
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-amber-400 text-sm">${escapeHtml(bot.name)}</h4>
                        ${isActive ? '<span class="text-[10px] bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded">ACTIVE</span>' : ''}
                    </div>
                    <p class="text-xs text-gray-400 mt-1.5 line-clamp-3">${escapeHtml(bot.prompt)}</p>
                </div>
                <div class="flex justify-end gap-2 mt-2">
                    <button class="edit-bot-btn bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold px-3 py-1 rounded-lg transition cursor-pointer">Edit</button>
                    <button class="use-bot-btn ${isActive ? 'bg-gray-700 text-gray-400 cursor-default' : 'bg-amber-600 hover:bg-amber-500 text-white'} text-xs font-bold px-3 py-1 rounded-lg transition cursor-pointer">
                        ${isActive ? 'Using' : 'Use'}
                    </button>
                </div>
            `;

            div.querySelector('.edit-bot-btn').onclick = () => openBotEditor(bot.id);
            div.querySelector('.use-bot-btn').onclick = () => useBot(bot.id);

            customGrid.appendChild(div);
        });
    }

    customSection.appendChild(customGrid);
    botStoreGrid.appendChild(customSection);
}
    
function openBotEditor(botId = null) {
    editingBotId = botId;
    if (botId) {
        const bot = customBots.find(b => b.id === botId);
        if (bot) {
            botEditorTitle.textContent = "Edit Assistant";
            editBotName.value = bot.name;
            editBotPrompt.value = bot.prompt;
            editBotModel.value = bot.model || '';
            editBotTemp.value = bot.temp || 0.7;
        }
    } else {
        botEditorTitle.textContent = "Create New Assistant";
        editBotName.value = '';
        editBotPrompt.value = '';
        editBotModel.value = '';
        editBotTemp.value = 0.7;
    }

    // Populate model dropdown from current providers list
    editBotModel.innerHTML = '';
    // Just a few common defaults if we don't have a full list,
    // but ideally we'd use the models from the current provider.
    // Since we don't have an easy way to get all models across all providers,
    // we'll just copy what's currently in the botModelSelect.
    Array.from(botModelSelect.options).forEach(opt => {
        editBotModel.add(new Option(opt.text, opt.value));
    });

    botEditorModal.classList.remove('hidden');
}

function useBot(botId) {
    activeBotId = botId;
    localStorage.setItem('ide_active_bot_id', botId);
    renderBotStore();

    // Optional: notify in AI chat
    const bot = customBots.find(b => b.id === botId);
    if (bot) {
        const notify = document.createElement('div');
        notify.className = 'bg-amber-950/40 border border-amber-900 text-amber-300 p-2 rounded-lg text-[11px] font-medium text-center animate-pulse';
        notify.textContent = `✨ Active Assistant switched to: ${bot.name}`;
        aiChatWindow.appendChild(notify);
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
        setTimeout(() => notify.remove(), 3000);
    }
}
    
function saveBot() {
    const name = editBotName.value.trim();
    const prompt = editBotPrompt.value.trim();
    const model = editBotModel.value;
    const temp = parseFloat(editBotTemp.value) || 0.7;

    if (!name || !prompt) {
        alert("Please provide both a name and a system prompt.");
        return;
    }

    if (editingBotId) {
        const index = customBots.findIndex(b => b.id === editingBotId);
        if (index !== -1) {
            customBots[index] = { ...customBots[index], name, prompt, model, temp };
        }
    } else {
        const newBot = {
            id: 'bot_' + Date.now(),
            name, prompt, model, temp
        };
        customBots.push(newBot);
    }

    localStorage.setItem('ide_custom_bots', JSON.stringify(customBots));
    botEditorModal.classList.add('hidden');
    renderBotStore();
}

function deleteBot() {
    if (!editingBotId) return;
    if (confirm("Delete this assistant?")) {
        customBots = customBots.filter(b => b.id !== editingBotId);
        if (activeBotId === editingBotId) {
            activeBotId = null;
            localStorage.removeItem('ide_active_bot_id');
        }
        localStorage.setItem('ide_custom_bots', JSON.stringify(customBots));
        botEditorModal.classList.add('hidden');
        renderBotStore();
    }
}

function exportBots() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(customBots, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'traliran-ide-bots.json');
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

function importBots(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
    try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                customBots = [...customBots, ...imported];
                // Deduplicate by ID if necessary, but usually we just append
                localStorage.setItem('ide_custom_bots', JSON.stringify(customBots));
                renderBotStore();
                alert("Bots imported successfully!");
            } else {
                throw new Error("Invalid format: expected an array of bots.");
            }
        } catch (err) {
            alert("Error importing bots: " + err.message);
        }
    };
    reader.readAsText(file);
}

// Bot Store Listeners
if (openBotStoreBtn) openBotStoreBtn.onclick = () => {
    renderBotStore();
    botStoreModal.classList.remove('hidden');
};
if (closeBotStoreModal) closeBotStoreModal.onclick = () => botStoreModal.classList.add('hidden');
if (createNewBotBtn) createNewBotBtn.onclick = () => openBotEditor();
if (saveBotBtn) saveBotBtn.onclick = saveBot;
if (deleteBotBtn) deleteBotBtn.onclick = deleteBot;
if (closeBotEditorModal) closeBotEditorModal.onclick = () => botEditorModal.classList.add('hidden');
if (exportBotsBtn) exportBotsBtn.onclick = exportBots;
if (importBotsInput) importBotsInput.onchange = importBots;

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
function tryParseJson(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

// Diff generation (for selective updates & token savings)
function generateDiff(oldContent, newContent) {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const diff = [];
    let oldIndex = 0, newIndex = 0;

    // Simple line-by-line diff (not a full unified diff, but close enough)
    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i] || '';
        const newLine = newLines[i] || '';
        
        if (oldLine !== newLine) {
            if (oldLine) diff.push(`- ${oldLine}`);
            if (newLine) diff.push(`+ ${newLine}`);
        } else {
            diff.push(`  ${oldLine}`);
        }
    }
    return diff.join('\n');
}

// Apply diff to file content
function applyDiff(oldContent, diffText) {
    try {
        const lines = diffText.split('\n');
        const result = [];
        
        for (const line of lines) {
            if (line.startsWith('- ')) {
                // Remove line (skip it)
                continue;
            } else if (line.startsWith('+ ')) {
                // Add line
                result.push(line.substring(2));
            } else if (line.startsWith('  ')) {
                // Keep line
                result.push(line.substring(2));
            }
        }
        return result.join('\n');
    } catch (e) {
        console.error('Diff apply error:', e);
        return oldContent; // Fallback to original
    }
}

// Parse diff format: <<<DIFF_START: file>>>\n@@ ...diff... \n<<<DIFF_END>>>
function parseDiffFiles(responseText) {
    const diffRegex = /<<<DIFF_START:\s*(.*?)\s*>>>([\s\S]*?)<<<DIFF_END>>>/g;
    let match;
    const extractedDiffs = {};

    while ((match = diffRegex.exec(responseText)) !== null) {
        const filePath = match[1].trim();
        let diffContent = match[2];
        
        if (diffContent.startsWith('\r\n')) diffContent = diffContent.substring(2);
        else if (diffContent.startsWith('\n')) diffContent = diffContent.substring(1);
        if (diffContent.endsWith('\r\n')) diffContent = diffContent.substring(0, diffContent.length - 2);
        else if (diffContent.endsWith('\n')) diffContent = diffContent.substring(0, diffContent.length - 1);

        extractedDiffs[filePath] = diffContent;
    }
    return extractedDiffs;
}

// Convert diffs to full file content
function applyDiffsToFiles(diffsByFile) {
    const resultFiles = {};
    Object.entries(diffsByFile).forEach(([filepath, diffContent]) => {
        if (projectFiles[filepath]) {
            resultFiles[filepath] = applyDiff(projectFiles[filepath], diffContent);
        } else {
            // If file doesn't exist, treat diff lines starting with + as new content
            const lines = diffContent.split('\n').filter(l => l.startsWith('+ ')).map(l => l.substring(2));
            resultFiles[filepath] = lines.join('\n');
        }
    });
    return resultFiles;
}

function stripFileMarkers(responseText) {
    return responseText
        .replace(/<<<FILE_START:\s*.*?\s*>>>([\s\S]*?)<<<FILE_END>>>/g, '')
        .replace(/<<<DIFF_START:\s*.*?\s*>>>([\s\S]*?)<<<DIFF_END>>>/g, '')
        .replace(/```\w*\s*<<<FILE_START[\s\S]*?<<<FILE_END>>>\s*```/g, '')
        .replace(/```\w*\s*<<<DIFF_START[\s\S]*?<<<DIFF_END>>>\s*```/g, '')
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

    // Try to parse diffs (new feature)
    const diffTags = parseDiffFiles(responseText);
    if (Object.keys(diffTags).length > 0) {
        const appliedFiles = applyDiffsToFiles(diffTags);
        return {
            cleanText: stripFileMarkers(responseText),
            files: appliedFiles
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
            cleanText: responseText.trim(),
            files: fallbackFiles
        };
    }

    return {
        cleanText: responseText.trim(),
        files: {}
    };
}

async function runAiAgentRequest(userPromptText) {
    const maxCalls = 999;
    let attemptPrompt = userPromptText;
    
    // Get only selected files for AI context
    const selectedFiles = {};
    Object.entries(projectFiles).forEach(([filename, content]) => {
        if (selectedFilesForAI[filename] !== false) {
            selectedFiles[filename] = content;
        }
    });

    // Check if an active bot is selected, otherwise use default
    const activeBot = customBots.find(b => b.id === activeBotId);
    const systemPrompt = activeBot ? activeBot.prompt : `You are Traliran AI operating in a browser IDE. You have full access to the workspace files and can modify or create files directly.`;

    const personalInfo = localStorage.getItem('gem_personal_info') || '';
    const personalContext = personalInfo ? `[About the user]:\n${personalInfo}\n\n` : '';

    const baseSystemPrompt = `${personalContext}${systemPrompt}

Current workspace files:
${Object.entries(selectedFiles).map(([filename, content]) => `--- FILE: ${filename} ---\n${content}`).join('\n\n')}

Active file: ${activeFileName}

Write updates using one of these formats only:
1) <<<FILE_START: filename>>>\n...file contents...\n<<<FILE_END>>>
2) JSON object with a top-level \"files\" field mapping filenames to content.

Do not include any extra text outside of the file output blocks unless you are providing a short explanation. If you need to retry, respond with file outputs only.`;

    let lastResult = { cleanText: '', files: {}, rawText: '' };
    for (let attempt = 1; attempt <= maxCalls; attempt++) {

        // Use active bot's model and temperature if specified, otherwise use the global ones
        const modelToUse = (activeBot && activeBot.model) ? activeBot.model : botModelSelect.value;
        const tempToUse = (activeBot && activeBot.temp !== undefined) ? activeBot.temp : parseFloat(localStorage.getItem('gem_temp') || '0.7');

        // We need to pass these to fetchCompletion, but fetchCompletion currently reads from global state.
        // Let's override global state temporarily or modify fetchCompletion.
        // Easiest way: temporarily set the global value or update fetchCompletion signature.

        const originalModel = botModelSelect.value;
        const originalTemp = localStorage.getItem('gem_temp');

        if (modelToUse) botModelSelect.value = modelToUse;
        localStorage.setItem('gem_temp', tempToUse.toString());

        const messages = [
            { role: 'system', content: baseSystemPrompt },
            { role: 'user', content: attemptPrompt }
        ];

        try {
            const response = await fetchCompletion(messages, currentAiAbortController.signal);

            // Restore original state
            botModelSelect.value = originalModel;
            if (originalTemp) localStorage.setItem('gem_temp', originalTemp);
            else localStorage.removeItem('gem_temp');

            const rawText = extractAiResponse(response);
            const parsed = parseAndExtractFiles(rawText);

            lastResult = { cleanText: parsed.cleanText, files: parsed.files, rawText };
            if (Object.keys(parsed.files).length > 0) {
                return { ...lastResult, calls: attempt };
            }
    } catch (e) {
            // Restore state on error too
            botModelSelect.value = originalModel;
            if (originalTemp) localStorage.setItem('gem_temp', originalTemp);
            else localStorage.removeItem('gem_temp');

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

    if (activeFileName && projectFiles[activeFileName] !== undefined && codeEditor) {
        projectFiles[activeFileName] = codeEditor.getValue();
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

        renderCopilotMessage('assistant', responseSummary);

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
    if (projectFiles[activeFileName] !== undefined && codeEditor) {
        codeEditor.setValue(projectFiles[activeFileName]);
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

// ============ GIT INTEGRATION ============

function createGitCommit() {
    const message = commitMessage.value.trim();
    if (!message) {
        alert('Please enter a commit message');
        return;
    }

    // Save current editor content before creating snapshot
    if (activeFileName && projectFiles[activeFileName] !== undefined && codeEditor) {
        projectFiles[activeFileName] = codeEditor.getValue();
    }

    // Create a snapshot of current files
    const snapshot = {
        timestamp: new Date().toISOString(),
        message: message,
        files: JSON.parse(JSON.stringify(projectFiles)) // Deep copy
    };

    gitCommits.unshift(snapshot); // Add to front
    localStorage.setItem('ide_git_commits', JSON.stringify(gitCommits));
    commitMessage.value = '';
    renderGitHistory();

    // Show feedback
    const notify = document.createElement('div');
    notify.className = 'bg-emerald-950/40 border border-emerald-900 text-emerald-300 p-2 rounded-lg text-[11px] font-medium animate-pulse';
    notify.textContent = `✓ Commit created: "${message}"`;
    aiChatWindow.appendChild(notify);
    setTimeout(() => notify.remove(), 3000);

    // Download commit as JSON backup
    downloadCommitJson(snapshot);
}

function downloadCommitJson(commit) {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(commit, null, 2));
    const anchor = document.createElement('a');
    const filename = `commit-${commit.message.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}-${new Date(commit.timestamp).toISOString().slice(0, 10)}.json`;
    anchor.setAttribute('href', dataStr);
    anchor.setAttribute('download', filename);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
}

function renderGitHistory() {
    gitHistory.innerHTML = '';
    
    if (gitCommits.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'text-xs text-gray-500 p-2 text-center';
        empty.innerHTML = 'No commits yet<br>Create a commit to save snapshots!';
        gitHistory.appendChild(empty);
        commitCount.textContent = '0';
        return;
    }

    commitCount.textContent = gitCommits.length;

    gitCommits.forEach((commit, index) => {
        const item = document.createElement('div');
        const date = new Date(commit.timestamp);
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        
        item.className = 'group p-2 rounded-lg bg-gray-800/30 hover:bg-gray-800/60 cursor-pointer border border-gray-800/50 hover:border-violet-600/40 transition text-xs space-y-1';
        item.innerHTML = `
            <div class="font-mono text-violet-400 text-[10px]">#${index}</div>
            <div class="text-gray-300 font-medium truncate">${escapeHtml(commit.message)}</div>
            <div class="text-gray-500 text-[11px]">${timeStr}</div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button class="flex-1 bg-blue-900/50 hover:bg-blue-800 text-blue-300 py-1 rounded text-[10px]">View</button>
                <button class="flex-1 bg-emerald-900/50 hover:bg-emerald-800 text-emerald-300 py-1 rounded text-[10px]">Download</button>
            </div>
        `;

        // View commit details
        item.querySelector('button:nth-child(1)').addEventListener('click', (e) => {
            e.stopPropagation();
            showCommitDetails(index, commit);
        });

        // Download commit JSON
        item.querySelector('button:nth-child(2)').addEventListener('click', (e) => {
            e.stopPropagation();
            downloadCommitJson(commit);
        });

        gitHistory.appendChild(item);
    });
}

function showCommitDetails(index, commit) {
    let details = `Commit #${index}\n`;
    details += `Message: ${commit.message}\n`;
    details += `Date: ${new Date(commit.timestamp).toLocaleString()}\n`;
    details += `Files:\n`;
    Object.keys(commit.files).forEach(file => {
        details += `  • ${file}\n`;
    });
    alert(details);
}

// Tab switching for Files/Git
if (tabFiles && tabGit) {
    tabFiles.addEventListener('click', () => {
        tabFiles.className = 'flex-1 px-3 py-2 text-xs font-bold text-violet-400 bg-gray-950 border-b-2 border-violet-500 transition';
        tabGit.className = 'flex-1 px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-300 transition border-b-2 border-transparent';
        filesPanel.classList.remove('hidden');
        gitPanel.classList.add('hidden');
    });

    tabGit.addEventListener('click', () => {
        tabGit.className = 'flex-1 px-3 py-2 text-xs font-bold text-violet-400 bg-gray-950 border-b-2 border-violet-500 transition';
        tabFiles.className = 'flex-1 px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-300 transition border-b-2 border-transparent';
        filesPanel.classList.add('hidden');
        gitPanel.classList.remove('hidden');
    });
}

// Git button listeners
if (createCommitBtn) {
    createCommitBtn.addEventListener('click', createGitCommit);
}

if (commitMessage) {
    commitMessage.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            createGitCommit();
        }
    });
}

if (clearGitBtn) {
    clearGitBtn.addEventListener('click', () => {
        if (confirm('Clear all commits? This cannot be undone.')) {
            gitCommits = [];
            localStorage.setItem('ide_git_commits', JSON.stringify(gitCommits));
            renderGitHistory();
        }
    });
}

function restoreFromJson(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const commit = JSON.parse(e.target.result);
            if (!commit.files || typeof commit.files !== 'object') {
                alert('Invalid backup file: missing "files" field.');
                return;
            }
            if (confirm(`Restore from backup "${commit.message || 'unknown'}"?\nThis will overwrite current files.`)) {
                if (activeFileName && projectFiles[activeFileName] !== undefined && codeEditor) {
                    projectFiles[activeFileName] = codeEditor.getValue();
                }
                projectFiles = JSON.parse(JSON.stringify(commit.files));
                saveWorkspace();
                renderFileList();
                selectFile(activeFileName);
                runPreview();
                const notify = document.createElement('div');
                notify.className = 'bg-emerald-950/40 border border-emerald-900 text-emerald-300 p-2 rounded-lg text-[11px]';
                notify.textContent = '✓ Restored from backup: ' + (commit.message || 'unknown');
                aiChatWindow.appendChild(notify);
                setTimeout(() => notify.remove(), 3000);
            }
        } catch (err) {
            alert('Invalid JSON backup file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

if (restoreFileInput) {
    restoreFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) restoreFromJson(file);
        e.target.value = '';
    });
}

if (restoreFromFileBtn) {
    restoreFromFileBtn.addEventListener('click', () => {
        restoreFileInput.click();
    });
}

// ============ END GIT INTEGRATION ============

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

// ============ AUTO-HEALING (Error Detection & Auto-Fix) ============

let lastDetectedError = null;
let autoFixInProgress = false;

function setupErrorListener() {
    // Hook into iframe console
    projectIframe.onload = () => {
        try {
            const iframeDoc = projectIframe.contentDocument || projectIframe.contentWindow.document;
            const iframeWindow = projectIframe.contentWindow;
            
            // Capture console errors
            if (iframeWindow) {
                const originalError = iframeWindow.console.error;
                iframeWindow.console.error = function(...args) {
                    originalError.apply(iframeWindow.console, args);
                    
                    const errorMsg = args.join(' ');
                    if (!autoFixInProgress && errorMsg && errorMsg.length > 0) {
                        detectAndFixError(errorMsg);
                    }
                };
                
                // Also capture window errors
                iframeWindow.onerror = function(message, source, lineno, colno, error) {
                    if (!autoFixInProgress) {
                        const fullMsg = `${message} at line ${lineno}`;
                        detectAndFixError(fullMsg);
                    }
                    return false;
                };
            }
        } catch (e) {
            // If we can't hook into iframe (security), that's OK
        }
    };
}

function detectAndFixError(errorMsg) {
    lastDetectedError = errorMsg;
    
    // Don't auto-fix if no suitable file is active
    const ext = activeFileName.split('.').pop().toLowerCase();
    if (!['html', 'js', 'css'].includes(ext)) return;

    // Show error notification with auto-fix option
    const errorNotif = document.createElement('div');
    errorNotif.className = 'bg-rose-950/40 border border-rose-900 text-rose-300 p-2 rounded-lg text-[11px] font-medium flex items-center justify-between gap-2';
    errorNotif.innerHTML = `
        <span>🐛 Error detected: ${errorMsg.substring(0, 40)}...</span>
        <button class="bg-rose-700 hover:bg-rose-600 px-2 py-1 rounded text-[10px]">Auto-Fix with AI</button>
    `;
    
    errorNotif.querySelector('button').addEventListener('click', () => {
        autoFixError(errorMsg);
        errorNotif.remove();
    });
    
    aiChatWindow.appendChild(errorNotif);
    aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
    
    // Auto-fix after 3 seconds if user doesn't click
    setTimeout(() => {
        if (lastDetectedError === errorMsg && !autoFixInProgress) {
            autoFixError(errorMsg);
            if (errorNotif.parentElement) {
                errorNotif.remove();
            }
        }
    }, 3000);
}

async function autoFixError(errorMsg) {
    if (autoFixInProgress) return;
    autoFixInProgress = true;

    const fixPrompt = `I'm getting an error in my project:\n\n"${errorMsg}"\n\nPlease fix this error in the ${activeFileName} file. Analyze the code and provide the corrected version.`;
    
    try {
        // Show loading state
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'text-xs text-amber-400 italic px-1 animate-pulse';
        loadingDiv.textContent = '🔧 Analyzing error and generating fix...';
        aiChatWindow.appendChild(loadingDiv);
        aiChatWindow.scrollTop = aiChatWindow.scrollHeight;

        // Make AI request
        await handleAiRequest(fixPrompt);
        
        if (loadingDiv.parentElement) {
            loadingDiv.remove();
        }
        
        // Notify user
        const successNotif = document.createElement('div');
        successNotif.className = 'bg-emerald-950/40 border border-emerald-900 text-emerald-300 p-2 rounded-lg text-[11px] font-medium';
        successNotif.textContent = '✓ Auto-fix applied! Check the preview.';
        aiChatWindow.appendChild(successNotif);
        aiChatWindow.scrollTop = aiChatWindow.scrollHeight;
    } catch (e) {
        console.error('Auto-fix error:', e);
    } finally {
        autoFixInProgress = false;
    }
}

// ============ END AUTO-HEALING ============

// Auth / Sync integration
function updateLoginButton() {
    const btn = document.getElementById('loginBtn');
    const text = document.getElementById('loginBtnText');
    if (!btn || !text) return;
    if (SYNC_MANAGER.isLoggedIn()) {
        text.textContent = SYNC_MANAGER.getUserEmail() || 'Logged in';
        btn.title = 'Logged in - click to manage';
    } else {
        text.textContent = 'Login';
        btn.title = 'Login / Cloud Sync';
    }
}

saveWorkspace = SYNC_MANAGER.wrapStorageSave(saveWorkspace, 'ide_files');

const _origCreateGitCommit = createGitCommit;
createGitCommit = function () {
    _origCreateGitCommit.apply(this, arguments);
    SYNC_MANAGER.pushToCloud('ide_commits');
};

const _origSaveBot = saveBot;
saveBot = function () {
    _origSaveBot.apply(this, arguments);
    SYNC_MANAGER.pushToCloud('ide_bots');
};

function setupIdeSyncUI() {
    const loginBtn = document.getElementById('loginBtn');
    const authModal = document.getElementById('authModal');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const authTabLogin = document.getElementById('authTabLogin');
    const authTabRegister = document.getElementById('authTabRegister');
    const authDbUrl = document.getElementById('authDbUrl');
    const authDbKey = document.getElementById('authDbKey');
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authError = document.getElementById('authError');

    if (!loginBtn || !authModal) return;

    let authMode = 'login';

    if (closeAuthModal) closeAuthModal.addEventListener('click', () => authModal.classList.add('hidden'));

    if (authTabLogin) {
        authTabLogin.addEventListener('click', () => {
            authMode = 'login';
            authTabLogin.className = 'flex-1 py-2 text-sm font-bold text-violet-400 border-b-2 border-violet-500 transition';
            authTabRegister.className = 'flex-1 py-2 text-sm font-bold text-gray-500 border-b-2 border-transparent transition';
            authSubmitBtn.textContent = 'Login';
            authError.classList.add('hidden');
        });
    }

    if (authTabRegister) {
        authTabRegister.addEventListener('click', () => {
            authMode = 'register';
            authTabRegister.className = 'flex-1 py-2 text-sm font-bold text-violet-400 border-b-2 border-violet-500 transition';
            authTabLogin.className = 'flex-1 py-2 text-sm font-bold text-gray-500 border-b-2 border-transparent transition';
            authSubmitBtn.textContent = 'Register';
            authError.classList.add('hidden');
        });
    }

    if (authSubmitBtn) {
        authSubmitBtn.addEventListener('click', async () => {
            const url = authDbUrl.value.trim();
            const key = authDbKey.value.trim();
            const email = authEmail.value.trim();
            const password = authPassword.value;

            if (!email || !password) {
                authError.textContent = 'Email and password are required';
                authError.classList.remove('hidden');
                return;
            }

            DB_CONNECTOR.configureFromUI(url, key);
            authSubmitBtn.disabled = true;
            authSubmitBtn.textContent = 'Processing...';
            authError.classList.add('hidden');

            try {
                if (authMode === 'login') {
                    await SYNC_MANAGER.loginAndSync(email, password);
                } else {
                    await SYNC_MANAGER.registerAndSync(email, password);
                }
                authModal.classList.add('hidden');
                updateLoginButton();
                authPassword.value = '';
            } catch (e) {
                authError.textContent = e.message || 'Authentication failed';
                authError.classList.remove('hidden');
            } finally {
                authSubmitBtn.disabled = false;
                authSubmitBtn.textContent = authMode === 'login' ? 'Login' : 'Register';
            }
        });
    }

    loginBtn.addEventListener('click', () => {
        if (SYNC_MANAGER.isLoggedIn()) {
            if (confirm('Logout from cloud sync?')) {
                SYNC_MANAGER.logout().then(() => updateLoginButton());
            }
        } else {
            authModal.classList.remove('hidden');
        }
    });
}

updateLoginButton();
setupIdeSyncUI();

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initWorkspace();
    initializeMonaco();

    if (SYNC_MANAGER.isLoggedIn()) {
        SYNC_MANAGER.pullAndMerge().then(() => {
            initWorkspace();
            if (codeEditor && activeFileName) {
                selectFile(activeFileName);
            }
            runPreview();
        }).catch(e => console.error('Initial IDE sync error:', e));
    }
});

