/**
 * IndexedDB Wrapper for Project Storage + VFS Operations
 * Replaces ephemeral file system with persistent browser storage
 * 
 * Features:
 * - File CRUD operations with automatic event emission
 * - Cloud sync via DB_CONNECTOR when logged in
 * - Version Control snapshots
 * - Reactive events: vfs:file-updated, vfs:file-deleted, vfs:saved
 * 
 * VFS Methods exported for ide.js usage:
 * - projectDB.saveFile(path, content, language)
 * - projectDB.getFile(path)
 * - projectDB.getAllFiles()
 * - projectDB.deleteFile(path)
 * - projectDB.saveCommit(commitData)
 * - projectDB.getAllCommits()
 * - projectDB.getCommit(commitId)
 */

class ProjectDB {
    constructor(dbName = 'WebAppDB', version = 2) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.initPromise = this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Store for files: key = filePath, value = { content, language, lastModified }
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'path' });
                }
                // Store for settings/metadata
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta', { keyPath: 'key' });
                }
                // Store for version control commits
                if (!db.objectStoreNames.contains('commits')) {
                    db.createObjectStore('commits', { keyPath: 'id' });
                }
                // Store for generic key/value data (replaces localStorage)
                if (!db.objectStoreNames.contains('kv')) {
                    db.createObjectStore('kv', { keyPath: 'key' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ IndexedDB initialized');
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('❌ IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Save a file to IndexedDB and emit vfs:file-updated event
     * @param {string} path - File path
     * @param {string} content - File content
     * @param {string} language - Language identifier
     */
    async saveFile(path, content, language = 'javascript') {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('files', 'readwrite');
            const store = tx.objectStore('files');
            
            const record = {
                path,
                content,
                language,
                lastModified: Date.now()
            };

            const req = store.put(record);
            req.onsuccess = () => {
                // Dispatch custom event for UI updates
                window.dispatchEvent(new CustomEvent('vfs:file-updated', { 
                    detail: { path, content, language } 
                }));
                console.log('[VFS WRITE] IndexedDB:', path, 'bytes:', content.length);
                resolve(record);
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Read a file from IndexedDB
     * @param {string} path - File path
     * @returns {Promise<string|null>} File content or null
     */
    async getFile(path) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const req = store.get(path);

            req.onsuccess = () => {
                console.log('[VFS READ] IndexedDB:', path);
                resolve(req.result ? req.result.content : null);
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Get all files from IndexedDB
     * @returns {Promise<Object>} Object with paths as keys and content as values
     */
    async getAllFiles() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('files', 'readonly');
            const store = tx.objectStore('files');
            const req = store.getAll();

            req.onsuccess = () => {
                const files = {};
                req.result.forEach(f => files[f.path] = f.content);
                resolve(files);
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Delete a file from IndexedDB and emit vfs:file-deleted event
     * @param {string} path - File path
     */
    async deleteFile(path) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('files', 'readwrite');
            const store = tx.objectStore('files');
            const req = store.delete(path);

            req.onsuccess = () => {
                window.dispatchEvent(new CustomEvent('vfs:file-deleted', { detail: { path } }));
                console.log('[VFS DELETE] IndexedDB:', path);
                resolve(true);
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Save a version control commit snapshot
     * @param {Object} commitData - Commit object with id, timestamp, message, snapshot
     */
    async saveCommit(commitData) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('commits', 'readwrite');
            const store = tx.objectStore('commits');
            const req = store.put(commitData);
            req.onsuccess = () => {
                console.log('[VERSION] Commit saved to IndexedDB:', commitData.id);
                resolve(commitData);
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Get all commits sorted by timestamp (newest first)
     * @returns {Promise<Array>} Array of commit objects
     */
    async getAllCommits() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('commits', 'readonly');
            const store = tx.objectStore('commits');
            const req = store.getAll();
            req.onsuccess = () => {
                const commits = req.result || [];
                commits.sort((a, b) => b.timestamp - a.timestamp);
                resolve(commits);
            };
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Get a specific commit by ID
     * @param {string} commitId - Commit ID
     * @returns {Promise<Object|null>} Commit object or null
     */
    async getCommit(commitId) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('commits', 'readonly');
            const store = tx.objectStore('commits');
            const req = store.get(commitId);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    /**
     * Clear all files from IndexedDB
     */
    async clearAll() {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('files', 'readwrite');
            const store = tx.objectStore('files');
            const req = store.clear();
            req.onsuccess = () => resolve(true);
            req.onerror = () => reject(req.error);
        });
    }
}

// Global instance - accessible by ide.js and other modules
window.projectDB = new ProjectDB();

/**
 * KV_STORE - Async key/value access to the IndexedDB 'kv' store.
 * Backs the STORAGE facade below.
 */
const KV_STORE = {
    async _getDB() {
        await window.projectDB.initPromise;
        return window.projectDB.db;
    },

    async getAll() {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('kv', 'readonly');
            const req = tx.objectStore('kv').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    },

    async get(key) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('kv', 'readonly');
            const req = tx.objectStore('kv').get(key);
            req.onsuccess = () => resolve(req.result ? req.result.value : null);
            req.onerror = () => reject(req.error);
        });
    },

    async set(key, value) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('kv', 'readwrite');
            const req = tx.objectStore('kv').put({ key, value });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },

    async remove(key) {
        const db = await this._getDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('kv', 'readwrite');
            const req = tx.objectStore('kv').delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
};

/**
 * STORAGE - Synchronous key/value facade over IndexedDB that mirrors the
 * old localStorage API (getItem/setItem/removeItem/keys/length).
 *
 * - Reads/writes go through an in-memory mirror of the IndexedDB 'kv' store,
 *   so existing synchronous call sites keep working unchanged.
 * - Every write is persisted to IndexedDB asynchronously.
 * - On the first load, legacy localStorage data is copied into IndexedDB
 *   (marked by the '_storage_migrated' record) and the app's own localStorage
 *   keys are then removed, so no user data is lost and IndexedDB becomes the
 *   sole source of truth.
 * - Cross-tab notification (previously provided by the browser 'storage'
 *   event) is preserved via BroadcastChannel, re-dispatching synthetic
 *   'storage' events so existing listeners keep working.
 */
const MIGRATION_MARKER = '_storage_migrated';

const STORAGE = {
    _cache: {},
    _pendingWrites: {},
    _channel: null,
    _readyPromise: null,
    _initialized: false,

    async init() {
        // Best-effort seed from legacy localStorage (only this app's keys are
        // managed). It feeds the synchronous startup reads and is the source
        // for the one-time migration.
        const legacy = {};
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k !== null && STORAGE._isManagedKey(k)) legacy[k] = localStorage.getItem(k);
            }
        } catch (e) {
            console.error('[STORAGE] Legacy seed error:', e);
        }
        this._cache = { ...legacy };

        try {
            await window.projectDB.initPromise;

            let records = [];
            try {
                records = await KV_STORE.getAll();
            } catch (e) {
                console.error('[STORAGE] IndexedDB load error:', e);
            }
            const idb = {};
            for (const rec of records) {
                if (rec && rec.key !== undefined) idb[rec.key] = rec.value;
            }

            if (idb[MIGRATION_MARKER] === 'true') {
                // IndexedDB already holds the data and is authoritative.
                // Ignore legacy seeds so deleted keys are not resurrected.
                const pendingSnap = { ...this._cache };
                this._cache = { ...idb };
                delete this._cache[MIGRATION_MARKER];
                for (const k of Object.keys(this._pendingWrites)) {
                    if (pendingSnap[k] === undefined) delete this._cache[k];
                    else this._cache[k] = pendingSnap[k];
                }
            } else {
                // First migration: overlay any existing IndexedDB values over the
                // legacy seed, persist the merged cache, and mark migration done.
                for (const [k, v] of Object.entries(idb)) {
                    if (!this._pendingWrites[k]) this._cache[k] = v;
                }
                for (const k of Object.keys(this._cache)) {
                    if (this._pendingWrites[k]) continue;
                    await KV_STORE.set(k, this._cache[k]);
                }
                await KV_STORE.set(MIGRATION_MARKER, 'true');
                // Remove this app's legacy localStorage data only, leaving any
                // unrelated data on shared origins untouched.
                for (const k of Object.keys(this._cache)) {
                    if (STORAGE._isManagedKey(k)) {
                        try { localStorage.removeItem(k); } catch (e) {}
                    }
                }
            }
        } catch (e) {
            console.error('[STORAGE] IndexedDB unavailable, using legacy fallback:', e);
        }

        this._setupChannel();
        this._pendingWrites = {};
        this._initialized = true;
    },

    _isManagedKey(key) {
        return typeof key === 'string' && (key.startsWith('gem_') || key.startsWith('ide_'));
    },

    ready() {
        return this._readyPromise;
    },

    getItem(key) {
        return Object.prototype.hasOwnProperty.call(this._cache, key) ? this._cache[key] : null;
    },

    setItem(key, value) {
        const val = String(value);
        const oldValue = this.getItem(key);
        this._cache[key] = val;
        if (!this._initialized) this._pendingWrites[key] = true;
        if (this._channel) {
            this._channel.postMessage({ type: 'storage', key, newValue: val, oldValue });
        }
        KV_STORE.set(key, val).catch(e => console.error('[STORAGE] set error:', e));
    },

    removeItem(key) {
        const oldValue = this.getItem(key);
        delete this._cache[key];
        if (!this._initialized) this._pendingWrites[key] = true;
        if (this._channel) {
            this._channel.postMessage({ type: 'storage', key, newValue: null, oldValue });
        }
        KV_STORE.remove(key).catch(e => console.error('[STORAGE] remove error:', e));
    },

    keys() {
        return Object.keys(this._cache);
    },

    get length() {
        return Object.keys(this._cache).length;
    },

    _setupChannel() {
        if (typeof BroadcastChannel === 'undefined') return;
        try {
            this._channel = new BroadcastChannel('traliran-ai-hub-storage');
            this._channel.onmessage = (e) => {
                const d = e.data || {};
                if (d.type !== 'storage') return;
                if (d.newValue === null) {
                    delete this._cache[d.key];
                } else {
                    this._cache[d.key] = d.newValue;
                }
                try {
                    window.dispatchEvent(new StorageEvent('storage', {
                        key: d.key,
                        newValue: d.newValue,
                        oldValue: d.oldValue,
                        storageArea: localStorage
                    }));
                } catch (err) {
                    window.dispatchEvent(new CustomEvent('storage', { detail: d }));
                }
            };
        } catch (e) {
            console.error('[STORAGE] BroadcastChannel error:', e);
        }
    }
};

STORAGE._readyPromise = STORAGE.init();

const DB_CONNECTOR = {
  _config: null,

  _loadConfig() {
    if (this._config) return this._config;
    this._config = {
      url: STORAGE.getItem('gem_db_url') || '',
      key: STORAGE.getItem('gem_db_key') || '',
      type: STORAGE.getItem('gem_db_type') || '',
      email: STORAGE.getItem('gem_db_email') || '',
      token: STORAGE.getItem('gem_db_token') || '',
      refreshToken: STORAGE.getItem('gem_db_refresh_token') || '',
    };
    if (!this._config.type && this._config.url) {
      this._config.type = this.detectType(this._config.url);
      STORAGE.setItem('gem_db_type', this._config.type);
    }
    return this._config;
  },

  _saveConfig() {
    Object.entries(this._config).forEach(([k, v]) => {
      STORAGE.setItem(`gem_db_${k}`, v || '');
    });
  },

  _clearConfig() {
    Object.keys(this._config || {}).forEach(k => {
      STORAGE.removeItem(`gem_db_${k}`);
    });
    this._config = null;
  },

  detectType(url) {
    if (!url) return '';
    const u = url.toLowerCase();
    if (u.includes('firebase') || u.includes('firestore') || u.includes('identitytoolkit')) return 'firebase';
    if (u.includes('supabase')) return 'supabase';
    if (u.includes('pocketbase') || u.includes('pb.')) return 'pocketbase';
    return 'generic';
  },

  setConfig(url, key) {
    const cfg = this._loadConfig();
    cfg.url = url;
    cfg.key = key;
    cfg.type = url ? this.detectType(url) : '';
    STORAGE.setItem('gem_db_url', url);
    STORAGE.setItem('gem_db_key', key);
    STORAGE.setItem('gem_db_type', cfg.type);
    this._config = cfg;
  },

  isLoggedIn() {
    const cfg = this._loadConfig();
    return !!(cfg.token && cfg.url);
  },

  getUserEmail() {
    return this._loadConfig().email;
  },

  getDbType() {
    return this._loadConfig().type;
  },

  async register(email, password) {
    const cfg = this._loadConfig();
    if (!cfg.url || !cfg.key) throw new Error('Database URL and API Key required');

    if (cfg.type === 'firebase') {
      const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cfg.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Registration failed');
      cfg.email = email;
      cfg.token = data.idToken;
      cfg.refreshToken = data.refreshToken || '';
      this._saveConfig();
      return data;
    }

    if (cfg.type === 'supabase') {
      const resp = await fetch(`${cfg.url}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cfg.key },
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message || 'Registration failed');
      cfg.email = email;
      if (data.access_token) {
        cfg.token = data.access_token;
        cfg.refreshToken = data.refresh_token || '';
        this._saveConfig();
      }
      return data;
    }

    throw new Error(`Registration not supported for ${cfg.type || 'this'} database type`);
  },

  async login(email, password) {
    const cfg = this._loadConfig();
    if (!cfg.url) throw new Error('Database URL not configured');

    if (cfg.type === 'firebase') {
      if (!cfg.key) throw new Error('API Key required for Firebase');
      const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${cfg.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error?.message || 'Login failed');
      cfg.email = email;
      cfg.token = data.idToken;
      cfg.refreshToken = data.refreshToken || '';
      this._saveConfig();
      return data;
    }

    if (cfg.type === 'supabase') {
      const resp = await fetch(`${cfg.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cfg.key },
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error.message || 'Login failed');
      cfg.email = email;
      cfg.token = data.access_token;
      cfg.refreshToken = data.refresh_token || '';
      this._saveConfig();
      return data;
    }

    if (cfg.type === 'pocketbase') {
      const resp = await fetch(`${cfg.url}/api/collections/users/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: email, password })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Login failed');
      cfg.email = email;
      cfg.token = data.token;
      cfg.refreshToken = '';
      this._saveConfig();
      return data;
    }

    if (cfg.type === 'generic') {
      const resp = await fetch(`${cfg.url}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Login failed');
      cfg.email = email;
      cfg.token = data.token || data.accessToken || data.access_token || '';
      cfg.refreshToken = data.refreshToken || data.refresh_token || '';
      this._saveConfig();
      return data;
    }

    throw new Error(`Login not supported for ${cfg.type} database type`);
  },

  async logout() {
    const cfg = this._loadConfig();
    cfg.token = '';
    cfg.refreshToken = '';
    cfg.email = '';
    this._saveConfig();
  },

  getToken() {
    return this._loadConfig().token;
  },

  async _firestoreRequest(method, collection, docId, body) {
    const cfg = this._loadConfig();
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${cfg.url}/databases/(default)/documents/${collection}`;
    const url = docId ? `${baseUrl}/${docId}` : baseUrl;
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.token) headers['Authorization'] = `Bearer ${cfg.token}`;
    const resp = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `Firestore HTTP ${resp.status}`);
    }
    return resp.json();
  },

  async _supabaseRequest(method, collection, docId, body) {
    const cfg = this._loadConfig();
    const headers = { 'Content-Type': 'application/json', apikey: cfg.key, Prefer: 'return=representation' };
    if (cfg.token) headers['Authorization'] = `Bearer ${cfg.token}`;
    let url = `${cfg.url}/rest/v1/${collection}`;
    if (docId) url += `?id=eq.${encodeURIComponent(docId)}`;
    const resp = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `Supabase HTTP ${resp.status}`);
    }
    return resp.json();
  },

  async _pocketbaseRequest(method, collection, docId, body) {
    const cfg = this._loadConfig();
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.token) headers['Authorization'] = `Bearer ${cfg.token}`;
    let url = `${cfg.url}/api/collections/${collection}/records`;
    if (docId) url += `/${docId}`;
    const resp = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `PocketBase HTTP ${resp.status}`);
    }
    return resp.json();
  },

  async _genericRequest(method, collection, docId, body) {
    const cfg = this._loadConfig();
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.token) headers['Authorization'] = `Bearer ${cfg.token}`;
    let url = `${cfg.url}/${collection}`;
    if (docId) url += `/${docId}`;
    const resp = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${resp.status}`);
    }
    return resp.json();
  },

  async _request(method, collection, docId, body) {
    const cfg = this._loadConfig();
    if (!cfg.url) throw new Error('Database URL not configured');
    const type = cfg.type || 'generic';
    if (type === 'firebase') return this._firestoreRequest(method, collection, docId, body);
    if (type === 'supabase') return this._supabaseRequest(method, collection, docId, body);
    if (type === 'pocketbase') return this._pocketbaseRequest(method, collection, docId, body);
    return this._genericRequest(method, collection, docId, body);
  },

  async fetchData(collection) {
    const cfg = this._loadConfig();
    if (!cfg.url) return null;

    try {
      if (cfg.type === 'firebase') {
        const resp = await this._request('GET', collection, 'all');
        const obj = this._firestoreDocToObject(resp);
        return obj ? (obj.data || obj) : null;
      }

      let result = await this._request('GET', collection, null);

      if (cfg.type === 'supabase' && Array.isArray(result)) {
        if (result.length === 0) return null;
        return result[0]?.data || result[0] || null;
      }

      if (cfg.type === 'pocketbase') {
        const items = result.items || result;
        if (Array.isArray(items) && items.length === 0) return null;
        return items[0]?.data || items[0] || null;
      }

      return result;
    } catch (e) {
      if (e.message?.includes('404') || e.message?.includes('NOT_FOUND') || e.message?.includes('No rows')) return null;
      throw e;
    }
  },

  async saveData(collection, id, data) {
    const cfg = this._loadConfig();
    if (!cfg.url) throw new Error('Database URL not configured');

    const docId = id || 'all';

    if (cfg.type === 'firebase') {
      const converted = this._objectToFirestoreDoc({ data });
      return this._request('PATCH', collection, docId, converted);
    }

    if (cfg.type === 'supabase') {
      const payload = { id: docId, data };
      return this._request('POST', collection, null, payload);
    }

    if (cfg.type === 'pocketbase') {
      const payload = { id: docId, data };
      return this._request('PATCH', collection, docId, payload);
    }

    return this._request('PUT', collection, docId, { id: docId, data });
  },

  async deleteData(collection, id) {
    return this._request('DELETE', collection, id || 'all', null);
  },

  _firestoreDocToObject(doc) {
    if (!doc || !doc.fields) return null;
    const result = {};
    Object.entries(doc.fields).forEach(([key, value]) => {
      result[key] = this._firestoreValueToJS(value);
    });
    return result;
  },

  _firestoreValueToJS(value) {
    if (value.stringValue !== undefined) return value.stringValue;
    if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
    if (value.doubleValue !== undefined) return parseFloat(value.doubleValue);
    if (value.booleanValue !== undefined) return value.booleanValue;
    if (value.arrayValue) return (value.arrayValue.values || []).map(v => this._firestoreValueToJS(v));
    if (value.mapValue) return this._firestoreDocToObject(value.mapValue);
    if (value.nullValue !== undefined) return null;
    return null;
  },

  _objectToFirestoreDoc(obj) {
    const fields = {};
    Object.entries(obj).forEach(([key, value]) => {
      fields[key] = this._jsToFirestoreValue(value);
    });
    return { fields };
  },

  _jsToFirestoreValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === 'string') return { stringValue: value };
    if (typeof value === 'number') {
      if (Number.isInteger(value)) return { integerValue: String(value) };
      return { doubleValue: value };
    }
    if (typeof value === 'boolean') return { booleanValue: value };
    if (Array.isArray(value)) return { arrayValue: { values: value.map(v => this._jsToFirestoreValue(v)) } };
    if (typeof value === 'object') return { mapValue: this._objectToFirestoreDoc(value) };
    return { stringValue: String(value) };
  },

  configureFromUI(url, key) {
    this.setConfig(url, key);
  },

  async attemptLogin(email, password) {
    const cfg = this._loadConfig();
    if (!cfg.url) throw new Error('Please configure a Database URL first');
    return this.login(email, password);
  },

  async attemptRegister(email, password) {
    const cfg = this._loadConfig();
    if (!cfg.url) throw new Error('Please configure a Database URL first');
    return this.register(email, password);
  },

  async attemptLogout() {
    await this.logout();
  }
};

// Once IndexedDB-backed storage is loaded, re-read the DB config so any
// values that changed since the synchronous startup window are picked up.
STORAGE.ready().then(() => {
  DB_CONNECTOR._config = null;
}).catch(e => console.error('[DB_CONNECTOR] Config reload error:', e));
