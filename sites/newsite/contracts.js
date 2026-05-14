(function initContracts(globalScope) {
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};

  NewSiteAutomation.SiteProfileContract = {
    requiredFields: ["siteId", "baseUrl", "urlPattern", "selectors", "timing", "behavior"],
    requiredSelectorsForMainWorkflow: [
      "fileInput",
      "chatInput",
      "sendButton"
    ],
    optionalSelectors: [
      "attachButton",
      "fileAttachedIndicator",
      "fileNameIndicator",
      "fileTypeIndicator",
      "sendButtonDisabledIndicator",
      "errorBanner",
      "progressIndicator",
      "generatingIndicator",
      "responseContainer",
      "latestAssistantMessage",
      "uploadButton",
      "downloadButton",
      "primaryActionButton",
      "secondaryActionButton",
      "confirmButton",
      "processButton",
      "resultReadyIndicator"
    ]
  };

  NewSiteAutomation.RunAutomationCommandContract = {
    type: "NEWSITE_RUN_AUTOMATION",
    requiredInputFields: ["traceId", "filePath", "promptText"],
    optionalInputFields: ["metadata", "dryRun", "expectedFileExtension", "waitForResponse", "conversationMode"],
    expectedResponse: {
      status: "completed|failed",
      traceId: "string",
      workflowId: "string",
      error: "object|null",
      diagnosticPackage: "object|null"
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
