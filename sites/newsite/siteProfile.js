(function initSiteProfile(globalScope) {
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const siteConfig = NewSiteAutomation.NEWSITE_CONFIG;
  const contracts = NewSiteAutomation.SiteProfileContract;
  const Storage = NewSiteCore.Storage;
  const Telemetry = NewSiteCore.Telemetry;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;

  const DEFAULT_NEWSITE_SITE_PROFILE = {
    siteId: "newsite",
    version: 1,
    baseUrl: "https://example.com",
    urlPattern: "https://example.com/*",
    selectors: {
      primaryActionButton: "",
      secondaryActionButton: "",
      fileInput: "",
      uploadButton: "",
      processButton: "",
      confirmButton: "",
      progressIndicator: "",
      resultReadyIndicator: "",
      downloadButton: "",
      errorBanner: ""
    },
    timing: {
      afterPageLoadDelayMs: 2000,
      afterUploadDelayMs: 2000,
      afterActionClickDelayMs: 1500,
      elementWaitTimeoutMs: 60000,
      workflowTimeoutMs: 180000,
      pollIntervalMs: 500
    }
  };

  function cloneDefaultProfile() {
    return JSON.parse(JSON.stringify(DEFAULT_NEWSITE_SITE_PROFILE));
  }

  function getSelectorKeys() {
    return Object.keys(DEFAULT_NEWSITE_SITE_PROFILE.selectors);
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

  function normalizeSiteProfile(input) {
    const base = cloneDefaultProfile();
    const merged = Object.assign({}, base, input || {});
    merged.selectors = Object.assign({}, base.selectors, input && input.selectors ? input.selectors : {});
    merged.timing = Object.assign({}, base.timing, input && input.timing ? input.timing : {});
    merged.siteId = siteConfig.siteId;
    return merged;
  }

  function validateSiteProfile(profile) {
    const normalized = normalizeSiteProfile(profile);
    const errors = [];

    contracts.requiredFields.forEach(function checkField(field) {
      if (normalized[field] === undefined || normalized[field] === null) {
        errors.push("Missing required field: " + field);
      }
    });

    if (!/^https?:\/\/.+/.test(normalized.baseUrl)) {
      errors.push("Invalid base URL.");
    }

    if (!/^https?:\/\/.+\*$/.test(normalized.urlPattern)) {
      errors.push("Invalid URL pattern. Example: https://example.com/*");
    }

    Object.keys(normalized.timing).forEach(function checkTiming(key) {
      const value = normalized.timing[key];
      if (typeof value !== "number" || value < 0) {
        errors.push("Timing value must be a non-negative number: " + key);
      }
    });

    Object.keys(normalized.selectors).forEach(function checkSelector(key) {
      if (getSelectorKeys().indexOf(key) === -1) {
        errors.push("Unknown selector key: " + key);
        return;
      }
      if (!isValidCssSelector(normalized.selectors[key])) {
        errors.push("Invalid CSS selector for " + key);
      }
    });

    return {
      valid: errors.length === 0,
      errors: errors,
      profile: normalized
    };
  }

  async function loadSiteProfile() {
    const stored = await Storage.getValue(siteConfig.storageKeySiteProfile, null);
    const normalized = normalizeSiteProfile(stored || cloneDefaultProfile());
    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.PROFILE_LOADED,
      traceId: NewSiteCore.Telemetry.createTraceId("profile"),
      siteId: siteConfig.siteId,
      component: "siteProfile",
      level: "info",
      message: "Site profile loaded"
    });
    return normalized;
  }

  async function saveSiteProfile(profile) {
    const validation = validateSiteProfile(profile);
    if (!validation.valid) {
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.PROFILE_VALIDATION_FAILED,
        traceId: NewSiteCore.Telemetry.createTraceId("profile"),
        siteId: siteConfig.siteId,
        component: "siteProfile",
        level: "warn",
        message: "Site profile validation failed",
        data: { errors: validation.errors }
      });
      return validation;
    }

    await Storage.setValue(siteConfig.storageKeySiteProfile, validation.profile);
    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.PROFILE_SAVED,
      traceId: NewSiteCore.Telemetry.createTraceId("profile"),
      siteId: siteConfig.siteId,
      component: "siteProfile",
      level: "info",
      message: "Site profile saved"
    });
    return validation;
  }

  NewSiteAutomation.DEFAULT_NEWSITE_SITE_PROFILE = DEFAULT_NEWSITE_SITE_PROFILE;
  NewSiteAutomation.SiteProfile = {
    loadSiteProfile: loadSiteProfile,
    saveSiteProfile: saveSiteProfile,
    normalizeSiteProfile: normalizeSiteProfile,
    validateSiteProfile: validateSiteProfile,
    cloneDefaultProfile: cloneDefaultProfile
  };
})(globalThis);
