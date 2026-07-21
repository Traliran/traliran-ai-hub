# План реализации: Кнопка суммаризации беседы

## Обзор
Добавить кнопку на верхнюю панель (после Settings), которая суммаризирует текущую беседу через выбранную ИИ-модель и вставляет результат в поле Personal AI (textarea `#personalInfo`). Кнопка появляется только когда в чате есть 2+ ответа нейросети.

---

## Шаг 1: HTML — добавить кнопку

**Файл:** `index.html`, после строки 26 (после кнопки Settings)

```html
<button id="summarizeChatBtn" class="hidden bg-gray-800 hover:bg-gray-700 text-white text-sm px-3 py-1.5 rounded transition cursor-pointer" title="Summarize conversation to Personal AI">
    📝 <span class="hidden sm:inline">Summarize</span>
</button>
```

Ключевые моменты:
- Начальный класс `hidden` — кнопка скрыта по умолчанию
- Стили идентичны кнопкам Chats и Settings

---

## Шаг 2: JavaScript — DOM ссылка

**Файл:** `app.js`, рядом с другими DOM-ссылками (~строка 86)

```javascript
const summarizeChatBtn = document.getElementById('summarizeChatBtn');
```

---

## Шаг 3: JavaScript — функции подсчёта и видимости

**Файл:** `app.js`, после ~строки 100

```javascript
function countAssistantMessages() {
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return 0;
    return session.messages.filter(m => m.role === 'assistant').length;
}

function updateSummarizeButtonVisibility() {
    const count = countAssistantMessages();
    summarizeChatBtn.classList.toggle('hidden', count < 2);
}
```

---

## Шаг 4: JavaScript — обработчик клика

**Файл:** `app.js`, после ~строки 150

```javascript
summarizeChatBtn.addEventListener('click', async () => {
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return;
    
    if (countAssistantMessages() < 2) {
        alert('Need at least 2 AI responses to summarize.');
        return;
    }
    
    const providerName = apiProvider.value;
    const hasKey = PROVIDERS[providerName].hasKey;
    const apiKey = apiKeyValue.value.trim();
    const endpoint = apiEndpoint.value.trim();
    const topP = parseFloat(topPInput.value);
    
    if (hasKey && !apiKey) {
        alert('Please enter your API key!');
        openSidebarUniversal();
        return;
    }
    
    const modelId = botModelSelect.value;
    if (!modelId) {
        alert('Please select an AI model!');
        openSidebarUniversal();
        return;
    }
    
    const conversationMessages = session.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        }));
    
    const summarizationPrompt = {
        role: 'system',
        content: 'You are a conversation summarizer. Create a concise but comprehensive summary of this conversation. Focus on: 1) Key topics discussed, 2) Important decisions or conclusions, 3) User preferences and goals revealed. Format as structured text suitable for a "Personal AI" context field.'
    };
    
    const messagesToSend = [summarizationPrompt, ...conversationMessages];
    
    summarizeChatBtn.disabled = true;
    summarizeChatBtn.innerHTML = '⏳ <span class="hidden sm:inline">Summarizing...</span>';
    
    try {
        const payload = {
            model: modelId,
            messages: messagesToSend,
            temperature: 0.3,
            top_p: topP,
            max_tokens: 500
        };
        
        const result = await fetchSingleCompletion(endpoint, apiKey, hasKey, payload, providerName);
        const parsed = extractAssistantContent(result, providerName);
        const summary = parsed.content || '';
        
        if (summary) {
            const currentInfo = personalInfoInput.value.trim();
            const newInfo = currentInfo
                ? `${currentInfo}\n\n--- Conversation Summary ---\n${summary}`
                : `--- Conversation Summary ---\n${summary}`;
            
            personalInfoInput.value = newInfo;
            localStorage.setItem('gem_personal_info', newInfo);
            
            summarizeChatBtn.innerHTML = '✅ <span class="hidden sm:inline">Done!</span>';
            setTimeout(() => {
                summarizeChatBtn.innerHTML = '📝 <span class="hidden sm:inline">Summarize</span>';
            }, 2000);
        }
    } catch (error) {
        console.error('Summarization error:', error);
        alert('Failed to summarize conversation: ' + error.message);
        summarizeChatBtn.innerHTML = '📝 <span class="hidden sm:inline">Summarize</span>';
    } finally {
        summarizeChatBtn.disabled = false;
    }
});
```

---

## Шаг 5: JavaScript — вызовы обновления видимости

**Файл:** `app.js`

Добавить `updateSummarizeButtonVisibility()` в трёх местах:

1. После строки 1231 (после single model response):
   ```javascript
   updateSummarizeButtonVisibility();
   ```

2. После строки 1272 (после multi-model response):
   ```javascript
   updateSummarizeButtonVisibility();
   ```

3. В функции `selectSession()` (~строка 410) для обновления при переключении сессий:
   ```javascript
   updateSummarizeButtonVisibility();
   ```

---

## Итоговые изменения

| Файл | Где | Что |
|------|-----|-----|
| `index.html` | После строки 26 | Новая кнопка с `id="summarizeChatBtn"` и классом `hidden` |
| `app.js` | ~строка 86 | DOM ссылка `summarizeChatBtn` |
| `app.js` | После ~строки 100 | Функции `countAssistantMessages()`, `updateSummarizeButtonVisibility()` |
| `app.js` | После ~строки 150 | Обработчик `click` с вызовом AI API |
| `app.js` | Строки 1231, 1272, ~410 | `updateSummarizeButtonVisibility()` |
