/*
 * MCP (Model Context Protocol) client for Traliran AI Hub.
 *
 * Connects to remote MCP servers over the Streamable HTTP transport (JSON-RPC)
 * and exposes their tools to the chat as OpenAI-style function tools. The chat
 * engine then performs tool-calling in the system prompt, exactly like an IDE
 * agent: the model decides to call an MCP tool, the hub proxies the call to the
 * MCP server, feeds the result back, and repeats until the model is done.
 */

const MCP_STORAGE_KEY = 'gem_mcp_servers';

function sanitizeMcpName(name) {
    return (name || 'server')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'server';
}

function formatMcpResult(result) {
    if (!result) return '(no result)';
    if (result.isError) {
        const text = Array.isArray(result.content)
            ? result.content.map(p => (p.text != null ? p.text : JSON.stringify(p))).join('\n')
            : JSON.stringify(result);
        return `Error: ${text}`;
    }
    if (Array.isArray(result.content)) {
        return result.content.map(p => {
            if (p.type === 'text') return p.text;
            if (p.type === 'resource') return JSON.stringify(p.resource || p);
            return p.text != null ? p.text : JSON.stringify(p);
        }).join('\n');
    }
    return JSON.stringify(result);
}

async function parseJsonRpcResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let collected = null;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            let dataLine = '';
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    dataLine += line.slice(5).trim();
                } else if (line.trim() === '' && dataLine) {
                    try {
                        const parsed = JSON.parse(dataLine);
                        if (parsed.result !== undefined || parsed.error !== undefined) collected = parsed;
                    } catch (_) { /* ignore partial */ }
                    dataLine = '';
                }
            }
        }
        if (!collected) throw new Error('Empty SSE response from MCP server');
        return collected;
    }
    return response.json();
}

class McpClient {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.url = config.url;
        this.authHeader = config.authHeader || '';
        this.sessionId = null;
        this.protocolVersion = '2024-11-05';
        this.tools = [];
        this.connected = false;
        this._idCounter = 0;
    }

    _headers() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream'
        };
        if (this.authHeader) headers['Authorization'] = this.authHeader;
        if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId;
        return headers;
    }

    async _rpc(method, params, { notification = false } = {}) {
        const payload = { jsonrpc: '2.0', method, params: params || {} };
        if (!notification) payload.id = String(++this._idCounter);

        const response = await fetch(this.url, {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(payload)
        });

        const sessionId = response.headers.get('mcp-session-id');
        if (sessionId) this.sessionId = sessionId;

        if (notification) {
            if (!response.ok && response.status !== 202) {
                throw new Error(`MCP notification failed: HTTP ${response.status}`);
            }
            return null;
        }

        if (!response.ok) {
            let detail = '';
            try {
                const errJson = await response.json();
                detail = errJson.error?.message || JSON.stringify(errJson);
            } catch (_) { /* noop */ }
            throw new Error(`MCP ${method} failed: HTTP ${response.status} ${detail}`);
        }

        const data = await parseJsonRpcResponse(response);
        if (data.error) throw new Error(`MCP ${method} error: ${data.error.message || JSON.stringify(data.error)}`);
        return data.result;
    }

    async connect() {
        const initResult = await this._rpc('initialize', {
            protocolVersion: this.protocolVersion,
            capabilities: {},
            clientInfo: { name: 'TraliranAIHub', version: '1.0.0' }
        });
        if (initResult && initResult.protocolVersion) {
            this.protocolVersion = initResult.protocolVersion;
        }
        await this._rpc('notifications/initialized', {}, { notification: true });
        const listResult = await this._rpc('tools/list', {});
        this.tools = Array.isArray(listResult?.tools) ? listResult.tools : [];
        this.connected = true;
        return this.tools;
    }

    async callTool(name, args) {
        const result = await this._rpc('tools/call', { name, arguments: args || {} });
        return formatMcpResult(result);
    }
}

const MCP_MANAGER = {
    servers: [],
    clients: {},
    _registry: {},

    load() {
        try {
            const saved = STORAGE.getItem(MCP_STORAGE_KEY);
            this.servers = saved ? JSON.parse(saved) : [];
        } catch (_) {
            this.servers = [];
        }
    },

    save() {
        STORAGE.setItem(MCP_STORAGE_KEY, JSON.stringify(this.servers));
    },

    async connectOne(id) {
        const cfg = this.servers.find(s => s.id === id);
        if (!cfg) return;
        const client = new McpClient(cfg);
        const tools = await client.connect();
        this.clients[id] = client;
        return tools;
    },

    async connectAll() {
        const results = await Promise.allSettled(
            this.servers.map(s => this.connectOne(s.id))
        );
        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.error(`MCP connect failed for ${this.servers[i].name}:`, r.reason);
            }
        });
        this._rebuildRegistry();
        return this.connectedCount();
    },

    disconnectOne(id) {
        delete this.clients[id];
    },

    remove(id) {
        this.servers = this.servers.filter(s => s.id !== id);
        delete this.clients[id];
        this.save();
        this._rebuildRegistry();
    },

    add(config) {
        const id = 'mcp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        const entry = {
            id,
            name: config.name.trim(),
            url: config.url.trim(),
            authHeader: (config.authHeader || '').trim()
        };
        this.servers.push(entry);
        this.save();
        return entry;
    },

    _rebuildRegistry() {
        this._registry = {};
        const usedNames = {};
        for (const id of Object.keys(this.clients)) {
            const client = this.clients[id];
            if (!client.connected) continue;
            const prefix = sanitizeMcpName(client.name);
            for (const tool of client.tools) {
                let fnName = `${prefix}_${tool.name}`;
                if (fnName.length > 64) fnName = fnName.slice(0, 64);
                while (this._registry[fnName] || usedNames[fnName]) {
                    usedNames[fnName] = true;
                    fnName = fnName.slice(0, 60) + '_' + Math.random().toString(36).slice(2, 5);
                }
                usedNames[fnName] = true;
                this._registry[fnName] = { clientId: id, toolName: tool.name };
            }
        }
    },

    buildToolSet() {
        this._rebuildRegistry();
        const tools = Object.keys(this._registry).map(fnName => {
            const ref = this._registry[fnName];
            const tool = this.clients[ref.clientId].tools.find(t => t.name === ref.toolName);
            const client = this.clients[ref.clientId];
            return {
                type: 'function',
                function: {
                    name: fnName,
                    description: `[MCP:${client.name}] ${tool.description || ''}`,
                    parameters: tool.inputSchema && Object.keys(tool.inputSchema).length
                        ? tool.inputSchema
                        : { type: 'object', properties: {}, description: 'No parameters' }
                }
            };
        });
        return { tools, registry: this._registry };
    },

    async callTool(fnName, args) {
        const ref = this._registry[fnName];
        if (!ref) return `Unknown MCP tool: ${fnName}`;
        const client = this.clients[ref.clientId];
        if (!client || !client.connected) return `MCP server "${client?.name || ref.clientId}" is not connected.`;
        return client.callTool(ref.toolName, args);
    },

    connectedCount() {
        return Object.values(this.clients).filter(c => c.connected && c.tools.length > 0).length;
    },

    toolCount() {
        return Object.values(this.clients).reduce((sum, c) => sum + (c.connected ? c.tools.length : 0), 0);
    },

    connectedServers() {
        return this.servers.map(s => ({
            ...s,
            connected: !!this.clients[s.id]?.connected,
            tools: this.clients[s.id]?.tools || []
        }));
    }
};

window.MCP_MANAGER = MCP_MANAGER;
