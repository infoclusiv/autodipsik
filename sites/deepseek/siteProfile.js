(function initDeepSeekSiteProfile(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const config = DeepSeekAutomation.DEEPSEEK_CONFIG;
  const Storage = NewSiteCore.Storage;

  const DEFAULT_DEEPSEEK_SITE_PROFILE = {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    siteId: "deepseek-chat",
    version: 1,
    urlPatterns: ["https://chat.deepseek.com/*"],
    hostnames: ["chat.deepseek.com"],
    capabilities: {
      supportsFileUpload: true,
      supportsPromptInjection: true,
      supportsSubmit: true
    },
    selectors: {
      fileInput: "input[type='file']",
      composer: "textarea, div[contenteditable='true']",
      sendButton: "button[type='submit'], button[aria-label*='Send' i]",
      attachmentButton: "button[aria-label*='Attach' i], button[aria-label*='Upload' i], label[for]"
    },
    upload: {
      mode: "native-file-input",
      acceptedExtensions: [".xls", ".xlsx", ".csv"],
      dispatchEvents: ["input", "change"],
      waitAfterAttachMs: 1500,
      elementWaitTimeoutMs: 5000,
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
    merged.upload = Object.assign({}, base.upload, input && input.upload ? input.upload : {});
    merged.capabilities = Object.assign({}, base.capabilities, input && input.capabilities ? input.capabilities : {});
    merged.diagnostics = Object.assign({}, base.diagnostics, input && input.diagnostics ? input.diagnostics : {});
    merged.siteId = config.siteId;
    return merged;
  }

  async function loadSiteProfile() {
    const stored = await Storage.getValue(config.storageKeySiteProfile, null);
    return normalizeSiteProfile(stored || cloneDefaultProfile());
  }

  DeepSeekAutomation.DEFAULT_DEEPSEEK_SITE_PROFILE = DEFAULT_DEEPSEEK_SITE_PROFILE;
  DeepSeekAutomation.DeepSeekSiteProfile = {
    cloneDefaultProfile: cloneDefaultProfile,
    normalizeSiteProfile: normalizeSiteProfile,
    loadSiteProfile: loadSiteProfile
  };
})(globalThis);
