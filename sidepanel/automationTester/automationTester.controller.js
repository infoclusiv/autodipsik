(function initAutomationController(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const NewSiteCore = globalScope.NewSiteCore || {};
  const store = NewSiteSidepanel.AutomationTesterStore.state;
  const render = NewSiteSidepanel.AutomationTesterRender.render;
  const messaging = NewSiteSidepanel.ChromeMessaging;
  const Toast = NewSiteSidepanel.Toast;
  const adapters = NewSiteSidepanel.AutomationTesterAdapters;
  const orchestrator = NewSiteSidepanel.AutomationRunOrchestrator;
  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const workflowSamples = NewSiteCore.ConditionalWorkflowSamples;
  const draftSessionApi = NewSiteCore.ConditionalWorkflowDraftSession;
  const deepSeekConfig = globalScope.DeepSeekAutomation.DEEPSEEK_CONFIG;

  let rootNode;
  const draftSession = draftSessionApi && typeof draftSessionApi.create === "function"
    ? draftSessionApi.create({
      getText: function getDraftText() {
        return store.conditionalWorkflowText;
      },
      setText: function setDraftText(text) {
        store.conditionalWorkflowText = text;
      },
      onLoaded: function onDraftLoaded() {
        rerender();
      }
    })
    : null;

  function rerender() {
    render(rootNode);
    bindEvents();
  }

  function deriveFailedBatchFiles(response) {
    if (!response || !Array.isArray(response.results)) {
      return [];
    }

    return response.results.reduce(function collectFailedFiles(failedFiles, item) {
      if (!item || item.status !== "failed" || !item.selectedFile || !item.selectedFile.fileId) {
        return failedFiles;
      }

      failedFiles.push({
        fileId: item.selectedFile.fileId,
        name: item.selectedFile.name || "",
        extension: item.selectedFile.extension || "",
        index: typeof item.index === "number" ? item.index : failedFiles.length
      });
      return failedFiles;
    }, []);
  }

  async function parseConditionalWorkflowDefinition() {
    const collected = collectAutomationInput();
    if (draftSession && typeof draftSession.flushSave === "function") {
      await draftSession.flushSave(collected.conditionalWorkflowText);
    }
    if (!collected.conditionalWorkflowText.trim()) {
      store.conditionalWorkflowParseError = "Conditional workflow JSON is required.";
      rerender();
      Toast.showToast("Conditional workflow JSON is required.");
      return null;
    }

    try {
      const definition = JSON.parse(collected.conditionalWorkflowText);
      store.conditionalWorkflowParseError = "";
      return definition;
    } catch (error) {
      store.conditionalWorkflowParseError = error && error.message ? error.message : "Invalid JSON.";
      rerender();
      Toast.showToast("Conditional workflow JSON is invalid.");
      return null;
    }
  }

  function applyBatchRunResponse(response) {
    store.isRunningConditionalWorkflow = false;
    store.isRunningBatchConditionalWorkflow = false;
    store.conditionalWorkflowResult = null;
    store.batchRunResult = response;
    store.failedBatchFiles = deriveFailedBatchFiles(response);
    store.lastRunSummary = response;
    store.lastError = response.error || null;
    if (adapters && typeof adapters.applyGatewayStatusSnapshotToStore === "function") {
      adapters.applyGatewayStatusSnapshotToStore(store, response);
    }
    rerender();
  }

  function applyResponse(response) {
    if (adapters && typeof adapters.applyGatewayStatusSnapshotToStore === "function") {
      adapters.applyGatewayStatusSnapshotToStore(store, response);
    }

    if (response && response.status === "failed") {
      store.lastError = response.error || null;
      rerender();
      if (response.error && response.error.message) {
        Toast.showToast(response.error.message);
      }
      return false;
    }

    return true;
  }

  async function refreshRuntimeStatus() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.RUNTIME_STATUS_GET });
    store.runtimeStatus = response.runtimeStatus;
    document.getElementById("extension-status").textContent = response.status;
    document.getElementById("active-tab-url").textContent = response.runtimeStatus.activeTabUrl || "Unknown";
    document.getElementById("current-site").textContent = deepSeekConfig.isDeepSeekUrl(response.runtimeStatus.activeTabUrl || "")
      ? "deepseek"
      : "newsite";
    rerender();
  }

  async function refreshGatewayStatus() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_STATUS_GET });
    if (!applyResponse(response)) {
      return;
    }
    if (adapters && typeof adapters.applyGatewayStatusToStore === "function") {
      adapters.applyGatewayStatusToStore(store, response);
    }
    rerender();
  }

  async function connectGateway() {
    store.isConnectingGateway = true;
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_CONNECT });
    store.isConnectingGateway = false;
    if (!applyResponse(response)) {
      return;
    }
    if (adapters && typeof adapters.applyGatewayStatusToStore === "function") {
      adapters.applyGatewayStatusToStore(store, response);
    }
    store.lastError = null;
    rerender();
    Toast.showToast("Gateway connected.");
  }

  async function disconnectGateway() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_DISCONNECT });
    if (!applyResponse(response)) {
      return;
    }
    if (adapters && typeof adapters.applyGatewayStatusToStore === "function") {
      adapters.applyGatewayStatusToStore(store, response);
    }
    store.lastError = null;
    rerender();
  }

  async function selectExcelFile() {
    store.isSelectingFile = true;
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_SELECT_FILE });
    store.isSelectingFile = false;
    if (!applyResponse(response)) {
      return;
    }
    if (adapters && typeof adapters.applyFileSelectionToStore === "function") {
      adapters.applyFileSelectionToStore(store, response);
    }
    store.failedBatchFiles = [];
    store.failedBatchRetryCount = 0;
    store.lastError = null;
    rerender();
    Toast.showToast(store.selectedFile ? "Excel file selected." : "File selection cancelled.");
  }

  async function selectExcelFiles() {
    store.isSelectingFiles = true;
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_SELECT_FILES });
    store.isSelectingFiles = false;
    if (!applyResponse(response)) {
      return;
    }
    if (adapters && typeof adapters.applyBatchSelectionToStore === "function") {
      adapters.applyBatchSelectionToStore(store, response);
    }
    store.failedBatchFiles = [];
    store.failedBatchRetryCount = 0;
    store.lastError = null;
    rerender();
    Toast.showToast(store.selectedFiles.length ? String(store.selectedFiles.length) + " Excel files selected." : "File selection cancelled.");
  }

  async function detectPageState() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.PAGE_STATE_DETECT });
    store.pageState = response;
    store.lastError = response.error || null;
    rerender();
  }

  async function exportDiagnostics() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.EXPORT_DIAGNOSTICS, targetSiteId: "deepseek" });
    const diagnosticsPayload = JSON.stringify(response.diagnostics, null, 2);
    const diagnosticsBlob = new Blob([diagnosticsPayload], { type: "application/json" });
    const diagnosticsUrl = URL.createObjectURL(diagnosticsBlob);
    const markdownPayload = globalScope.NewSiteCore.DiagnosticExporter.createCausalReportMarkdown(response.diagnostics);
    const markdownBlob = new Blob([markdownPayload], { type: "text/markdown" });
    const markdownUrl = URL.createObjectURL(markdownBlob);
    const timestamp = Date.now();
    await chrome.downloads.download({
      url: markdownUrl,
      filename: "causal-report-" + timestamp + ".md",
      saveAs: true
    });
    await chrome.downloads.download({
      url: diagnosticsUrl,
      filename: "diagnostic-" + timestamp + ".json",
      saveAs: true
    });
    Toast.showToast("Causal report export started.");
  }

  function collectAutomationInput() {
    const conditionalWorkflowInput = document.getElementById("conditional-workflow-json");
    store.conditionalWorkflowText = conditionalWorkflowInput ? conditionalWorkflowInput.value : store.conditionalWorkflowText;
    return adapters && typeof adapters.buildConditionalWorkflowInput === "function"
      ? adapters.buildConditionalWorkflowInput(store)
      : {
        selectedFile: null,
        fileId: "",
        fileName: "",
        fileExtension: "",
        conditionalWorkflowText: store.conditionalWorkflowText
      };
  }

  function loadSampleConditionalWorkflow() {
    const sampleDefinition = workflowSamples && typeof workflowSamples.getSampleTipoFlow === "function"
      ? workflowSamples.getSampleTipoFlow()
      : null;
    store.conditionalWorkflowText = JSON.stringify(sampleDefinition || {}, null, 2);
    if (draftSession && typeof draftSession.markEdited === "function") {
      draftSession.markEdited();
    }
    store.conditionalWorkflowParseError = "";
    rerender();
    if (draftSession && typeof draftSession.flushSave === "function") {
      draftSession.flushSave(store.conditionalWorkflowText).catch(function noop() {});
    }
    Toast.showToast("Sample conditional workflow loaded.");
  }

  async function runConditionalWorkflow() {
    if (store.isRunningConditionalWorkflow || store.isRunningBatchConditionalWorkflow) {
      return;
    }

    const definition = await parseConditionalWorkflowDefinition();
    if (!definition) {
      return;
    }
    store.conditionalWorkflowResult = null;
    store.batchRunResult = null;
    const selectedFiles = Array.isArray(store.selectedFiles) ? store.selectedFiles : [];
    const shouldRunBatch = selectedFiles.length > 1;
    if (shouldRunBatch) {
      store.failedBatchFiles = [];
      store.failedBatchRetryCount = 0;
    }
    store.isRunningConditionalWorkflow = !shouldRunBatch;
    store.isRunningBatchConditionalWorkflow = shouldRunBatch;
    rerender();

    const response = shouldRunBatch
      ? await orchestrator.runConditionalWorkflowBatch({
        definition: definition,
        selectedFiles: selectedFiles,
        continueOnError: true,
        retryMode: "full_batch",
        retryCount: 0
      })
      : await orchestrator.runConditionalWorkflow({
        definition: definition
      });

    if (shouldRunBatch) {
      applyBatchRunResponse(response);
    } else {
      store.isRunningConditionalWorkflow = false;
      store.isRunningBatchConditionalWorkflow = false;
      store.conditionalWorkflowResult = response;
      store.batchRunResult = null;
      store.lastRunSummary = response;
      store.lastError = response.error || null;
      if (adapters && typeof adapters.applyGatewayStatusSnapshotToStore === "function") {
        adapters.applyGatewayStatusSnapshotToStore(store, response);
      }
      rerender();
    }
    Toast.showToast(
      shouldRunBatch
        ? (response.status === "completed"
          ? "Batch conditional workflow completed. " + String(response.completedCount || 0) + " of " + String(response.totalCount || 0) + " files processed."
          : (response.totalCount || 0) > 1 && (response.completedCount || 0) + (response.failedCount || 0) === (response.totalCount || 0)
          ? "Batch conditional workflow finished with " + String(response.failedCount || 0) + " failure" + ((response.failedCount || 0) === 1 ? "" : "s") + ". " + String(response.completedCount || 0) + " of " + String(response.totalCount || 0) + " files processed."
          : response.error && response.error.message
          ? "Batch conditional workflow failed: " + response.error.message
          : "Batch conditional workflow failed.")
        : (response.status === "completed"
          ? (response.workflowAhkFileSave && response.workflowAhkFileSave.fileName
            ? "Conditional workflow completed. AHK saved: " + response.workflowAhkFileSave.fileName
            : response.workflowRunJsonSave && response.workflowRunJsonSave.fileName
            ? "Conditional workflow JSON saved: " + response.workflowRunJsonSave.fileName
            : "Conditional workflow executed.")
          : (response.error && response.error.message ? response.error.message : "Conditional workflow failed."))
    );
  }

  async function retryFailedBatchFiles() {
    if (store.isRunningConditionalWorkflow || store.isRunningBatchConditionalWorkflow) {
      return;
    }

    const failedBatchFiles = Array.isArray(store.failedBatchFiles) ? store.failedBatchFiles : [];
    if (!failedBatchFiles.length) {
      Toast.showToast("No failed files are available to retry.");
      return;
    }

    const definition = await parseConditionalWorkflowDefinition();
    if (!definition) {
      return;
    }

    store.conditionalWorkflowResult = null;
    store.batchRunResult = null;
    store.failedBatchFiles = [];
    store.failedBatchRetryCount += 1;
    store.isRunningConditionalWorkflow = false;
    store.isRunningBatchConditionalWorkflow = true;
    rerender();

    try {
      const response = await orchestrator.runConditionalWorkflowBatch({
        definition: definition,
        selectedFiles: failedBatchFiles,
        continueOnError: true,
        retryMode: "failed_only",
        retryCount: store.failedBatchRetryCount
      });

      applyBatchRunResponse(response);
      Toast.showToast(
        response.status === "completed"
          ? "Retry completed. " + String(response.completedCount || 0) + " of " + String(response.totalCount || 0) + " failed files processed."
          : (response.totalCount || 0) > 0 && (response.completedCount || 0) + (response.failedCount || 0) === (response.totalCount || 0)
          ? "Retry finished with " + String(response.failedCount || 0) + " remaining failure" + ((response.failedCount || 0) === 1 ? "" : "s") + "."
          : response.error && response.error.message
          ? "Retry failed: " + response.error.message
          : "Retry failed."
      );
    } catch (error) {
      store.isRunningBatchConditionalWorkflow = false;
      store.lastError = error || null;
      rerender();
      Toast.showToast(error && error.message ? error.message : "Retry failed.");
    }
  }

  function bindEvents() {
    document.getElementById("automation-connect-gateway").onclick = connectGateway;
    document.getElementById("automation-disconnect-gateway").onclick = disconnectGateway;
    document.getElementById("automation-select-file").onclick = selectExcelFile;
    document.getElementById("automation-select-files").onclick = selectExcelFiles;
    document.getElementById("automation-export-causal-report").onclick = exportDiagnostics;
    document.getElementById("open-target-site").onclick = function onOpen() {
      chrome.tabs.create({ url: deepSeekConfig.baseUrl });
    };
    document.getElementById("open-workflow-lab").onclick = function onOpenWorkflowLab() {
      chrome.windows.create({
        url: chrome.runtime.getURL("workflowLab/workflowLab.html"),
        type: "popup",
        state: "maximized",
        focused: true
      });
    };
    document.getElementById("detect-page-state").onclick = detectPageState;
    document.getElementById("conditional-workflow-json").addEventListener("input", function onInput(event) {
      if (draftSession && typeof draftSession.markEdited === "function") {
        draftSession.markEdited();
      }
      store.conditionalWorkflowText = event.target.value;
      if (draftSession && typeof draftSession.scheduleSave === "function") {
        draftSession.scheduleSave(store.conditionalWorkflowText);
      }
    });
    document.getElementById("load-sample-conditional-workflow").onclick = loadSampleConditionalWorkflow;
    document.getElementById("run-conditional-workflow").onclick = function onRunConditionalWorkflow() {
      runConditionalWorkflow();
    };
    const retryFailedFilesButton = document.getElementById("automation-retry-failed-files");
    if (retryFailedFilesButton) {
      retryFailedFilesButton.onclick = function onRetryFailedFiles() {
        retryFailedBatchFiles();
      };
    }
  }

  function mount(root) {
    rootNode = root;
    rerender();
    if (draftSession && typeof draftSession.loadDraft === "function") {
      draftSession.loadDraft().catch(function noop() {});
    }
    refreshRuntimeStatus().catch(function noop() {});
    refreshGatewayStatus().catch(function noop() {});
  }

  NewSiteSidepanel.AutomationTesterController = {
    mount: mount,
    refreshRuntimeStatus: refreshRuntimeStatus
  };
})(globalThis);
