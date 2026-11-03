// Shared chat attachment mechanics for the Hub and the RAG Playground.
// Handles multi-file reading, composer/message attachment cards and the
// dimmed full-screen preview. All comments and UI strings are in English.
(function () {
    'use strict';

    const FONT_SCALE_KEY = 'gem_chat_font_size';

    let indicatorEl = null;
    let cardsEl = null;
    let pending = [];
    let previewOverlay = null;

    // ---------- Formatting ----------
    function formatBytes(bytes) {
        const size = Number(bytes) || 0;
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10240 ? 1 : 0)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    }

    const EXTENSION_LABELS = {
        txt: 'TXT', md: 'MD', markdown: 'MD', js: 'JS', mjs: 'JS', ts: 'TS', jsx: 'JSX',
        tsx: 'TSX', html: 'HTML', htm: 'HTML', css: 'CSS', json: 'JSON', py: 'PY',
        c: 'C', h: 'H', cpp: 'C++', java: 'Java', pdf: 'PDF', csv: 'CSV', xml: 'XML',
        yml: 'YAML', yaml: 'YAML', sh: 'SH'
    };

    function extensionOf(name) {
        const match = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
        return match ? match[1] : '';
    }

    function typeLabel(item) {
        const type = String(item && item.type || '').split(';')[0];
        if (type.startsWith('image/')) return type.slice(6).toUpperCase() + ' image';
        if (type === 'application/pdf') return 'PDF';
        if (type.startsWith('video/')) return type.slice(6).toUpperCase() + ' video';
        if (type.startsWith('text/')) return 'Text';
        const ext = extensionOf(item && item.name);
        return EXTENSION_LABELS[ext] || (ext ? ext.toUpperCase() : 'File');
    }

    function mimeFromDataUrl(url) {
        const match = String(url || '').match(/^data:([^;,]+)/);
        return match ? match[1] : '';
    }

    function dataUrlByteSize(url) {
        const parts = String(url || '').split(',');
        if (parts.length < 2) return 0;
        const base64 = parts[1];
        const padding = (base64.match(/=*$/) || [''])[0].length;
        return Math.max(0, Math.round((base64.length * 3) / 4) - padding);
    }

    // ---------- Reading ----------
    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => resolve(event.target.result);
            reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    // Downscale large pasted/screenshot images so base64 stays small enough
    // for IndexedDB and chat/completions vision payloads.
    async function compressImageFile(file, maxDim = 1600, quality = 0.85) {
        const dataUrl = await readFileAsDataURL(file);
        try {
            const bitmap = await createImageBitmap(file);
            const { width, height } = bitmap;
            bitmap.close();
            const scale = Math.min(1, maxDim / Math.max(width, height));
            if (scale >= 1 && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp') && file.size < 1024 * 1024) {
                return dataUrl;
            }
            const targetW = Math.max(1, Math.round(width * scale));
            const targetH = Math.max(1, Math.round(height * scale));
            const img = await new Promise((resolve, reject) => {
                const el = new Image();
                el.onload = () => resolve(el);
                el.onerror = reject;
                el.src = dataUrl;
            });
            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            canvas.getContext('2d').drawImage(img, 0, 0, targetW, targetH);
            const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
            return canvas.toDataURL(outType, quality);
        } catch (e) {
            return dataUrl;
        }
    }

    function resolveAttachmentName(file, fallbackPrefix) {
        if (file && file.name) return file.name;
        const ext = (file && file.type === 'image/png') ? 'png'
            : (file && file.type === 'image/jpeg') ? 'jpg'
            : (file && file.type === 'image/webp') ? 'webp'
            : (file && file.type === 'image/gif') ? 'gif'
            : 'png';
        return `${fallbackPrefix || 'image'}-${Date.now()}.${ext}`;
    }

    async function extractPdfText(file, name) {
        try {
            if (typeof pdfjsLib === 'undefined') throw new Error('PDF library is unavailable');
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let text = '';
            for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
                const page = await pdf.getPage(i);
                const pageText = await page.getTextContent();
                text += pageText.items.map(item => item.str).join(' ') + '\n\n';
            }
            return text.trim();
        } catch (error) {
            return `Unable to parse PDF file content. File name: ${name}`;
        }
    }

    async function readAttachment(file, fallbackPrefix) {
        let type = file.type || '';
        let name = resolveAttachmentName(file, fallbackPrefix);
        if (!name.includes('.') && type) {
            if (type === 'image/png') name += '.png';
            else if (type === 'image/jpeg') name += '.jpg';
        }
        if (!type && /\.png$/i.test(name)) type = 'image/png';
        if (!type && /\.jpe?g$/i.test(name)) type = 'image/jpeg';

        const isImage = type.startsWith('image/');
        const isVideo = type.startsWith('video/');
        const isPdf = type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
        let content = '';

        if (isPdf) {
            content = await extractPdfText(file, name);
        } else if (isImage) {
            if (type === 'image/gif') {
                content = await readFileAsDataURL(file);
            } else {
                try {
                    content = await compressImageFile(file);
                } catch (e) {
                    content = await readFileAsDataURL(file);
                }
            }
        } else if (isVideo) {
            content = await readFileAsDataURL(file);
        } else {
            content = await file.text();
        }

        return { name, type, size: file.size || 0, content, isImage, isVideo, isPdf };
    }

    async function addFiles(files, options = {}) {
        const list = Array.from(files || []).filter(Boolean);
        if (!list.length) return false;
        if (options.replace) pending = [];
        try {
            const entries = [];
            for (const file of list) {
                entries.push(await readAttachment(file, options.fallbackPrefix));
            }
            pending = pending.concat(entries);
            renderComposerCards();
            return true;
        } catch (error) {
            if (typeof window.notifyError === 'function') {
                window.notifyError('Failed to attach file: ' + error.message);
            } else {
                console.error(error);
            }
            return false;
        }
    }

    function hasFiles() {
        return pending.length > 0;
    }

    function getPending() {
        return pending.slice();
    }

    function clear() {
        pending = [];
        renderComposerCards();
    }

    // ---------- Composer and message cards ----------
    function fileIcon() {
        const icon = document.createElement('div');
        icon.className = 'attachment-card-icon';
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>';
        return icon;
    }

    function buildCard(item, options = {}) {
        const card = document.createElement('div');
        card.className = 'attachment-card';
        card.title = item.name || 'Attachment';
        card.setAttribute('role', 'button');
        card.tabIndex = 0;

        if (item.isImage) {
            const img = document.createElement('img');
            img.className = 'attachment-card-media';
            img.src = item.content;
            img.alt = item.name || 'Image attachment';
            card.appendChild(img);
        }

        const shade = document.createElement('div');
        shade.className = 'attachment-card-shade';
        card.appendChild(shade);

        const body = document.createElement('div');
        body.className = 'attachment-card-body';
        if (!item.isImage) body.appendChild(fileIcon());

        const text = document.createElement('div');
        text.className = 'attachment-card-text';
        const name = document.createElement('div');
        name.className = 'attachment-card-name';
        name.textContent = item.name || 'Attachment';
        const meta = document.createElement('div');
        meta.className = 'attachment-card-meta';
        meta.textContent = [typeLabel(item), formatBytes(item.size)].filter(Boolean).join(' · ');
        text.appendChild(name);
        text.appendChild(meta);
        body.appendChild(text);
        card.appendChild(body);

        card.addEventListener('click', () => openPreview(item));
        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openPreview(item);
            }
        });

        if (options.removable) {
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'attachment-card-remove';
            remove.setAttribute('aria-label', 'Remove ' + (item.name || 'attachment'));
            remove.textContent = '\u00d7';
            remove.addEventListener('click', event => {
                event.stopPropagation();
                if (typeof options.onRemove === 'function') options.onRemove();
            });
            card.appendChild(remove);
        }

        return card;
    }

    function renderComposerCards() {
        if (!cardsEl || !indicatorEl) return;
        cardsEl.innerHTML = '';
        pending.forEach((item, index) => {
            cardsEl.appendChild(buildCard(item, {
                removable: true,
                onRemove: () => {
                    pending.splice(index, 1);
                    renderComposerCards();
                }
            }));
        });
        indicatorEl.classList.toggle('hidden', pending.length === 0);
    }

    function createCardsElement(items) {
        const grid = document.createElement('div');
        grid.className = 'attachment-grid attachment-grid-message';
        (items || []).forEach(item => grid.appendChild(buildCard(item)));
        return grid;
    }

    // ---------- Content conversion ----------
    // Build the user message content for the next request. Single-file shapes
    // stay identical to the previous behaviour; multiple files are appended.
    function buildUserContent(text) {
        if (!pending.length) return text;

        const images = pending.filter(item => item.isImage);
        const files = pending.filter(item => !item.isImage && !item.isVideo);
        const videos = pending.filter(item => item.isVideo);

        const fileBlocks = files.map(item => {
            // Pick a fence longer than any backtick run inside the file so
            // embedded ``` code blocks cannot terminate the attachment early.
            const runs = String(item.content || '').match(/`{3,}/g) || [];
            const longest = runs.reduce((max, run) => Math.max(max, run.length), 2);
            const fence = '`'.repeat(Math.max(3, longest + 1));
            return `[Attached File: ${item.name}]\n${fence}\n${item.content}\n${fence}`;
        });
        const videoNotes = videos.map(item => `[Video attachment: ${item.name} — video bytes are not sent to the model.]`);
        const textBlocks = fileBlocks.concat(videoNotes);

        if (images.length) {
            const textPart = [text, ...textBlocks].filter(Boolean).join('\n\n');
            const parts = [{
                type: 'text',
                text: textPart || images.map(item => `Attached image: ${item.name}`).join('\n')
            }];
            images.forEach(item => parts.push({ type: 'image_url', image_url: { url: item.content } }));
            return parts;
        }

        return [text, ...textBlocks].filter(Boolean).join('\n\n');
    }

    function extractFileBlocks(text) {
        const source = String(text || '');
        const headerPattern = /\[Attached File: ([^\]\n]+)\]\n/g;
        const headers = [];
        let match;
        while ((match = headerPattern.exec(source)) !== null) {
            headers.push({ name: match[1].trim(), headerStart: match.index, contentStart: headerPattern.lastIndex });
        }
        if (!headers.length) return { text: source.trim(), attachments: [] };

        const attachments = headers.map((header, index) => {
            const nextStart = index + 1 < headers.length ? headers[index + 1].headerStart : source.length;
            const raw = source.slice(header.contentStart, nextStart);
            const opening = raw.match(/^(`{3,})\n/);
            const fenceLength = opening ? opening[1].length : 3;
            let body = opening ? raw.slice(opening[0].length) : raw;
            // Close only on a fence that ends the block (or is followed by a
            // trailing video note), never on the first backticks inside the
            // file content, so embedded code blocks cannot truncate the
            // preview or leak into the chat prompt.
            const closing = new RegExp('\\n`{' + fenceLength + ',}(?=\\n*$|\\n\\n\\[Video attachment: )');
            const closeMatch = body.match(closing);
            if (closeMatch) {
                body = body.slice(0, closeMatch.index);
            } else {
                body = body.replace(/\s+$/, '');
            }
            return {
                name: header.name,
                type: '',
                size: typeof Blob !== 'undefined' ? new Blob([body]).size : body.length,
                content: body,
                isImage: false,
                isVideo: false
            };
        });

        const cleaned = source.slice(0, headers[0].headerStart).replace(/\n{3,}/g, '\n\n').trim();
        return { text: cleaned, attachments };
    }

    // Turn stored user content into prompt text plus attachment cards.
    function parseUserContent(content) {
        content = (typeof unwrapMessageContent === 'function') ? unwrapMessageContent(content) : content;
        const attachments = [];
        let text = '';

        if (typeof content === 'string') {
            text = content;
        } else if (Array.isArray(content)) {
            const textParts = [];
            content.forEach(part => {
                if (typeof part === 'string') {
                    textParts.push(part);
                    return;
                }
                if (!part) return;
                if (part.type === 'text' || part.type === 'input_text') {
                    textParts.push(part.text || part.content || '');
                    return;
                }
                if (part.type === 'image_url' || part.type === 'image' || part.type === 'input_image') {
                    const url = typeof part.image_url === 'string'
                        ? part.image_url
                        : (part.image_url?.url || part.url || part.src || '');
                    if (!url) return;
                    attachments.push({
                        name: 'Image',
                        type: mimeFromDataUrl(url) || 'image/*',
                        size: dataUrlByteSize(url),
                        content: url,
                        isImage: true,
                        isVideo: false
                    });
                }
            });
            text = textParts.filter(Boolean).join('\n');
        }

        if (text) {
            const blocks = extractFileBlocks(text);
            text = blocks.text;
            if (blocks.attachments.length) attachments.unshift(...blocks.attachments);
        }

        // Restore image file names from the caption used when no text was typed.
        const captionLines = text.split('\n').map(line => line.trim()).filter(Boolean);
        const imageCaptions = captionLines.filter(line => /^Attached image: /.test(line));
        if (imageCaptions.length && imageCaptions.length === captionLines.length) {
            const images = attachments.filter(item => item.isImage);
            imageCaptions.forEach((line, index) => {
                if (images[index]) images[index].name = line.replace(/^Attached image: /, '').trim();
            });
            text = '';
        }

        return { text: text.trim(), attachments };
    }

    // ---------- Preview overlay ----------
    function ensurePreviewOverlay() {
        if (previewOverlay) return;
        previewOverlay = document.createElement('div');
        previewOverlay.className = 'attachment-preview-overlay hidden';
        previewOverlay.setAttribute('role', 'dialog');
        previewOverlay.setAttribute('aria-modal', 'true');
        previewOverlay.addEventListener('click', event => {
            if (event.target === previewOverlay) closePreview();
        });
        document.body.appendChild(previewOverlay);
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && previewOverlay && !previewOverlay.classList.contains('hidden')) {
                closePreview();
            }
        });
    }

    function openPreview(item) {
        ensurePreviewOverlay();
        previewOverlay.innerHTML = '';

        const shell = document.createElement('div');
        shell.className = 'attachment-preview-shell';

        const head = document.createElement('div');
        head.className = 'attachment-preview-head';
        const title = document.createElement('div');
        title.className = 'attachment-preview-title';
        title.textContent = [item.name || 'Attachment', typeLabel(item), formatBytes(item.size)].filter(Boolean).join(' · ');
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'attachment-preview-close';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', closePreview);
        head.appendChild(title);
        head.appendChild(closeBtn);
        shell.appendChild(head);

        if (item.isImage) {
            const img = document.createElement('img');
            img.className = 'attachment-preview-image';
            img.src = item.content;
            img.alt = item.name || 'Image attachment';
            shell.appendChild(img);
        } else if (item.isVideo) {
            const video = document.createElement('video');
            video.className = 'attachment-preview-image';
            video.controls = true;
            video.src = item.content;
            shell.appendChild(video);
        } else {
            const pre = document.createElement('pre');
            pre.className = 'attachment-preview-text';
            pre.textContent = item.content || '';
            shell.appendChild(pre);
        }

        previewOverlay.appendChild(shell);
        previewOverlay.classList.remove('hidden');
    }

    function closePreview() {
        if (previewOverlay) previewOverlay.classList.add('hidden');
    }

    // ---------- Mount ----------
    function mount(options = {}) {
        indicatorEl = document.getElementById(options.indicatorId || 'fileIndicator');
        cardsEl = document.getElementById(options.cardsId || 'attachmentCards');
        renderComposerCards();
    }

    // The slider scales chat bubbles only, leaving the rest of the UI untouched.
    function initFontScale(chatWindow, options = {}) {
        if (!chatWindow) return;
        const slider = document.getElementById(options.sliderId || 'chatFontSize');
        const valueEl = document.getElementById(options.valueId || 'chatFontSizeValue');
        const clamp = value => Math.min(2, Math.max(0.8, value));
        const apply = () => {
            const scale = slider ? clamp(parseFloat(slider.value) || 1) : 1;
            chatWindow.style.setProperty('--chat-font-scale', String(scale));
            if (valueEl) valueEl.textContent = Math.round(scale * 100) + '%';
        };
        const saved = (typeof STORAGE !== 'undefined') ? parseFloat(STORAGE.getItem(FONT_SCALE_KEY)) : NaN;

        if (slider) {
            if (Number.isFinite(saved)) slider.value = String(clamp(saved));
            slider.addEventListener('input', () => {
                if (typeof STORAGE !== 'undefined') STORAGE.setItem(FONT_SCALE_KEY, slider.value);
                apply();
            });
            apply();
        } else if (Number.isFinite(saved)) {
            chatWindow.style.setProperty('--chat-font-scale', String(clamp(saved)));
        }
    }

    window.CHAT_ATTACHMENTS = {
        mount,
        addFiles,
        clear,
        hasFiles,
        getPending,
        buildUserContent,
        parseUserContent,
        createCardsElement,
        openPreview,
        initFontScale
    };
})();
