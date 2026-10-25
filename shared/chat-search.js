// Lightweight full-screen chat search shared by Hub, IDE and RAG Playground.
// It does not build or keep an index: every query reads the session list from
// IndexedDB and compares the user's words against the stored text.
// All comments and user-facing strings are in English.

const CHAT_SEARCH = (() => {
    'use strict';

    const MAX_SNIPPETS = 3;
    const SNIPPET_BEFORE = 90;
    const SNIPPET_AFTER = 140;
    const MAX_SNIPPET_SPAN = 320;
    const DEBOUNCE_MS = 120;
    const MAX_OCCURRENCES_PER_TERM = 100;

    let config = null;
    let overlay = null;
    let input = null;
    let resultsEl = null;
    let metaEl = null;
    let debounceTimer = null;
    let requestId = 0;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function normalizeText(content) {
        if (typeof normalizeContentToText === 'function') {
            return normalizeContentToText(content);
        }
        return typeof content === 'string' ? content : '';
    }

    function tokenize(query) {
        return String(query || '')
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
    }

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function containsAll(text, terms) {
        const lower = String(text || '').toLowerCase();
        return terms.every(term => lower.includes(term));
    }

    function findAll(text, term) {
        const starts = [];
        let index = text.indexOf(term);
        while (index !== -1 && starts.length < MAX_OCCURRENCES_PER_TERM) {
            starts.push(index);
            index = text.indexOf(term, index + Math.max(1, term.length));
        }
        return starts;
    }

    // Return the smallest text window that contains every query term, then
    // expand it to word boundaries so the card shows a readable paragraph.
    function findSnippet(text, terms) {
        const lower = text.toLowerCase();
        const occurrences = terms.map(term => findAll(lower, term));
        if (occurrences.some(list => list.length === 0)) return null;

        const events = [];
        occurrences.forEach((starts, termIndex) => {
            starts.forEach(start => {
                events.push({ start, end: start + terms[termIndex].length, termIndex });
            });
        });
        events.sort((a, b) => a.start - b.start || a.end - b.end);

        const counts = new Array(terms.length).fill(0);
        let covered = 0;
        let left = 0;
        let best = null;

        for (let right = 0; right < events.length; right++) {
            const event = events[right];
            if (counts[event.termIndex] === 0) covered++;
            counts[event.termIndex]++;

            while (covered === terms.length) {
                let windowEnd = 0;
                for (let i = left; i <= right; i++) {
                    if (events[i].end > windowEnd) windowEnd = events[i].end;
                }
                const windowStart = events[left].start;
                if (!best || (windowEnd - windowStart) < (best.end - best.start)) {
                    best = { start: windowStart, end: windowEnd };
                }

                const leftEvent = events[left];
                counts[leftEvent.termIndex]--;
                if (counts[leftEvent.termIndex] === 0) covered--;
                left++;
            }
        }

        if (!best) return null;

        // Very distant query terms can produce a huge window. Keep the card
        // readable by anchoring the snippet on the first term of that window.
        const windowEnd = best.end - best.start > MAX_SNIPPET_SPAN
            ? Math.min(text.length, best.start + MAX_SNIPPET_SPAN)
            : best.end;

        let start = Math.max(0, best.start - SNIPPET_BEFORE);
        let end = Math.min(text.length, windowEnd + SNIPPET_AFTER);
        if (start > 0) {
            const space = text.indexOf(' ', start);
            if (space !== -1 && space < best.start && space - start < 40) start = space + 1;
        }
        if (end < text.length) {
            const space = text.lastIndexOf(' ', end);
            if (space > best.start && end - space < 40) end = space;
        }

        const raw = text.slice(start, end).trim();
        const prefix = start > 0 ? '… ' : '';
        const suffix = end < text.length ? ' …' : '';
        return {
            html: prefix + highlightHtml(raw, terms) + suffix,
            text: prefix + raw + suffix
        };
    }

    function highlightHtml(text, terms) {
        if (!terms.length) return escapeHtml(text);
        const pattern = terms
            .slice()
            .sort((a, b) => b.length - a.length)
            .map(escapeRegExp)
            .join('|');
        const regex = new RegExp(`(${pattern})`, 'gi');
        let html = '';
        let last = 0;
        for (const match of text.matchAll(regex)) {
            if (match.index === undefined) continue;
            html += escapeHtml(text.slice(last, match.index));
            html += `<mark>${escapeHtml(match[0])}</mark>`;
            last = match.index + match[0].length;
        }
        html += escapeHtml(text.slice(last));
        return html;
    }

    // Attachments are stored inside the user message. Hub uses a fenced block,
    // the IDE stores the raw text after the marker.
    function splitUserText(text) {
        const marker = /\[(?:Attached\s+(?:File|file)|Video\s+attachment):\s*([^\]\n]+)\]/i;
        const match = text.match(marker);
        if (!match || match.index === undefined) {
            return { prompt: text.trim(), files: [] };
        }

        const prompt = text.slice(0, match.index).trim();
        const name = match[1].trim();
        let fileText = text.slice(match.index + match[0].length).trim();
        fileText = fileText.replace(/^```[^\n]*\n?/, '').replace(/\n?```\s*$/, '').trim();

        return {
            prompt,
            files: [{ name, text: fileText ? `${name}\n${fileText}` : name }]
        };
    }

    function getSessionTitle(session) {
        return String(session?.name || session?.title || 'Untitled chat');
    }

    function collectSources(session) {
        const sources = [];
        const messages = Array.isArray(session?.messages) ? session.messages : [];

        messages.forEach((message, messageIndex) => {
            if (!message) return;
            const text = normalizeText(message.content).trim();
            if (!text) return;

            if (message.role === 'user') {
                const parts = splitUserText(text);
                if (parts.prompt) {
                    sources.push({ type: 'user', label: 'Your prompt', text: parts.prompt, messageIndex });
                }
                parts.files.forEach(file => {
                    sources.push({ type: 'file', label: 'Attached file', text: file.text, messageIndex });
                });
            } else if (message.role === 'assistant') {
                sources.push({ type: 'assistant', label: 'AI response', text, messageIndex });
            }
        });

        return sources;
    }

    function searchSessions(sessions, query) {
        const terms = tokenize(query);
        if (!terms.length) return [];

        const priority = { file: 0, user: 1, assistant: 2 };
        const results = [];

        sessions.forEach((session, order) => {
            if (!session) return;

            const title = getSessionTitle(session);
            const titleMatches = containsAll(title, terms);
            const matched = [];

            collectSources(session).forEach(source => {
                if (!containsAll(source.text, terms)) return;
                const snippet = findSnippet(source.text, terms);
                matched.push({ ...source, snippet });
            });

            if (!titleMatches && matched.length === 0) return;

            matched.sort((a, b) => {
                const byType = (priority[a.type] ?? 9) - (priority[b.type] ?? 9);
                return byType || (a.messageIndex - b.messageIndex);
            });

            const snippets = matched.slice(0, MAX_SNIPPETS).map(source => ({
                label: source.label,
                html: source.snippet ? source.snippet.html : highlightHtml(source.text, terms),
                text: source.snippet ? source.snippet.text : source.text
            }));

            if (snippets.length === 0 && titleMatches) {
                snippets.push({
                    label: 'Chat title',
                    html: highlightHtml(title, terms),
                    text: title
                });
            }

            const firstMatch = matched.reduce((best, source) => {
                if (source.messageIndex === null || source.messageIndex === undefined) return best;
                if (!best || source.messageIndex < best.messageIndex) return source;
                return best;
            }, null);

            results.push({
                sessionId: session.id,
                title,
                titleHtml: titleMatches ? highlightHtml(title, terms) : escapeHtml(title),
                snippets,
                matchCount: matched.length + (titleMatches ? 1 : 0),
                messageIndex: firstMatch ? firstMatch.messageIndex : null,
                score: (titleMatches ? 100 : 0) + matched.length,
                order
            });
        });

        results.sort((a, b) => b.score - a.score || a.order - b.order);
        return results;
    }

    // Read directly from the IndexedDB kv store on every search. STORAGE is
    // used only as a fallback when IndexedDB is unavailable.
    async function readSessions(storageKey) {
        let raw = null;
        try {
            if (typeof KV_STORE !== 'undefined' && typeof KV_STORE.get === 'function') {
                raw = await KV_STORE.get(storageKey);
            }
        } catch (error) {
            console.warn('[CHAT_SEARCH] IndexedDB read failed, using STORAGE fallback:', error);
        }

        if (raw === null || raw === undefined) {
            try {
                raw = STORAGE.getItem(storageKey);
            } catch (error) {
                raw = null;
            }
        }

        if (!raw) return [];

        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            console.warn('[CHAT_SEARCH] Could not parse stored sessions:', error);
            return [];
        }
    }

    async function search(storageKey, query) {
        const sessions = await readSessions(storageKey);
        return searchSessions(sessions, query);
    }

    function isOpen() {
        return Boolean(overlay && !overlay.classList.contains('hidden'));
    }

    function createOverlay() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.id = 'chatSearchOverlay';
        overlay.className = 'chat-search-overlay hidden';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Search chats');
        overlay.innerHTML = `
            <div class="chat-search-shell">
                <div class="chat-search-bar">
                    <svg class="svg-icon chat-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7"></circle>
                        <path d="M21 21l-4.35-4.35"></path>
                    </svg>
                    <input id="chatSearchInput" class="chat-search-input" type="text" autocomplete="off" spellcheck="false" aria-label="Search chats">
                    <button type="button" id="chatSearchCloseBtn" class="chat-search-close" title="Close search (Esc)" aria-label="Close search">Esc</button>
                </div>
                <div id="chatSearchMeta" class="chat-search-meta" aria-live="polite">Type to search...</div>
                <div id="chatSearchResults" class="chat-search-results chat-scroll"></div>
            </div>
        `;
        document.body.appendChild(overlay);

        input = overlay.querySelector('#chatSearchInput');
        resultsEl = overlay.querySelector('#chatSearchResults');
        metaEl = overlay.querySelector('#chatSearchMeta');

        overlay.querySelector('#chatSearchCloseBtn').addEventListener('click', close);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) close();
        });
        input.addEventListener('input', onInput);
    }

    function open() {
        if (!overlay) createOverlay();
        overlay.classList.remove('hidden');
        document.body.classList.add('chat-search-open');
        input.value = '';
        resultsEl.innerHTML = '';
        metaEl.textContent = 'Type to search...';
        requestId++;
        clearTimeout(debounceTimer);
        requestAnimationFrame(() => input.focus());
    }

    function close() {
        if (!overlay) return;
        overlay.classList.add('hidden');
        document.body.classList.remove('chat-search-open');
        clearTimeout(debounceTimer);
        requestId++;
        if (input) input.blur();
    }

    function onInput() {
        const query = input.value.trim();
        clearTimeout(debounceTimer);

        if (!query) {
            requestId++;
            resultsEl.innerHTML = '';
            metaEl.textContent = 'Type to search...';
            return;
        }

        metaEl.textContent = 'Searching...';
        debounceTimer = setTimeout(() => run(query), DEBOUNCE_MS);
    }

    async function run(query) {
        const currentRequest = ++requestId;
        const found = await search(config.storageKey, query);
        if (currentRequest !== requestId || !isOpen()) return;
        render(found, query);
    }

    function render(found, query) {
        resultsEl.innerHTML = '';

        if (!found.length) {
            metaEl.textContent = `No chats found for “${query}”`;
            const empty = document.createElement('div');
            empty.className = 'chat-search-empty';
            empty.textContent = 'Try a different word or check another workspace.';
            resultsEl.appendChild(empty);
            return;
        }

        metaEl.textContent = `${found.length} chat${found.length === 1 ? '' : 's'} found`;
        found.forEach(result => resultsEl.appendChild(createResultCard(result)));
    }

    function createResultCard(result) {
        const card = document.createElement('article');
        card.className = 'chat-search-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Open chat ${result.title}`);

        const head = document.createElement('div');
        head.className = 'chat-search-card-head';

        const title = document.createElement('span');
        title.className = 'chat-search-card-title';
        title.innerHTML = result.titleHtml;

        const count = document.createElement('span');
        count.className = 'chat-search-card-count';
        count.textContent = `${result.matchCount} match${result.matchCount === 1 ? '' : 'es'}`;

        head.append(title, count);

        const snippets = document.createElement('div');
        snippets.className = 'chat-search-snippets';
        result.snippets.forEach(snippet => {
            const item = document.createElement('div');
            item.className = 'chat-search-snippet';

            const label = document.createElement('span');
            label.className = 'chat-search-snippet-label';
            label.textContent = snippet.label;

            const text = document.createElement('p');
            text.innerHTML = snippet.html;

            item.append(label, text);
            snippets.appendChild(item);
        });

        card.append(head, snippets);
        card.addEventListener('click', () => selectResult(result));
        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectResult(result);
            }
        });
        return card;
    }

    function scrollToMessage(container, index) {
        if (!container || index === null || index === undefined) return;
        const target = container.children[index];
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('chat-search-jump');
        window.setTimeout(() => target.classList.remove('chat-search-jump'), 1800);
    }

    function selectResult(result) {
        close();
        const proceed = typeof config?.onSelect === 'function'
            ? config.onSelect(result.sessionId, result)
            : true;
        if (proceed === false) return;

        if (result.messageIndex === null || result.messageIndex === undefined) return;
        if (typeof config?.getMessageContainer !== 'function') return;

        requestAnimationFrame(() => {
            scrollToMessage(config.getMessageContainer(), result.messageIndex);
        });
    }

    function mount(options) {
        config = Object.assign({
            storageKey: '',
            triggerId: 'chatSearchBtn',
            accent: '#34d399',
            placeholder: 'Search chat titles, prompts, files and AI answers...'
        }, options || {});

        createOverlay();
        overlay.style.setProperty('--chat-search-accent', config.accent);
        document.documentElement.style.setProperty('--chat-search-accent', config.accent);
        input.placeholder = config.placeholder;

        const trigger = document.getElementById(config.triggerId);
        if (trigger && trigger.dataset.chatSearchBound !== 'true') {
            trigger.dataset.chatSearchBound = 'true';
            trigger.addEventListener('click', open);
        }

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && isOpen()) {
                event.preventDefault();
                close();
            }
        });

        return api;
    }

    const api = {
        mount,
        open,
        close,
        search,
        searchSessions,
        scrollToMessage
    };

    return api;
})();
