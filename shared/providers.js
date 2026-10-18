// Single source of truth for AI provider metadata shared by Hub, IDE and Playground.
// All comments and identifiers are in English.

// Provider descriptors: base URL, whether an API key is required, and API flavour.
const PROVIDERS = {
    groq: { url: 'https://api.groq.com/openai/v1', hasKey: true, type: 'openai' },
    google: { url: 'https://generativelanguage.googleapis.com/v1beta/openai', hasKey: true, type: 'openai' },
    openrouter: { url: 'https://openrouter.ai/api/v1', hasKey: true, type: 'openai' },
    openai: { url: 'https://api.openai.com/v1', hasKey: true, type: 'openai' },
    deepseek: { url: 'https://api.deepseek.com/v1', hasKey: true, type: 'openai' },
    qwen: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', hasKey: true, type: 'openai' },
    glm: { url: 'https://open.bigmodel.cn/api/paas/v4', hasKey: true, type: 'openai' },
    claude: { url: 'https://api.anthropic.com/v1', hasKey: true, type: 'anthropic' },
    ollama: { url: 'http://localhost:11434/v1', hasKey: false, type: 'openai' },
    llamacpp: { url: 'http://localhost:8080/v1', hasKey: false, type: 'openai' }
};

// The IDE used to store Anthropic under the key "anthropic"; the canonical key
// is "claude". Aliasing keeps Hub, IDE and Playground in sync.
const PROVIDER_ALIASES = { anthropic: 'claude' };

// Resolve any provider name (including legacy aliases) to a canonical key.
function resolveProviderName(name) {
    const key = String(name || '').trim();
    return PROVIDER_ALIASES[key] || key || 'groq';
}

// Descriptor for a provider, falling back to OpenAI for unknown/custom names.
function getProviderDescriptor(name) {
    return PROVIDERS[resolveProviderName(name)] || PROVIDERS.openai;
}

// True only when the provider explicitly requires an API key (local/custom do not).
function providerRequiresKey(name) {
    return PROVIDERS[resolveProviderName(name)]?.hasKey === true;
}
