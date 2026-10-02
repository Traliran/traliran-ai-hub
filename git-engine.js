// Git-compatible object builder (real git on-disk format, KISS subset).
// Generates .git/ content (blobs, trees, commits, refs) so exported ZIPs
// are valid git repositories readable by the C git CLI.
// All comments and identifiers are in English.

const GIT_ENGINE = (() => {
  const AUTHOR_NAME = 'Traliran IDE';
  const AUTHOR_EMAIL = 'ide@traliran.local';
  const DEFAULT_BRANCH = 'main';

  const enc = new TextEncoder();

  function hex(bytes) {
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function concat(chunks) {
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }

  // SHA-1 of raw (uncompressed) git object bytes.
  async function sha1Hex(data) {
    const digest = await crypto.subtle.digest('SHA-1', data);
    return hex(new Uint8Array(digest));
  }

  // Git objects are stored zlib-wrapped. CompressionStream('deflate') emits zlib.
  async function deflate(data) {
    if (typeof CompressionStream === 'undefined') return data;
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate'));
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }

  function blobRaw(contentBytes) {
    const header = enc.encode(`blob ${contentBytes.length}\0`);
    return concat([header, contentBytes]);
  }

  function treeRaw(entries) {
    // entries: [{ mode, name, shaHex }] sorted by name.
    const body = concat(
      entries.map((e) => {
        const head = enc.encode(`${e.mode} ${e.name}\0`);
        const sha = new Uint8Array(20);
        for (let i = 0; i < 20; i++) sha[i] = parseInt(e.shaHex.slice(i * 2, i * 2 + 2), 16);
        return concat([head, sha]);
      })
    );
    return concat([enc.encode(`tree ${body.length}\0`), body]);
  }

  function commitRaw(treeSha, parentSha, message, timestampSec) {
    const stamp = `${timestampSec} +0000`;
    let text = `tree ${treeSha}\n`;
    if (parentSha) text += `parent ${parentSha}\n`;
    text += `author ${AUTHOR_NAME} <${AUTHOR_EMAIL}> ${stamp}\n`;
    text += `committer ${AUTHOR_NAME} <${AUTHOR_EMAIL}> ${stamp}\n\n`;
    text += `${message}\n`;
    const body = enc.encode(text);
    return concat([enc.encode(`commit ${body.length}\0`), body]);
  }

  // Build nested tree objects from a flat snapshot: { path: { content } }.
  // Returns { rootSha, objects } where objects maps sha -> raw bytes.
  async function buildTreeForSnapshot(snapshot) {
    const objects = new Map();
    const blobShaByPath = {};

    // 1. Blobs (dedup by content automatically via sha key).
    for (const [path, file] of Object.entries(snapshot || {})) {
      if (path.startsWith('.git/')) continue; // Never version the .git dir itself.
      const content = typeof file === 'string' ? file : file.content || '';
      const raw = blobRaw(enc.encode(content));
      const sha = await sha1Hex(raw);
      objects.set(sha, raw);
      blobShaByPath[path] = sha;
    }

    // 2. Nested dir structure.
    const root = { dirs: {}, files: {} };
    for (const [path, sha] of Object.entries(blobShaByPath)) {
      const parts = path.split('/').filter(Boolean);
      let node = root;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!node.dirs[parts[i]]) node.dirs[parts[i]] = { dirs: {}, files: {} };
        node = node.dirs[parts[i]];
      }
      node.files[parts[parts.length - 1]] = sha;
    }

    async function writeTree(node) {
      const entries = [];
      for (const [name, sha] of Object.entries(node.files)) {
        entries.push({ mode: '100644', name, shaHex: sha });
      }
      for (const [name, child] of Object.entries(node.dirs)) {
        const childSha = await writeTree(child);
        entries.push({ mode: '40000', name, shaHex: childSha });
      }
      entries.sort((a, b) => (a.name < b.name ? -1 : 1));
      const raw = treeRaw(entries);
      const sha = await sha1Hex(raw);
      objects.set(sha, raw);
      return sha;
    }

    const rootSha = await writeTree(root);
    return { rootSha, objects };
  }

  // Build full .git/ file list from commit history (newest-first).
  // Each commit: { id, message, timestamp, snapshot, branch }.
  // Returns { gitFiles: [{ path, data }], shaByCommitId, tipByBranch }.
  async function buildGitFiles(commitsNewestFirst, branches, currentBranch) {
    const ordered = [...(commitsNewestFirst || [])].reverse(); // Oldest first.
    const objects = new Map(); // sha -> raw bytes.
    const shaByCommitId = {};
    const tipByBranch = {};
    let prevSha = null;

    for (const commit of ordered) {
      const { rootSha, objects: treeObjects } = await buildTreeForSnapshot(commit.snapshot || {});
      for (const [sha, raw] of treeObjects) objects.set(sha, raw);

      const timestampSec = Math.floor((commit.timestamp || Date.now()) / 1000);
      const raw = commitRaw(rootSha, prevSha, commit.message || 'Untitled commit', timestampSec);
      const sha = await sha1Hex(raw);
      objects.set(sha, raw);

      shaByCommitId[commit.id] = sha;
      prevSha = sha;
      const branch = commit.branch || currentBranch || DEFAULT_BRANCH;
      tipByBranch[branch] = sha;
    }

    // Ensure every known branch has a ref (empty branches point at tip).
    for (const name of Object.keys(branches || {})) {
      if (!tipByBranch[name] && prevSha) tipByBranch[name] = branches[name] || prevSha;
    }
    if (currentBranch && prevSha && !tipByBranch[currentBranch]) {
      tipByBranch[currentBranch] = prevSha;
    }

    // Deflate all objects for .git/objects/.
    const gitFiles = [];
    for (const [sha, raw] of objects) {
      const packed = await deflate(raw);
      gitFiles.push({ path: `.git/objects/${sha.slice(0, 2)}/${sha.slice(2)}`, data: packed });
    }

    const activeBranch = currentBranch || DEFAULT_BRANCH;
    gitFiles.push({ path: '.git/HEAD', data: enc.encode(`ref: refs/heads/${activeBranch}\n`) });
    gitFiles.push({
      path: '.git/config',
      data: enc.encode('[core]\n\trepositoryformatversion = 0\n\tfilemode = false\n\tbare = false\n'),
    });
    for (const [name, sha] of Object.entries(tipByBranch)) {
      if (sha) gitFiles.push({ path: `.git/refs/heads/${name}`, data: enc.encode(`${sha}\n`) });
    }
    // Minimal reflog so `git log -g` has content.
    if (prevSha) {
      gitFiles.push({
        path: '.git/logs/HEAD',
        data: enc.encode(`0000000000000000000000000000000000000000 ${prevSha} ${AUTHOR_NAME} <${AUTHOR_EMAIL}> 0 +0000\tclone: from traliran-ide\n`),
      });
    }
    // Machine-readable backup used for ZIP re-import (ignored by git CLI).
    gitFiles.push({
      path: '.git/traliran-meta.json',
      data: enc.encode(
        JSON.stringify({ branches: tipByBranch, currentBranch: activeBranch, shaByCommitId }, null, 2)
      ),
    });

    return { gitFiles, shaByCommitId, tipByBranch };
  }

  // Split imported ZIP entries into workspace files and git meta.
  function splitZipEntries(entries) {
    // entries: [{ path, data }] with data as string (text files only here).
    const files = {};
    let meta = null;
    for (const e of entries) {
      if (e.path.startsWith('.git/')) {
        if (e.path === '.git/traliran-meta.json') {
          try {
            meta = JSON.parse(typeof e.data === 'string' ? e.data : enc.decode(e.data));
          } catch {
            meta = null;
          }
        }
        continue; // Never import .git internals into the workspace.
      }
      if (e.path.endsWith('/')) continue;
      files[e.path] = e.data;
    }
    return { files, meta };
  }

  return { DEFAULT_BRANCH, sha1Hex, buildGitFiles, splitZipEntries };
})();
