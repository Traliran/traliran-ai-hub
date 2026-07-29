# Assistant Store Documentation

## Overview

The Assistant Store is a feature in the Traliran AI IDE that allows users to:
- Browse premium AI assistant presets
- Create custom AI assistants with personalized system prompts
- Manage (edit, delete, import, export) custom assistants
- Switch between different AI personas for coding assistance

---

## Visual Components (HTML/CSS)

### Bot Store Modal (`#botStoreModal`)

**Location:** `ide.html` lines 307-337

**Structure:**
```html
<div id="botStoreModal" class="hidden fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
    <div class="bg-gray-900 border border-gray-800 rounded-2xl max-w-4xl w-full p-6 space-y-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        <!-- Close button -->
        <button id="closeBotStoreModal">✕</button>

        <!-- Header -->
        <div class="flex justify-between items-start">
            <div>
                <h2>🏪 Assistant Store</h2>
                <p>Manage your custom AI personas and specialized prompts.</p>
            </div>
            <!-- Import/Export buttons -->
            <div class="flex gap-2">
                <label for="importBotsInput">📥 Import</label>
                <button id="exportBotsBtn">📤 Export</button>
            </div>
        </div>

        <!-- Bot Grid Container -->
        <div id="botStoreGrid" class="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Bots populated dynamically by JS -->
        </div>

        <!-- Create Button -->
        <button id="createNewBotBtn">➕ Create New Assistant</button>
    </div>
</div>
```

**Styling:**
- Dark theme with gray-900 background
- Amber accent colors for premium features
- Responsive grid layout (1 column on mobile, 2 on desktop)
- Maximum height constrained to 90vh with scrollable content area

### Bot Editor Modal (`#botEditorModal`)

**Location:** `ide.html` lines 340-377

**Structure:**
```html
<div id="botEditorModal" class="hidden fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
    <div class="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative">
        <!-- Close button -->
        <button id="closeBotEditorModal">✕</button>
        
        <!-- Title -->
        <h2 id="botEditorTitle">Edit Assistant</h2>

        <!-- Form Fields -->
        <div class="space-y-3">
            <!-- Name Input -->
            <input type="text" id="editBotName" placeholder="Assistant Name">
            
            <!-- System Prompt Textarea -->
            <textarea id="editBotPrompt" rows="6"></textarea>
            
            <!-- Model Selection & Temperature -->
            <div class="grid grid-cols-2 gap-4">
                <select id="editBotModel">Preferred Model</select>
                <input type="number" id="editTemp" step="0.1" min="0" max="2">
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-between">
            <button id="deleteBotBtn">🗑️ Delete Bot</button>
            <button id="saveBotBtn">Save Assistant</button>
        </div>
    </div>
</div>
```

**Form Fields:**
1. **Assistant Name** - Text input for bot display name
2. **System Prompt** - Large textarea for custom instructions
3. **Preferred Model** - Dropdown select for AI model selection
4. **Temperature** - Number input (0-2, step 0.1) for creativity control

---

## Logic & State Management (JavaScript)

### State Variables

**Location:** `ide.js` lines 9-19

```javascript
// Bot Store State
let customBots = [];          // Array of user-created bots
let activeBotId = null;       // Currently selected bot ID
let editingBotId = null;      // Bot being edited in modal

const OFFICIAL_BOTS = [
    {
        name: "UX Forge AI",
        description: "UX Forge AI analyzes your code inside the IDE...",
        link: "https://whop.com/traliran-ai-huub/ux-forge-ai"
    }
];
```

### DOM Elements Reference

**Location:** `ide.js` lines 64-82

```javascript
// Bot Store DOM Elements
const openBotStoreBtn = document.getElementById('openBotStoreBtn');
const botStoreModal = document.getElementById('botStoreModal');
const closeBotStoreModal = document.getElementById('closeBotStoreModal');
const botStoreGrid = document.getElementById('botStoreGrid');
const createNewBotBtn = document.getElementById('createNewBotBtn');
const exportBotsBtn = document.getElementById('exportBotsBtn');
const importBotsInput = document.getElementById('importBotsInput');
const botEditorModal = document.getElementById('botEditorModal');
const closeBotEditorModal = document.getElementById('closeBotEditorModal');
const botEditorTitle = document.getElementById('botEditorTitle');
const editBotName = document.getElementById('editBotName');
const editBotPrompt = document.getElementById('editBotPrompt');
const editBotModel = document.getElementById('editBotModel');
const editBotTemp = document.getElementById('editBotTemp');
const saveBotBtn = document.getElementById('saveBotBtn');
const deleteBotBtn = document.getElementById('deleteBotBtn');
```

---

## Core Functions

### 1. `renderBotStore()`

**Location:** `ide.js` lines 483-556

**Purpose:** Renders the bot store interface with official and custom bots

**Logic Flow:**
1. Clears the `botStoreGrid` container
2. Creates Official/Premium Bots section with amber styling
3. Maps through `OFFICIAL_BOTS` array to generate premium bot cards
4. Creates Custom Bots section header
5. Checks if `customBots` array is empty:
   - If empty: Shows "empty state" message
   - If not empty: Iterates through custom bots and creates cards
6. Each custom bot card displays:
   - Bot name and active status badge
   - System prompt preview (line-clamped)
   - Edit and Use buttons with event handlers

**Visual Distinction:**
- Premium bots: Amber border, "PREMIUM" badge, external link button
- Custom bots: Gray border, "ACTIVE" badge when selected, edit/use buttons

---

### 2. `openBotEditor(botId = null)`

**Location:** `ide.js` lines 558-588

**Purpose:** Opens the bot editor modal for creating or editing a bot

**Parameters:**
- `botId` (optional): ID of bot to edit, null for new bot

**Logic:**
1. Sets `editingBotId` to provided botId
2. If editing existing bot:
   - Finds bot in `customBots` array
   - Populates form fields with bot data
   - Sets title to "Edit Assistant"
3. If creating new bot:
   - Clears all form fields
   - Sets title to "Create New Assistant"
4. Populates model dropdown from `botModelSelect` options
5. Removes `hidden` class from `botEditorModal`

---

### 3. `useBot(botId)`

**Location:** `ide.js` lines 590-605

**Purpose:** Activates a specific bot as the current AI assistant

**Logic:**
1. Sets `activeBotId` to provided botId
2. Saves to localStorage: `ide_active_bot_id`
3. Re-renders bot store to update UI badges
4. Creates notification in AI chat window:
   - Amber animated banner
   - Displays bot name
   - Auto-removes after 3 seconds

---

### 4. `saveBot()`

**Location:** `ide.js` lines 607-634

**Purpose:** Saves a bot (create new or update existing)

**Validation:**
- Requires both name and prompt to be non-empty
- Alerts user if validation fails

**Logic:**
1. Extracts and trims form values
2. Parses temperature as float (defaults to 0.7)
3. If `editingBotId` exists (update mode):
   - Finds bot index in array
   - Updates bot properties while preserving ID
4. If no `editingBotId` (create mode):
   - Generates new ID: `'bot_' + Date.now()`
   - Creates new bot object
   - Pushes to `customBots` array
5. Saves to localStorage: `ide_custom_bots`
6. Closes modal and re-renders store

---

### 5. `deleteBot()`

**Location:** `ide.js` lines 636-648

**Purpose:** Deletes a custom bot

**Logic:**
1. Returns early if no bot is being edited
2. Shows confirmation dialog
3. Filters out deleted bot from `customBots` array
4. If deleted bot was active:
   - Clears `activeBotId`
   - Removes from localStorage
5. Saves updated array to localStorage
6. Closes modal and re-renders store

---

### 6. `exportBots()`

**Location:** `ide.js` lines 650-658

**Purpose:** Exports all custom bots as JSON file

**Logic:**
1. Stringifies `customBots` array with formatting
2. Creates data URI with UTF-8 encoding
3. Creates temporary anchor element
4. Triggers download with filename `traliran-ide-bots.json`
5. Removes anchor from DOM

---

### 7. `importBots(event)`

**Location:** `ide.js` lines 660-682

**Purpose:** Imports bots from JSON file

**Logic:**
1. Gets file from input event
2. Creates FileReader
3. On file read:
   - Parses JSON content
   - Validates that result is an array
   - Appends imported bots to existing array
   - Saves to localStorage
   - Re-renders store
   - Shows success alert
4. Error handling:
   - Catches parsing errors
   - Displays error message to user

---

### 8. Event Listeners

**Location:** `ide.js` lines 684-695

```javascript
// Bot Store Listeners
if (openBotStoreBtn) openBotStoreBtn.onclick = () => {
    renderBotStore();
    botStoreModal.classList.remove('hidden');
};
if (closeBotStoreModal) closeBotStoreModal.onclick = () => botStoreModal.classList.add('hidden');
if (createNewBotBtn) createNewBotBtn.onclick = () => openBotEditor();
if (saveBotBtn) saveBotBtn.onclick = saveBot;
if (deleteBotBtn) deleteBotBtn.onclick = deleteBot;
if (closeBotEditorModal) closeBotEditorModal.onclick = () => botEditorModal.classList.add('hidden');
if (exportBotsBtn) exportBotsBtn.onclick = exportBots;
if (importBotsInput) importBotsInput.onchange = importBots;
```

---

## Persistence & Initialization

### Loading Bots on Init

**Location:** `ide.js` lines 166-177

```javascript
// Load Custom Bots
const savedBots = localStorage.getItem('ide_custom_bots');
if (savedBots) {
    try {
        customBots = JSON.parse(savedBots);
    } catch (e) {
        customBots = [];
    }
}

const savedActiveBot = localStorage.getItem('ide_active_bot_id');
activeBotId = savedActiveBot;
```

### Storage Keys

| Key | Type | Description |
|-----|------|-------------|
| `ide_custom_bots` | JSON Array | All user-created bot definitions |
| `ide_active_bot_id` | String | ID of currently selected bot |

---

## Bot Data Structure

```typescript
interface Bot {
    id: string;           // Unique identifier (format: 'bot_' + timestamp)
    name: string;         // Display name
    prompt: string;       // System prompt/instructions
    model: string;        // Preferred AI model
    temp: number;         // Temperature (0.0 - 2.0)
}
```

Example:
```json
{
    "id": "bot_1709234567890",
    "name": "Code Reviewer Pro",
    "prompt": "You are an expert code reviewer. Analyze code for bugs, performance issues, and best practices.",
    "model": "gpt-4-turbo",
    "temp": 0.3
}
```

---

## Helper Function: `escapeHtml()`

**Location:** `ide.js` line 1667

**Purpose:** Prevents XSS by escaping HTML entities in bot names/prompts

```javascript
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
```

**Usage in Bot Store:**
- Line 496: Escapes bot name in premium section
- Line 497: Escapes bot description in premium section
- Line 534: Escapes bot name in custom section
- Line 537: Escapes bot prompt in custom section

---

## Integration Points

### Active Bot Usage in AI Requests

**Location:** `ide.js` line 1426

When making AI requests, the system checks for active bot:
```javascript
const activeBot = customBots.find(b => b.id === activeBotId);
```

If an active bot exists, its system prompt and model preferences are used instead of defaults.

---

## UI States & Conditions

### Bot Card States

| State | Visual Indicator |
|-------|------------------|
| Active | Amber border + ring, "ACTIVE" badge, "Using" button (disabled style) |
| Inactive | Gray border, "Use" button (amber background) |
| Premium | Amber border, "PREMIUM" badge, external link button |

### Empty State

When `customBots.length === 0`:
- Shows centered icon (🏪)
- Displays message: "Your custom store is empty. Create your first assistant or import a preset!"
- Dashed border container with padding

---

## Accessibility Features

- All interactive elements have cursor-pointer class
- Form inputs have associated labels
- Focus states defined for inputs (focus:border-amber-500)
- Semantic HTML structure with proper heading hierarchy
- ARIA-friendly modal structure (can be enhanced with role="dialog")

---

## File References

| File | Lines | Content |
|------|-------|---------|
| `ide.html` | 307-337 | Bot Store Modal HTML |
| `ide.html` | 340-377 | Bot Editor Modal HTML |
| `ide.js` | 9-19 | State variables & OFFICIAL_BOTS |
| `ide.js` | 64-82 | DOM element references |
| `ide.js` | 166-177 | Initialization logic |
| `ide.js` | 483-556 | renderBotStore() |
| `ide.js` | 558-588 | openBotEditor() |
| `ide.js` | 590-605 | useBot() |
| `ide.js` | 607-634 | saveBot() |
| `ide.js` | 636-648 | deleteBot() |
| `ide.js` | 650-658 | exportBots() |
| `ide.js` | 660-682 | importBots() |
| `ide.js` | 684-695 | Event listeners |
| `ide.js` | 1667-1673 | escapeHtml() helper |

---

## Future Enhancement Ideas

1. **Bot Categories:** Add tags/categories for organizing bots
2. **Sharing:** Enable sharing bot configurations via URL
3. **Templates:** Provide pre-built bot templates
4. **Search:** Add search/filter functionality in bot store
5. **Usage Stats:** Track which bots are used most frequently
6. **Cloud Sync:** Sync custom bots across devices via cloud storage
