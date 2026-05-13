(function initConstants(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  NewSiteCore.MESSAGE_TYPES = {
    PROFILE_GET: "NEWSITE_PROFILE_GET",
    PROFILE_SAVE: "NEWSITE_PROFILE_SAVE",
    PROFILE_RESET: "NEWSITE_PROFILE_RESET",
    SELECTOR_TEST: "NEWSITE_SELECTOR_TEST",
    SELECTOR_TEST_ALL: "NEWSITE_SELECTOR_TEST_ALL",
    PAGE_STATE_DETECT: "NEWSITE_PAGE_STATE_DETECT",
    RUN_AUTOMATION: "NEWSITE_RUN_AUTOMATION",
    RUNTIME_STATUS_GET: "NEWSITE_RUNTIME_STATUS_GET",
    DIAGNOSTICS_GET: "NEWSITE_DIAGNOSTICS_GET",
    EXPORT_DIAGNOSTICS: "NEWSITE_EXPORT_DIAGNOSTICS"
  };

  NewSiteCore.STORAGE_KEYS = {
    SITE_PROFILE: "newsite_site_profile",
    EVENT_BUFFER: "telemetry_buffer",
    LAST_WORKFLOW: "last_workflow",
    SELECTOR_HEALTH: "selector_health",
    PAGE_STATE_HISTORY: "page_state_history",
    ERROR_LOG: "error_log",
    RUNTIME_STATUS: "runtime_status",
    DIAGNOSTIC_SNAPSHOT: "diagnostic_snapshot"
  };

  NewSiteCore.TELEMETRY_EVENTS = {
    EXTENSION_BOOTSTRAP_STARTED: "extension.bootstrap.started",
    EXTENSION_BOOTSTRAP_COMPLETED: "extension.bootstrap.completed",
    EXTENSION_MESSAGE_RECEIVED: "extension.message.received",
    EXTENSION_MESSAGE_FORWARDED: "extension.message.forwarded",
    EXTENSION_MESSAGE_FAILED: "extension.message.failed",
    PROFILE_LOADED: "site.profile.loaded",
    PROFILE_SAVED: "site.profile.saved",
    PROFILE_VALIDATION_FAILED: "site.profile.validation_failed",
    SELECTOR_TEST_STARTED: "site.selector.test.started",
    SELECTOR_TEST_COMPLETED: "site.selector.test.completed",
    SELECTOR_TEST_FAILED: "site.selector.test.failed",
    SELECTOR_BROKEN: "site.selector.broken",
    SELECTOR_FALLBACK_USED: "site.selector.fallback_used",
    PAGE_STATE_DETECT_STARTED: "site.page_state.detect.started",
    PAGE_STATE_DETECT_COMPLETED: "site.page_state.detect.completed",
    PAGE_STATE_DETECT_FAILED: "site.page_state.detect.failed",
    WORKFLOW_STARTED: "site.workflow.started",
    WORKFLOW_STEP_STARTED: "site.workflow.step.started",
    WORKFLOW_STEP_COMPLETED: "site.workflow.step.completed",
    WORKFLOW_STEP_FAILED: "site.workflow.step.failed",
    WORKFLOW_COMPLETED: "site.workflow.completed",
    WORKFLOW_FAILED: "site.workflow.failed",
    DIAGNOSTIC_EXPORT_STARTED: "diagnostic.export.started",
    DIAGNOSTIC_EXPORT_COMPLETED: "diagnostic.export.completed"
  };
})(globalThis);
