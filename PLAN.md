# Plan: "Personal AI" Tab Implementation

## Goal
Add a "Personal AI" section to the Hub sidebar where users write free-form text about themselves. This text is automatically injected as an additional system prompt into **all** AI interactions: Hub chat, RAG Playground, and AI IDE.

---

## Storage

**New localStorage key:** `gem_personal_info` (string, free-form text)

---

## 1. Hub Sidebar UI (`index.html`)

Add a new section in the sidebar **below** the existing "Assistant Profile" section (after line 174), before "Appearance" section (line 176):

```html
<div class="border-t border-gray-800 pt-3 mt-1 space-y-3">
    <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Personal AI</h3>
    <p class="text-[10px] text-gray-500">Info about you — injected into all AI prompts hub-wide</p>
    <div>
        <textarea id="personalInfo" rows="4" 
            placeholder="Write about yourself: your role, expertise, preferences, goals... This will be used as context across all AI interactions."
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none"></textarea>
    </div>
</div>
```

---

## 2. Hub JS Logic (`app.js`)

### a) DOM reference (near line 85):
```js
const personalInfoInput = document.getElementById('personalInfo');
```

### b) Load on init — in `loadApiSettings()` (after line 270):
```js
personalInfoInput.value = localStorage.getItem('gem_personal_info') || '';
```

### c) Save on input — add event listener (near line 1428):
```js
personalInfoInput.addEventListener('input', saveApiSettings);
```

### d) Persist — in `saveApiSettings()` (after line 294):
```js
localStorage.setItem('gem_personal_info', personalInfoInput.value.trim());
```

### e) Inject into system prompt — in `sendMessage()` (lines 1312-1316), modify to:
```js
const baseSystemPrompt = botPromptInput.value.trim();
const personalInfo = personalInfoInput.value.trim();
const userLanguageHint = buildLanguageHint(typeof fullUserContent === 'string' ? fullUserContent : text);

let fullSystemPrompt = baseSystemPrompt || '';
if (personalInfo) {
    fullSystemPrompt = fullSystemPrompt
        ? `${fullSystemPrompt}\n\n[About the user]:\n${personalInfo}`
        : `[About the user]:\n${personalInfo}`;
}
session.systemPrompt = fullSystemPrompt
    ? `${fullSystemPrompt}\n\n${userLanguageHint}`
    : userLanguageHint;
```

### f) JSON Export/Import
- Add `personalInfo` to export config object (line 1608-1627)
- Add `personalInfo` import handling (line 1629-1656)

---

## 3. Playground Injection (`playground.js`)

### In `loadConfig()` (line 39-54), add:
```js
personalInfo: localStorage.getItem('gem_personal_info') || ''
```

### In `sendMessage()` (lines 207-218), prepend personal info:
```js
const personalContext = config.personalInfo ? `[About the user]:\n${config.personalInfo}\n\n` : '';
const ragSystemPrompt = `
${personalContext}${config.systemPrompt}

You are now operating in RAG (Retrieval Augmented Generation) mode. 
...
`;
```

---

## 4. IDE Injection (`ide.js`)

### In `runAiAgentRequest()` (lines 1196-1211), read and prepend:
```js
const personalInfo = localStorage.getItem('gem_personal_info') || '';
const personalContext = personalInfo ? `[About the user]:\n${personalInfo}\n\n` : '';

const baseSystemPrompt = `${personalContext}${systemPrompt}

Current workspace files:
${Object.entries(selectedFiles).map(([filename, content]) => `--- FILE: ${filename} ---\n${content}`).join('\n\n')}
...
`;
```

---

## 5. Cloud Sync (`sync-manager.js`)

### Add to `COLLECTION_MAP` (line 8-16):
```js
hub_personal: { key: 'gem_personal_info' },
```

### In `app.js`, wrap save function for sync:
```js
const _origSaveApiSettings = saveApiSettings;
saveApiSettings = function() {
    _origSaveApiSettings.apply(this, arguments);
    SYNC_MANAGER.pushToCloud('hub_settings');
    SYNC_MANAGER.pushToCloud('hub_personal');
};
```

---

## Files to Modify

| File | Changes |
|---|---|
| `index.html` | Add "Personal AI" textarea section in sidebar |
| `app.js` | DOM ref, load/save, inject into system prompt, JSON export/import, sync wrapper |
| `playground.js` | Read `gem_personal_info` in `loadConfig()`, prepend to RAG system prompt |
| `ide.js` | Read `gem_personal_info` in `runAiAgentRequest()`, prepend to IDE system prompt |
| `sync-manager.js` | Add `hub_personal` to `COLLECTION_MAP` |

---

## Injection Format

```
[About the user]:
<user's personal info text>

<original system prompt>

<language hint>
```

This ensures the AI always has context about the user without conflicting with the existing system prompt structure.
