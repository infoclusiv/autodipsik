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

    const collected = collectAutomationInput();
    if (draftSession && typeof draftSession.flushSave === "function") {
      await draftSession.flushSave(collected.conditionalWorkflowText);
    }
    if (!collected.conditionalWorkflowText.trim()) {
      store.conditionalWorkflowParseError = "Conditional workflow JSON is required.";
      rerender();
      Toast.showToast("Conditional workflow JSON is required.");
      return;
    }

    let definition;
    try {
      definition = JSON.parse(collected.conditionalWorkflowText);
    } catch (error) {
      store.conditionalWorkflowParseError = error && error.message ? error.message : "Invalid JSON.";
      rerender();
      Toast.showToast("Conditional workflow JSON is invalid.");
      return;
    }

    store.conditionalWorkflowParseError = "";
    store.conditionalWorkflowResult = null;
    store.batchRunResult = null;
    const selectedFiles = Array.isArray(store.selectedFiles) ? store.selectedFiles : [];
    const shouldRunBatch = selectedFiles.length > 1;
    store.isRunningConditionalWorkflow = !shouldRunBatch;
    store.isRunningBatchConditionalWorkflow = shouldRunBatch;
    rerender();

    const response = shouldRunBatch
      ? await orchestrator.runConditionalWorkflowBatch({
        definition: definition,
        selectedFiles: selectedFiles
      })
      : await orchestrator.runConditionalWorkflow({
        definition: definition
      });

    store.isRunningConditionalWorkflow = false;
    store.isRunningBatchConditionalWorkflow = false;
    store.conditionalWorkflowResult = shouldRunBatch ? null : response;
    store.batchRunResult = shouldRunBatch ? response : null;
    store.lastRunSummary = response;
    store.lastError = response.error || null;
    if (adapters && typeof adapters.applyGatewayStatusSnapshotToStore === "function") {
      adapters.applyGatewayStatusSnapshotToStore(store, response);
    }
    rerender();
    Toast.showToast(
      shouldRunBatch
        ? (response.status === "completed"
          ? "Batch conditional workflow completed. " + String(response.completedCount || 0) + " of " + String(response.totalCount || 0) + " files processed."
          : response.error && response.error.message
          ? "Batch stopped on " + String(response.failedCount || 0) + " failure: " + response.error.message
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
