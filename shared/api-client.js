// Unified AI API client shared by Hub, IDE and Playground.
// Supports OpenAI-compatible chat/completions and the Anthropic messages API,
// for both single (non-streaming) and streaming responses.
// All comments and identifiers are in English.

// Anthropic does not expose a public model-list endpoint; use this static list.
const CLAUDE_FALLBACK_MODELS = [
    'claude-3-5-sonnet-latest',
    'claude-3-7-sonnet-latest',
    'claude-3-5-haiku-latest'
];

// Convert a chat-completions payload to the Anthropic messages shape.
function toAnthropicPayload(bodyPayload, streaming) {
    const systemMessage = bodyPayload.messages.find(msg => msg.role === 'system');
    const payload = {
        model: bodyPayload.model,
        max_tokens: bodyPayload.max_tokens || 1024,
        messages: bodyPayload.messages.filter(msg => msg.role !== 'system').map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: convertContentForAnthropic(msg.content)
        }))
    };
    if (bodyPayload.temperature !== undefined) payload.temperature = bodyPayload.temperature;
    if (bodyPayload.top_p !== undefined) payload.top_p = bodyPayload.top_p;
    if (streaming) payload.stream = true;
    if (systemMessage) {
        payload.system = typeof systemMessage.content === 'string'
            ? systemMessage.content
            : normalizeContentToText(systemMessage.content);
    }
    return payload;
}

function anthropicTextFromResponse(data) {
    return Array.isArray(data?.content)
        ? data.content.filter(part => part?.type === 'text').map(part => part.text || '').join('\n')
        : '';
}

async function fetchSingleCompletion(endpoint, apiKey, hasKey, bodyPayload, providerName, signal) {
    const provider = getProviderDescriptor(providerName);

    if (provider.type === 'anthropic') {
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        };
        const response = await fetch(`${endpoint}/messages`, {
            method: 'POST',
            headers,
            body: JSON.stringify(toAnthropicPayload(bodyPayload, false)),
            signal
        });
        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error?.message || `HTTP ${response.status}`);
        }
        return response.json();
    }

    const headers = { 'Content-Type': 'application/json' };
    if (hasKey && apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal
    });
    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${response.status}`);
    }
    return response.json();
}

async function fetchAnthropicStreamingCompletion(endpoint, apiKey, bodyPayload, signal, onDelta, onUsage) {
    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
    };
    const response = await fetch(`${endpoint}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(toAnthropicPayload(bodyPayload, true)),
        signal
    });
    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        const result = await response.json();
        return { content: anthropicTextFromResponse(result), toolCalls: [] };
    }

    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (let line of lines) {
            line = line.trim();
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
                const event = JSON.parse(payload);
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                    const delta = event.delta.text || '';
                    accumulated += delta;
                    if (delta) onDelta(delta);
                } else if (event.type === 'message_start' && event.message?.usage && onUsage) {
                    onUsage(event.message.usage);
                } else if (event.type === 'message_delta' && event.usage && onUsage) {
                    onUsage(event.usage);
                }
            } catch (_) {
                // Ignore partial JSON chunks.
            }
        }
    }
    return { content: accumulated, toolCalls: [] };
}

async function fetchStreamingCompletion(endpoint, apiKey, hasKey, bodyPayload, providerName, signal, onDelta, onUsage) {
    const provider = getProviderDescriptor(providerName);
    if (provider.type === 'anthropic') {
        return fetchAnthropicStreamingCompletion(endpoint, apiKey, bodyPayload, signal, onDelta, onUsage);
    }

    const headers = { 'Content-Type': 'application/json' };
    if (hasKey && apiKey) headers.Authorization = `Bearer ${apiKey}`;

    bodyPayload.stream = true;

    const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal
    });

    if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        const result = await response.json();
        return { content: result.choices?.[0]?.message?.content || '', toolCalls: [] };
    }

    const decoder = new TextDecoder();
    let accumulated = '';
    let buffer = '';
    const toolCallsMap = {};

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (let line of lines) {
            line = line.trim();
            if (!line || line === 'data: [DONE]') continue;
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
                const eventData = JSON.parse(payload);

                if (eventData.usage && onUsage) onUsage(eventData.usage);

                const choice = eventData.choices?.[0];
                const delta = choice?.delta?.content || '';
                accumulated += delta;
                if (delta) onDelta(delta);

                const tcDeltas = choice?.delta?.tool_calls;
                if (Array.isArray(tcDeltas)) {
                    for (const tc of tcDeltas) {
                        const idx = tc.index != null ? tc.index : 0;
                        if (!toolCallsMap[idx]) toolCallsMap[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
                        if (tc.id) toolCallsMap[idx].id = tc.id;
                        if (tc.type) toolCallsMap[idx].type = tc.type;
                        if (tc.function?.name) toolCallsMap[idx].function.name += tc.function.name;
                        if (tc.function?.arguments) toolCallsMap[idx].function.arguments += tc.function.arguments;
                    }
                }
            } catch (_) {
                // Ignore parse errors for partial chunks.
            }
        }
    }

    const toolCalls = Object.keys(toolCallsMap).map(k => toolCallsMap[k]);
    return { content: accumulated, toolCalls };
}

// Fetch the model list for a provider. Returns an array of model ids.
async function fetchModelList(endpoint, apiKey, hasKey, providerName, signal) {
    const provider = getProviderDescriptor(providerName);
    if (provider.type === 'anthropic') return [...CLAUDE_FALLBACK_MODELS];
    if (!endpoint) return [];

    const headers = { 'Content-Type': 'application/json' };
    if (hasKey && apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(`${endpoint}/models`, { method: 'GET', headers, signal });
    if (!response.ok) throw new Error(`Status Error: ${response.status}`);

    const json = await response.json();
    const models = json.data && Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);

    return models
        .filter(m => {
            const id = (m.id || m.name || '').toLowerCase();
            return !id.includes('whisper') && !id.includes('tts') && !id.includes('embed') && !id.includes('guard');
        })
        .map(m => m.id || m.name)
        .filter(Boolean);
}
