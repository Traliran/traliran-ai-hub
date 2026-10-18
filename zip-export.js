// Self-contained ZIP export/import for the IDE workspace.
// No external libraries: the ZIP container is written and parsed by hand
// (STORE method only) and file data is read straight from the IndexedDB
// cache (STORAGE). Works fully offline.
// All comments and user-facing strings are in English.

(function (global) {
    'use strict';

    var enc = new TextEncoder();
    var dec = new TextDecoder();

    // --- CRC32 (standard ZIP polynomial 0xEDB88320) ---

    var CRC_TABLE = null;

    function crcTable() {
        if (CRC_TABLE) return CRC_TABLE;
        CRC_TABLE = new Uint32Array(256);
        for (var n = 0; n < 256; n++) {
            var c = n;
            for (var k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            }
            CRC_TABLE[n] = c >>> 0;
        }
        return CRC_TABLE;
    }

    function crc32(data) {
        var table = crcTable();
        var crc = 0xFFFFFFFF;
        for (var i = 0; i < data.length; i++) {
            crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        }
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    // --- DOS date/time (local time, 2-second resolution) ---

    function dosDateTime(date) {
        var d = date || new Date();
        var time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() >> 1) & 31);
        var day = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | (d.getDate() & 31);
        return { time: time, date: day };
    }

    function writeU16(view, offset, value) {
        view.setUint16(offset, value, true);
    }

    function writeU32(view, offset, value) {
        view.setUint32(offset, value >>> 0, true);
    }

    // --- ZIP writer (STORE / method 0, UTF-8 names) ---
    // entries: [{ name: string, data: Uint8Array }]. Directory entries
    // (names ending with "/") are stored with zero sizes.

    function buildZip(entries) {
        var list = Array.isArray(entries) ? entries : [];
        var names = list.map(function (e) { return enc.encode(String(e.name)); });
        var stamp = dosDateTime();

        var localSize = 0;
        var centralSize = 0;
        for (var i = 0; i < list.length; i++) {
            localSize += 30 + names[i].length + list[i].data.length;
            centralSize += 46 + names[i].length;
        }

        var total = localSize + centralSize + 22;
        var buf = new ArrayBuffer(total);
        var view = new DataView(buf);
        var out = new Uint8Array(buf);
        var pos = 0;
        var offsets = [];

        for (var j = 0; j < list.length; j++) {
            var name = names[j];
            var data = list[j].data;
            var crc = crc32(data);
            offsets.push(pos);

            // Local file header.
            writeU32(view, pos, 0x04034b50); pos += 4; // Signature.
            writeU16(view, pos, 20); pos += 2;         // Version needed.
            writeU16(view, pos, 0x0800); pos += 2;    // Flags: UTF-8 names.
            writeU16(view, pos, 0); pos += 2;         // Method: STORE.
            writeU16(view, pos, stamp.time); pos += 2;
            writeU16(view, pos, stamp.date); pos += 2;
            writeU32(view, pos, crc); pos += 4;
            writeU32(view, pos, data.length); pos += 4;
            writeU32(view, pos, data.length); pos += 4;
            writeU16(view, pos, name.length); pos += 2;
            writeU16(view, pos, 0); pos += 2;         // Extra field length.
            out.set(name, pos); pos += name.length;
            out.set(data, pos); pos += data.length;
        }

        var centralStart = pos;
        for (var k = 0; k < list.length; k++) {
            var nm = names[k];
            var dt = list[k].data;
            // Central directory header.
            writeU32(view, pos, 0x02014b50); pos += 4; // Signature.
            writeU16(view, pos, 20); pos += 2;         // Version made by.
            writeU16(view, pos, 20); pos += 2;         // Version needed.
            writeU16(view, pos, 0x0800); pos += 2;    // Flags: UTF-8 names.
            writeU16(view, pos, 0); pos += 2;         // Method: STORE.
            writeU16(view, pos, stamp.time); pos += 2;
            writeU16(view, pos, stamp.date); pos += 2;
            writeU32(view, pos, crc32(dt)); pos += 4;
            writeU32(view, pos, dt.length); pos += 4;
            writeU32(view, pos, dt.length); pos += 4;
            writeU16(view, pos, nm.length); pos += 2;
            writeU16(view, pos, 0); pos += 2;         // Extra length.
            writeU16(view, pos, 0); pos += 2;         // Comment length.
            writeU16(view, pos, 0); pos += 2;         // Disk number.
            writeU16(view, pos, 0); pos += 2;         // Internal attrs.
            writeU32(view, pos, 0); pos += 4;         // External attrs.
            writeU32(view, pos, offsets[k]); pos += 4; // Local header offset.
            out.set(nm, pos); pos += nm.length;
        }

        var centralLen = pos - centralStart;
        // End of central directory.
        writeU32(view, pos, 0x06054b50); pos += 4; // Signature.
        writeU16(view, pos, 0); pos += 2;          // Disk number.
        writeU16(view, pos, 0); pos += 2;          // Central dir disk.
        writeU16(view, pos, list.length); pos += 2;
        writeU16(view, pos, list.length); pos += 2;
        writeU32(view, pos, centralLen); pos += 4;
        writeU32(view, pos, centralStart); pos += 4;
        writeU16(view, pos, 0); pos += 2;          // Comment length.

        return out;
    }

    // --- ZIP reader (methods 0/STORE and 8/DEFLATE) ---

    function findEocd(data) {
        // EOCD is at most 22 + 65535 bytes from the end; scan backwards.
        var start = Math.max(0, data.length - (22 + 65535));
        for (var i = data.length - 22; i >= start; i--) {
            if (data[i] === 0x50 && data[i + 1] === 0x4B && data[i + 2] === 0x05 && data[i + 3] === 0x06) {
                return i;
            }
        }
        return -1;
    }

    function readU16(data, offset) {
        return data[offset] | (data[offset + 1] << 8);
    }

    function readU32(data, offset) {
        return (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)) >>> 0;
    }

    function inflateRaw(data) {
        // Native decompression, no external library needed.
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('DEFLATE entries are not supported in this browser.');
        }
        var stream = new DecompressionStream('deflate-raw');
        var writer = stream.writable.getWriter();
        writer.write(data);
        writer.close();
        return new Response(stream.readable).arrayBuffer().then(function (buf) {
            return new Uint8Array(buf);
        });
    }

    // Returns a Promise resolving to [{ name, data: Uint8Array }].
    async function parseZip(buffer) {
        var data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        var eocd = findEocd(data);
        if (eocd < 0) throw new Error('Not a valid ZIP file.');
        var count = readU16(data, eocd + 10);
        var centralOffset = readU32(data, eocd + 16);

        var pos = centralOffset;
        var entries = [];
        for (var i = 0; i < count; i++) {
            if (readU32(data, pos) !== 0x02014b50) throw new Error('Corrupted ZIP directory.');
            var method = readU16(data, pos + 10);
            var nameLen = readU16(data, pos + 28);
            var extraLen = readU16(data, pos + 30);
            var commentLen = readU16(data, pos + 32);
            var localOffset = readU32(data, pos + 42);
            // Compressed size from the central directory is authoritative: for
            // streamed archives (data-descriptor flag) the local header stores 0.
            var compSize = readU32(data, pos + 20);
            var nameBytes = data.slice(pos + 46, pos + 46 + nameLen);
            var name = dec.decode(nameBytes);
            pos += 46 + nameLen + extraLen + commentLen;

            if (readU32(data, localOffset) !== 0x04034b50) throw new Error('Corrupted ZIP entry.');
            var localNameLen = readU16(data, localOffset + 26);
            var localExtraLen = readU16(data, localOffset + 28);
            var dataStart = localOffset + 30 + localNameLen + localExtraLen;
            var raw = data.slice(dataStart, dataStart + compSize);

            var content;
            if (method === 0) {
                content = raw;
            } else if (method === 8) {
                content = await inflateRaw(raw);
            } else {
                throw new Error('Unsupported compression method: ' + method);
            }
            if (!name.endsWith('/')) entries.push({ name: name, data: content });
        }
        return entries;
    }

    // --- Cache access (IndexedDB-backed STORAGE, with live-memory fallback) ---

    function readJsonCache(key, fallback) {
        try {
            if (typeof STORAGE !== 'undefined') {
                var raw = STORAGE.getItem(key);
                if (raw) return JSON.parse(raw);
            }
        } catch (e) {
            console.error('[ZIP_EXPORT] Cache read error:', e);
        }
        return fallback;
    }

    function collectRepoData() {
        // Prefer the IndexedDB cache so export reflects persisted state.
        var activeId = STORAGE.getItem('ide_active_repo_id');
        if (!activeId && REPO_STORE.activeId) {
            activeId = REPO_STORE.activeId;
        }

        var repoName = 'workspace';
        try {
            repoName = REPO_STORE.getActive().name || repoName;
        } catch (e) { /* Keep default name. */ }

        var files = readJsonCache(activeId ? ('ide_repo_' + activeId + '_files') : 'ide_vfs_files', null)
            || readJsonCache('ide_vfs_files', null)
            || vfsFiles;

        var commits = readJsonCache(activeId ? ('ide_repo_' + activeId + '_commits') : 'ide_vfs_commits', null)
            || readJsonCache('ide_vfs_commits', null)
            || commitHistory;

        var gitMeta = readJsonCache(activeId ? ('ide_repo_' + activeId + '_git') : '', null) || null;
        var branches = (gitMeta && gitMeta.branches) || null;
        var currentBranch = (gitMeta && gitMeta.currentBranch) || null;
        try {
            if ((!branches || !currentBranch) && REPO_STORE.meta) {
                branches = branches || REPO_STORE.meta.branches;
                currentBranch = currentBranch || REPO_STORE.meta.currentBranch;
            }
        } catch (e) { /* Keep cache values. */ }
        if (!branches) branches = { main: null };
        if (!currentBranch) currentBranch = 'main';

        return {
            repoName: repoName,
            files: files || {},
            commits: Array.isArray(commits) ? commits : [],
            branches: branches,
            currentBranch: currentBranch
        };
    }

    function sanitizeRepoName(name) {
        var clean = String(name || 'workspace').replace(/[^\w\-.]+/g, '-').replace(/^-+|-+$/g, '');
        return clean || 'workspace';
    }

    // --- .git payload ---
    // Uses the real git object builder so the exported archive is a valid
    // git repository with branches.

    async function collectGitFiles(repo) {
        var built = await GIT_ENGINE.buildGitFiles(repo.commits, repo.branches, repo.currentBranch);
        return built.gitFiles || [];
    }

    function toBytes(value) {
        if (value instanceof Uint8Array) return value;
        if (typeof value === 'string') return enc.encode(value);
        return enc.encode(String(value));
    }

    function downloadBlob(blob, filename) {
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    }

    function fail(message) {
        console.error('[ZIP_EXPORT]', message);
        if (typeof notifyError !== 'undefined') notifyError(message);
        else if (typeof notify !== 'undefined') notify(message, 'error');
    }

    function done(message) {
        console.log('[ZIP_EXPORT]', message);
        if (typeof notifySuccess !== 'undefined') notifySuccess(message);
        else if (typeof notify !== 'undefined') notify(message, 'success');
    }

    // --- Public API ---

    // Packs the working tree, the full .git history (all commits, all
    // branches) and a commit backup from the IndexedDB cache, then
    // downloads the archive named after the repository.
    async function exportActiveRepo() {
        try {
            var repo = collectRepoData();
            var entries = [];

            // 1. Working tree files at the archive root.
            var paths = Object.keys(repo.files).sort();
            for (var i = 0; i < paths.length; i++) {
                var path = paths[i];
                if (path.startsWith('.git/')) continue; // Regenerated below.
                var file = repo.files[path];
                var content = (file && typeof file === 'object' && 'content' in file) ? file.content : file;
                entries.push({ name: path, data: toBytes(content == null ? '' : content) });
            }

            // 2. Full git repository data (objects, refs, branches).
            var gitFiles = await collectGitFiles(repo);
            for (var j = 0; j < gitFiles.length; j++) {
                entries.push({ name: gitFiles[j].path, data: toBytes(gitFiles[j].data) });
            }

            // 3. Complete commit backup so import restores full history.
            entries.push({
                name: '.git/traliran-commits.json',
                data: enc.encode(JSON.stringify(repo.commits))
            });

            var bytes = buildZip(entries);
            var blob = new Blob([bytes], { type: 'application/zip' });
            downloadBlob(blob, sanitizeRepoName(repo.repoName) + '.zip');
            done('Repository exported as ZIP.');
        } catch (e) {
            fail('Failed to export ZIP: ' + (e && e.message ? e.message : e));
        }
    }

    // Restores working tree files, commit history and branches from a
    // ZIP produced by exportActiveRepo (plain file ZIPs work too).
    async function importRepoZip(file) {
        try {
            if (!file) {
                fail('No file selected for import.');
                return;
            }
            var raw = new Uint8Array(await file.arrayBuffer());
            var entries = await parseZip(raw);
            if (entries.length === 0) {
                fail('The ZIP archive is empty.');
                return;
            }

            // Decode only UTF-8 text entries; binary files are skipped so they
            // are never corrupted into replacement-character garbage.
            var textByName = {};
            var binarySkipped = 0;
            var fatalDecoder = new TextDecoder('utf-8', { fatal: true });
            for (var i = 0; i < entries.length; i++) {
                var entryName = entries[i].name;
                if (entryName.startsWith('.git/')) {
                    textByName[entryName] = dec.decode(entries[i].data);
                    continue;
                }
                try {
                    textByName[entryName] = fatalDecoder.decode(entries[i].data);
                } catch (e) {
                    binarySkipped++;
                    console.warn('[ZIP_EXPORT] Skipping non-text file:', entryName);
                }
            }

            // Restore branches, tips and the SHA map first so files land on the right branch.
            var hasGit = Object.keys(textByName).some(function (n) { return n.startsWith('.git/'); });
            try {
                if (textByName['.git/traliran-meta.json'] && REPO_STORE.restoreMeta) {
                    REPO_STORE.restoreMeta(JSON.parse(textByName['.git/traliran-meta.json']));
                }
            } catch (e) {
                console.error('[ZIP_EXPORT] Branch restore skipped:', e);
            }

            // Restore full commit history when the backup is present.
            var restoredCommits = null;
            try {
                if (textByName['.git/traliran-commits.json']) {
                    var parsed = JSON.parse(textByName['.git/traliran-commits.json']);
                    if (Array.isArray(parsed)) restoredCommits = parsed;
                }
            } catch (e) {
                console.error('[ZIP_EXPORT] Commit backup skipped:', e);
            }

            // Re-bind imported commits to the active repository so repo-scoped
            // queries (load/delete) can find them after import.
            if (restoredCommits && REPO_STORE.activeId) {
                var activeRepoId = REPO_STORE.activeId;
                restoredCommits = restoredCommits.map(function (c) {
                    return Object.assign({}, c, { repoId: activeRepoId });
                });
            }

            // Write working tree files (.git internals never enter the VFS).
            var jobs = [];
            var names = Object.keys(textByName).sort();
            for (var k = 0; k < names.length; k++) {
                var name = names[k];
                if (name.startsWith('.git/')) continue;
                jobs.push(VFS.writeFile(name, textByName[name]));
            }
            await Promise.all(jobs);

            if (restoredCommits && REPO_STORE.activeId) {
                REPO_STORE.saveCommits(restoredCommits);
            }
            try {
                if (restoredCommits) {
                    commitHistory = restoredCommits;
                }
            } catch (e) { /* Imported files are already written. */ }

            // Refresh the IDE views without touching any other logic.
            try {
                if (typeof renderFileTree === 'function') renderFileTree();
                if (typeof renderRepoSelects === 'function') renderRepoSelects();
                if (typeof VERSION_CONTROL !== 'undefined' && VERSION_CONTROL.renderCommitHistory) {
                    VERSION_CONTROL.renderCommitHistory();
                }
            } catch (e) {
                console.error('[ZIP_EXPORT] View refresh skipped:', e);
            }

            var summary = hasGit ? 'Git repository imported successfully!' : 'Project imported successfully!';
            if (binarySkipped > 0) summary += ' (' + binarySkipped + ' binary file(s) skipped)';
            done(summary);
        } catch (e) {
            fail('Failed to import ZIP: ' + (e && e.message ? e.message : e));
        }
    }

    var api = {
        exportActiveRepo: exportActiveRepo,
        importRepoZip: importRepoZip,
    };

    global.ZIP_EXPORT = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : globalThis);
