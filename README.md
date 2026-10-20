# 💎 Traliran AI Hub

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

A lightweight, serverless, and privacy-first AI web client and sandbox running directly in your browser. Features a built-in code execution environment, a full-fledged AI IDE, and a parallel model benchmarking tool. Connect directly to Groq, Gemini, OpenAI, OpenRouter, DeepSeek, Qwen, GLM, Claude, and local backends (Ollama / Llama.cpp) without middlemen.

## ⚠️ Warning! ⚠️

> When you export a custom bot configuration that you've created, **your API keys are also exported**.
> 
> So before sharing your configuration, **REMOVE YOUR API KEYS FROM THE .json FILE**
> 
> P.S. This was designed to make it easy to import or restore your session later.


<img width="1866" height="1032" alt="image" src="https://github.com/user-attachments/assets/9a5bc0a3-eea5-4027-a76a-03c72e10bbc6" />

<img width="1873" height="1030" alt="image" src="https://github.com/user-attachments/assets/7ee56e9d-e4bd-4cac-b466-afe62f79816b" />

<img width="1873" height="1033" alt="image" src="https://github.com/user-attachments/assets/9b8c7d1e-9ead-4435-913e-3c638d9077c1" />

<img width="1876" height="1030" alt="image" src="https://github.com/user-attachments/assets/26a26954-dbe2-448a-84a9-279bc44f8495" />

<img width="1878" height="1036" alt="image" src="https://github.com/user-attachments/assets/513f0060-f5e7-414b-883a-5e651124a529" />

---

### 🛠️ Custom Builds & B2B Deployments

Need a branded, zero-server AI workspace tailored for your team or agency?
I build custom deployments with pre-configured prompt libraries, custom UI, and lightweight local storage/sync options.

👉 **[Read B2B / Custom Build Docs](https://github.com/traliran/traliran-ai-hub/wiki/Custom-Builds-and-B2B)** or **[Order via Google Form](https://forms.gle/XpTQRCrpGdsbPiR48)**
---

## ✨ Live Web App & Preset Store
👉 **[Launch Traliran AI Hub on GitHub Pages](https://traliran.github.io/traliran-ai-hub/)**

### Assistant Store

Inside, you can unlock exclusive Premium Bots (advanced system prompts and configurations for scriptwriters, prompt engineers, and content creators) for just **$4 – $6**. Skip hours of tedious prompt tuning and get production-ready tools for the price of a coffee!

---

## 🛡️ 100% Privacy-First & Serverless
* **Zero Middleman Servers:** The application is 100% client-side and runs directly in your browser.
* **Direct Routing:** Your API keys are stored strictly in your browser's local storage (IndexedDB) and sent straight to official provider endpoints. No logs, no data collection, no leaks.
* **AGPLv3 Guaranteed:** Complete freedom to audit, inspect, and self-host, backed by a strong copyleft license.

---

## 🚀 Key Features

*   **Multi-Provider Support:** Seamlessly switch between top cloud APIs (Groq, Gemini, OpenAI, OpenRouter, DeepSeek, Qwen, GLM, Claude) and local LLMs (Ollama, Llama.cpp).
*   **⚡ Multi-Model Setup & Compare:** Select multiple models simultaneously — including across different providers (Groq + OpenAI + Claude, local models, etc.), each using its own configured API key. The app triggers parallel requests and renders side-by-side comparative cards with per-model and per-provider labels for instant benchmarking.
*   **💡 Model Thinking Support:** Native rendering for reasoning models (like DeepSeek-R1). Structural thoughts are captured and organized into a clean, collapsible hidden dropdown block.
*   **🧠 Conversation Summary:** Summarize the current discussion into your Personal AI context with one click (available once at least two AI responses exist).
*   **🧑 Personal AI Context:** Store a persistent profile about yourself (role, expertise, preferences, goals) in settings; it is injected into every AI prompt across the Hub.
*   **👥 AI Group Debate Mode:** Turn your raw ideas into fully analyzed concepts. Run a multi-agent discussion loop where specialized personas (Optimist, Critic, and Technologist) cross-examine your thesis over multiple rounds.
*   **⚡ AI IDE - Integrated Development Environment:** A full-fledged in-browser IDE for code generation, editing, and project management, powered by your chosen AI model.
    *   **Multi-Repository Workspaces:** Create, switch, and delete repositories. Each repo keeps its own files, commits, branches, and git refs; new repos start empty.
    *   **Real Git:** Commits bound to repo + branch, per-branch history, branches forked from the current branch, cascading delete of branches/repos with their commits (GIT tab).
    *   **Git-Compatible ZIP Export/Import:** Export packs the working tree plus a real `.git/` readable by the Git CLI (offline, zero dependencies); import restores files, history, and branches.
    *   **File Explorer:** Create/rename files and folders manually (HTML, CSS, JS, etc.) or via the AI agent.
    *   **Code Editor:** Edit files with a monospaced code editor.
    *   **Live Preview:** Instantly preview HTML/JS/CSS code changes in a separate browser tab or the inline panel.
    *   **AI Agent:** Multi-chat agent with tool calling (`list/read/write/edit/rename` files), image attachments (upload, camera, `Ctrl+V` paste), and a fullscreen Agentic-only mode.
    *   **Cloud Sync (optional):** Sync workspace via Firebase, Supabase, PocketBase, or a generic backend, with an offline queue.
    *   **Project Management:** Download your entire workspace as a `.zip` or reset it.
*   **📚 RAG Playground:** Build a local knowledge base, run dedicated RAG chats over it, and export Hub notes straight into the knowledge base.
*   **🗂️ Notes Page:** A dedicated Notes app at `/notes` (synced with the Hub through the shared IndexedDB). Notes can live only in IndexedDB, sync through the configured cloud DB (Firebase / Supabase / PocketBase), or mirror to a local folder as Markdown files. In Chrome/Edge the local folder mode uses the File System Access API and syncs both ways every minute while the Notes tab is open, warning once per session if the folder becomes unavailable. Firefox and Safari can import Markdown files from a folder (read-only, kept in IndexedDB) but cannot write changes back to the real folder.
*   **☁️ Cloud Sync:** Optional Firebase / Supabase / PocketBase / generic-backend sync with offline queueing for sessions, notes, VFS files, commits, and agent chats.
*   **💻 Built-in Sandbox Interpreter:** Execute, preview, and test generated HTML/JS/CSS code snippets securely in an isolated iframe without leaving the main chat workspace.
*   **🏪 Assistant Store:** Access a marketplace of free and premium, highly-optimized AI assistant presets and custom prompts for various tasks (e.g., Polyglot Translator, Code & Text Editor, Ideation Generator).
*   **⚙️ Advanced Parameters Control:** Fine-tune system behaviors with on-the-fly adjustable sliders for Temperature, Top P, and Max Tokens configuration.
*   **🧩 MCP (Model Context Protocol):** Connect remote MCP servers over Streamable HTTP and expose their tools to the AI as function-calling tools — just like an IDE agent. The model decides when to call a tool, the hub proxies the call, feeds the result back, and repeats. Works with any Streamable HTTP MCP endpoint; configure servers in the **🧩 MCP Servers** modal.

---

## 🗂️ Notes & Local Storage

The Notes app has its own page at **`/notes`** and is linked from the Hub sidebar. Both pages share the same IndexedDB data, so your notes are available in both places without an extra sync step.

Pick a storage mode in the Notes sidebar:

| Mode | Behaviour | Browser support |
| --- | --- | --- |
| **Local (IndexedDB)** | Default when no cloud database is connected. Notes stay in the browser. | All modern browsers |
| **Cloud DB** | Mirrors notes through the configured Firebase / Supabase / PocketBase / generic backend. | All modern browsers |
| **Local folder (.md)** | One Markdown file per note, with `id`, `title`, `updated` and `tags` front matter. Two-way sync every minute while the Notes tab is open. | Chrome / Edge (desktop, HTTPS or localhost) |
| **Local folder (import)** | Imports every `.md` file from the selected folder (including subfolders) into IndexedDB; **Re-import** refreshes them. Edits stay in IndexedDB and are never written back. | Firefox and browsers without folder write access |

Folder notes are matched by their front-matter `id` (or by a stable file-name hash when there is no front matter), so files edited in an external editor can be re-imported without duplicates. When the same note exists locally and in the folder, the newer version wins; deleting a file in a writable folder removes the matching note. In Chrome/Edge the Notes page warns once per session if the linked folder becomes unavailable.

Firefox and Safari do not expose write access to real folders — a platform limitation, not an app setting. They can import Markdown files into IndexedDB (read-only), but changes are not written back to disk. Use Chrome/Edge for two-way folder sync, or export notes manually when you need `.md` files on disk.

The editor also supports Markdown preview, automatic `#tag` extraction (Unicode-aware, so Cyrillic and CJK tags work), full-text search, single-note import/export, **AI Complement** using the provider/model configured in the Hub, and **Export to RAG**.

---

## 🧩 MCP (Model Context Protocol)

MCP lets you plug external tools into the chat. The client (`mcp.js`) speaks JSON-RPC 2.0 over Streamable HTTP to any remote MCP server and turns its tools into OpenAI-style function tools used by the agentic loop.

**Connect a server:** open **🧩 MCP Servers**, enter a name + URL (and an optional `Bearer` auth header), hit **Add & Connect**. Servers are saved in your browser's local storage (IndexedDB) and auto-reconnect on startup. You can also add one from the console:

```js
const entry = MCP_MANAGER.add({ name: 'MyServer', url: 'https://host/mcp', authHeader: '' });
await MCP_MANAGER.connectOne(entry.id);
```

**Write your own server:** implement a `POST` endpoint handling `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`, return an `Mcp-Session-Id` header, and emit CORS. 

> Note: the agentic MCP mode runs only when a **single** model is selected (it is disabled in multi-model compare mode), and your server must allow CORS from the app's domain.

---

### 🐳 Run via Docker (Self-Hosted)

If you want to run this app locally using Docker, you can build and run it yourself:

1. Clone the repository:
```
   git clone https://github.com/traliran/traliran-ai-hub.git
   cd traliran-ai-hub
```
2. Build the Docker image:
```
docker build -t traliran-ai-hub .
```
3. Run the container:
```
docker run -d -p 8080:80 traliran-ai-hub
```
Open http://localhost:8080 in your browser.

   
## ⚖️ License & Open Source Terms

This project is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.

### What this means for forks and deployments:
1.  **Keep it Open:** If you modify this software and run it on a server accessible to users over a network (e.g., SaaS or public websites), you **MUST** make your modified source code publicly available under the AGPLv3 license.
2.  **Attribution:** You must retain original copyright notices, links to this repository, and state any changes made.
3.  **No Hidden Commercialization:** You cannot close the source code or hide integrated core features (including the store and author credits) in public deployments.

*For custom commercial licensing or private white-label partnerships without AGPLv3 restrictions, please contact the repository maintainer via email: cwcom@proton.me.*
