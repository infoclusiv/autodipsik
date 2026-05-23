(function initStorageKeyConstants(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  NewSiteCore.CoreStorageKeys = {
    SITE_PROFILE: "newsite_site_profile",
    EVENT_BUFFER: "telemetry_buffer",
    LAST_WORKFLOW: "last_workflow",
    CONDITIONAL_WORKFLOW_DRAFT: "conditional_workflow_draft",
    SELECTOR_HEALTH: "selector_health",
    PAGE_STATE_HISTORY: "page_state_history",
    ERROR_LOG: "error_log",
    RUNTIME_STATUS: "runtime_status",
    DIAGNOSTIC_SNAPSHOT: "diagnostic_snapshot",
    DIAGNOSTIC_RUN_HISTORY: "diagnostic_run_history"
  };

  NewSiteCore.GatewayStorageKeys = {
    GATEWAY_STATUS: "gateway_status",
    GATEWAY_EVENTS: "gateway_events",
    GATEWAY_SELECTED_FILE: "gateway_selected_file"
  };

  NewSiteCore.DeepSeekStorageKeys = {
    DEEPSEEK_SITE_PROFILE: "deepseek_site_profile"
  };
})(globalThis);
