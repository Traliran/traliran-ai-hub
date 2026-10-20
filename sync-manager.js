/**
 * Sync Manager - Handles cloud synchronization for VFS and other data
 *
 * Features:
 * - Auto-sync VFS to cloud when logged in (whole-collection snapshots)
 * - Queue-based sync for offline support
 * - Local Markdown VFS for the Notes page (user-selected folder)
 *
 * Methods:
 * - SYNC_MANAGER.pushToCloud(collection)
 * - SYNC_MANAGER.pullFromCloud(collection)
 * - SYNC_MANAGER.pushAll()
 * - SYNC_MANAGER.pullAndMerge()
 */

const SYNC_MANAGER = {
  _syncQueue: [],
  _debounceTimers: {},
  _isOnline: navigator.onLine,
  _isSyncing: false,
  _statusCallback: null,

  COLLECTION_MAP: {
    hub_sessions: { key: 'gem_sessions' },
    hub_notes: { key: 'gem_notes' },
    hub_settings: { keys: ['gem_provider', 'gem_bot_name', 'gem_system_prompt', 'gem_temp', 'gem_topp', 'gem_tokens'], isSettings: true },
    rag_knowledge: { key: 'gem_rag_kb' },
    rag_sessions: { key: 'gem_rag_sessions' },
    hub_personal: { key: 'gem_personal_info' },
    ide_vfs: { key: 'ide_vfs_files', isVFS: true },
    ide_commits: { key: 'ide_vfs_commits', isCommits: true },
    ide_agent_chats: { key: 'ide_agent_sessions' },
  },

  init() {
    this._isOnline = navigator.onLine;
    window.addEventListener('online', () => {
      this._isOnline = true;
      this.updateStatus('Online - syncing...');
      this._processQueue();
    });
    window.addEventListener('offline', () => {
      this._isOnline = false;
      this.updateStatus('Offline - changes queued', true);
    });
  },

  setStatusCallback(cb) {
    this._statusCallback = cb;
  },

  updateStatus(text, isError) {
    if (this._statusCallback) {
      this._statusCallback(text, isError);
    }
  },

  _readCollectionData(collection) {
    const map = this.COLLECTION_MAP[collection];
    if (!map) return null;

    if (map.isSettings) {
      const settings = {};
      map.keys.forEach(key => {
        const val = STORAGE.getItem(key);
        if (val !== null) settings[key] = val;
      });
      STORAGE.keys().filter(k => k.startsWith('gem_key_')).forEach(k => {
        settings[k] = STORAGE.getItem(k);
      });
      return settings;
    }

    if (map.isVFS) {
      const stored = STORAGE.getItem('ide_vfs_files');
      if (stored) {
        try { return JSON.parse(stored); } catch { return {}; }
      }
      return {};
    }

    if (map.isCommits) {
      const stored = STORAGE.getItem('ide_vfs_commits');
      if (stored) {
        try { return JSON.parse(stored); } catch { return []; }
      }
      return [];
    }

    if (map.key) {
      const val = STORAGE.getItem(map.key);
      if (val !== null) {
        try { return JSON.parse(val); } catch { return val; }
      }
    }
    return null;
  },

  _writeCollectionData(collection, data) {
    const map = this.COLLECTION_MAP[collection];
    if (!map) return;

    if (map.isSettings) {
      if (data && typeof data === 'object') {
        // Whitelist settings keys so cloud data can never overwrite the
        // local database connection config (gem_db_url / gem_db_token, ...).
        Object.entries(data).forEach(([key, val]) => {
          if (key === 'id' || typeof val !== 'string') return;
          if (map.keys.includes(key) || key.startsWith('gem_key_')) {
            STORAGE.setItem(key, val);
          }
        });
      }
      return;
    }

    if (map.isVFS || map.isCommits) {
      const storageKey = collection === 'ide_vfs' ? 'ide_vfs_files' : 'ide_vfs_commits';
      if (data !== null && data !== undefined) {
        STORAGE.setItem(storageKey, JSON.stringify(data));
      }
      return;
    }

    if (map.key && data !== null && data !== undefined) {
      STORAGE.setItem(map.key, typeof data === 'string' ? data : JSON.stringify(data));
    }
  },

  async pushToCloud(collection) {
    if (!DB_CONNECTOR.isLoggedIn()) return;
    if (!this._isOnline) {
      this._syncQueue.push({ type: 'push', collection });
      this.updateStatus('Queued for sync (offline)', true);
      return;
    }

    if (this._debounceTimers[collection]) {
      clearTimeout(this._debounceTimers[collection]);
    }

    this._debounceTimers[collection] = setTimeout(async () => {
      try {
        const data = this._readCollectionData(collection);
        if (data === null) return;
        this.updateStatus(`Syncing ${collection}...`);
        await DB_CONNECTOR.saveData(collection, 'current', data);
        this.updateStatus(`${collection} saved to cloud`);
      } catch (e) {
        console.error('Sync push error:', e);
        this.updateStatus(`Sync error: ${e.message}`, true);
        this._syncQueue.push({ type: 'push', collection });
      }
    }, 500);
  },

  async pullFromCloud(collection) {
    if (!DB_CONNECTOR.isLoggedIn()) return null;
    try {
      this.updateStatus(`Pulling ${collection}...`);
      const data = await DB_CONNECTOR.fetchData(collection);
      if (data !== null && data !== undefined) {
        this._writeCollectionData(collection, data);
        this.updateStatus(`${collection} synced from cloud`);
      }
      return data;
    } catch (e) {
      console.error('Sync pull error:', e);
      this.updateStatus(`Pull error: ${e.message}`, true);
      return null;
    }
  },

  async pullAndMerge() {
    if (!DB_CONNECTOR.isLoggedIn()) return;
    this.updateStatus('Full sync started...');
    const collections = Object.keys(this.COLLECTION_MAP);
    for (const collection of collections) {
      // The Notes page can opt out of cloud storage (local-only or folder mode).
      if (collection === 'hub_notes' && !this._isNotesCloudEnabled()) continue;
      await this.pullFromCloud(collection);
    }
    this.updateStatus('Sync complete');
  },

  async pushAll() {
    if (!DB_CONNECTOR.isLoggedIn()) return;
    this.updateStatus('Pushing all data...');
    const collections = Object.keys(this.COLLECTION_MAP);
    for (const collection of collections) {
      if (collection === 'hub_notes' && !this._isNotesCloudEnabled()) continue;
      const data = this._readCollectionData(collection);
      if (data !== null) {
        try {
          await DB_CONNECTOR.saveData(collection, 'current', data);
        } catch (e) {
          console.error(`Push error for ${collection}:`, e);
        }
      }
    }
    this.updateStatus('All data pushed to cloud');
  },

  // Notes use cloud sync by default. "local" and "folder" are explicit
  // per-device opt-outs, so cloud pulls/pushes skip the notes collection.
  _isNotesCloudEnabled() {
    if (typeof STORAGE === 'undefined') return true;
    const mode = STORAGE.getItem('gem_notes_storage');
    return mode !== 'local' && mode !== 'folder';
  },

  async _processQueue() {
    if (!this._isOnline || this._isSyncing || this._syncQueue.length === 0) return;
    this._isSyncing = true;

    const queue = [...this._syncQueue];
    this._syncQueue = [];

    for (const item of queue) {
      if (item.type === 'push') {
        try {
          const data = this._readCollectionData(item.collection);
          if (data !== null) {
            await DB_CONNECTOR.saveData(item.collection, 'current', data);
          }
        } catch (e) {
          console.error('Queue processing error:', e);
          this._syncQueue.push(item);
        }
      }
    }
    this._isSyncing = false;

    if (this._syncQueue.length > 0) {
      setTimeout(() => this._processQueue(), 2000);
    }
  },

  async loginAndSync(email, password) {
    await DB_CONNECTOR.attemptLogin(email, password);
    if (DB_CONNECTOR.isLoggedIn()) {
      await this.pullAndMerge();
    }
  },

  async registerAndSync(email, password) {
    await DB_CONNECTOR.attemptRegister(email, password);
    if (DB_CONNECTOR.isLoggedIn()) {
      await this.pushAll();
    }
  },

  async logout() {
    await DB_CONNECTOR.attemptLogout();
    this._syncQueue = [];
    this.updateStatus('Logged out');
  },

  isLoggedIn() {
    return DB_CONNECTOR.isLoggedIn();
  },

  getUserEmail() {
    return DB_CONNECTOR.getUserEmail();
  }
};

SYNC_MANAGER.init();

/**
 * NOTES_FOLDER - Local Markdown storage for the Notes page.
 *
 * Notes are stored as one Markdown file per note inside a directory chosen by
 * the user (File System Access API). Every file starts with a small front
 * matter block that keeps the note id, title, tags and update timestamp, so
 * files can be moved or edited in any external editor and still be matched.
 *
 * The directory handle is persisted in IndexedDB, so the same folder can be
 * reused after a reload (the browser may still ask for permission again).
 *
 * The Notes page keeps its IndexedDB copy at all times. This module is only a
 * folder-backed mirror used when the user selects the "Local folder" storage
 * mode.
 */
const NOTES_FOLDER = {
  HANDLE_KEY: 'notes_dir_handle',
  WRITE_DELAY: 900,

  _handle: null,
  _cache: new Map(), // fileName -> { lastModified, note }
  _writeTimers: {},
  _lock: Promise.resolve(),

  // Two-way sync needs the File System Access API (Chrome/Edge).
  isSupported() {
    return typeof window.showDirectoryPicker === 'function';
  },

  canWrite() {
    return this.isSupported();
  },

  // Firefox/Safari can still open a directory through a file input, but only
  // for reading (the browser never grants write access to the real folder).
  canImport() {
    if (typeof document === 'undefined') return false;
    const input = document.createElement('input');
    return 'webkitdirectory' in input || 'directory' in input;
  },

  hasFolder() {
    return !!this._handle;
  },

  getFolderName() {
    return this._handle ? this._handle.name : '';
  },

  async restore() {
    if (!this.isSupported() || !window.projectDB) return null;
    try {
      const handle = await window.projectDB.getMeta(this.HANDLE_KEY);
      if (handle && handle.kind === 'directory') this._handle = handle;
    } catch (e) {
      console.warn('[NOTES_FOLDER] Could not restore folder handle:', e);
    }
    return this._handle;
  },

  async pickDirectory() {
    if (!this.isSupported()) {
      throw new Error('Local folders are not supported by this browser');
    }
    const handle = await window.showDirectoryPicker({ id: 'traliran-notes', mode: 'readwrite' });
    let state = await handle.queryPermission({ mode: 'readwrite' });
    if (state === 'prompt') {
      state = await handle.requestPermission({ mode: 'readwrite' });
    }
    if (state !== 'granted') {
      throw new Error('Folder access was not granted');
    }
    this._handle = handle;
    this._cache.clear();
    if (window.projectDB) {
      try {
        await window.projectDB.saveMeta(this.HANDLE_KEY, handle);
      } catch (e) {
        // The folder still works for this session even if the handle cannot
        // be persisted.
        console.warn('[NOTES_FOLDER] Could not persist folder handle:', e);
      }
    }
    return handle;
  },

  /**
   * Make sure the folder can be used. Read-only sync only needs "read"
   * permission; writing always asks for "readwrite".
   * @param {boolean} interactive - Request permission (must run on a user gesture)
   * @param {'read'|'readwrite'} mode - Required permission
   */
  async ensureAccess(interactive, mode) {
    if (!this._handle) {
      await this.restore();
    }
    if (!this._handle) {
      throw new Error('No folder linked');
    }
    const permission = { mode: mode === 'read' ? 'read' : 'readwrite' };
    let state = await this._handle.queryPermission(permission);
    if (state === 'prompt' && interactive) {
      state = await this._handle.requestPermission(permission);
    }
    if (state !== 'granted') {
      throw new Error('Folder access is not granted');
    }
    return this._handle;
  },

  _withLock(task) {
    const run = this._lock.then(task, task);
    this._lock = run.catch(() => {});
    return run;
  },

  _extractTags(content) {
    const tagRegex = /#([\p{L}\p{N}_]+)/gu;
    return [...String(content || '').matchAll(tagRegex)].map(m => m[1]);
  },

  _hashFileName(fileName) {
    let hash = 0;
    for (let i = 0; i < fileName.length; i++) {
      hash = ((hash << 5) - hash + fileName.charCodeAt(i)) | 0;
    }
    return 'note_f_' + Math.abs(hash).toString(36);
  },

  _fileNameFor(note) {
    const clean = String(note.title || '')
      .replace(/\r?\n/g, ' ')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, '-')
      .replace(/^[.\s-]+|[.\s-]+$/g, '')
      .slice(0, 60);
    const base = clean || 'note';
    const suffix = String(note.id || Date.now())
      .replace(/^note_/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '') || String(Date.now());
    return `${base}-${suffix}.md`;
  },

  _serialize(note) {
    const title = String(note.title || '').replace(/\r?\n/g, ' ').trim();
    const tags = Array.isArray(note.tags) ? note.tags.join(', ') : '';
    const updated = Number(note.updatedAt) || Date.now();
    return [
      '---',
      `id: ${note.id}`,
      `title: ${title}`,
      `updated: ${updated}`,
      `tags: ${tags}`,
      '---',
      String(note.content || '')
    ].join('\n');
  },

  _parse(text, fileName, lastModified) {
    const meta = {};
    let body = text;
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
    if (match) {
      match[1].split(/\r?\n/).forEach(line => {
        const idx = line.indexOf(':');
        if (idx > 0) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
      body = text.slice(match[0].length);
    }
    const tags = meta.tags
      ? meta.tags.split(',').map(t => t.trim()).filter(Boolean)
      : this._extractTags(body);
    return {
      id: meta.id || this._hashFileName(fileName),
      title: meta.title !== undefined ? meta.title : fileName.replace(/\.md$/i, ''),
      content: body,
      tags,
      updatedAt: Math.max(Number(meta.updated) || 0, lastModified),
      folderFile: fileName
    };
  },

  _snapshot(note) {
    return {
      id: note.id,
      title: note.title,
      content: note.content,
      tags: Array.isArray(note.tags) ? [...note.tags] : [],
      updatedAt: note.updatedAt,
      folderFile: note.folderFile
    };
  },

  /**
   * Read every Markdown file in the folder. Unchanged files are served from
   * the in-memory cache, so a one-minute poll only touches changed files.
   */
  async readAllNotes() {
    const dir = await this.ensureAccess(false, 'read');
    const result = [];
    const seen = new Set();

    for await (const [name, entry] of dir.entries()) {
      if (entry.kind !== 'file' || !/\.md$/i.test(name)) continue;
      seen.add(name);

      const file = await entry.getFile();
      const cached = this._cache.get(name);
      if (cached && cached.lastModified === file.lastModified) {
        result.push({ ...cached.note, tags: [...cached.note.tags] });
        continue;
      }

      const note = this._parse(await file.text(), name, file.lastModified);
      this._cache.set(name, { lastModified: file.lastModified, note });
      result.push({ ...note, tags: [...note.tags] });
    }

    for (const name of [...this._cache.keys()]) {
      if (!seen.has(name)) this._cache.delete(name);
    }
    return result;
  },

  async _writeFile(dir, name, text) {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return handle;
  },

  async writeNoteNow(note) {
    if (!note || !note.id) return null;
    return this._withLock(async () => {
      const dir = await this.ensureAccess(false, 'readwrite');
      const target = this._fileNameFor(note);
      const previous = note.folderFile || '';
      const handle = await this._writeFile(dir, target, this._serialize(note));

      if (previous && previous !== target) {
        try {
          await dir.removeEntry(previous);
        } catch (e) {
          if (e.name !== 'NotFoundError') {
            console.warn('[NOTES_FOLDER] Could not remove old file:', e);
          }
        }
        this._cache.delete(previous);
      }

      note.folderFile = target;
      try {
        const file = await handle.getFile();
        this._cache.set(target, { lastModified: file.lastModified, note: this._snapshot(note) });
      } catch (e) {
        // The next poll will read the file again; not critical.
      }
      return target;
    });
  },

  /**
   * Debounced write used while the user types.
   */
  queueWrite(note) {
    if (!note || !note.id || !this._handle) return;
    clearTimeout(this._writeTimers[note.id]);
    this._writeTimers[note.id] = setTimeout(() => {
      delete this._writeTimers[note.id];
      this.writeNoteNow(note).catch(e => {
        console.warn('[NOTES_FOLDER] Write failed:', e.message);
      });
    }, this.WRITE_DELAY);
  },

  async deleteNoteFile(note) {
    if (!note || !note.folderFile) return;
    clearTimeout(this._writeTimers[note.id]);
    delete this._writeTimers[note.id];
    try {
      const dir = await this.ensureAccess(false, 'readwrite');
      await dir.removeEntry(note.folderFile);
      this._cache.delete(note.folderFile);
    } catch (e) {
      if (e.name !== 'NotFoundError') {
        console.warn('[NOTES_FOLDER] Delete failed:', e.message);
      }
    }
  }
};

