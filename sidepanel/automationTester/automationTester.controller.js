(function initAutomationController(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.AutomationTesterStore.state;
  const render = NewSiteSidepanel.AutomationTesterRender.render;
  const messaging = NewSiteSidepanel.ChromeMessaging;
  const Toast = NewSiteSidepanel.Toast;
  const orchestrator = NewSiteSidepanel.AutomationRunOrchestrator;
  const MESSAGE_TYPES = globalScope.NewSiteCore.MESSAGE_TYPES;
  const draftStorage = globalScope.NewSiteCore && globalScope.NewSiteCore.ConditionalWorkflowDraftStorage;
  const deepSeekConfig = globalScope.DeepSeekAutomation.DEEPSEEK_CONFIG;
  const SAMPLE_CONDITIONAL_WORKFLOW = {
    flowVersion: 1,
    workflowId: "mvp_tipo_flow",
    startNodeId: "prompt_1",
    nodes: [
      {
        id: "prompt_1",
        type: "prompt",
        promptText: "Analyze the attached Excel briefly. At the end include exactly one marker: [[TIPO: tipo_1]] or [[TIPO: tipo_2]].",
        attachFile: true,
        waitForResponse: true,
        nextNodeId: "extract_tipo"
      },
      {
        id: "extract_tipo",
        type: "regex_extract",
        sourceNodeId: "prompt_1",
        patterns: [
          {
            name: "tipo",
            regex: "\\\\[\\\\[TIPO:\\\\s*(tipo_1|tipo_2)\\\\s*\\\\]\\\\]",
            groupIndex: 1,
            required: true
          }
        ],
        nextNodeId: "decision_tipo"
      },
      {
        id: "decision_tipo",
        type: "condition",
        variable: "tipo",
        branches: [
          { equals: "tipo_1", nextNodeId: "prompt_tipo_1" },
          { equals: "tipo_2", nextNodeId: "prompt_tipo_2" }
        ],
        fallbackNextNodeId: "end_no_match"
      },
      {
        id: "prompt_tipo_1",
        type: "prompt",
        promptText: "Continue with the tipo_1 follow-up and keep the answer brief.",
        attachFile: false,
        waitForResponse: true,
        nextNodeId: "end"
      },
      {
        id: "prompt_tipo_2",
        type: "prompt",
        promptText: "Continue with the tipo_2 follow-up and keep the answer brief.",
        attachFile: false,
        waitForResponse: true,
        nextNodeId: "end"
      },
      {
        id: "end_no_match",
        type: "end",
        reason: "No matching branch."
      },
      {
        id: "end",
        type: "end"
      }
    ]
  };

  let rootNode;
  let conditionalWorkflowDraftSaveTimer = null;
  let conditionalWorkflowDraftSessionVersion = 0;

  function rerender() {
    render(rootNode);
    bindEvents();
  }

  async function saveConditionalWorkflowDraft(text) {
    if (!draftStorage || typeof draftStorage.saveDraft !== "function") {
      return false;
    }

    try {
      return await draftStorage.saveDraft(text);
    } catch (error) {
      return false;
    }
  }

  function scheduleConditionalWorkflowDraftSave(text) {
    if (conditionalWorkflowDraftSaveTimer) {
      clearTimeout(conditionalWorkflowDraftSaveTimer);
    }

    conditionalWorkflowDraftSaveTimer = setTimeout(function persistDraft() {
      conditionalWorkflowDraftSaveTimer = null;
      saveConditionalWorkflowDraft(text).catch(function noop() {});
    }, 250);
  }

  async function flushConditionalWorkflowDraftSave(text) {
    if (conditionalWorkflowDraftSaveTimer) {
      clearTimeout(conditionalWorkflowDraftSaveTimer);
      conditionalWorkflowDraftSaveTimer = null;
    }
    return saveConditionalWorkflowDraft(text);
  }

  async function loadConditionalWorkflowDraft() {
    if (!draftStorage || typeof draftStorage.loadDraft !== "function") {
      return;
    }

    const loadVersion = conditionalWorkflowDraftSessionVersion;
    const loadedDraft = await draftStorage.loadDraft();

    if (conditionalWorkflowDraftSessionVersion !== loadVersion) {
      return;
    }

    if (typeof loadedDraft !== "string" || loadedDraft === store.conditionalWorkflowText) {
      return;
    }

    store.conditionalWorkflowText = loadedDraft;
    rerender();
  }

  function applyResponse(response) {
    if (response && response.gatewayStatus) {
      store.gatewayStatus = response.gatewayStatus;
      store.selectedFile = response.gatewayStatus.selectedFile || store.selectedFile || null;
      store.selectedFiles = response.gatewayStatus.selectedFiles || store.selectedFiles || [];
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
    store.gatewayStatus = response.gatewayStatus || null;
    store.selectedFile = store.gatewayStatus ? store.gatewayStatus.selectedFile || null : null;
    store.selectedFiles = store.gatewayStatus ? store.gatewayStatus.selectedFiles || [] : [];
    rerender();
  }

  async function connectGateway() {
    store.isConnectingGateway = true;
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_CONNECT });
    store.isConnectingGateway = false;
    if (!applyResponse(response)) {
      return;
    }
    store.gatewayStatus = response.gatewayStatus || null;
    store.selectedFile = store.gatewayStatus ? store.gatewayStatus.selectedFile || null : null;
    store.selectedFiles = store.gatewayStatus ? store.gatewayStatus.selectedFiles || [] : [];
    store.lastError = null;
    rerender();
    Toast.showToast("Gateway connected.");
  }

  async function disconnectGateway() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_DISCONNECT });
    if (!applyResponse(response)) {
      return;
    }
    store.gatewayStatus = response.gatewayStatus || null;
    store.selectedFile = null;
    store.selectedFiles = [];
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
    store.gatewayStatus = response.gatewayStatus || null;
    store.selectedFile = response.file || (store.gatewayStatus ? store.gatewayStatus.selectedFile : null);
    store.selectedFiles = store.gatewayStatus ? store.gatewayStatus.selectedFiles || [] : [];
    store.fileSelectionResult = response.file || null;
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
    store.gatewayStatus = response.gatewayStatus || null;
    store.selectedFiles = response.files || (store.gatewayStatus ? store.gatewayStatus.selectedFiles || [] : []);
    store.selectedFile = response.selectedFile || (store.gatewayStatus ? store.gatewayStatus.selectedFile : null);
    store.batchSelectionResult = response;
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

    const selectedFile = store.selectedFile
      || (store.gatewayStatus && store.gatewayStatus.selectedFile)
      || null;

    return {
      selectedFile: selectedFile,
      fileId: selectedFile ? selectedFile.fileId : "",
      fileName: selectedFile ? selectedFile.name : "",
      fileExtension: selectedFile ? selectedFile.extension : "",
      conditionalWorkflowText: store.conditionalWorkflowText
    };
  }

  function loadSampleConditionalWorkflow() {
    store.conditionalWorkflowText = JSON.stringify(SAMPLE_CONDITIONAL_WORKFLOW, null, 2);
    conditionalWorkflowDraftSessionVersion += 1;
    store.conditionalWorkflowParseError = "";
    rerender();
    flushConditionalWorkflowDraftSave(store.conditionalWorkflowText).catch(function noop() {});
    Toast.showToast("Sample conditional workflow loaded.");
  }

  async function runConditionalWorkflow() {
    if (store.isRunningConditionalWorkflow || store.isRunningBatchConditionalWorkflow) {
      return;
    }

    const collected = collectAutomationInput();
    await flushConditionalWorkflowDraftSave(collected.conditionalWorkflowText);
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
    if (response.gatewayStatus) {
      store.gatewayStatus = response.gatewayStatus;
      store.selectedFile = response.gatewayStatus.selectedFile || store.selectedFile;
      store.selectedFiles = response.gatewayStatus.selectedFiles || store.selectedFiles || [];
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
      conditionalWorkflowDraftSessionVersion += 1;
      store.conditionalWorkflowText = event.target.value;
      scheduleConditionalWorkflowDraftSave(store.conditionalWorkflowText);
    });
    document.getElementById("load-sample-conditional-workflow").onclick = loadSampleConditionalWorkflow;
    document.getElementById("run-conditional-workflow").onclick = function onRunConditionalWorkflow() {
      runConditionalWorkflow();
    };
  }

  function mount(root) {
    rootNode = root;
    rerender();
    loadConditionalWorkflowDraft().catch(function noop() {});
    refreshRuntimeStatus().catch(function noop() {});
    refreshGatewayStatus().catch(function noop() {});
  }

  NewSiteSidepanel.AutomationTesterController = {
    mount: mount,
    refreshRuntimeStatus: refreshRuntimeStatus
  };
})(globalThis);
