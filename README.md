# 💎 Traliran AI Hub

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

A lightweight, serverless, and privacy-first AI web client and sandbox running directly in your browser. Features a built-in code execution environment, a full-fledged AI IDE, and a parallel model benchmarking tool. Connect directly to Groq, Gemini, OpenAI, OpenRouter, DeepSeek, Qwen, GLM, Claude, and local backends (Ollama / Llama.cpp) without middlemen.

## ⚠️ Warning! ⚠️

> When you export a custom bot configuration that you've created, **your API keys are also exported**.
> 
> So before sharing your configuration, **REMOVE YOUR API KEYS FROM THE .json FILE**
> 
> P.S. This was designed to make it easy to import or restore your session later.


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
* **Direct Routing:** Your API keys are stored strictly in your browser's `LocalStorage` and sent straight to official provider endpoints. No logs, no data collection, no leaks.
* **AGPLv3 Guaranteed:** Complete freedom to audit, inspect, and self-host, backed by a strong copyleft license.

---

## 🚀 Key Features

*   **Multi-Provider Support:** Seamlessly switch between top cloud APIs (Groq, Gemini, OpenAI, OpenRouter, DeepSeek, Qwen, GLM, Claude) and local LLMs (Ollama, Llama.cpp).
*   **⚡ Multi-Model Setup & Compare:** Select multiple models simultaneously — including across different providers (Groq + OpenAI + Claude, local models, etc.), each using its own configured API key. The app triggers parallel requests and renders side-by-side comparative cards with per-model and per-provider labels for instant benchmarking.
*   **💡 Model Thinking Support:** Native rendering for reasoning models (like DeepSeek-R1). Structural thoughts are captured and organized into a clean, collapsible hidden dropdown block.
*   **👥 AI Group Debate Mode:** Turn your raw ideas into fully analyzed concepts. Run a multi-agent discussion loop where specialized personas (Optimist, Critic, and Technologist) cross-examine your thesis over multiple rounds.
*   **⚡ AI IDE - Integrated Development Environment:** A full-fledged in-browser IDE for code generation, editing, and project management, powered by your chosen AI model.
    *   **File Explorer:** Manage multiple project files (HTML, CSS, JS, etc.).
    *   **Code Editor:** Edit files with a monospaced code editor.
    *   **Live Preview:** Instantly preview HTML/JS/CSS code changes in an isolated iframe.
    *   **AI:** Utilize AI for quick actions like `Create Layout`, `Optimize / Clean`, `Explain Code`, and `Debug & Fix` based on your active file or prompt.
    *   **Project Management:** Download your entire workspace as a `.zip` or reset it.
*   **💻 Built-in Sandbox Interpreter:** Execute, preview, and test generated HTML/JS/CSS code snippets securely in an isolated iframe without leaving the main chat workspace.
*   **🏪 Assistant Store:** Access a marketplace of free and premium, highly-optimized AI assistant presets and custom prompts for various tasks (e.g., Polyglot Translator, Code & Text Editor, Ideation Generator).
*   **⚙️ Advanced Parameters Control:** Fine-tune system behaviors with on-the-fly adjustable sliders for Temperature, Top P, and Max Tokens configuration.
*   **🧩 MCP (Model Context Protocol):** Connect remote MCP servers over Streamable HTTP and expose their tools to the AI as function-calling tools — just like an IDE agent. The model decides when to call a tool, the hub proxies the call, feeds the result back, and repeats. Works with any Streamable HTTP MCP endpoint; configure servers in the **🧩 MCP Servers** modal.

---

## 🧩 MCP (Model Context Protocol)

MCP lets you plug external tools into the chat. The client (`mcp.js`) speaks JSON-RPC 2.0 over Streamable HTTP to any remote MCP server and turns its tools into OpenAI-style function tools used by the agentic loop.

**Connect a server:** open **🧩 MCP Servers**, enter a name + URL (and an optional `Bearer` auth header), hit **Add & Connect**. Servers are saved in `LocalStorage` and auto-reconnect on startup. You can also add one from the console:

```js
const entry = MCP_MANAGER.add({ name: 'MyServer', url: 'https://host/mcp', authHeader: '' });
await MCP_MANAGER.connectOne(entry.id);
```

**Write your own server:** implement a `POST` endpoint handling `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`, return an `Mcp-Session-Id` header, and emit CORS. 

> Note: the agentic MCP mode runs only when a **single** model is selected (it is disabled in multi-model compare mode), and your server must allow CORS from the app's domain.

---

## ⚖️ License & Open Source Terms

This project is licensed under the **GNU Affero General Public License v3.0 (AGPLv3)**.

### What this means for forks and deployments:
1.  **Keep it Open:** If you modify this software and run it on a server accessible to users over a network (e.g., SaaS or public websites), you **MUST** make your modified source code publicly available under the AGPLv3 license.
2.  **Attribution:** You must retain original copyright notices, links to this repository, and state any changes made.
3.  **No Hidden Commercialization:** You cannot close the source code or hide integrated core features (including the store and author credits) in public deployments.

*For custom commercial licensing or private white-label partnerships without AGPLv3 restrictions, please contact the repository maintainer via email: cwcom@proton.me.*
