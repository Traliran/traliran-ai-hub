// ==================== STATE MANAGEMENT ====================

// VFS State
let vfsFiles = {}; // { path: { content, language, lastModified } }
let activeFilePath = null;
let openFiles = []; // Array of file paths
let monacoEditor = null;
let monacoModels = {}; // Cache of Monaco models by path

// Bot Store State
let customBots = [];
let activeBotId = null;
let editingBotId = null;

const OFFICIAL_BOTS = [
    {
        name: "UX Forge AI",
        description: "UX Forge AI analyzes your code inside the IDE for accessibility, performance, and modern UI patterns.",
        link: "https://whop.com/traliran-ai-huub/ux-forge-ai"
    },
];

// AI Agent State
let agentChatHistory = [];
let agentAbortController = null;
let isAgentProcessing = false;
let totalTokensUsed = 0;

// Version Control State
let commitHistory = [];

// Auth State
let isLoggedIn = false;

// API Configuration (synced from Hub)
let apiConfig = {
    provider: 'groq',
    apiKey: '',
    endpoint: '',
    model: ''
};

// ==================== DOM ELEMENTS ====================

let filesTabBtn, versionControlTabBtn;
let filesPanel, versionControlPanel;
let fileTreeContainer, openFilesTabs;
let commitMessageInput, createCommitBtn, commitHistoryList;
let exportZipBtn, importZipBtn, zipFileInput;
let newFileBtn, saveFileBtn, togglePreviewBtn, previewPanel, previewFrame, closePreviewBtn;
let monacoContainer;

// Bot Store DOM Elements
let openBotStoreBtn, botStoreModal, closeBotStoreModal, botStoreGrid, createNewBotBtn;
let exportBotsBtn, importBotsInput, botEditorModal, closeBotEditorModal, botEditorTitle;
let editBotName, editBotPrompt, editBotModel, editBotTemp, saveBotBtn, deleteBotBtn;

// AI Agent DOM Elements
let agentChatWindow, agentInput, sendAgentBtn, stopAgentBtn, agentStatusIndicator;
let agentModelDisplay, tokenUsageDisplay;

// Auth DOM Elements
let loginBtn, loginBtnText, loginModal, closeLoginModal, loginDbUrl, loginDbKey, loginEmail, loginPassword;
let doLoginBtn, doRegisterBtn, doLogoutBtn, loginStatus;

// ==================== PROVIDERS CONFIG ====================

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

// ==================== API CLIENT FUNCTIONS (from app.js) ====================

function normalizeContentToText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(part => {
            if (typeof part === 'string') return part;
            if (part?.type === 'text' || part?.type === 'input_text') return part.text || part.content || '';
            if (part?.type === 'image_url' || part?.type === 'image' || part?.type === 'input_image') return '[Image]';
            if (part?.type === 'video_url' || part?.type === 'video' || part?.type === 'input_video') return '[Video]';
            return '';
        }).join('');
    }
    return '';
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

async function fetchStreamingCompletion(endpoint, apiKey, hasKey, bodyPayload, providerName, signal, onDelta) {
    const headers = { 'Content-Type': 'application/json' };
    if (hasKey && apiKey) headers.Authorization = `Bearer ${apiKey}`;

    bodyPayload.stream = true;

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

    const reader = response.body?.getReader();
    if (!reader) {
        const result = await response.json();
        return { content: result.choices?.[0]?.message?.content || '' };
    }

    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\\n');
        buffer = lines.pop();
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            if (line === 'data: [DONE]') {
                continue;
            }
            if (line.startsWith('data:')) {
                const payload = line.slice(5).trim();
                if (!payload) continue;
                try {
                    const eventData = JSON.parse(payload);
                    const delta = eventData.choices?.[0]?.delta?.content || '';
                    accumulated += delta;
                    if (delta) onDelta(delta);
                } catch (error) {
                    // ignore parse errors for partial chunks
                }
            }
        }
    }

    return { content: accumulated };
}

// ==================== UTILITY FUNCTIONS ====================

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getLanguageFromPath(path) {
    const ext = path.split('.').pop().toLowerCase();
    const langMap = {
        'js': 'javascript', 'mjs': 'javascript',
        'ts': 'typescript', 'tsx': 'typescript',
        'html': 'html', 'htm': 'html',
        'css': 'css', 'scss': 'scss', 'sass': 'scss',
        'json': 'json',
        'md': 'markdown',
        'py': 'python',
        'java': 'java',
        'c': 'c', 'cpp': 'cpp', 'h': 'c', 'hpp': 'cpp',
        'cs': 'csharp',
        'go': 'go',
        'rs': 'rust',
        'php': 'php',
        'rb': 'ruby',
        'swift': 'swift',
        'kt': 'kotlin',
        'sql': 'sql',
        'sh': 'shell', 'bash': 'shell',
        'yaml': 'yaml', 'yml': 'yaml',
        'xml': 'xml',
        'vue': 'vue',
        'svelte': 'svelte'
    };
    return langMap[ext] || 'plaintext';
}

function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

// ==================== VFS (VIRTUAL FILE SYSTEM) ====================

const VFS = {
    async init() {
        console.log('[VFS] Initializing...');
        await this.loadFromStorage();
        this.setupEventListeners();
        console.log('[VFS] Initialized with', Object.keys(vfsFiles).length, 'files');
    },

    async loadFromStorage() {
        try {
            const stored = localStorage.getItem('ide_vfs_files');
            if (stored) {
                vfsFiles = JSON.parse(stored);
            }
            
            // Load commits
            const commitsStored = localStorage.getItem('ide_vfs_commits');
            if (commitsStored) {
                commitHistory = JSON.parse(commitsStored);
            }
            
            // If empty, create default files
            if (Object.keys(vfsFiles).length === 0) {
                await this.writeFile('README.md', '# Welcome to Traliran AI IDE\n\nStart coding! The AI agent can help you.\n');
                await this.writeFile('index.html', '<!DOCTYPE html>\n<html>\n<head>\n    <title>My App</title>\n</head>\n<body>\n    <h1>Hello World</h1>\n    <script src="app.js"><\/script>\n</body>\n</html>\n');
                await this.writeFile('app.js', '// Your JavaScript code here\nconsole.log("Hello from AI IDE!");\n');
                await this.writeFile('styles.css', '/* Your styles here */\nbody {\n    font-family: system-ui;\n    margin: 2rem;\n}\n');
            }
        } catch (e) {
            console.error('[VFS] Load error:', e);
            vfsFiles = {};
        }
    },

    async saveToStorage() {
        try {
            localStorage.setItem('ide_vfs_files', JSON.stringify(vfsFiles));
            window.dispatchEvent(new CustomEvent('vfs:saved'));
        } catch (e) {
            console.error('[VFS] Save error:', e);
        }
    },

    async writeFile(path, content) {
        console.log('[VFS WRITE]', path, 'bytes:', content.length);
        const language = getLanguageFromPath(path);
        
        vfsFiles[path] = {
            content,
            language,
            lastModified: Date.now()
        };

        await this.saveToStorage();
        
        // Emit update event
        window.dispatchEvent(new CustomEvent('vfs:file-updated', { 
            detail: { path, content, language } 
        }));

        // Sync to cloud if logged in
        if (isLoggedIn && DB_CONNECTOR.isLoggedIn()) {
            this.syncToCloud(path);
        }

        return vfsFiles[path];
    },

    async readFile(path) {
        console.log('[VFS READ]', path);
        const file = vfsFiles[path];
        if (!file) {
            throw new Error(`File not found: ${path}`);
        }
        return file.content;
    },

    async deleteFile(path) {
        console.log('[VFS DELETE]', path);
        delete vfsFiles[path];
        await this.saveToStorage();
        window.dispatchEvent(new CustomEvent('vfs:file-deleted', { detail: { path } }));
    },

    getFileTree() {
        const tree = {};
        for (const path of Object.keys(vfsFiles)) {
            const parts = path.split('/');
            let current = tree;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    current[part] = { type: 'file', path };
                } else {
                    if (!current[part]) {
                        current[part] = { type: 'folder', children: {} };
                    }
                    current = current[part].children;
                }
            }
        }
        return tree;
    },

    listFiles(dir = '') {
        const files = [];
        for (const path of Object.keys(vfsFiles)) {
            if (dir === '' || path.startsWith(dir + '/') || path.startsWith(dir)) {
                files.push(path);
            }
        }
        return files.sort();
    },

    setupEventListeners() {
        // Listen for Monaco changes
        window.addEventListener('monaco:content-changed', async (e) => {
            const { path, content } = e.detail;
            if (path && content !== undefined) {
                await this.writeFile(path, content);
            }
        });

        // Listen for VFS updates (from AI or other sources)
        window.addEventListener('vfs:file-updated', (e) => {
            const { path, content } = e.detail;
            if (path === activeFilePath && monacoEditor) {
                console.log('[MONACO REACTION] Updating editor for', path);
                const model = monacoEditor.getModel();
                if (model && model.getValue() !== content) {
                    model.setValue(content);
                }
            }
        });
    },

    async syncToCloud(path) {
        try {
            // Use SYNC_MANAGER if available for better queue handling
            if (typeof SYNC_MANAGER !== 'undefined' && SYNC_MANAGER.pushVFSFileToCloud) {
                await SYNC_MANAGER.pushVFSFileToCloud(path);
            } else {
                await DB_CONNECTOR.saveData('ide_vfs', path, vfsFiles[path]);
            }
            console.log('[VFS] Synced to cloud:', path);
        } catch (e) {
            console.error('[VFS] Cloud sync error:', e);
        }
    },

    async syncFromCloud() {
        if (!DB_CONNECTOR.isLoggedIn()) return;
        try {
            // Use SYNC_MANAGER if available for proper collection handling
            if (typeof SYNC_MANAGER !== 'undefined' && SYNC_MANAGER.pullFromCloud) {
                const data = await SYNC_MANAGER.pullFromCloud('ide_vfs');
                if (data && typeof data === 'object') {
                    vfsFiles = { ...vfsFiles, ...data };
                    await this.saveToStorage();
                    console.log('[VFS] Synced from cloud via SYNC_MANAGER');
                }
            } else {
                const data = await DB_CONNECTOR.fetchData('ide_vfs');
                if (data && typeof data === 'object') {
                    vfsFiles = { ...vfsFiles, ...data };
                    await this.saveToStorage();
                    console.log('[VFS] Synced from cloud');
                }
            }
        } catch (e) {
            console.error('[VFS] Cloud pull error:', e);
        }
    }
};

// ==================== VERSION CONTROL ====================

const VERSION_CONTROL = {
    async createCommit(message) {
        const commit = {
            id: 'commit_' + Date.now(),
            timestamp: Date.now(),
            message: message || 'Untitled commit',
            snapshot: JSON.parse(JSON.stringify(vfsFiles))
        };
        
        commitHistory.unshift(commit);
        localStorage.setItem('ide_vfs_commits', JSON.stringify(commitHistory));
        
        // Also save to IndexedDB for persistence
        if (typeof projectDB !== 'undefined' && projectDB.saveCommit) {
            try {
                await projectDB.saveCommit(commit);
            } catch (e) {
                console.error('[VERSION] IndexedDB save error:', e);
            }
        }
        
        console.log('[VERSION] Created commit:', commit.id);
        this.renderCommitHistory();
        return commit;
    },

    async revertToCommit(commitId) {
        const commit = commitHistory.find(c => c.id === commitId);
        if (!commit) {
            throw new Error('Commit not found');
        }
        
        vfsFiles = JSON.parse(JSON.stringify(commit.snapshot));
        await VFS.saveToStorage();
        
        // Refresh editor and file tree
        window.dispatchEvent(new CustomEvent('vfs:reverted', { detail: { commitId } }));
        
        console.log('[VERSION] Reverted to:', commitId);
        this.renderCommitHistory();
    },

    async loadCommitsFromStorage() {
        // Try IndexedDB first
        if (typeof projectDB !== 'undefined' && projectDB.getAllCommits) {
            try {
                const commits = await projectDB.getAllCommits();
                if (commits && commits.length > 0) {
                    commitHistory = commits;
                    localStorage.setItem('ide_vfs_commits', JSON.stringify(commitHistory));
                    console.log('[VERSION] Loaded', commits.length, 'commits from IndexedDB');
                    return;
                }
            } catch (e) {
                console.error('[VERSION] IndexedDB load error:', e);
            }
        }
        
        // Fallback to localStorage
        const stored = localStorage.getItem('ide_vfs_commits');
        if (stored) {
            try {
                commitHistory = JSON.parse(stored);
                console.log('[VERSION] Loaded', commitHistory.length, 'commits from localStorage');
            } catch (e) {
                commitHistory = [];
            }
        }
    },

    renderCommitHistory() {
        if (!commitHistoryList) return;
        
        commitHistoryList.innerHTML = '';
        
        if (commitHistory.length === 0) {
            commitHistoryList.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">No commits yet</p>';
            return;
        }
        
        for (const commit of commitHistory) {
            const date = new Date(commit.timestamp);
            const div = document.createElement('div');
            div.className = 'bg-gray-800 border border-gray-700 rounded p-2 cursor-pointer hover:border-violet-500 transition';
            div.innerHTML = `
                <div class="text-xs font-mono text-violet-400 truncate">${escapeHtml(commit.message)}</div>
                <div class="text-[10px] text-gray-500 mt-1">${date.toLocaleString()}</div>
                <div class="text-[10px] text-gray-600 mt-1">${Object.keys(commit.snapshot).length} files</div>
            `;
            div.onclick = () => {
                if (confirm(`Revert to this commit? This will replace current workspace.`)) {
                    this.revertToCommit(commit.id);
                }
            };
            commitHistoryList.appendChild(div);
        }
    },

    async exportAsZip() {
        if (typeof JSZip === 'undefined') {
            alert('ZIP library not loaded. Please check your internet connection.');
            return;
        }
        
        const zip = new JSZip();
        
        for (const [path, file] of Object.entries(vfsFiles)) {
            zip.file(path, file.content);
        }
        
        try {
            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'workspace-export-' + Date.now() + '.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            console.log('[VERSION] Exported as ZIP');
        } catch (e) {
            console.error('[VERSION] Export error:', e);
            alert('Failed to export ZIP: ' + e.message);
        }
    },

    async importFromZip(file) {
        try {
            const zip = new JSZip();
            const contents = await zip.loadAsync(file);
            
            const promises = [];
            contents.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir) {
                    promises.push(
                        zipEntry.async('string').then(content => {
                            VFS.writeFile(relativePath, content);
                        })
                    );
                }
            });
            
            await Promise.all(promises);
            console.log('[VERSION] Imported from ZIP');
            alert('Project imported successfully!');
        } catch (e) {
            console.error('[VERSION] Import error:', e);
            alert('Failed to import ZIP: ' + e.message);
        }
    }
};

// ==================== MONACO EDITOR INTEGRATION ====================

const MONACO = {
    async init() {
        return new Promise((resolve, reject) => {
            if (typeof require === 'undefined') {
                reject(new Error('Monaco loader not available'));
                return;
            }
            
            require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
            
            require(['vs/editor/editor.main'], () => {
                console.log('[MONACO] Loaded');
                this.createEditor();
                resolve();
            }, reject);
        });
    },

    createEditor() {
        if (!monacoContainer) return;
        
        monacoEditor = monaco.editor.create(monacoContainer, {
            value: '',
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: true },
            fontSize: 14,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
            tabSize: 2
        });

        // Debounced save on content change
        monacoEditor.onDidChangeModelContent(debounce(() => {
            if (activeFilePath) {
                const content = monacoEditor.getValue();
                console.log('[MONACO] Content changed, scheduling save');
                window.dispatchEvent(new CustomEvent('monaco:content-changed', {
                    detail: { path: activeFilePath, content }
                }));
            }
        }, 500));

        console.log('[MONACO] Editor created');
    },

    async openFile(path) {
        console.log('[MONACO OPEN]', path);
        
        if (!vfsFiles[path]) {
            console.error('[MONACO] File not in VFS:', path);
            return;
        }

        const file = vfsFiles[path];
        
        // Create or reuse model
        if (!monacoModels[path]) {
            monacoModels[path] = monaco.editor.createModel(
                file.content,
                file.language
            );
        } else {
            monacoModels[path].setValue(file.content);
        }

        monacoEditor.setModel(monacoModels[path]);
        activeFilePath = path;

        // Add to open files if not already
        if (!openFiles.includes(path)) {
            openFiles.push(path);
        }

        this.renderTabs();
        console.log('[MONACO REACTION] Opened', path);
    },

    closeFile(path) {
        const idx = openFiles.indexOf(path);
        if (idx > -1) {
            openFiles.splice(idx, 1);
        }

        if (activeFilePath === path) {
            if (openFiles.length > 0) {
                this.openFile(openFiles[Math.max(0, idx - 1)]);
            } else {
                activeFilePath = null;
                monacoEditor.setModel(null);
            }
        }

        this.renderTabs();
    },

    renderTabs() {
        if (!openFilesTabs) return;
        
        openFilesTabs.innerHTML = '';
        
        for (const path of openFiles) {
            const isActive = path === activeFilePath;
            const fileName = path.split('/').pop();
            
            const tab = document.createElement('div');
            tab.className = `flex items-center gap-2 px-3 py-2 text-xs border-r border-gray-800 cursor-pointer whitespace-nowrap ${
                isActive ? 'bg-gray-800 text-violet-400 border-b-2 border-b-violet-400' : 'text-gray-400 hover:bg-gray-800/50'
            }`;
            tab.innerHTML = `
                <span>${this.getFileIcon(path)} ${escapeHtml(fileName)}</span>
                <button class="hover:text-white ml-1" data-path="${path}">×</button>
            `;
            
            tab.onclick = (e) => {
                if (e.target.dataset.path) {
                    this.closeFile(e.target.dataset.path);
                } else {
                    this.openFile(path);
                }
            };
            
            openFilesTabs.appendChild(tab);
        }
    },

    getFileIcon(path) {
        const ext = path.split('.').pop().toLowerCase();
        const icons = {
            'js': '📜', 'mjs': '📜',
            'ts': '📘', 'tsx': '⚛️',
            'html': '🌐', 'htm': '🌐',
            'css': '🎨', 'scss': '🎨',
            'json': '📋',
            'md': '📝',
            'py': '🐍',
            'vue': '💚',
            'svelte': '🔷'
        };
        return icons[ext] || '📄';
    },

    getCurrentContent() {
        if (!monacoEditor || !activeFilePath) return null;
        return monacoEditor.getValue();
    }
};

// ==================== AI AGENT WITH TOOL CALLING ====================

const AI_AGENT = {
    tools: [
        {
            name: 'list_files',
            description: 'Returns the directory structure/tree of the workspace',
            parameters: {
                type: 'object',
                properties: {
                    directory: { type: 'string', description: 'Optional directory path to list (default: root)' }
                },
                required: [],
                additionalProperties: false
            },
            execute: async (args) => {
                const dir = args.directory || '';
                const files = VFS.listFiles(dir);
                return JSON.stringify({ files }, null, 2);
            }
        },
        {
            name: 'read_file',
            description: 'Fetches full content of a specific file',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Full path to the file' }
                },
                required: ['path'],
                additionalProperties: false
            },
            execute: async (args) => {
                try {
                    const content = await VFS.readFile(args.path);
                    return JSON.stringify({ success: true, content }, null, 2);
                } catch (e) {
                    return JSON.stringify({ success: false, error: e.message }, null, 2);
                }
            }
        },
        {
            name: 'write_file',
            description: 'Creates or overwrites a file with new content',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Full path where to write the file' },
                    content: { type: 'string', description: 'Complete file content' }
                },
                required: ['path', 'content'],
                additionalProperties: false
            },
            execute: async (args) => {
                try {
                    await VFS.writeFile(args.path, args.content);
                    return JSON.stringify({ success: true, message: `File written: ${args.path}` }, null, 2);
                } catch (e) {
                    return JSON.stringify({ success: false, error: e.message }, null, 2);
                }
            }
        },
        {
            name: 'edit_file_part',
            description: 'Edits part of a file by searching for pattern and replacing it',
            parameters: {
                type: 'object',
                properties: {
                    path: { type: 'string', description: 'Full path to the file' },
                    search_pattern: { type: 'string', description: 'Text or regex pattern to find' },
                    replace_content: { type: 'string', description: 'Content to replace the match with' }
                },
                required: ['path', 'search_pattern', 'replace_content'],
                additionalProperties: false
            },
            execute: async (args) => {
                try {
                    const content = await VFS.readFile(args.path);
                    const regex = new RegExp(args.search_pattern, 'g');
                    if (!regex.test(content)) {
                        return JSON.stringify({ success: false, error: 'Pattern not found in file' }, null, 2);
                    }
                    const newContent = content.replace(regex, args.replace_content);
                    await VFS.writeFile(args.path, newContent);
                    return JSON.stringify({ success: true, message: 'File updated successfully' }, null, 2);
                } catch (e) {
                    return JSON.stringify({ success: false, error: e.message }, null, 2);
                }
            }
        }
    ],

    async sendMessage(userMessage) {
        if (isAgentProcessing) return;
        
        isAgentProcessing = true;
        agentAbortController = new AbortController();
        
        this.addMessageToChat('user', userMessage);
        agentInput.value = '';
        
        const statusEl = document.getElementById('agentStatusIndicator');
        statusEl.textContent = 'Thinking...';
        statusEl.classList.add('text-violet-400');

        try {
            // Get active bot if any
            const activeBot = customBots.find(b => b.id === activeBotId);
            
            // Build system prompt
            const systemPrompt = activeBot 
                ? activeBot.prompt 
                : `You are an expert AI coding assistant integrated into a web-based IDE. You have access to the user's file system through tool calls.

IMPORTANT RULES:
1. Always use tools to interact with files - NEVER make up file contents
2. First request: Use list_files() to see the project structure
3. Before modifying: Use read_file() to understand current code
4. Make targeted changes using edit_file_part() when possible
5. Use write_file() only for new files or complete rewrites
6. Explain what you're doing before and after tool calls
7. If asked general questions, analyze code via tools first, then answer without modifying files
8. Work step-by-step - don't try everything in one call

Be helpful, precise, and professional. All communication must be in English.`;

            // Initial context: file tree only
            const fileTree = VFS.getFileTree();
            const initialContext = `Current workspace structure:\n${JSON.stringify(fileTree, null, 2)}`;

            // Build messages array
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: initialContext },
                ...agentChatHistory.slice(-10), // Last 10 messages for context
                { role: 'user', content: userMessage }
            ];

            // Get API config
            const provider = apiConfig.provider || localStorage.getItem('gem_provider') || 'groq';
            const apiKey = apiConfig.apiKey || localStorage.getItem('gem_key_' + provider) || '';
            const model = apiConfig.model || localStorage.getItem('gem_model') || '';
            const baseEndpoint = PROVIDERS[provider]?.url || '';

            if (!apiKey && PROVIDERS[provider]?.hasKey) {
                this.addMessageToChat('assistant', '⚠️ Please configure your API key in Settings first.');
                isAgentProcessing = false;
                statusEl.textContent = 'Error';
                return;
            }

            // Execute tool loop
            await this.executeToolLoop(messages, provider, apiKey, model, baseEndpoint);

        } catch (e) {
            console.error('[AI AGENT] Error:', e);
            this.addMessageToChat('assistant', `❌ Error: ${e.message}`);
        } finally {
            isAgentProcessing = false;
            agentAbortController = null;
            statusEl.textContent = 'Ready';
            statusEl.classList.remove('text-violet-400');
        }
    },

    async executeToolLoop(messages, provider, apiKey, model, endpoint, maxIterations = 10) {
        let iterations = 0;
        
        // Build tool definitions for system prompt
        const toolDescriptions = this.tools.map(t => {
            const params = t.parameters.properties || {};
            const paramList = Object.entries(params).map(([name, schema]) => {
                const type = schema.type || 'string';
                const desc = schema.description || '';
                const required = t.parameters.required?.includes(name) ? '(required)' : '(optional)';
                return `  - ${name} (${type}, ${required}): ${desc}`;
            }).join('\n');
            
            return `### ${t.name}\nDescription: ${t.description}\nParameters:\n${paramList}`;
        }).join('\n\n');

        // Add tool instructions to system message
        const systemPrompt = `You are an AI assistant in a code IDE. You can use the following tools to interact with the file system and editor:

${toolDescriptions}

To call a tool, respond with a JSON object in this exact format:
{"tool": "tool_name", "arguments": {"param1": "value1", "param2": "value2"}}

Only output the JSON object when you want to call a tool. Do not include any other text.
If you need to make multiple tool calls, wait for the results before making the next call.
If no tool is needed, just respond normally with your answer.`;

        // Inject or replace system message
        const existingSystemIndex = messages.findIndex(msg => msg.role === 'system');
        if (existingSystemIndex !== -1) {
            const existingContent = typeof messages[existingSystemIndex].content === 'string' 
                ? messages[existingSystemIndex].content 
                : normalizeContentToText(messages[existingSystemIndex].content);
            messages[existingSystemIndex].content = systemPrompt + '\n\n' + existingContent;
        } else {
            messages.unshift({ role: 'system', content: systemPrompt });
        }
        
        while (iterations < maxIterations) {
            iterations++;
            console.log(`[AI TOOL CALL] Iteration ${iterations}`);

            const response = await this.callLLM(messages, provider, apiKey, model, endpoint);
            
            if (!response) break;

            const { content, toolCalls } = response;
            totalTokensUsed += response.usage?.total_tokens || 0;
            this.updateTokenDisplay();

            // If no tool calls, just show response and exit
            if (!toolCalls || toolCalls.length === 0) {
                if (content) {
                    this.addMessageToChat('assistant', content);
                    agentChatHistory.push({ role: 'assistant', content });
                }
                break;
            }

            // Execute tool calls
            for (const toolCall of toolCalls) {
                const tool = this.tools.find(t => t.name === toolCall.function.name);
                
                if (tool) {
                    console.log('[AI TOOL CALL] Executing:', toolCall.function.name);
                    
                    let args;
                    try {
                        args = JSON.parse(toolCall.function.arguments);
                    } catch (e) {
                        args = {};
                    }

                    const result = await tool.execute(args);
                    
                    // Add tool result to messages as a user message with context
                    // We use 'user' role instead of 'tool' to avoid API errors when tools aren't defined
                    messages.push({
                        role: 'user',
                        content: `[Tool result from ${toolCall.function.name}]: ${result}`
                    });

                    // Show brief notification in chat
                    this.addToolNotification(toolCall.function.name, args);
                }
            }

            // Continue loop with tool results
        }

        if (iterations >= maxIterations) {
            this.addMessageToChat('assistant', '⚠️ Reached maximum iteration limit. Please refine your request.');
        }
    },

    async callLLM(messages, provider, apiKey, model, endpoint) {
        console.log('[AI TOOL CALL] Calling LLM:', provider, model);
        
        const url = endpoint || PROVIDERS[provider]?.url;
        const hasKey = PROVIDERS[provider]?.hasKey !== false;
        const providerConfig = PROVIDERS[provider];
        
        // Tools are now in system prompt, no need to send via API
        
        try {
            // Handle Anthropic (Claude) separately
            if (providerConfig?.type === 'anthropic') {
                console.log('[AI TOOL CALL] Using Anthropic API');
                const headers = {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                };

                const systemMessage = messages.find(msg => msg.role === 'system');
                const userMessages = messages.filter(msg => msg.role !== 'system').map(msg => ({
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: convertContentForAnthropic(msg.content)
                }));

                const anthropicPayload = {
                    model: model,
                    max_tokens: 4096,
                    messages: userMessages,
                    temperature: 0.7
                    // No tools sent - they're in system prompt
                };

                if (systemMessage) {
                    anthropicPayload.system = typeof systemMessage.content === 'string' 
                        ? systemMessage.content 
                        : normalizeContentToText(systemMessage.content);
                }

                const resp = await fetch(url + '/messages', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(anthropicPayload),
                    signal: agentAbortController?.signal
                });

                if (!resp.ok) {
                    const errJson = await resp.json().catch(() => ({}));
                    throw new Error(errJson.error?.message || `HTTP ${resp.status}`);
                }

                const data = await resp.json();
                const content = data.content?.[0]?.text || '';
                
                // Try to parse tool call from text content
                const toolCalls = this.parseToolCallsFromText(content);

                return {
                    content: content,
                    toolCalls: toolCalls,
                    usage: data.usage
                };
            }

            // For OpenAI-compatible APIs (Groq, OpenAI, etc.)
            console.log('[AI TOOL CALL] Using OpenAI-compatible API');
            const headers = { 'Content-Type': 'application/json' };
            
            if (hasKey && apiKey) {
                if (provider === 'openrouter') {
                    headers['Authorization'] = `Bearer ${apiKey}`;
                    headers['HTTP-Referer'] = window.location.origin;
                    headers['X-Title'] = 'Traliran AI IDE';
                } else {
                    headers['Authorization'] = `Bearer ${apiKey}`;
                }
            }

            // Filter out 'tool' role messages as we emulate tools via text
            // Sending 'tool' role without defined tools causes API errors
            const cleanMessages = messages.filter(msg => msg.role !== 'tool');

            const payload = {
                model: model,
                messages: cleanMessages,
                temperature: 0.7
                // No tools sent - they're in system prompt
            };

            const resp = await fetch(url + '/chat/completions', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: agentAbortController?.signal
            });

            if (!resp.ok) {
                const errText = await resp.text().catch(() => '');
                let errJson = {};
                try { errJson = JSON.parse(errText); } catch {}
                const errMsg = errJson.error?.message || errJson.message || `HTTP ${resp.status}`;
                throw new Error(`API Error (${resp.status}): ${errMsg}`);
            }

            const data = await resp.json();
            const choice = data.choices[0]?.message;
            const content = choice?.content || '';
            console.log('[AI TOOL CALL] Response content:', content);
            
            // Try to parse tool calls from text content
            const toolCalls = this.parseToolCallsFromText(content);
            console.log('[AI TOOL CALL] Parsed tool calls:', toolCalls);

            return {
                content: content,
                toolCalls: toolCalls,
                usage: data.usage
            };

        } catch (e) {
            if (e.name === 'AbortError') {
                this.addMessageToChat('assistant', '⏹️ Request stopped by user.');
            } else {
                console.error('[AI TOOL CALL] Error:', e);
                throw new Error('Failed to connect to AI service: ' + e.message);
            }
        }
    },

    // Parse tool calls from text response (JSON format)
    parseToolCallsFromText(content) {
        if (!content) return [];
        
        try {
            // Try to find JSON object in the content
            const jsonMatch = content.match(/\{[\s\S]*"tool"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
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
            // Not a valid JSON tool call
        }
        
        return [];
    },

    addMessageToChat(role, content) {
        if (!agentChatWindow) return;

        const div = document.createElement('div');
        div.className = role === 'user' 
            ? 'bg-violet-900/30 border border-violet-800 rounded-lg p-3 text-sm ml-8'
            : 'bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-sm mr-8';

        // Parse markdown for assistant messages
        const formattedContent = role === 'assistant' ? marked.parse(content) : escapeHtml(content);
        
        div.innerHTML = `
            <div class="font-semibold text-xs mb-1 ${role === 'user' ? 'text-violet-400' : 'text-gray-400'}">
                ${role === 'user' ? '👤 You' : '🤖 Assistant'}
            </div>
            <div class="prose prose-invert prose-sm max-w-none text-gray-200">${formattedContent}</div>
        `;

        agentChatWindow.appendChild(div);
        agentChatWindow.scrollTop = agentChatWindow.scrollHeight;
    },

    addToolNotification(toolName, args) {
        if (!agentChatWindow) return;

        const div = document.createElement('div');
        div.className = 'bg-gray-900/50 border border-gray-800 rounded p-2 text-[10px] text-gray-500 my-1';
        
        let argStr = Object.entries(args).map(([k, v]) => `${k}: ${v}`).join(', ');
        if (argStr.length > 80) argStr = argStr.substring(0, 77) + '...';
        
        div.innerHTML = `🔧 <span class="text-violet-400">${toolName}</span>(${argStr})`;
        agentChatWindow.appendChild(div);
        agentChatWindow.scrollTop = agentChatWindow.scrollHeight;
    },

    updateTokenDisplay() {
        if (tokenUsageDisplay) {
            tokenUsageDisplay.textContent = `Tokens: ${totalTokensUsed.toLocaleString()}`;
        }
    },

    stopGeneration() {
        if (agentAbortController) {
            agentAbortController.abort();
        }
    }
};

// ==================== BOT STORE (per assistant-store.md) ====================

function renderBotStore() {
    if (!botStoreGrid) return;
    
    botStoreGrid.innerHTML = '';
    
    // Official/Premium Bots Section
    const premiumSection = document.createElement('div');
    premiumSection.className = 'col-span-full';
    premiumSection.innerHTML = '<h3 class="text-sm font-bold text-amber-400 mb-3">🌟 Premium Assistants</h3>';
    botStoreGrid.appendChild(premiumSection);
    
    const premiumGrid = document.createElement('div');
    premiumGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4 col-span-full';
    
    OFFICIAL_BOTS.forEach(bot => {
        const card = document.createElement('div');
        card.className = 'bg-gray-800/50 border border-amber-900/50 rounded-xl p-4 space-y-2';
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <h4 class="font-bold text-amber-300">${escapeHtml(bot.name)}</h4>
                <span class="text-[10px] bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded">PREMIUM</span>
            </div>
            <p class="text-xs text-gray-400 line-clamp-2">${escapeHtml(bot.description)}</p>
            <a href="${bot.link}" target="_blank" class="block text-center bg-amber-600 hover:bg-amber-700 text-white text-xs py-2 rounded-lg transition">
                🔗 Get on Whop
            </a>
        `;
        premiumGrid.appendChild(card);
    });
    
    botStoreGrid.appendChild(premiumGrid);
    
    // Custom Bots Section
    const customSection = document.createElement('div');
    customSection.className = 'col-span-full mt-4';
    customSection.innerHTML = '<h3 class="text-sm font-bold text-gray-400 mb-3">📁 Your Custom Assistants</h3>';
    botStoreGrid.appendChild(customSection);
    
    if (customBots.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'col-span-full text-center py-8 border-2 border-dashed border-gray-800 rounded-xl';
        emptyState.innerHTML = `
            <div class="text-4xl mb-2">🏪</div>
            <p class="text-sm text-gray-500">Your custom store is empty. Create your first assistant or import a preset!</p>
        `;
        botStoreGrid.appendChild(emptyState);
    } else {
        const customGrid = document.createElement('div');
        customGrid.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4 col-span-full';
        
        customBots.forEach(bot => {
            const isActive = bot.id === activeBotId;
            const card = document.createElement('div');
            card.className = `bg-gray-800/50 border rounded-xl p-4 space-y-2 ${isActive ? 'border-amber-500 ring-1 ring-amber-500' : 'border-gray-700 hover:border-gray-600'}`;
            card.innerHTML = `
                <div class="flex justify-between items-start">
                    <h4 class="font-bold text-gray-200">${escapeHtml(bot.name)}</h4>
                    ${isActive ? '<span class="text-[10px] bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded">ACTIVE</span>' : ''}
                </div>
                <p class="text-xs text-gray-400 line-clamp-2 h-8 overflow-hidden">${escapeHtml(bot.prompt)}</p>
                <div class="flex gap-2 pt-2">
                    <button onclick="useBot('${bot.id}')" class="flex-1 ${isActive ? 'bg-gray-700 text-gray-400 cursor-default' : 'bg-amber-600 hover:bg-amber-700 text-white'} text-xs py-1.5 rounded transition">
                        ${isActive ? 'Using' : 'Use'}
                    </button>
                    <button onclick="openBotEditor('${bot.id}')" class="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs py-1.5 rounded transition">
                        ✏️ Edit
                    </button>
                </div>
            `;
            customGrid.appendChild(card);
        });
        
        botStoreGrid.appendChild(customGrid);
    }
}

function openBotEditor(botId = null) {
    editingBotId = botId;
    
    if (botId) {
        const bot = customBots.find(b => b.id === botId);
        if (bot) {
            botEditorTitle.textContent = 'Edit Assistant';
            editBotName.value = bot.name;
            editBotPrompt.value = bot.prompt;
            editBotModel.value = bot.model || '';
            editBotTemp.value = bot.temp || 0.7;
        }
    } else {
        botEditorTitle.textContent = 'Create New Assistant';
        editBotName.value = '';
        editBotPrompt.value = '';
        editBotModel.value = apiConfig.model || '';
        editBotTemp.value = 0.7;
    }
    
    // Populate model dropdown
    editBotModel.innerHTML = '';
    const currentModel = localStorage.getItem('gem_model') || apiConfig.model;
    if (currentModel) {
        const opt = document.createElement('option');
        opt.value = currentModel;
        opt.textContent = currentModel + ' (Current)';
        editBotModel.appendChild(opt);
    }
    
    botEditorModal.classList.remove('hidden');
}

function useBot(botId) {
    activeBotId = botId;
    localStorage.setItem('ide_active_bot_id', botId);
    renderBotStore();
    
    // Show notification
    const bot = customBots.find(b => b.id === botId);
    if (bot && agentChatWindow) {
        const notif = document.createElement('div');
        notif.className = 'bg-amber-900/30 border border-amber-700 rounded-lg p-3 text-xs text-amber-300 animate-pulse';
        notif.innerHTML = `✅ Now using: <strong>${escapeHtml(bot.name)}</strong>`;
        agentChatWindow.appendChild(notif);
        setTimeout(() => notif.remove(), 3000);
        agentChatWindow.scrollTop = agentChatWindow.scrollHeight;
    }
}

function saveBot() {
    const name = editBotName.value.trim();
    const prompt = editBotPrompt.value.trim();
    
    if (!name || !prompt) {
        alert('Please provide both name and system prompt.');
        return;
    }
    
    const temp = parseFloat(editBotTemp.value) || 0.7;
    
    if (editingBotId) {
        // Update existing
        const idx = customBots.findIndex(b => b.id === editingBotId);
        if (idx > -1) {
            customBots[idx] = {
                ...customBots[idx],
                name,
                prompt,
                model: editBotModel.value,
                temp
            };
        }
    } else {
        // Create new
        const newBot = {
            id: 'bot_' + Date.now(),
            name,
            prompt,
            model: editBotModel.value,
            temp
        };
        customBots.push(newBot);
    }
    
    localStorage.setItem('ide_custom_bots', JSON.stringify(customBots));
    botEditorModal.classList.add('hidden');
    renderBotStore();
}

function deleteBot() {
    if (!editingBotId) return;
    
    if (!confirm('Delete this assistant?')) return;
    
    customBots = customBots.filter(b => b.id !== editingBotId);
    
    if (activeBotId === editingBotId) {
        activeBotId = null;
        localStorage.removeItem('ide_active_bot_id');
    }
    
    localStorage.setItem('ide_custom_bots', JSON.stringify(customBots));
    botEditorModal.classList.add('hidden');
    renderBotStore();
}

function exportBots() {
    const json = JSON.stringify(customBots, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'traliran-ide-bots.json';
    a.click();
    
    URL.revokeObjectURL(url);
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
                localStorage.setItem('ide_custom_bots', JSON.stringify(customBots));
                renderBotStore();
                alert(`Imported ${imported.length} assistant(s)!`);
            } else {
                throw new Error('Invalid format');
            }
        } catch (err) {
            alert('Failed to import: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// Expose to window for onclick handlers
window.useBot = useBot;
window.openBotEditor = openBotEditor;


// ==================== API SETTINGS PANEL ====================

function switchRightTab(tabName) {
    const agentPanel = document.getElementById('panelAgent');
    const settingsPanel = document.getElementById('panelSettings');
    const agentBtn = document.getElementById('tabBtnAgent');
    const settingsBtn = document.getElementById('tabBtnSettings');

    if (tabName === 'agent') {
        agentPanel.classList.remove('hidden');
        settingsPanel.classList.add('hidden');
        agentBtn.classList.add('text-violet-400', 'border-b-2', 'border-violet-400', 'bg-gray-800/50');
        agentBtn.classList.remove('text-gray-400');
        settingsBtn.classList.remove('text-violet-400', 'border-b-2', 'border-violet-400', 'bg-gray-800/50');
        settingsBtn.classList.add('text-gray-400');
    } else {
        agentPanel.classList.add('hidden');
        settingsPanel.classList.remove('hidden');
        settingsBtn.classList.add('text-violet-400', 'border-b-2', 'border-violet-400', 'bg-gray-800/50');
        settingsBtn.classList.remove('text-gray-400');
        agentBtn.classList.remove('text-violet-400', 'border-b-2', 'border-violet-400', 'bg-gray-800/50');
        agentBtn.classList.add('text-gray-400');
        loadSettingsIntoForm();
    }
}

function loadSettingsIntoForm() {
    const providerSelect = document.getElementById('apiProvider');
    const apiKeyInput = document.getElementById('apiKey');
    const apiModelSelect = document.getElementById('apiModel');
    const apiBaseUrlInput = document.getElementById('apiBaseUrl');
    const customUrlGroup = document.getElementById('customUrlGroup');

    if (providerSelect) providerSelect.value = apiConfig.provider || 'groq';
    if (apiKeyInput) apiKeyInput.value = apiConfig.apiKey || '';
    if (apiBaseUrlInput) apiBaseUrlInput.value = apiConfig.endpoint || '';
    if (customUrlGroup) customUrlGroup.classList.toggle('hidden', apiConfig.provider !== 'custom');

    // Populate models first, then restore saved value
    updateModelSuggestions().then(() => {
        if (apiConfig.model && apiModelSelect) {
            if ([...apiModelSelect.options].some(o => o.value === apiConfig.model)) {
                apiModelSelect.value = apiConfig.model;
            } else {
                const opt = document.createElement('option');
                opt.value = apiConfig.model;
                opt.textContent = apiConfig.model + ' (saved)';
                apiModelSelect.appendChild(opt);
                apiModelSelect.value = apiConfig.model;
            }
        }
    });
}

function updateModelSuggestions() {
    const provider = document.getElementById('apiProvider').value;
    const modelSelect = document.getElementById('apiModel');
    const hint = document.getElementById('modelHint');
    const customUrlGroup = document.getElementById('customUrlGroup');

    if (customUrlGroup) customUrlGroup.classList.toggle('hidden', provider !== 'custom');
    if (hint) hint.textContent = 'Enter API key to load available models.';

    return fetchActiveModels();
}

async function fetchActiveModels() {
    const provider = document.getElementById('apiProvider').value;
    const modelSelect = document.getElementById('apiModel');
    const hint = document.getElementById('modelHint');
    const apiKey = document.getElementById('apiKey').value.trim();
    // Map 'anthropic' (HTML select value) to 'claude' (PROVIDERS key)
    const providerKey = provider === 'anthropic' ? 'claude' : provider;
    const providerConfig = PROVIDERS[providerKey];
    const hasKey = providerConfig?.hasKey !== false;
    const endpoint = document.getElementById('apiBaseUrl').value.trim() || providerConfig?.url || '';

    if (hasKey && !apiKey) {
        modelSelect.innerHTML = '<option value="">(Enter API key to load models)</option>';
        if (hint) hint.textContent = 'Paste your API key above and click refresh.';
        return;
    }

    const previousValue = modelSelect.value;
    modelSelect.innerHTML = '<option value="">Loading models...</option>';

    try {
        if (providerKey === 'claude') {
            const fallbackModels = ['claude-3-5-sonnet-latest', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'];
            modelSelect.innerHTML = '';
            fallbackModels.forEach(m => modelSelect.add(new Option(m, m)));
            if (previousValue && [...modelSelect.options].some(o => o.value === previousValue)) {
                modelSelect.value = previousValue;
            }
            if (hint) hint.textContent = `${fallbackModels.length} models loaded (static list for Anthropic).`;
            return;
        }

        const headers = { 'Content-Type': 'application/json' };
        if (hasKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const response = await fetch(`${endpoint}/models`, { method: 'GET', headers });
        if (!response.ok) throw new Error(`Status: ${response.status}`);

        const json = await response.json();
        let models = json.data && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);

        models = models.filter(m => {
            const id = (m.id || m.name || '').toLowerCase();
            return !id.includes('whisper') && !id.includes('tts') && !id.includes('embed') && !id.includes('guard');
        });

        if (models.length === 0) {
            modelSelect.innerHTML = '<option value="">No models found</option>';
            if (hint) hint.textContent = 'No chat models available for this provider.';
            return;
        }

        modelSelect.innerHTML = '';
        models.forEach(m => {
            const modelId = m.id || m.name;
            modelSelect.add(new Option(modelId, modelId));
        });

        if (previousValue && [...modelSelect.options].some(o => o.value === previousValue)) {
            modelSelect.value = previousValue;
        }
        if (hint) hint.textContent = `${models.length} models loaded. Select one above.`;
    } catch (err) {
        console.error('[MODEL FETCH]', err);
        modelSelect.innerHTML = '<option value="">Error loading models</option>';
        if (hint) hint.textContent = 'Failed to fetch: ' + err.message;
    }
}

async function saveApiSettings() {
    const provider = document.getElementById('apiProvider').value;
    const apiKey = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('apiModel').value.trim();
    const baseUrl = document.getElementById('apiBaseUrl').value.trim();
    const statusEl = document.getElementById('settingsStatus');

    if (!apiKey) {
        statusEl.textContent = '✗ API Key required';
        statusEl.className = 'text-center text-xs mt-2 h-4 text-red-400';
        return;
    }
    if (!model) {
        statusEl.textContent = '✗ Model name required';
        statusEl.className = 'text-center text-xs mt-2 h-4 text-red-400';
        return;
    }

    try {
        localStorage.setItem('gem_provider', provider);
        localStorage.setItem('gem_key_' + provider, apiKey);
        localStorage.setItem('gem_model', model);
        if (baseUrl) localStorage.setItem('gem_endpoint', baseUrl);

        apiConfig.provider = provider;
        apiConfig.apiKey = apiKey;
        apiConfig.model = model;
        apiConfig.endpoint = baseUrl;

        if (agentModelDisplay) agentModelDisplay.textContent = `Model: ${model}`;

        statusEl.textContent = '✓ Settings saved!';
        statusEl.className = 'text-center text-xs mt-2 h-4 text-green-400';

        setTimeout(() => switchRightTab('agent'), 1000);
    } catch (e) {
        statusEl.textContent = '✗ Error: ' + e.message;
        statusEl.className = 'text-center text-xs mt-2 h-4 text-red-400';
    }
}

window.switchRightTab = switchRightTab;
window.updateModelSuggestions = updateModelSuggestions;
window.saveApiSettings = saveApiSettings;
window.fetchActiveModels = fetchActiveModels;

// ==================== AUTH & SETTINGS SYNC ====================

function loadApiConfig() {
    apiConfig.provider = localStorage.getItem('gem_provider') || 'groq';
    apiConfig.apiKey = localStorage.getItem('gem_key_' + apiConfig.provider) || '';
    apiConfig.endpoint = localStorage.getItem('gem_endpoint') || '';
    apiConfig.model = localStorage.getItem('gem_model') || '';
    
    if (agentModelDisplay) {
        agentModelDisplay.textContent = `Model: ${apiConfig.model || '--'}`;
    }
}

function updateAuthUI() {
    isLoggedIn = DB_CONNECTOR.isLoggedIn();
    
    if (loginBtnText) {
        loginBtnText.textContent = isLoggedIn ? DB_CONNECTOR.getUserEmail() : 'Login';
    }
    
    if (doLogoutBtn) {
        doLogoutBtn.classList.toggle('hidden', !isLoggedIn);
    }
    
    if (doLoginBtn && doRegisterBtn) {
        doLoginBtn.classList.toggle('hidden', isLoggedIn);
        doRegisterBtn.classList.toggle('hidden', isLoggedIn);
    }
}

async function handleLogin(email, password) {
    try {
        const dbUrl = loginDbUrl.value.trim();
        const dbKey = loginDbKey.value.trim();
        
        if (!dbUrl) {
            loginStatus.textContent = '✗ Database URL required';
            return;
        }
        
        // Save DB config first
        DB_CONNECTOR.setConfig(dbUrl, dbKey);
        localStorage.setItem('gem_db_url', dbUrl);
        localStorage.setItem('gem_db_key', dbKey);
        
        loginStatus.textContent = 'Logging in...';
        await DB_CONNECTOR.login(email, password);
        updateAuthUI();
        loginStatus.textContent = '✓ Logged in!';
        setTimeout(() => loginModal.classList.add('hidden'), 1000);
        
        // Sync VFS from cloud
        await VFS.syncFromCloud();
    } catch (e) {
        loginStatus.textContent = '✗ ' + e.message;
    }
}

async function handleRegister(email, password) {
    try {
        const dbUrl = loginDbUrl.value.trim();
        const dbKey = loginDbKey.value.trim();
        
        if (!dbUrl) {
            loginStatus.textContent = '✗ Database URL required';
            return;
        }
        
        // Save DB config first
        DB_CONNECTOR.setConfig(dbUrl, dbKey);
        localStorage.setItem('gem_db_url', dbUrl);
        localStorage.setItem('gem_db_key', dbKey);
        
        loginStatus.textContent = 'Registering...';
        await DB_CONNECTOR.register(email, password);
        updateAuthUI();
        loginStatus.textContent = '✓ Registered!';
        setTimeout(() => loginModal.classList.add('hidden'), 1000);
    } catch (e) {
        loginStatus.textContent = '✗ ' + e.message;
    }
}

async function handleLogout() {
    await DB_CONNECTOR.logout();
    updateAuthUI();
    loginModal.classList.add('hidden');
}

// ==================== LIVE PREVIEW ====================

const PREVIEW = {
    isVisible: false,
    
    toggle() {
        this.isVisible = !this.isVisible;
        previewPanel.classList.toggle('hidden', !this.isVisible);
        
        if (this.isVisible) {
            this.render();
        }
    },
    
    render() {
        if (!previewFrame) return;
        
        // Find HTML file to preview
        let htmlContent = '';
        let cssContent = '';
        let jsContent = '';
        
        // Look for index.html or main HTML file
        const htmlFiles = Object.keys(vfsFiles).filter(p => p.endsWith('.html'));
        const mainHtml = htmlFiles.find(p => p.includes('index')) || htmlFiles[0];
        
        if (mainHtml) {
            htmlContent = vfsFiles[mainHtml].content;
        }
        
        // Inject CSS
        const cssFiles = Object.keys(vfsFiles).filter(p => p.endsWith('.css'));
        if (cssFiles.length > 0) {
            const styleTag = '<style>\n' + cssFiles.map(f => vfsFiles[f].content).join('\n') + '\n</style>';
            htmlContent = htmlContent.replace('</head>', styleTag + '</head>');
        }
        
        // Inject JS
        const jsFiles = Object.keys(vfsFiles).filter(p => p.endsWith('.js'));
        if (jsFiles.length > 0) {
            const scriptTag = '<script>\n' + jsFiles.map(f => vfsFiles[f].content).join('\n') + '\n<\/script>';
            htmlContent = htmlContent.replace('</body>', scriptTag + '</body>');
        }
        
        // Render in iframe
        const blob = new Blob([htmlContent], { type: 'text/html' });
        previewFrame.src = URL.createObjectURL(blob);
    }
};

// ==================== FILE TREE RENDERING ====================

function renderFileTree() {
    if (!fileTreeContainer) return;
    
    fileTreeContainer.innerHTML = '';
    const tree = VFS.getFileTree();
    
    function renderNode(node, path = '') {
        for (const [name, info] of Object.entries(node)) {
            const itemPath = path ? `${path}/${name}` : name;
            
            const div = document.createElement('div');
            div.className = `file-tree-item text-xs py-1 flex items-center justify-between gap-1 ${activeFilePath === itemPath ? 'active' : ''}`;
            
            if (info.type === 'folder') {
                const folderDiv = document.createElement('div');
                folderDiv.className = 'flex items-center gap-1 flex-1';
                folderDiv.innerHTML = `<span>📁</span><span>${escapeHtml(name)}</span>`;
                div.appendChild(folderDiv);
                
                // Delete button for folders
                const delBtn = document.createElement('button');
                delBtn.className = 'text-gray-500 hover:text-rose-400 text-[10px] px-1';
                delBtn.innerHTML = '🗑';
                delBtn.title = 'Delete folder';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteFileOrFolder(itemPath);
                };
                div.appendChild(delBtn);
                
                fileTreeContainer.appendChild(div);
                
                // Render children
                const childContainer = document.createElement('div');
                childContainer.style.paddingLeft = '12px';
                fileTreeContainer.appendChild(childContainer);
                
                const oldContainer = fileTreeContainer;
                fileTreeContainer = childContainer;
                renderNode(info.children, itemPath);
                fileTreeContainer = oldContainer;
            } else {
                const fileDiv = document.createElement('div');
                fileDiv.className = 'flex items-center gap-1 flex-1 cursor-pointer';
                fileDiv.innerHTML = `<span>📄</span><span class="truncate">${escapeHtml(name)}</span>`;
                fileDiv.onclick = () => {
                    MONACO.openFile(itemPath);
                    renderFileTree(); // Update active state
                };
                div.appendChild(fileDiv);
                
                // Delete button for files
                const delBtn = document.createElement('button');
                delBtn.className = 'text-gray-500 hover:text-rose-400 text-[10px] px-1';
                delBtn.innerHTML = '🗑';
                delBtn.title = 'Delete file';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteFileOrFolder(itemPath);
                };
                div.appendChild(delBtn);
                
                fileTreeContainer.appendChild(div);
            }
        }
    }
    
    renderNode(tree);
}

async function deleteFileOrFolder(path) {
    const file = vfsFiles[path];
    if (file) {
        // It's a file
        if (!confirm(`Delete file "${path}"? This cannot be undone.`)) return;
        
        // Close tab if open
        if (openFiles.includes(path)) {
            MONACO.closeFile(path);
        }
        
        await VFS.deleteFile(path);
        renderFileTree();
    } else {
        // It's a folder - delete all files in it
        const filesInFolder = Object.keys(vfsFiles).filter(p => p.startsWith(path + '/'));
        if (filesInFolder.length === 0) {
            alert('Folder is empty or does not exist.');
            return;
        }
        if (!confirm(`Delete folder "${path}" and all ${filesInFolder.length} files inside? This cannot be undone.`)) return;
        
        // Close tabs for files in folder
        for (const f of filesInFolder) {
            if (openFiles.includes(f)) {
                MONACO.closeFile(f);
            }
        }
        
        // Delete all files
        for (const f of filesInFolder) {
            await VFS.deleteFile(f);
        }
        renderFileTree();
    }
}

// ==================== INITIALIZATION ====================

async function init() {
    console.log('[IDE] Initializing...');
    
    // Get DOM elements
    filesTabBtn = document.getElementById('filesTabBtn');
    versionControlTabBtn = document.getElementById('versionControlTabBtn');
    filesPanel = document.getElementById('filesPanel');
    versionControlPanel = document.getElementById('versionControlPanel');
    fileTreeContainer = document.getElementById('fileTreeContainer');
    openFilesTabs = document.getElementById('openFilesTabs');
    commitMessageInput = document.getElementById('commitMessageInput');
    createCommitBtn = document.getElementById('createCommitBtn');
    commitHistoryList = document.getElementById('commitHistoryList');
    exportZipBtn = document.getElementById('exportZipBtn');
    importZipBtn = document.getElementById('importZipBtn');
    zipFileInput = document.getElementById('zipFileInput');
    newFileBtn = document.getElementById('newFileBtn');
    saveFileBtn = document.getElementById('saveFileBtn');
    togglePreviewBtn = document.getElementById('togglePreviewBtn');
    previewPanel = document.getElementById('previewPanel');
    previewFrame = document.getElementById('previewFrame');
    closePreviewBtn = document.getElementById('closePreviewBtn');
    monacoContainer = document.getElementById('monacoContainer');
    
    // Bot Store elements
    openBotStoreBtn = document.getElementById('openBotStoreBtn');
    botStoreModal = document.getElementById('botStoreModal');
    closeBotStoreModal = document.getElementById('closeBotStoreModal');
    botStoreGrid = document.getElementById('botStoreGrid');
    createNewBotBtn = document.getElementById('createNewBotBtn');
    exportBotsBtn = document.getElementById('exportBotsBtn');
    importBotsInput = document.getElementById('importBotsInput');
    botEditorModal = document.getElementById('botEditorModal');
    closeBotEditorModal = document.getElementById('closeBotEditorModal');
    botEditorTitle = document.getElementById('botEditorTitle');
    editBotName = document.getElementById('editBotName');
    editBotPrompt = document.getElementById('editBotPrompt');
    editBotModel = document.getElementById('editBotModel');
    editBotTemp = document.getElementById('editBotTemp');
    saveBotBtn = document.getElementById('saveBotBtn');
    deleteBotBtn = document.getElementById('deleteBotBtn');
    
    // AI Agent elements
    agentChatWindow = document.getElementById('agentChatWindow');
    agentInput = document.getElementById('agentInput');
    sendAgentBtn = document.getElementById('sendAgentBtn');
    stopAgentBtn = document.getElementById('stopAgentBtn');
    agentStatusIndicator = document.getElementById('agentStatusIndicator');
    agentModelDisplay = document.getElementById('agentModelDisplay');
    tokenUsageDisplay = document.getElementById('tokenUsageDisplay');
    
    // Auth elements
    loginBtn = document.getElementById('loginBtn');
    loginBtnText = document.getElementById('loginBtnText');
    loginModal = document.getElementById('loginModal');
    closeLoginModal = document.getElementById('closeLoginModal');
    loginDbUrl = document.getElementById('loginDbUrl');
    loginDbKey = document.getElementById('loginDbKey');
    loginEmail = document.getElementById('loginEmail');
    loginPassword = document.getElementById('loginPassword');
    doLoginBtn = document.getElementById('doLoginBtn');
    doRegisterBtn = document.getElementById('doRegisterBtn');
    doLogoutBtn = document.getElementById('doLogoutBtn');
    loginStatus = document.getElementById('loginStatus');
    
    // Load saved DB config
    const savedDbUrl = localStorage.getItem('gem_db_url') || '';
    const savedDbKey = localStorage.getItem('gem_db_key') || '';
    if (savedDbUrl && loginDbUrl) loginDbUrl.value = savedDbUrl;
    if (savedDbKey && loginDbKey) loginDbKey.value = savedDbKey;
    
    // Initialize VFS
    await VFS.init();
    
    // Load commits from storage (IndexedDB or localStorage)
    await VERSION_CONTROL.loadCommitsFromStorage();
    
    // Initialize Monaco
    try {
        await MONACO.init();
        // Open first file or README
        const firstFile = Object.keys(vfsFiles)[0];
        if (firstFile) {
            MONACO.openFile(firstFile);
        }
    } catch (e) {
        console.error('[IDE] Monaco failed to load:', e);
    }
    
    // Load custom bots
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
    
    // Load API config
    loadApiConfig();
    
    // Render UI
    renderFileTree();
    VERSION_CONTROL.renderCommitHistory();
    
    // Setup event listeners
    
    // Tab switching
    filesTabBtn.onclick = () => {
        filesPanel.classList.remove('hidden');
        versionControlPanel.classList.add('hidden');
        filesTabBtn.classList.add('text-violet-400', 'border-b-2', 'border-violet-400', 'bg-gray-800/50');
        filesTabBtn.classList.remove('text-gray-400');
        versionControlTabBtn.classList.remove('text-violet-400', 'border-b-2', 'border-violet-400', 'bg-gray-800/50');
        versionControlTabBtn.classList.add('text-gray-400');
    };
    
    versionControlTabBtn.onclick = () => {
        filesPanel.classList.add('hidden');
        versionControlPanel.classList.remove('hidden');
        versionControlTabBtn.classList.add('text-violet-400', 'border-b-2', 'border-violet-400', 'bg-gray-800/50');
        versionControlTabBtn.classList.remove('text-gray-400');
        filesTabBtn.classList.remove('text-violet-400', 'border-b-2', 'border-violet-400', 'bg-gray-800/50');
        filesTabBtn.classList.add('text-gray-400');
        VERSION_CONTROL.renderCommitHistory();
    };
    
    // File operations
    newFileBtn.onclick = async () => {
        const name = prompt('Enter file name (e.g., script.js):');
        if (name) {
            await VFS.writeFile(name, '');
            MONACO.openFile(name);
            renderFileTree();
        }
    };
    
    saveFileBtn.onclick = () => {
        if (activeFilePath) {
            const content = MONACO.getCurrentContent();
            if (content !== undefined) {
                VFS.writeFile(activeFilePath, content);
                console.log('[IDE] File saved');
            }
        }
    };
    
    // Keyboard shortcut for save
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveFileBtn.click();
        }
    });
    
    // Preview
    togglePreviewBtn.onclick = () => PREVIEW.toggle();
    closePreviewBtn.onclick = () => PREVIEW.toggle();
    
    // Version control
    createCommitBtn.onclick = async () => {
        const message = commitMessageInput.value.trim();
        if (!message) {
            alert('Please enter a commit message');
            return;
        }
        await VERSION_CONTROL.createCommit(message);
        commitMessageInput.value = '';
    };
    
    exportZipBtn.onclick = () => VERSION_CONTROL.exportAsZip();
    importZipBtn.onclick = () => zipFileInput.click();
    zipFileInput.onchange = (e) => {
        if (e.target.files[0]) {
            VERSION_CONTROL.importFromZip(e.target.files[0]);
        }
    };
    
    // Bot Store
    openBotStoreBtn.onclick = () => {
        renderBotStore();
        botStoreModal.classList.remove('hidden');
    };
    closeBotStoreModal.onclick = () => botStoreModal.classList.add('hidden');
    createNewBotBtn.onclick = () => openBotEditor();
    saveBotBtn.onclick = saveBot;
    deleteBotBtn.onclick = deleteBot;
    closeBotEditorModal.onclick = () => botEditorModal.classList.add('hidden');
    exportBotsBtn.onclick = exportBots;
    importBotsInput.onchange = importBots;
    
    // AI Agent
    sendAgentBtn.onclick = () => {
        const msg = agentInput.value.trim();
        if (msg) AI_AGENT.sendMessage(msg);
    };
    
    agentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAgentBtn.click();
        }
    });
    
    stopAgentBtn.onclick = () => AI_AGENT.stopGeneration();
    
    // Auth
    loginBtn.onclick = () => loginModal.classList.remove('hidden');
    closeLoginModal.onclick = () => loginModal.classList.add('hidden');
    doLoginBtn.onclick = () => handleLogin(loginEmail.value, loginPassword.value);
    doRegisterBtn.onclick = () => handleRegister(loginEmail.value, loginPassword.value);
    doLogoutBtn.onclick = handleLogout;
    
    // Auto-fetch models when API key changes
    const apiKeyEl = document.getElementById('apiKey');
    if (apiKeyEl) {
        apiKeyEl.addEventListener('input', debounce(() => {
            fetchActiveModels();
        }, 500));
    }

    // Listen for settings changes in Hub
    window.addEventListener('storage', (e) => {
        if (e.key?.startsWith('gem_')) {
            loadApiConfig();
        }
    });
    
    updateAuthUI();
    
    console.log('[IDE] Initialization complete');
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
