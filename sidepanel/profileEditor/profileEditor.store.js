(function initProfileEditorStore(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

  const state = {
    profile: null,
    validationErrors: [],
    selectorResults: {}
  };

  const selectorGroups = [
    {
      title: "File Attachment",
      keys: ["fileInput", "attachButton", "fileAttachedIndicator", "fileNameIndicator", "fileTypeIndicator"]
    },
    {
      title: "Chat Input",
      keys: ["chatInput", "chatInputFallback"]
    },
    {
      title: "Send",
      keys: ["sendButton", "sendButtonDisabledIndicator"]
    },
    {
      title: "Response / State",
      keys: ["generatingIndicator", "responseContainer", "latestAssistantMessage", "progressIndicator", "resultReadyIndicator", "errorBanner"]
    },
    {
      title: "Legacy / Compatibility",
      keys: ["primaryActionButton", "secondaryActionButton", "uploadButton", "processButton", "confirmButton", "downloadButton"]
    }
  ];

  NewSiteSidepanel.ProfileEditorStore = {
    state: state,
    selectorGroups: selectorGroups
  };
})(globalThis);
