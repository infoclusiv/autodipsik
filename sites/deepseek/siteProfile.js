(function initDeepSeekSiteProfile(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const config = DeepSeekAutomation.DEEPSEEK_CONFIG;
  const Storage = NewSiteCore.Storage;
  const Telemetry = NewSiteCore.Telemetry;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;

  const DEFAULT_DEEPSEEK_SITE_PROFILE = {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    siteId: "deepseek",
    version: 2,
    baseUrl: config.baseUrl,
    urlPattern: config.urlPattern,
    urlPatterns: ["https://chat.deepseek.com/*"],
    hostnames: ["chat.deepseek.com"],
    capabilities: {
      supportsFileUpload: true,
      supportsPromptInjection: true,
      supportsSubmit: true
    },
    selectors: {
      fileInput: "input[type='file']",
      chatInput: "textarea[placeholder='Message DeepSeek'], textarea",
      chatInputFallback: "textarea[name='search'], textarea, div[contenteditable='true']",
      attachButton: "button[aria-label*='Attach' i], button[aria-label*='Upload' i], label[for]",
      sendButton: "button[type='submit'], button[aria-label*='Send' i], [role='button'][aria-label*='Send' i]",
      fileAttachedIndicator: "[data-testid*='attachment' i], [class*='attach' i], [class*='upload' i]",
      fileNameIndicator: "*",
      fileTypeIndicator: "*",
      sendButtonDisabledIndicator: "button[disabled][type='submit'], button[aria-disabled='true']",
      errorBanner: "[role='alert'], .error, .alert, .warning",
      progressIndicator: "[role='progressbar'], [aria-busy='true']",
      generatingIndicator: "[class*='generat' i], [data-testid*='generat' i]",
      responseContainer: "[data-testid*='message' i], [class*='message' i]",
      latestAssistantMessage: "[data-testid*='assistant' i], [class*='assistant' i]",
      primaryActionButton: "button, [role='button']"
    },
    timing: {
      afterPageLoadDelayMs: 1200,
      chatInputReadyTimeoutMs: 10000,
      fileAttachTimeoutMs: 10000,
      afterFileAttachDelayMs: 1500,
      attachmentReadyTimeoutMs: 30000,
      attachmentStablePollCount: 3,
      attachmentStableMinDurationMs: 750,
      afterPromptInsertDelayMs: 250,
      composerReadyTimeoutMs: 30000,
      sendButtonReadyTimeoutMs: 5000,
      afterSendClickDelayMs: 600,
      pollIntervalMs: 200
    },
    behavior: {
      enableHeuristicFallbacks: true,
      requireFileAttachedIndicator: false,
      requireAttachmentReadyBeforePrompt: true,
      requireComposerReadyBeforeSend: true,
      readinessDiagnosticsEnabled: true,
      expectedFileExtensions: [".xls", ".xlsx"]
    },
    upload: {
      mode: "native-file-input",
      acceptedExtensions: [".xls", ".xlsx", ".csv"],
      dispatchEvents: ["input", "change"],
      waitAfterAttachMs: 1500,
      elementWaitTimeoutMs: 10000,
      pollIntervalMs: 200
    },
    diagnostics: {
      captureSelectorSnapshots: true,
      captureDomUploadState: true
    }
  };

  function cloneDefaultProfile() {
    return JSON.parse(JSON.stringify(DEFAULT_DEEPSEEK_SITE_PROFILE));
  }

  function normalizeSiteProfile(input) {
    const base = cloneDefaultProfile();
    const merged = Object.assign({}, base, input || {});
    merged.selectors = Object.assign({}, base.selectors, input && input.selectors ? input.selectors : {});
    merged.timing = Object.assign({}, base.timing, input && input.timing ? input.timing : {});
    merged.behavior = Object.assign({}, base.behavior, input && input.behavior ? input.behavior : {});
    merged.upload = Object.assign({}, base.upload, input && input.upload ? input.upload : {});
    merged.capabilities = Object.assign({}, base.capabilities, input && input.capabilities ? input.capabilities : {});
    merged.diagnostics = Object.assign({}, base.diagnostics, input && input.diagnostics ? input.diagnostics : {});
    merged.siteId = config.siteId;
    merged.baseUrl = config.baseUrl;
    merged.urlPattern = config.urlPattern;
    return merged;
  }

  function isValidCssSelector(selector) {
    if (!selector || typeof selector !== "string") {
      return true;
    }
    if (typeof document === "undefined") {
      return true;
    }
    try {
      document.createDocumentFragment().querySelector(selector);
      return true;
    } catch (error) {
      return false;
    }
  }

  function validateSiteProfile(profile) {
    const normalized = normalizeSiteProfile(profile);
    const errors = [];
    ["id", "siteId", "baseUrl", "urlPattern"].forEach(function checkField(key) {
      if (!normalized[key]) {
        errors.push("Missing required field: " + key);
      }
    });

    if (normalized.siteId !== "deepseek") {
      errors.push("siteId must be deepseek.");
    }

    ["fileInput", "chatInput", "sendButton"].forEach(function checkSelector(key) {
      if (!normalized.selectors[key]) {
        errors.push("Missing required selector: " + key);
      }
    });

    Object.keys(normalized.selectors).forEach(function checkSelector(key) {
      if (!isValidCssSelector(normalized.selectors[key])) {
        errors.push("Invalid CSS selector for " + key);
      }
    });

    Object.keys(normalized.timing).forEach(function checkTiming(key) {
      if (typeof normalized.timing[key] !== "number" || normalized.timing[key] < 0) {
        errors.push("Timing value must be a non-negative number: " + key);
      }
    });

    if (!Array.isArray(normalized.behavior.expectedFileExtensions)) {
      errors.push("behavior.expectedFileExtensions must be an array.");
    }

    ["supportsFileUpload", "supportsPromptInjection", "supportsSubmit"].forEach(function checkCapability(key) {
      if (typeof normalized.capabilities[key] !== "boolean") {
        errors.push("capabilities." + key + " must be a boolean.");
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors,
      profile: normalized
    };
  }

  async function loadSiteProfile() {
    const stored = await Storage.getValue(config.storageKeySiteProfile, null);
    const normalized = normalizeSiteProfile(stored || cloneDefaultProfile());
    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.PROFILE_LOADED,
      traceId: Telemetry.createTraceId("profile"),
      siteId: config.siteId,
      component: "deepseekSiteProfile",
      level: "info",
      message: "DeepSeek site profile loaded"
    });
    return normalized;
  }

  async function saveSiteProfile(profile) {
    const validation = validateSiteProfile(profile);
    if (!validation.valid) {
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.PROFILE_VALIDATION_FAILED,
        traceId: Telemetry.createTraceId("profile"),
        siteId: config.siteId,
        component: "deepseekSiteProfile",
        level: "warn",
        message: "DeepSeek site profile validation failed",
        data: { errors: validation.errors }
      });
      return validation;
    }

    await Storage.setValue(config.storageKeySiteProfile, validation.profile);
    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.PROFILE_SAVED,
      traceId: Telemetry.createTraceId("profile"),
      siteId: config.siteId,
      component: "deepseekSiteProfile",
      level: "info",
      message: "DeepSeek site profile saved"
    });
    return validation;
  }

  DeepSeekAutomation.DEFAULT_DEEPSEEK_SITE_PROFILE = DEFAULT_DEEPSEEK_SITE_PROFILE;
  DeepSeekAutomation.DeepSeekSiteProfile = {
    cloneDefaultProfile: cloneDefaultProfile,
    normalizeSiteProfile: normalizeSiteProfile,
    validateSiteProfile: validateSiteProfile,
    loadSiteProfile: loadSiteProfile,
    saveSiteProfile: saveSiteProfile
  };
})(globalThis);
