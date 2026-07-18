const SYNC_MANAGER = {
  _syncQueue: [],
  _debounceTimers: {},
  _isOnline: navigator.onLine,
  _isSyncing: false,
  _statusCallback: null,

  COLLECTION_MAP: {
    hub_sessions: { key: 'gem_sessions' },
    hub_notes: { key: 'gem_notes' },
    hub_settings: { keys: ['gem_provider', 'gem_bot_name', 'gem_system_prompt', 'gem_temp', 'gem_topp', 'gem_tokens', 'gem_theme'], isSettings: true },
    ide_files: { key: 'ide_project_files' },
    ide_commits: { key: 'ide_git_commits' },
    ide_bots: { key: 'ide_custom_bots' },
    rag_knowledge: { key: 'gem_rag_kb' },
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
        const val = localStorage.getItem(key);
        if (val !== null) settings[key] = val;
      });
      Object.keys(localStorage).filter(k => k.startsWith('gem_key_')).forEach(k => {
        settings[k] = localStorage.getItem(k);
      });
      return settings;
    }

    if (map.key) {
      const val = localStorage.getItem(map.key);
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
        Object.entries(data).forEach(([key, val]) => {
          if (key !== 'id' && typeof val === 'string') {
            localStorage.setItem(key, val);
          }
        });
      }
      return;
    }

    if (map.key && data !== null && data !== undefined) {
      localStorage.setItem(map.key, typeof data === 'string' ? data : JSON.stringify(data));
    }
  },

  wrapStorageSave(originalFn, collection) {
    const self = this;
    return function (...args) {
      originalFn.apply(this, args);
      self.pushToCloud(collection);
    };
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
      await this.pullFromCloud(collection);
    }
    this.updateStatus('Sync complete');
  },

  async pushAll() {
    if (!DB_CONNECTOR.isLoggedIn()) return;
    this.updateStatus('Pushing all data...');
    const collections = Object.keys(this.COLLECTION_MAP);
    for (const collection of collections) {
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
