(function initContracts(globalScope) {
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};

  NewSiteAutomation.SiteProfileContract = {
    requiredFields: ["siteId", "baseUrl", "urlPattern", "selectors", "timing"],
    requiredSelectorsForMainWorkflow: [
      "processButton",
      "resultReadyIndicator"
    ],
    optionalSelectors: [
      "fileInput",
      "uploadButton",
      "downloadButton",
      "errorBanner",
      "primaryActionButton",
      "secondaryActionButton",
      "confirmButton",
      "progressIndicator"
    ]
  };

  NewSiteAutomation.RunAutomationCommandContract = {
    type: "NEWSITE_RUN_AUTOMATION",
    requiredInputFields: ["traceId"],
    optionalInputFields: ["filePath", "metadata", "dryRun"],
    expectedResponse: {
      status: "completed|failed",
      traceId: "string",
      workflowId: "string",
      error: "object|null"
    }
  };

  NewSiteAutomation.TelemetryEventContract = {
    requiredFields: [
      "eventName",
      "timestamp",
      "traceId",
      "siteId",
      "component",
      "level",
      "message"
    ]
  };
})(globalThis);
