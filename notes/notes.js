/*
 * Notes page logic.
 *
 * Extracted from app.js so Notes can live on its own page (/notes) and share
 * the same IndexedDB data, cloud sync and local Markdown folder VFS.
 *
 * Storage modes:
 * - cloud: IndexedDB mirror + DB_CONNECTOR cloud sync (default, legacy behaviour)
 * - local: IndexedDB only
 * - folder: IndexedDB mirror + Markdown files in a user-selected local folder
 */

const notesList = document.getElementById('notesList');
const notesSearch = document.getElementById('notesSearch');
const noteTitle = document.getElementById('noteTitle');
const noteContent = document.getElementById('noteContent');
const notePreview = document.getElementById('notePreview');
const toggleNotePreview = document.getElementById('toggleNotePreview');
const newNoteBtn = document.getElementById('newNoteBtn');
const deleteNoteBtn = document.getElementById('deleteNoteBtn');
const importNoteBtn = document.getElementById('importNoteBtn');
const exportToRagBtn = document.getElementById('exportToRagBtn');
const exportNoteBtn = document.getElementById('exportNoteBtn');
const noteFileInput = document.getElementById('noteFileInput');
const noteTagsContainer = document.getElementById('noteTagsContainer');
const aiComplementBtn = document.getElementById('aiComplementBtn');
const notesStorageModeSelect = document.getElementById('notesStorageMode');
const notesFolderControls = document.getElementById('notesFolderControls');
const notesFolderStatus = document.getElementById('notesFolderStatus');
const chooseNotesFolderBtn = document.getElementById('chooseNotesFolderBtn');
const syncNotesFolderBtn = document.getElementById('syncNotesFolderBtn');

const NOTES_STORAGE_KEY = 'gem_notes_storage';
const NOTES_FOLDER_SYNC_INTERVAL = 60000;

let notes = [];
let currentNoteId = null;
let notesFolderSyncTimer = null;
let notesFolderAccessWarned = false;
let notesFolderSyncing = false;

function getNotesStorageMode() {
    const saved = STORAGE.getItem(NOTES_STORAGE_KEY);
    if (saved === 'local' || saved === 'folder' || saved === 'cloud') return saved;
    // Default to the local IndexedDB store unless a cloud DB is connected.
    return DB_CONNECTOR.isLoggedIn() ? 'cloud' : 'local';
}

// Why local folders are unavailable in this browser/context (empty when usable).
function notesFolderUnavailableReason() {
    if (!window.isSecureContext) {
        return 'Local folders require HTTPS or localhost, in Chrome or Edge on desktop.';
    }
    if (typeof window.showDirectoryPicker !== 'function') {
        return 'This browser does not support local folders. Use Chrome or Edge on desktop.';
    }
    return '';
}

function loadNotes() {
    const saved = STORAGE.getItem('gem_notes');
    if (saved) {
        try { notes = JSON.parse(saved); } catch (e) { notes = []; }
    }
    if (notes.length === 0) {
        createNewNote();
    }
    renderNotesList();
}

function saveNotesToStorage() {
    STORAGE.setItem('gem_notes', JSON.stringify(notes));
    const mode = getNotesStorageMode();
    if (mode === 'cloud') {
        SYNC_MANAGER.pushToCloud('hub_notes');
    } else if (mode === 'folder') {
        const note = notes.find(n => n.id === currentNoteId);
        if (note) NOTES_FOLDER.queueWrite(note);
    }
}

// ---------------------------------------------------------------------------
// Local folder VFS (Markdown files)
// ---------------------------------------------------------------------------

function updateNotesFolderUi() {
    if (!notesStorageModeSelect) return;
    const mode = getNotesStorageMode();
    notesStorageModeSelect.value = mode;
    const isFolder = mode === 'folder';
    if (notesFolderControls) notesFolderControls.classList.toggle('hidden', !isFolder);

    const reason = notesFolderUnavailableReason();
    if (chooseNotesFolderBtn) {
        // Keep the button clickable so an unsupported browser gets a clear
        // explanation instead of a silent no-op.
        chooseNotesFolderBtn.disabled = false;
        chooseNotesFolderBtn.title = reason || 'Link a local folder for Markdown notes';
    }
    if (!notesFolderStatus) return;

    if (reason) {
        notesFolderStatus.textContent = reason;
    } else if (NOTES_FOLDER.hasFolder()) {
        notesFolderStatus.textContent = 'Folder: ' + NOTES_FOLDER.getFolderName();
    } else {
        notesFolderStatus.textContent = 'No folder linked yet.';
    }
}

function stopNotesFolderSync() {
    if (notesFolderSyncTimer) {
        clearInterval(notesFolderSyncTimer);
        notesFolderSyncTimer = null;
    }
}

function startNotesFolderSync() {
    stopNotesFolderSync();
    if (getNotesStorageMode() !== 'folder' || !NOTES_FOLDER.hasFolder()) return;
    notesFolderSyncTimer = setInterval(() => {
        // Do not touch the disk while the tab is in the background.
        if (document.hidden) return;
        syncNotesFromFolder();
    }, NOTES_FOLDER_SYNC_INTERVAL);
}

async function applyNotesStorageMode(interactive) {
    const mode = getNotesStorageMode();
    updateNotesFolderUi();
    if (mode === 'folder') {
        startNotesFolderSync();
        if (NOTES_FOLDER.hasFolder()) {
            await syncNotesFromFolder({ interactive: !!interactive });
        }
    } else {
        stopNotesFolderSync();
    }
}

// Refresh the open editor after an external change, but never overwrite text
// while the user is typing in it.
function refreshOpenNote(note) {
    if (!note || note.id !== currentNoteId) return;
    if (document.activeElement === noteContent || document.activeElement === noteTitle) return;
    if (noteTitle.value !== note.title) noteTitle.value = note.title;
    if (noteContent.value !== note.content) {
        noteContent.value = note.content;
        if (!notePreview.classList.contains('hidden')) renderNotePreview();
    }
    updateNoteTags();
}

// Two-way sync with the linked folder. Local changes win when they are newer;
// files edited outside the app are imported.
async function syncNotesFromFolder(options) {
    if (getNotesStorageMode() !== 'folder') return;
    if (!NOTES_FOLDER.isSupported() || !NOTES_FOLDER.hasFolder()) return;
    if (notesFolderSyncing) return;

    const interactive = !!(options && options.interactive);
    notesFolderSyncing = true;
    try {
        await NOTES_FOLDER.ensureAccess(interactive, 'read');
        const folderNotes = await NOTES_FOLDER.readAllNotes();
        const folderById = new Map(folderNotes.map(n => [n.id, n]));
        let changed = false;

        folderNotes.forEach(folderNote => {
            const local = notes.find(n => n.id === folderNote.id);
            if (!local) {
                notes.push(folderNote);
                changed = true;
                return;
            }
            if (folderNote.folderFile && local.folderFile !== folderNote.folderFile) {
                local.folderFile = folderNote.folderFile;
                changed = true;
            }
            if (folderNote.updatedAt > (local.updatedAt || 0)) {
                local.title = folderNote.title;
                local.content = folderNote.content;
                local.tags = folderNote.tags;
                local.updatedAt = folderNote.updatedAt;
                changed = true;
                refreshOpenNote(local);
            }
        });

        // Files removed on disk remove the matching local notes.
        const previousLength = notes.length;
        notes = notes.filter(note => !note.folderFile || folderById.has(note.id));
        if (notes.length !== previousLength) {
            changed = true;
            if (!notes.some(n => n.id === currentNoteId)) {
                if (notes.length > 0) {
                    openNote(notes[0].id);
                } else {
                    currentNoteId = null;
                    noteTitle.value = '';
                    noteContent.value = '';
                    updateNoteTags();
                }
            }
        }

        // Persist imports/removals before writing to the folder, so a reload
        // can never drop them.
        if (changed) STORAGE.setItem('gem_notes', JSON.stringify(notes));

        // Push notes that are new, or newer than their Markdown file.
        for (const note of notes) {
            const folderNote = folderById.get(note.id);
            if (!note.folderFile || !folderNote || (note.updatedAt || 0) > folderNote.updatedAt) {
                await NOTES_FOLDER.writeNoteNow(note);
                changed = true;
            }
        }

        if (changed) {
            STORAGE.setItem('gem_notes', JSON.stringify(notes));
            renderNotesList();
        }
        updateNotesFolderUi();
        if (notesFolderStatus) {
            notesFolderStatus.textContent = 'Folder: ' + NOTES_FOLDER.getFolderName() +
                ' — synced ' + new Date().toLocaleTimeString();
        }
    } catch (e) {
        console.warn('[Notes] Folder sync failed:', e.message);
        updateNotesFolderUi();
        if (notesFolderStatus) notesFolderStatus.textContent = 'Folder unavailable — click "Sync now" to reconnect.';
        if (interactive) {
            notifyError('Notes folder sync failed: ' + e.message);
        } else if (!notesFolderAccessWarned) {
            // Warn only once per page session (a reload starts a new session).
            notesFolderAccessWarned = true;
            notifyWarning('Cannot access your notes folder. Reconnect the folder to keep syncing.', 8000);
        }
    } finally {
        notesFolderSyncing = false;
    }
}

async function chooseNotesFolder() {
    const reason = notesFolderUnavailableReason();
    if (reason) {
        notifyWarning(reason, 8000);
        return;
    }
    try {
        console.info('[Notes] Opening the folder picker...');
        if (notesFolderStatus) notesFolderStatus.textContent = 'Waiting for the folder picker...';
        await NOTES_FOLDER.pickDirectory();
        // Treat the newly picked folder as the source of truth: drop stale
        // file links so every local note is written/merged into it.
        notes.forEach(note => { delete note.folderFile; });
        STORAGE.setItem('gem_notes', JSON.stringify(notes));
        STORAGE.setItem(NOTES_STORAGE_KEY, 'folder');
        updateNotesFolderUi();
        startNotesFolderSync();
        await syncNotesFromFolder({ interactive: true });
    } catch (e) {
        updateNotesFolderUi();
        // The user closing the native picker is not an error.
        if (e && e.name === 'AbortError') return;
        console.error('[Notes] Folder picker failed:', e);
        notifyError('Could not link the folder: ' + (e && e.message ? e.message : e));
    }
}

async function onNotesStorageModeChange() {
    if (!notesStorageModeSelect) return;
    const mode = notesStorageModeSelect.value;
    STORAGE.setItem(NOTES_STORAGE_KEY, mode);
    if (mode === 'cloud' && !DB_CONNECTOR.isLoggedIn()) {
        notifyWarning('No cloud database is connected. Notes stay in local IndexedDB until you sign in from the Hub.', 7000);
    }
    await applyNotesStorageMode(true);
    if (getNotesStorageMode() === 'cloud') {
        SYNC_MANAGER.pushToCloud('hub_notes');
    }
}

async function onSyncNotesFolderClick() {
    if (!NOTES_FOLDER.hasFolder()) {
        await chooseNotesFolder();
        return;
    }
    await syncNotesFromFolder({ interactive: true });
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function createNewNote() {
    const id = 'note_' + Date.now();
    const newNote = {
        id,
        title: '',
        content: '',
        tags: [],
        updatedAt: Date.now()
    };
    notes.unshift(newNote);
    currentNoteId = id;
    saveNotesToStorage();
    renderNotesList();
    openNote(id);
}

function openNote(id) {
    currentNoteId = id;
    const note = notes.find(n => n.id === id);
    if (note) {
        noteTitle.value = note.title;
        noteContent.value = note.content;
        updateNoteTags();
    }
    renderNotesList();
    closeNotesSidebarDrawer();
}

// Sidebar drawer: hidden slide-over panel on phones, static column on desktop.
function openNotesSidebarDrawer() {
    const sidebar = document.getElementById('notesSidebar');
    const overlay = document.getElementById('notesOverlay');
    if (!sidebar) return;
    if (window.innerWidth >= 768) return;
    sidebar.classList.remove('-translate-x-full');
    if (overlay) overlay.classList.remove('hidden');
}

function closeNotesSidebarDrawer() {
    const sidebar = document.getElementById('notesSidebar');
    const overlay = document.getElementById('notesOverlay');
    if (!sidebar) return;
    if (window.innerWidth >= 768) return;
    sidebar.classList.add('-translate-x-full');
    if (overlay) overlay.classList.add('hidden');
}

function updateNoteContent() {
    if (!currentNoteId) return;
    const note = notes.find(n => n.id === currentNoteId);
    if (note) {
        note.title = noteTitle.value;
        note.content = noteContent.value;
        note.updatedAt = Date.now();

        // Auto-tagging logic (Unicode-aware: Cyrillic, CJK, etc.)
        const tagRegex = /#([\p{L}\p{N}_]+)/gu;
        const tags = [...note.content.matchAll(tagRegex)].map(match => match[1]);
        note.tags = [...new Set(tags)];

        saveNotesToStorage();
        renderNotesList();
        updateNoteTags();
    }
}

function updateNoteTags() {
    if (!currentNoteId) return;
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    noteTagsContainer.innerHTML = '';
    note.tags.forEach(tag => {
        const tagEl = document.createElement('span');
        tagEl.className = 'text-[10px] bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full';
        tagEl.textContent = `#${tag}`;
        noteTagsContainer.appendChild(tagEl);
    });
}

function renderNotesList() {
    const search = notesSearch.value.toLowerCase();
    notesList.innerHTML = '';

    const filtered = notes.filter(n =>
        n.title.toLowerCase().includes(search) ||
        n.content.toLowerCase().includes(search) ||
        n.tags.some(t => t.toLowerCase().includes(search.replace('#', '')))
    );

    filtered.forEach(note => {
        const isActive = note.id === currentNoteId;
        const div = document.createElement('div');
        div.className = `p-3 rounded-lg cursor-pointer transition flex flex-col gap-1 ${isActive ? 'bg-emerald-600/20 border border-emerald-500/40 text-white' : 'hover:bg-gray-800 text-gray-300'}`;
        div.onclick = () => openNote(note.id);

        div.innerHTML = `
            <span class="text-xs font-bold truncate">${note.title || 'Untitled Note'}</span>
            <span class="text-[10px] text-gray-500 truncate">${note.content.slice(0, 30).replace(/\n/g, ' ')}...</span>
        `;
        notesList.appendChild(div);
    });
}

function renderNotePreview() {
    if (typeof marked === 'undefined') {
        notePreview.textContent = noteContent.value;
        return;
    }
    notePreview.innerHTML = `<div class="md-content">${marked.parse(noteContent.value)}</div>`;
}

// ---------------------------------------------------------------------------
// AI complement
// ---------------------------------------------------------------------------

function getSavedAiConfig() {
    const providerName = resolveProviderName(STORAGE.getItem('gem_provider') || 'groq');
    const details = getProviderDescriptor(providerName);
    return {
        providerName,
        hasKey: details.hasKey,
        apiKey: (STORAGE.getItem(`gem_key_${providerName}`) || '').trim(),
        endpoint: (STORAGE.getItem(`gem_endpoint_${providerName}`) || details.url).trim(),
        model: STORAGE.getItem(`gem_selected_model_${providerName}`) || ''
    };
}

async function complementNote() {
    if (!currentNoteId) return;

    const note = notes.find(n => n.id === currentNoteId);
    if (!note || !note.content) {
        notifyWarning('Please write some text in the note first!');
        return;
    }

    const config = getSavedAiConfig();
    if (config.hasKey && !config.apiKey) {
        notifyWarning('Please configure your API key in the Hub settings first!');
        return;
    }
    if (!config.model) {
        notifyWarning('Please select an AI model in the Hub settings first!');
        return;
    }

    const originalText = note.content;
    const placeholder = '\n\n(AI is thinking...)';
    noteContent.value += placeholder;
    updateNoteContent();
    try {
        const systemPrompt = `You are a helpful note-completion assistant. Your task is to expand and complement the current note. Use Markdown formatting. Keep the tone consistent with the original text. Do not repeat the existing text, just add meaningful continuation or detailed expansion. Answer in the same language as the note content.`;
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please complement and expand this note:\n\n${originalText}` }
        ];

        const response = await fetchSingleCompletion(config.endpoint, config.apiKey, config.hasKey, {
            model: config.model,
            messages,
            temperature: 0.7,
            max_tokens: 5000
        }, config.providerName);

        const resultText = extractAssistantContent(response, config.providerName).content;
        if (!resultText) {
            throw new Error('AI returned an empty response');
        }

        const textWithoutPlaceholder = noteContent.value.replace(placeholder, '');
        noteContent.value = textWithoutPlaceholder + '\n\n' + resultText;
        updateNoteContent();
    } catch (error) {
        console.error('AI Complement Error:', error);
        notifyError('AI Complement failed: ' + error.message);
        noteContent.value = noteContent.value.replace(placeholder, '');
        updateNoteContent();
    }
}

// ---------------------------------------------------------------------------
// Import / export
// ---------------------------------------------------------------------------

function importNoteFromMD() {
    noteFileInput.click();
}

noteFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const content = await file.text();
    const title = file.name.replace(/\.md$/i, '');
    const id = 'note_' + Date.now();
    const newNote = { id, title, content, tags: [], updatedAt: Date.now() };
    notes.unshift(newNote);
    currentNoteId = id;
    saveNotesToStorage();
    renderNotesList();
    openNote(id);
    noteFileInput.value = '';
});

function exportNoteToMD() {
    if (!currentNoteId) return;
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;
    const title = note.title || 'untitled-note';
    const content = `# ${note.title}\n\n${note.content}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revocation so slow browsers do not cancel the download.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function loadRagKnowledgeBase() {
    const saved = STORAGE.getItem('gem_rag_kb');
    if (saved) {
        try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
}

function saveRagKnowledgeBase(kb) {
    STORAGE.setItem('gem_rag_kb', JSON.stringify(kb));
    SYNC_MANAGER.pushToCloud('rag_knowledge');
}

function exportNoteToRAG() {
    if (!currentNoteId) return;
    const note = notes.find(n => n.id === currentNoteId);
    if (!note) return;

    const content = note.content.trim();
    if (!content) {
        notifyWarning('Note is empty, nothing to export!');
        return;
    }

    let name = note.title.trim() || 'Untitled Note';
    if (!/\.(md|txt)$/i.test(name)) name += '.md';

    const kb = loadRagKnowledgeBase();
    const entry = { name, content, source: 'notes', noteId: note.id, updatedAt: Date.now() };
    const existingIndex = kb.findIndex(f => f.name === name);
    if (existingIndex !== -1) {
        kb[existingIndex] = entry;
    } else {
        kb.push(entry);
    }
    saveRagKnowledgeBase(kb);

    exportToRagBtn.textContent = 'Added';
    setTimeout(() => { exportToRagBtn.textContent = 'Export to RAG'; }, 2000);
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const toggleNotesSidebarBtn = document.getElementById('toggleNotesSidebar');
if (toggleNotesSidebarBtn) toggleNotesSidebarBtn.addEventListener('click', openNotesSidebarDrawer);
const closeNotesSidebarBtn = document.getElementById('closeNotesSidebar');
if (closeNotesSidebarBtn) closeNotesSidebarBtn.addEventListener('click', closeNotesSidebarDrawer);
const notesOverlayEl = document.getElementById('notesOverlay');
if (notesOverlayEl) notesOverlayEl.addEventListener('click', closeNotesSidebarDrawer);

newNoteBtn.addEventListener('click', createNewNote);
noteTitle.addEventListener('input', updateNoteContent);
noteContent.addEventListener('input', () => {
    updateNoteContent();
    const isPreviewVisible = !notePreview.classList.contains('hidden');
    if (isPreviewVisible) renderNotePreview();
});
notesSearch.addEventListener('input', renderNotesList);
if (notesStorageModeSelect) notesStorageModeSelect.addEventListener('change', onNotesStorageModeChange);
if (chooseNotesFolderBtn) chooseNotesFolderBtn.addEventListener('click', chooseNotesFolder);
if (syncNotesFolderBtn) syncNotesFolderBtn.addEventListener('click', onSyncNotesFolderClick);
document.addEventListener('visibilitychange', () => {
    // Catch up immediately when the tab becomes active again.
    if (!document.hidden && getNotesStorageMode() === 'folder' && NOTES_FOLDER.hasFolder()) {
        syncNotesFromFolder();
    }
});

deleteNoteBtn.addEventListener('click', async () => {
    if (!currentNoteId) return;
    const confirmed = await showAppConfirm('Delete this note?', {
        title: 'Delete note',
        confirmText: 'Delete',
        danger: true
    });
    if (confirmed) {
        const removedNote = notes.find(n => n.id === currentNoteId);
        notes = notes.filter(n => n.id !== currentNoteId);
        saveNotesToStorage();
        if (removedNote) NOTES_FOLDER.deleteNoteFile(removedNote);
        if (notes.length > 0) {
            openNote(notes[0].id);
        } else {
            currentNoteId = null;
            noteTitle.value = '';
            noteContent.value = '';
            updateNoteTags();
        }
        renderNotesList();
    }
});

toggleNotePreview.addEventListener('click', () => {
    const isPreview = !notePreview.classList.contains('hidden');
    if (isPreview) {
        notePreview.classList.add('hidden');
        noteContent.classList.remove('hidden');
        toggleNotePreview.textContent = 'Preview';
    } else {
        notePreview.classList.remove('hidden');
        noteContent.classList.add('hidden');
        toggleNotePreview.textContent = 'Close Preview';
        renderNotePreview();
    }
});

aiComplementBtn.addEventListener('click', complementNote);
importNoteBtn.addEventListener('click', importNoteFromMD);
exportToRagBtn.addEventListener('click', exportNoteToRAG);
exportNoteBtn.addEventListener('click', exportNoteToMD);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNotesSidebarDrawer();
});

document.addEventListener('DOMContentLoaded', async () => {
    await STORAGE.ready();
    await NOTES_FOLDER.restore();
    loadNotes();
    updateNotesFolderUi();
    // Folder sync can touch many files; do not delay first paint for it.
    applyNotesStorageMode();
});
