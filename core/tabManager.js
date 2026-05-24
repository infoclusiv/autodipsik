(function initTabManager(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const DEEPSEEK_CONTENT_SCRIPT_FILES = [
    "core/config.js",
    "core/constants.js",
    "core/errors.js",
    "core/storage.js",
    "core/telemetry.js",
    "core/observabilityContracts.js",
    "core/workflowRunner.js",
    "core/diagnosticRedactor.js",
    "core/diagnosticExporter.js",
    "core/diagnosticStore.js",
    "sites/deepseek/config.js",
    "sites/deepseek/siteProfile.js",
    "sites/deepseek/selectors.js",
    "sites/deepseek/domHelpers.js",
    "sites/deepseek/pageState.js",
    "sites/deepseek/filePayloadHelpers.js",
    "sites/deepseek/diagnostics/deepseekComposerProbe.js",
    "sites/deepseek/responseCapture.js",
    "sites/deepseek/chatAutomator.js",
    "sites/deepseek/content.js"
  ];

  async function getActiveTab() {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    return tabs[0] || null;
  }

  async function openTab(url) {
    return chrome.tabs.create({ url: url });
  }

  async function openTabInWindow(url, windowId) {
    const createOptions = {
      url: url,
      active: true
    };

    if (typeof windowId === "number") {
      createOptions.windowId = windowId;
    }

    return chrome.tabs.create(createOptions);
  }

  async function findTabByUrlPattern(urlPattern) {
    const tabs = await chrome.tabs.query({ url: urlPattern });
    return tabs[0] || null;
  }

  async function ensureTab(url, urlPattern) {
    const existing = urlPattern ? await findTabByUrlPattern(urlPattern) : null;
    if (existing) {
      await chrome.tabs.update(existing.id, { active: true });
      if (existing.windowId) {
        await chrome.windows.update(existing.windowId, { focused: true });
      }
      return existing;
    }
    return chrome.tabs.create({ url: url, active: true });
  }

  async function waitForTabComplete(tabId, timeoutMs) {
    const timeout = typeof timeoutMs === "number" ? timeoutMs : 15000;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.status === "complete") {
        return tab;
      }
      await new Promise(function sleep(resolve) {
        setTimeout(resolve, 200);
      });
    }
    throw new Error("Timed out waiting for tab " + tabId + " to complete loading.");
  }

  function isContentScriptUnavailableError(error) {
    const message = String(error && error.message ? error.message : error || "");
    return /Receiving end does not exist|Could not establish connection|No receiving end/i.test(message);
  }

  function sleep(ms) {
    return new Promise(function resolveAfterDelay(resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function pingContentScript(tabId, traceId) {
    const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES || {};
    const Telemetry = NewSiteCore.Telemetry;
    const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS || {};

    if (Telemetry && TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_PING_STARTED) {
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_PING_STARTED,
        traceId: traceId,
        siteId: "deepseek",
        component: "tabManager",
        level: "info",
        message: "DeepSeek content script ping started",
        data: { tabId: tabId }
      });
    }

    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.DEEPSEEK_CONTENT_SCRIPT_PING,
        traceId: traceId,
        targetSiteId: "deepseek"
      });

      if (Telemetry && TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_PING_COMPLETED) {
        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_PING_COMPLETED,
          traceId: traceId,
          siteId: "deepseek",
          component: "tabManager",
          level: "info",
          message: "DeepSeek content script ping completed",
          data: { tabId: tabId, response: response || null }
        });
      }

      return response;
    } catch (error) {
      if (Telemetry && TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_PING_FAILED) {
        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_PING_FAILED,
          traceId: traceId,
          siteId: "deepseek",
          component: "tabManager",
          level: "warn",
          message: "DeepSeek content script ping failed",
          data: { tabId: tabId, error: error.message }
        });
      }
      throw error;
    }
  }

  async function injectDeepSeekContentScripts(tabId, traceId) {
    const Telemetry = NewSiteCore.Telemetry;
    const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS || {};
    const tab = await chrome.tabs.get(tabId);
    const tabUrl = tab && tab.url ? tab.url : "";

    if (!/^https:\/\/chat\.deepseek\.com\//i.test(tabUrl)) {
      throw new Error("Refusing to inject DeepSeek content scripts into a non-DeepSeek tab.");
    }

    if (Telemetry && TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_INJECTION_STARTED) {
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_INJECTION_STARTED,
        traceId: traceId,
        siteId: "deepseek",
        component: "tabManager",
        level: "warn",
        message: "DeepSeek content script fallback injection started",
        data: {
          tabId: tabId,
          files: DEEPSEEK_CONTENT_SCRIPT_FILES
        }
      });
    }

    if (!chrome.scripting || !chrome.scripting.executeScript) {
      throw new Error("chrome.scripting.executeScript is not available. Check manifest permissions.");
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: DEEPSEEK_CONTENT_SCRIPT_FILES
      });

      await sleep(300);

      if (Telemetry && TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_INJECTION_COMPLETED) {
        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_INJECTION_COMPLETED,
          traceId: traceId,
          siteId: "deepseek",
          component: "tabManager",
          level: "info",
          message: "DeepSeek content script fallback injection completed",
          data: {
            tabId: tabId,
            files: DEEPSEEK_CONTENT_SCRIPT_FILES
          }
        });
      }
    } catch (error) {
      if (Telemetry && TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_INJECTION_FAILED) {
        await Telemetry.emit({
          eventName: TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_INJECTION_FAILED,
          traceId: traceId,
          siteId: "deepseek",
          component: "tabManager",
          level: "error",
          message: "DeepSeek content script fallback injection failed",
          data: {
            tabId: tabId,
            files: DEEPSEEK_CONTENT_SCRIPT_FILES,
            error: error.message
          }
        });
      }
      throw error;
    }
  }

  async function sendMessageWithContentScriptCheck(tabId, message, options) {
    const opts = options || {};
    const traceId = message && message.traceId ? message.traceId : "";
    const targetSiteId = opts.targetSiteId || (message && message.targetSiteId) || "deepseek";
    const Telemetry = NewSiteCore.Telemetry;
    const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS || {};

    try {
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (originalError) {
      if (targetSiteId !== "deepseek" || !isContentScriptUnavailableError(originalError)) {
        throw originalError;
      }

      try {
        await injectDeepSeekContentScripts(tabId, traceId);

        if (Telemetry && TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_RETRY_STARTED) {
          await Telemetry.emit({
            eventName: TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_RETRY_STARTED,
            traceId: traceId,
            siteId: "deepseek",
            component: "tabManager",
            level: "info",
            message: "Retrying message after DeepSeek content script injection",
            data: {
              tabId: tabId,
              messageType: message.type
            }
          });
        }

        await pingContentScript(tabId, traceId);
        const retryResponse = await chrome.tabs.sendMessage(tabId, message);

        if (Telemetry && TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_RETRY_COMPLETED) {
          await Telemetry.emit({
            eventName: TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_RETRY_COMPLETED,
            traceId: traceId,
            siteId: "deepseek",
            component: "tabManager",
            level: "info",
            message: "Message retry after DeepSeek content script injection succeeded",
            data: {
              tabId: tabId,
              messageType: message.type
            }
          });
        }

        return retryResponse;
      } catch (retryError) {
        if (Telemetry && TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_RETRY_FAILED) {
          await Telemetry.emit({
            eventName: TELEMETRY_EVENTS.DEEPSEEK_CONTENT_SCRIPT_RETRY_FAILED,
            traceId: traceId,
            siteId: "deepseek",
            component: "tabManager",
            level: "error",
            message: "Message retry after DeepSeek content script injection failed",
            data: {
              tabId: tabId,
              messageType: message.type,
              originalError: originalError.message,
              retryError: retryError.message,
              injectedFiles: DEEPSEEK_CONTENT_SCRIPT_FILES
            }
          });
        }

        const error = new Error("DeepSeek content script unavailable after fallback injection attempt.");
        error.code = "CONTENT_SCRIPT_UNAVAILABLE_AFTER_INJECTION";
        error.tabId = tabId;
        error.messageType = message.type;
        error.injectionAttempted = true;
        error.injectedFiles = DEEPSEEK_CONTENT_SCRIPT_FILES;
        error.originalError = originalError.message;
        error.retryError = retryError.message;
        throw error;
      }
    }
  }

  NewSiteCore.TabManager = {
    getActiveTab: getActiveTab,
    openTab: openTab,
    openTabInWindow: openTabInWindow,
    findTabByUrlPattern: findTabByUrlPattern,
    ensureTab: ensureTab,
    waitForTabComplete: waitForTabComplete,
    sendMessageWithContentScriptCheck: sendMessageWithContentScriptCheck
  };
})(globalThis);
