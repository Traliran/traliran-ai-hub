// Shared content helpers for Traliran AI Hub (Hub, IDE and Playground).
// All comments and identifiers are in English.

// Configure the shared Markdown renderer once (breaks + GitHub flavoured).
if (typeof marked !== 'undefined') {
    marked.use({ breaks: true, gfm: true });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Unwrap legacy double-wrapped content: some stored messages keep the shape
// { role: 'user', content: [...] } inside the message content field.
function unwrapMessageContent(content) {
    if (content && typeof content === 'object' && !Array.isArray(content) && Array.isArray(content.content)) {
        return content.content;
    }
    return content;
}

// Flatten any stored content shape into plain text.
function normalizeContentToText(content) {
    content = unwrapMessageContent(content);
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(part => {
            if (typeof part === 'string') return part;
            if (part?.type === 'text' || part?.type === 'input_text') return part.text || part.content || '';
            if (part?.type === 'image_url' || part?.type === 'image' || part?.type === 'input_image') return '[Image attachment]';
            if (part?.type === 'video_url' || part?.type === 'video' || part?.type === 'input_video') return '[Video attachment]';
            return '';
        }).filter(Boolean).join('\n');
    }
    return '';
}

// Convert stored content to the standard OpenAI chat format:
// [{ type: 'text', text }, { type: 'image_url', image_url: { url } }].
// Legacy parts stored as { type: 'image_url', url } are migrated here.
function normalizeContentForApi(content) {
    content = unwrapMessageContent(content);
    if (typeof content === 'string' || !Array.isArray(content)) return content;
    return content.map(part => {
        if (typeof part === 'string') return { type: 'text', text: part };
        if (part?.type === 'text') return { type: 'text', text: part.text || part.content || '' };
        if (part?.type === 'image_url') {
            const url = typeof part.image_url === 'string' ? part.image_url : (part.image_url?.url || part.url || '');
            if (!url) return { type: 'text', text: '[Image attachment]' };
            return { type: 'image_url', image_url: { url } };
        }
        if (part?.type === 'video_url' || part?.type === 'video') {
            return { type: 'text', text: `[Video attachment: ${part.url || part.video_url?.url || 'video'} — video bytes are not sent, describe it in text instead.]` };
        }
        if (part?.type === 'image' || part?.type === 'input_image') {
            const url = part.url || part.src || '';
            if (!url) return { type: 'text', text: '[Image attachment]' };
            return { type: 'image_url', image_url: { url } };
        }
        if (part?.type === 'input_text') return { type: 'text', text: part.text || part.content || '' };
        return { type: 'text', text: part?.text || part?.content || '' };
    });
}

// Convert stored content to the Anthropic messages format.
function convertContentForAnthropic(content) {
    content = unwrapMessageContent(content);
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return normalizeContentToText(content);

    return content.map(part => {
        if (typeof part === 'string') return { type: 'text', text: part };
        if (part?.type === 'text' || part?.type === 'input_text') return { type: 'text', text: part.text || part.content || '' };
        if (part?.type === 'image_url' || part?.type === 'image' || part?.type === 'input_image') {
            const dataUrl = typeof part.image_url === 'string' ? part.image_url : (part.image_url?.url || part.url || '');
            if (dataUrl.startsWith('data:')) {
                const [meta, payload] = dataUrl.split(',');
                const mime = meta.match(/data:(.+);/)?.[1] || 'image/png';
                return { type: 'image', source: { type: 'base64', media_type: mime, data: payload } };
            }
            return { type: 'text', text: '[Image attachment]' };
        }
        if (part?.type === 'video_url' || part?.type === 'video' || part?.type === 'input_video') {
            return { type: 'text', text: '[Video attachment]' };
        }
        return { type: 'text', text: '' };
    }).filter(item => item && (item.text || item.type === 'image'));
}

// Normalise an assistant response to { content: string, reasoning_content: string }.
function extractAssistantContent(response, providerName) {
    if (resolveProviderName(providerName) === 'claude') {
        const text = Array.isArray(response?.content)
            ? response.content.filter(part => part?.type === 'text').map(part => part.text || '').join('\n')
            : (response?.content || '');
        return { content: text, reasoning_content: '' };
    }

    const choice = response?.choices?.[0]?.message || {};
    return {
        content: choice.content || '',
        reasoning_content: choice.reasoning_content || choice.thinking_content || ''
    };
}

// --- Safe HTML rendering (prevents XSS from model output / imported data) ---

const HTML_ALLOWED_TAGS = new Set([
    'a', 'b', 'blockquote', 'br', 'button', 'code', 'del', 'details', 'div', 'em',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'input', 'li', 'ol', 'p',
    'pre', 's', 'span', 'strong', 'sub', 'summary', 'sup', 'table', 'tbody', 'td',
    'th', 'thead', 'tr', 'u', 'ul', 'video', 'source'
]);

const HTML_DROP_TAGS = new Set([
    'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
    'form', 'textarea', 'select', 'option', 'noscript', 'template', 'svg', 'math'
]);

const HTML_ALLOWED_ATTRS = new Set([
    'class', 'href', 'src', 'alt', 'title', 'target', 'rel', 'colspan', 'rowspan',
    'start', 'type', 'checked', 'disabled', 'open', 'controls', 'preload'
]);

function isUnsafeUrl(value) {
    const v = String(value || '').trim().toLowerCase().replace(/[\u0000-\u0020\u00a0]/g, '');
    if (v.startsWith('javascript:') || v.startsWith('vbscript:')) return true;
    if (v.startsWith('data:') && !v.startsWith('data:image/')) return true;
    return false;
}

function sanitizeNode(node) {
    for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) continue;
        if (child.nodeType !== Node.ELEMENT_NODE) {
            child.remove();
            continue;
        }
        const tag = child.tagName.toLowerCase();
        if (HTML_DROP_TAGS.has(tag)) {
            child.remove();
            continue;
        }
        if (!HTML_ALLOWED_TAGS.has(tag)) {
            // Keep the children of unknown-but-benign tags, drop the wrapper.
            sanitizeNode(child);
            while (child.firstChild) child.parentNode.insertBefore(child.firstChild, child);
            child.remove();
            continue;
        }
        for (const attr of Array.from(child.attributes)) {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on')) {
                child.removeAttribute(attr.name);
                continue;
            }
            if (name.startsWith('data-')) continue;
            if (!HTML_ALLOWED_ATTRS.has(name)) {
                child.removeAttribute(attr.name);
                continue;
            }
            if ((name === 'href' || name === 'src') && isUnsafeUrl(attr.value)) {
                child.removeAttribute(attr.name);
            }
        }
        if (tag === 'a' && child.getAttribute('target') === '_blank') {
            child.setAttribute('rel', 'noopener noreferrer');
        }
        sanitizeNode(child);
    }
}

// Strip dangerous markup and attributes from an HTML string.
function sanitizeHtml(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html == null ? '' : html);
    sanitizeNode(template.content);
    return template.innerHTML;
}

// Render Markdown to sanitized HTML, optionally with a custom marked renderer.
function renderMarkdown(markdown, renderer) {
    if (typeof marked === 'undefined') return escapeHtml(markdown);
    const source = String(markdown == null ? '' : markdown);
    const html = renderer ? marked.parse(source, { renderer }) : marked.parse(source);
    return sanitizeHtml(html);
}
