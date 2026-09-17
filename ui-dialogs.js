// Shared in-app notification and dialog system.
// Replaces native browser alert/confirm/prompt with styled in-app UI.
// All user-facing strings and comments are kept in English.
(function () {
    'use strict';

    var TOAST_STACK_ID = 'appToastStack';
    var DIALOG_OVERLAY_ID = 'appDialogOverlay';
    var TOAST_DURATION = 4200;

    var TONES = {
        info: { border: 'border-gray-700', accent: 'text-gray-200', dot: '#9ca3af' },
        success: { border: 'border-emerald-600/50', accent: 'text-emerald-300', dot: '#34d399' },
        warning: { border: 'border-amber-600/50', accent: 'text-amber-300', dot: '#fbbf24' },
        error: { border: 'border-rose-700/60', accent: 'text-rose-300', dot: '#fb7185' }
    };

    function ensureToastStack() {
        var stack = document.getElementById(TOAST_STACK_ID);
        if (stack) return stack;
        stack = document.createElement('div');
        stack.id = TOAST_STACK_ID;
        stack.setAttribute('role', 'status');
        stack.setAttribute('aria-live', 'polite');
        stack.className = 'app-toast-stack';
        document.body.appendChild(stack);
        return stack;
    }

    function notify(message, type, duration) {
        var tone = TONES[type] ? type : 'info';
        var text = message === null || message === undefined ? '' : String(message);
        if (!text) return;
        var stack = ensureToastStack();
        // Keep the stack compact on small screens.
        while (stack.children.length >= 4) {
            stack.removeChild(stack.firstChild);
        }
        var toneDef = TONES[tone];
        var toast = document.createElement('div');
        toast.className = 'app-toast app-toast-' + tone + ' ' + toneDef.border;

        var dot = document.createElement('span');
        dot.className = 'app-toast-dot';
        dot.style.background = toneDef.dot;
        dot.style.boxShadow = '0 0 8px ' + toneDef.dot;

        var body = document.createElement('div');
        body.className = 'app-toast-body ' + toneDef.accent;
        body.textContent = text;

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'app-toast-close';
        closeBtn.setAttribute('aria-label', 'Dismiss notification');
        closeBtn.textContent = '\u00d7';

        var dismiss = function () {
            if (toast.parentNode) {
                toast.classList.add('app-toast-leaving');
                setTimeout(function () {
                    if (toast.parentNode) toast.parentNode.removeChild(toast);
                }, 180);
            }
        };
        closeBtn.addEventListener('click', dismiss);
        toast.addEventListener('click', function (e) {
            if (e.target !== closeBtn) dismiss();
        });

        toast.appendChild(dot);
        toast.appendChild(body);
        toast.appendChild(closeBtn);
        stack.appendChild(toast);

        // Animate entrance on the next frame.
        requestAnimationFrame(function () {
            toast.classList.add('app-toast-visible');
        });

        setTimeout(dismiss, typeof duration === 'number' ? duration : TOAST_DURATION);
        return dismiss;
    }

    function notifySuccess(message, duration) { return notify(message, 'success', duration); }
    function notifyWarning(message, duration) { return notify(message, 'warning', duration); }
    function notifyError(message, duration) { return notify(message, 'error', duration); }
    function notifyInfo(message, duration) { return notify(message, 'info', duration); }

    function closeDialogOverlay() {
        var overlay = document.getElementById(DIALOG_OVERLAY_ID);
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', escHandler, true);
    }

    function escHandler(e) {
        if (e.key === 'Escape') {
            var overlay = document.getElementById(DIALOG_OVERLAY_ID);
            if (overlay && overlay.dataset.escClosable !== 'false') {
                e.stopPropagation();
                var cancelBtn = overlay.querySelector('[data-dialog-cancel]');
                if (cancelBtn) cancelBtn.click();
                else closeDialogOverlay();
            }
        }
    }

    function buildOverlay(options) {
        closeDialogOverlay();
        var overlay = document.createElement('div');
        overlay.id = DIALOG_OVERLAY_ID;
        overlay.className = 'app-dialog-overlay';
        if (options && options.escClosable === false) overlay.dataset.escClosable = 'false';

        var card = document.createElement('div');
        card.className = 'app-dialog-card';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');

        if (options && options.title) {
            var title = document.createElement('h2');
            title.className = 'app-dialog-title';
            title.textContent = options.title;
            card.appendChild(title);
        }

        var message = document.createElement('p');
        message.className = 'app-dialog-message';
        message.textContent = options ? options.message || '' : '';
        card.appendChild(message);

        overlay.appendChild(card);
        document.body.appendChild(overlay);
        document.addEventListener('keydown', escHandler, true);
        return { overlay: overlay, card: card };
    }

    // In-app replacement for native alert(): shows a modal with a single OK button.
    function showAppAlert(message, title) {
        return new Promise(function (resolve) {
            var parts = buildOverlay({ title: title || 'Notice', message: String(message == null ? '' : message) });
            var actions = document.createElement('div');
            actions.className = 'app-dialog-actions';
            var okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.className = 'app-dialog-btn app-dialog-btn-primary';
            okBtn.textContent = 'OK';
            okBtn.addEventListener('click', function () {
                closeDialogOverlay();
                resolve();
            });
            actions.appendChild(okBtn);
            parts.card.appendChild(actions);
            if (parts.overlay) {
                parts.overlay.addEventListener('click', function (e) {
                    if (e.target === parts.overlay) {
                        closeDialogOverlay();
                        resolve();
                    }
                });
            }
            setTimeout(function () { okBtn.focus(); }, 30);
        });
    }

    // In-app replacement for native confirm(): resolves to true/false.
    function showAppConfirm(message, options) {
        var opts = options || {};
        return new Promise(function (resolve) {
            var settled = false;
            var finish = function (value) {
                if (settled) return;
                settled = true;
                closeDialogOverlay();
                resolve(value);
            };
            var parts = buildOverlay({ title: opts.title || 'Please confirm', message: String(message == null ? '' : message) });
            var actions = document.createElement('div');
            actions.className = 'app-dialog-actions';

            var cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'app-dialog-btn app-dialog-btn-secondary';
            cancelBtn.setAttribute('data-dialog-cancel', 'true');
            cancelBtn.textContent = opts.cancelText || 'Cancel';
            cancelBtn.addEventListener('click', function () { finish(false); });

            var okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.className = 'app-dialog-btn ' + (opts.danger ? 'app-dialog-btn-danger' : 'app-dialog-btn-primary');
            okBtn.textContent = opts.confirmText || 'Confirm';
            okBtn.addEventListener('click', function () { finish(true); });

            actions.appendChild(cancelBtn);
            actions.appendChild(okBtn);
            parts.card.appendChild(actions);
            parts.overlay.addEventListener('click', function (e) {
                if (e.target === parts.overlay) finish(false);
            });
            var onKey = function (e) {
                if (e.key === 'Enter' && document.activeElement !== cancelBtn) {
                    e.preventDefault();
                    finish(true);
                }
            };
            parts.card.addEventListener('keydown', onKey);
            setTimeout(function () { okBtn.focus(); }, 30);
        });
    }

    // In-app replacement for native prompt(): resolves to string or null when cancelled.
    function showAppPrompt(message, defaultValue, options) {
        var opts = options || {};
        return new Promise(function (resolve) {
            var settled = false;
            var input;
            var finish = function (value) {
                if (settled) return;
                settled = true;
                closeDialogOverlay();
                resolve(value);
            };
            var parts = buildOverlay({ title: opts.title || 'Input required', message: String(message == null ? '' : message) });

            input = document.createElement('input');
            input.type = 'text';
            input.className = 'app-dialog-input';
            input.value = defaultValue === null || defaultValue === undefined ? '' : String(defaultValue);
            if (opts.placeholder) input.placeholder = opts.placeholder;
            if (opts.maxLength) input.maxLength = opts.maxLength;
            parts.card.appendChild(input);

            var actions = document.createElement('div');
            actions.className = 'app-dialog-actions';

            var cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'app-dialog-btn app-dialog-btn-secondary';
            cancelBtn.setAttribute('data-dialog-cancel', 'true');
            cancelBtn.textContent = opts.cancelText || 'Cancel';
            cancelBtn.addEventListener('click', function () { finish(null); });

            var okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.className = 'app-dialog-btn app-dialog-btn-primary';
            okBtn.textContent = opts.confirmText || 'Save';
            okBtn.addEventListener('click', function () {
                var value = input.value;
                if (opts.trim !== false) value = value.trim();
                if (opts.required && !value) {
                    input.classList.add('app-dialog-input-error');
                    input.focus();
                    return;
                }
                finish(value);
            });

            actions.appendChild(cancelBtn);
            actions.appendChild(okBtn);
            parts.card.appendChild(actions);
            parts.overlay.addEventListener('click', function (e) {
                if (e.target === parts.overlay) finish(null);
            });
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    okBtn.click();
                }
            });
            setTimeout(function () {
                input.focus();
                input.select();
            }, 30);
        });
    }

    // Expose helpers globally so Hub, IDE and Playground pages share one system.
    window.notify = notify;
    window.notifySuccess = notifySuccess;
    window.notifyWarning = notifyWarning;
    window.notifyError = notifyError;
    window.notifyInfo = notifyInfo;
    window.showToast = notify;
    window.showAppAlert = showAppAlert;
    window.showAppConfirm = showAppConfirm;
    window.showAppPrompt = showAppPrompt;
    window.AppDialogs = {
        notify: notify,
        success: notifySuccess,
        warning: notifyWarning,
        error: notifyError,
        info: notifyInfo,
        alert: showAppAlert,
        confirm: showAppConfirm,
        prompt: showAppPrompt
    };
})();
