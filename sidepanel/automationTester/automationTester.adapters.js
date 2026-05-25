(function initAutomationTesterAdapters(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

  function getSelectedFile(store) {
    if (!store || typeof store !== "object") {
      return null;
    }

    return store.selectedFile
      || (store.gatewayStatus && store.gatewayStatus.selectedFile)
      || null;
  }

  function applyGatewayStatusToStore(store, response) {
    const gatewayStatus = response && response.gatewayStatus ? response.gatewayStatus : null;

    store.gatewayStatus = gatewayStatus;
    store.selectedFile = gatewayStatus ? gatewayStatus.selectedFile || null : null;
    store.selectedFiles = gatewayStatus ? gatewayStatus.selectedFiles || [] : [];
  }

  function applyGatewayStatusSnapshotToStore(store, response) {
    if (!response || !response.gatewayStatus) {
      return;
    }

    store.gatewayStatus = response.gatewayStatus;
    store.selectedFile = response.gatewayStatus.selectedFile || store.selectedFile || null;
    store.selectedFiles = response.gatewayStatus.selectedFiles || store.selectedFiles || [];
  }

  function applyFileSelectionToStore(store, response) {
    const gatewayStatus = response && response.gatewayStatus ? response.gatewayStatus : null;

    store.gatewayStatus = gatewayStatus;
    store.selectedFile = response && response.file
      ? response.file
      : (gatewayStatus ? gatewayStatus.selectedFile || null : null);
    store.selectedFiles = gatewayStatus ? gatewayStatus.selectedFiles || [] : [];
    store.fileSelectionResult = response && response.file ? response.file : null;
  }

  function applyBatchSelectionToStore(store, response) {
    const gatewayStatus = response && response.gatewayStatus ? response.gatewayStatus : null;

    store.gatewayStatus = gatewayStatus;
    store.selectedFiles = response && Array.isArray(response.files)
      ? response.files
      : (gatewayStatus ? gatewayStatus.selectedFiles || [] : []);
    store.selectedFile = response && response.selectedFile
      ? response.selectedFile
      : (gatewayStatus ? gatewayStatus.selectedFile || null : null);
    store.batchSelectionResult = response || null;
  }

  function buildConditionalWorkflowInput(store) {
    const selectedFile = getSelectedFile(store);

    return {
      selectedFile: selectedFile,
      fileId: selectedFile ? selectedFile.fileId : "",
      fileName: selectedFile ? selectedFile.name : "",
      fileExtension: selectedFile ? selectedFile.extension : "",
      conditionalWorkflowText: store && typeof store.conditionalWorkflowText === "string"
        ? store.conditionalWorkflowText
        : ""
    };
  }

  NewSiteSidepanel.AutomationTesterAdapters = {
    applyGatewayStatusToStore: applyGatewayStatusToStore,
    applyGatewayStatusSnapshotToStore: applyGatewayStatusSnapshotToStore,
    applyFileSelectionToStore: applyFileSelectionToStore,
    applyBatchSelectionToStore: applyBatchSelectionToStore,
    buildConditionalWorkflowInput: buildConditionalWorkflowInput,
    getSelectedFile: getSelectedFile
  };
})(globalThis);
