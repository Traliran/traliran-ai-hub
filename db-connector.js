--- db-connector.js (原始)
const DB_CONNECTOR = {
  _config: null,

  _loadConfig() {
    if (this._config) return this._config;
    this._config = {
      url: localStorage.getItem('gem_db_url') || '',
      key: localStorage.getItem('gem_db_key') || '',
      type: localStorage.getItem('gem_db_type') || '',
      email: localStorage.getItem('gem_db_email') || '',
      token: localStorage.getItem('gem_db_token') || '',
      refreshToken: localStorage.getItem('gem_db_refresh_token') || '',
    };
    if (!this._config.type && this._config.url) {
      this._config.type = this.detectType(this._config.url);
      localStorage.setItem('gem_db_type', this._config.type);
    }
    return this._config;
  },

  _saveConfig() {
    Object.entries(this._config).forEach(([k, v]) => {
      localStorage.setItem(`gem_db_${k}`, v || '');
    });
  },

  _clearConfig() {
    ['url', 'key', 'type', 'email', 'token', 'refresh_token'].forEach(k => {
      localStorage.removeItem(`gem_db_${k}`);
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
    localStorage.setItem('gem_db_url', url);
    localStorage.setItem('gem_db_key', key);
    localStorage.setItem('gem_db_type', cfg.type);
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

+++ db-connector.js (修改后)
/**
 * db-connector.js
 * Централизованная VFS (Virtual File System) на базе IndexedDB.
 * ВСЕ взаимодействия с файлами идут только через этот модуль.
 */

class ProjectDB {
    constructor(dbName = 'IDE_VFS', version = 1) {
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
                if (!db.objectStoreNames.contains('files')) {
                    const store = db.createObjectStore('files', { keyPath: 'path' });
                    store.createIndex('lastModified', 'lastModified', { unique: false });
                    console.log('[VFS SYSTEM] IndexedDB initialized');
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('[VFS SYSTEM] Database connection established');
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('[VFS ERROR] Failed to open DB:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    async ensureReady() {
        if (!this.db) await this.initPromise;
    }

    /**
     * Сохраняет файл в VFS и эмитит событие обновления
     * @param {string} path - Путь к файлу (например, 'index.html')
     * @param {string} content - Содержимое файла
     */
    async saveFile(path, content) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');

            const fileRecord = {
                path: path,
                content: content,
                lastModified: Date.now()
            };

            const request = store.put(fileRecord);

            request.onsuccess = () => {
                // ЯРКОЕ ЛОГИРОВАНИЕ ЗАПИСИ
                console.log(`%c[VFS WRITE] ${path} (${content.length} bytes)`, 'color: #00ff00; font-weight: bold; background: #003300; padding: 2px 5px;');

                // Эмитим реактивное событие для всех подписчиков (Monaco, Preview, etc.)
                window.dispatchEvent(new CustomEvent('vfs:file-updated', {
                    detail: { path, content, timestamp: fileRecord.lastModified }
                }));

                resolve(fileRecord);
            };

            request.onerror = (e) => {
                console.error(`[VFS ERROR] Failed to save ${path}:`, e.target.error);
                reject(e.target.error);
            };
        });
    }

    /**
     * Читает файл из VFS
     * @param {string} path - Путь к файлу
     * @returns {Promise<string|null>}
     */
    async getFile(path) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.get(path);

            request.onsuccess = () => {
                const record = request.result;
                if (record) {
                    // ЯРКОЕ ЛОГИРОВАНИЕ ЧТЕНИЯ
                    console.log(`%c[VFS READ] ${path} (${record.content.length} bytes)`, 'color: #00ccff; font-weight: bold; background: #003344; padding: 2px 5px;');
                    resolve(record.content);
                } else {
                    console.log(`[VFS READ] ${path} not found (null)`);
                    resolve(null);
                }
            };

            request.onerror = (e) => {
                console.error(`[VFS ERROR] Failed to get ${path}:`, e.target.error);
                reject(e.target.error);
            };
        });
    }

    /**
     * Получает все файлы из VFS
     * @returns {Promise<Array<{path: string, content: string}>>}
     */
    async getAllFiles() {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readonly');
            const store = transaction.objectStore('files');
            const request = store.getAll();

            request.onsuccess = () => {
                const files = request.result.map(r => ({ path: r.path, content: r.content }));
                console.log(`[VFS READ] All files loaded: ${files.length} items`);
                resolve(files);
            };

            request.onerror = (e) => {
                reject(e.target.error);
            };
        });
    }

    /**
     * Удаляет файл из VFS
     */
    async deleteFile(path) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.delete(path);

            request.onsuccess = () => {
                console.log(`%c[VFS DELETE] ${path}`, 'color: #ff0000; font-weight: bold;');
                window.dispatchEvent(new CustomEvent('vfs:file-deleted', { detail: { path } }));
                resolve();
            };

            request.onerror = (e) => reject(e.target.error);
        });
    }

    async clearAll() {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['files'], 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.clear();

            request.onsuccess = () => {
                console.log('[VFS SYSTEM] All files cleared');
                window.dispatchEvent(new CustomEvent('vfs:cleared'));
                resolve();
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

// Глобальный экземпляр VFS
window.projectDB = new ProjectDB();
