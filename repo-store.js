// Multi-repository store for the IDE workspace (KISS layer over STORAGE).
// Each repository keeps its own files, snapshot commits, branch and git SHAs.
// The pre-existing single-workspace keys (ide_vfs_files / ide_vfs_commits)
// are preserved as a mirror of the active repo for backward compatibility
// with cloud sync and older code paths.
// All comments and identifiers are in English.

const REPO_STORE = (() => {
  const INDEX_KEY = 'ide_repos_index';
  const ACTIVE_KEY = 'ide_active_repo_id';

  const filesKey = (id) => `ide_repo_${id}_files`;
  const commitsKey = (id) => `ide_repo_${id}_commits`;
  const metaKey = (id) => `ide_repo_${id}_git`;

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function sanitizeName(name, fallback) {
    const clean = String(name || '').trim().replace(/[^\w\-. ]+/g, '').slice(0, 40);
    return clean || fallback;
  }

  function sanitizeBranch(name) {
    const clean = String(name || '').trim().replace(/[^a-zA-Z0-9_\-./]+/g, '-').replace(/^\.+|\.+$/g, '').slice(0, 64);
    return clean || 'main';
  }

  function defaultMeta(branch = 'main') {
    return { currentBranch: branch, branches: { [branch]: null }, shaByCommitId: {} };
  }

  function loadIndex() {
    try {
      const raw = STORAGE.getItem(INDEX_KEY);
      const list = raw ? JSON.parse(raw) : null;
      if (Array.isArray(list) && list.length > 0) return list;
    } catch {
      // Fall through to migration.
    }
    return null;
  }

  function saveIndex(repos) {
    STORAGE.setItem(INDEX_KEY, JSON.stringify(repos));
  }

  function loadMeta(repoId) {
    try {
      const raw = STORAGE.getItem(metaKey(repoId));
      if (raw) return { ...defaultMeta(), ...JSON.parse(raw) };
    } catch {
      // Corrupted meta resets to default.
    }
    return defaultMeta();
  }

  function saveMeta(repoId, meta) {
    STORAGE.setItem(metaKey(repoId), JSON.stringify(meta));
  }

  const api = {
    repos: [],
    activeId: null,
    meta: defaultMeta(),

    // Load index, migrate legacy single workspace, resolve active repo.
    init() {
      let repos = loadIndex();
      if (!repos) {
        // One-time migration: wrap the existing workspace into repo "main".
        let legacyFiles = {};
        let legacyCommits = [];
        try {
          legacyFiles = JSON.parse(STORAGE.getItem('ide_vfs_files') || '{}');
          legacyCommits = JSON.parse(STORAGE.getItem('ide_vfs_commits') || '[]');
        } catch {
          legacyFiles = {};
          legacyCommits = [];
        }
        const id = 'repo_main';
        repos = [{ id, name: 'main', createdAt: Date.now() }];
        saveIndex(repos);
        STORAGE.setItem(filesKey(id), JSON.stringify(legacyFiles));
        STORAGE.setItem(commitsKey(id), JSON.stringify(Array.isArray(legacyCommits) ? legacyCommits : []));
        saveMeta(id, defaultMeta('main'));
      }
      this.repos = repos;
      this.activeId = STORAGE.getItem(ACTIVE_KEY) || repos[0].id;
      if (!repos.some((r) => r.id === this.activeId)) this.activeId = repos[0].id;
      this.meta = loadMeta(this.activeId);
      return this.getActive();
    },

    getActive() {
      return this.repos.find((r) => r.id === this.activeId) || this.repos[0];
    },

    list() {
      return [...this.repos];
    },

    getFilesKey() {
      return filesKey(this.activeId);
    },

    getCommitsKey() {
      return commitsKey(this.activeId);
    },

    // Persist active files + mirror to legacy keys for cloud sync compat.
    saveFiles(filesObj) {
      const json = JSON.stringify(filesObj);
      STORAGE.setItem(filesKey(this.activeId), json);
      STORAGE.setItem('ide_vfs_files', json);
    },

    loadFiles() {
      try {
        const raw = STORAGE.getItem(filesKey(this.activeId));
        if (raw) return JSON.parse(raw);
      } catch {
        // Return empty below.
      }
      return {};
    },

    saveCommits(commits) {
      const json = JSON.stringify(commits);
      STORAGE.setItem(commitsKey(this.activeId), json);
      STORAGE.setItem('ide_vfs_commits', json);
    },

    loadCommits() {
      try {
        const raw = STORAGE.getItem(commitsKey(this.activeId));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch {
        // Return empty below.
      }
      return [];
    },

    create(name) {
      const repo = {
        id: uid('repo'),
        name: sanitizeName(name, `repo-${this.repos.length + 1}`),
        createdAt: Date.now(),
      };
      this.repos.push(repo);
      saveIndex(this.repos);
      STORAGE.setItem(filesKey(repo.id), JSON.stringify({}));
      STORAGE.setItem(commitsKey(repo.id), JSON.stringify([]));
      saveMeta(repo.id, defaultMeta('main'));
      return repo;
    },

    rename(id, name) {
      const repo = this.repos.find((r) => r.id === id);
      if (!repo) return;
      repo.name = sanitizeName(name, repo.name);
      saveIndex(this.repos);
    },

    remove(id) {
      if (this.repos.length <= 1) throw new Error('Cannot delete the last repository');
      this.repos = this.repos.filter((r) => r.id !== id);
      STORAGE.removeItem(filesKey(id));
      STORAGE.removeItem(commitsKey(id));
      STORAGE.removeItem(metaKey(id));
      saveIndex(this.repos);
      if (this.activeId === id) {
        this.activeId = this.repos[0].id;
        STORAGE.setItem(ACTIVE_KEY, this.activeId);
        this.meta = loadMeta(this.activeId);
      }
    },

    switch(id) {
      if (!this.repos.some((r) => r.id === id)) throw new Error('Repository not found');
      this.activeId = id;
      STORAGE.setItem(ACTIVE_KEY, id);
      this.meta = loadMeta(id);
      return this.getActive();
    },

    // --- Branches (per active repo, stored in git meta) ---

    getBranch() {
      return this.meta.currentBranch || 'main';
    },

    listBranches() {
      return Object.keys(this.meta.branches || { main: null });
    },

    createBranch(name) {
      const clean = sanitizeBranch(name);
      if (!this.meta.branches) this.meta.branches = {};
      if (!this.meta.branches[clean]) {
        // New branch starts at current tip (may be null for empty history).
        const cur = this.meta.currentBranch || 'main';
        this.meta.branches[clean] = this.meta.branches[cur] || null;
      }
      this.meta.currentBranch = clean;
      saveMeta(this.activeId, this.meta);
      return clean;
    },

    switchBranch(name) {
      const clean = sanitizeBranch(name);
      if (!this.meta.branches || !(clean in this.meta.branches)) {
        throw new Error('Branch not found');
      }
      this.meta.currentBranch = clean;
      saveMeta(this.activeId, this.meta);
      return clean;
    },

    // Record git SHA linkage after a snapshot commit is created.
    linkCommitSha(commitId, sha, treeSha, branch) {
      if (!this.meta.shaByCommitId) this.meta.shaByCommitId = {};
      if (!this.meta.branches) this.meta.branches = {};
      this.meta.shaByCommitId[commitId] = sha;
      const target = branch || this.meta.currentBranch || 'main';
      this.meta.currentBranch = target;
      this.meta.branches[target] = sha;
      if (treeSha) this.meta.shaByCommitId[`${commitId}:tree`] = treeSha;
      saveMeta(this.activeId, this.meta);
    },

    getCommitSha(commitId) {
      return (this.meta.shaByCommitId && this.meta.shaByCommitId[commitId]) || null;
    },

    // Find latest snapshot commit id for a branch tip (by stored branch name).
    findTipCommitId(commits, branch) {
      const list = [...(commits || [])].reverse(); // Oldest first.
      let tip = null;
      for (const c of list) {
        if ((c.branch || 'main') === branch) tip = c.id;
      }
      return tip;
    },
  };

  return api;
})();
