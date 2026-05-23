(function initAutomationController(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.AutomationTesterStore.state;
  const render = NewSiteSidepanel.AutomationTesterRender.render;
  const messaging = NewSiteSidepanel.ChromeMessaging;
  const Toast = NewSiteSidepanel.Toast;
  const orchestrator = NewSiteSidepanel.AutomationRunOrchestrator;
  const MESSAGE_TYPES = globalScope.NewSiteCore.MESSAGE_TYPES;
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

  function rerender() {
    render(rootNode);
    bindEvents();
  }

  function applyResponse(response) {
    if (response && response.gatewayStatus) {
      store.gatewayStatus = response.gatewayStatus;
      store.selectedFile = response.gatewayStatus.selectedFile || store.selectedFile || null;
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
    store.fileSelectionResult = response.file || null;
    store.lastError = null;
    rerender();
    Toast.showToast(store.selectedFile ? "Excel file selected." : "File selection cancelled.");
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
    const promptInput = document.getElementById("automation-prompt-text");
    const conditionalWorkflowInput = document.getElementById("conditional-workflow-json");
    store.promptText = promptInput ? promptInput.value.trim() : "";
    store.conditionalWorkflowText = conditionalWorkflowInput ? conditionalWorkflowInput.value : store.conditionalWorkflowText;

    const selectedFile = store.selectedFile
      || (store.gatewayStatus && store.gatewayStatus.selectedFile)
      || null;

    return {
      promptText: store.promptText,
      selectedFile: selectedFile,
      fileId: selectedFile ? selectedFile.fileId : "",
      fileName: selectedFile ? selectedFile.name : "",
      fileExtension: selectedFile ? selectedFile.extension : "",
      conditionalWorkflowText: store.conditionalWorkflowText
    };
  }

  async function runAutomation(dryRun) {
    const collected = collectAutomationInput();
    if (!collected.promptText) {
      Toast.showToast("Prompt text is required.");
      return;
    }
    if (!dryRun && !collected.fileId) {
      Toast.showToast("Select an Excel file before running automation.");
      return;
    }

    store.isRunningAutomation = true;
    const response = await messaging.sendMessage({
      type: MESSAGE_TYPES.RUN_AUTOMATION,
      input: Object.assign({}, collected, {
        dryRun: dryRun,
        useGatewaySelectedFile: true
      })
    });
    store.isRunningAutomation = false;
    store.workflowResult = response;
    store.lastRunSummary = response;
    store.lastError = response.error || null;
    if (response.gatewayStatus) {
      store.gatewayStatus = response.gatewayStatus;
      store.selectedFile = response.gatewayStatus.selectedFile || store.selectedFile;
    }
    rerender();
    Toast.showToast(dryRun ? "Dry run executed." : "Automation executed.");
  }

  async function runAutomationOneClick() {
    const collected = collectAutomationInput();
    if (!collected.promptText) {
      Toast.showToast("Prompt text is required.");
      return;
    }

    store.isRunningAutomation = true;
    const response = await orchestrator.runOneClick({
      promptText: collected.promptText
    });
    store.isRunningAutomation = false;
    store.workflowResult = response.automationResult || response;
    store.lastRunSummary = response;
    store.lastError = response.error || null;
    store.pageState = response.pageState || store.pageState;
    if (response.gatewayStatus) {
      store.gatewayStatus = response.gatewayStatus;
      store.selectedFile = response.gatewayStatus.selectedFile || store.selectedFile;
    }
    rerender();
    Toast.showToast(
      response.status === "completed"
        ? (response.responseJsonSave && response.responseJsonSave.fileName
          ? "DeepSeek response JSON saved: " + response.responseJsonSave.fileName
          : "Automation executed.")
        : (response.error && response.error.message ? response.error.message : "Automation failed.")
    );
  }

  function loadSampleConditionalWorkflow() {
    store.conditionalWorkflowText = JSON.stringify(SAMPLE_CONDITIONAL_WORKFLOW, null, 2);
    store.conditionalWorkflowParseError = "";
    rerender();
    Toast.showToast("Sample conditional workflow loaded.");
  }

  async function runConditionalWorkflow() {
    const collected = collectAutomationInput();
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
    store.isRunningConditionalWorkflow = true;
    rerender();

    const response = await orchestrator.runConditionalWorkflow({
      definition: definition
    });

    store.isRunningConditionalWorkflow = false;
    store.conditionalWorkflowResult = response;
    store.lastRunSummary = response;
    store.lastError = response.error || null;
    if (response.gatewayStatus) {
      store.gatewayStatus = response.gatewayStatus;
      store.selectedFile = response.gatewayStatus.selectedFile || store.selectedFile;
    }
    rerender();
    Toast.showToast(
      response.status === "completed"
        ? (response.workflowRunJsonSave && response.workflowRunJsonSave.fileName
          ? "Conditional workflow JSON saved: " + response.workflowRunJsonSave.fileName
          : "Conditional workflow executed.")
        : (response.error && response.error.message ? response.error.message : "Conditional workflow failed.")
    );
  }

  function bindEvents() {
    document.getElementById("automation-connect-gateway").onclick = connectGateway;
    document.getElementById("automation-disconnect-gateway").onclick = disconnectGateway;
    document.getElementById("automation-select-file").onclick = selectExcelFile;
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
    document.getElementById("run-dry-run").onclick = function onDryRun() {
      runAutomation(true);
    };
    document.getElementById("run-automation").onclick = function onRun() {
      runAutomationOneClick();
    };
    document.getElementById("load-sample-conditional-workflow").onclick = loadSampleConditionalWorkflow;
    document.getElementById("run-conditional-workflow").onclick = function onRunConditionalWorkflow() {
      runConditionalWorkflow();
    };
  }

  function mount(root) {
    rootNode = root;
    rerender();
    refreshRuntimeStatus().catch(function noop() {});
    refreshGatewayStatus().catch(function noop() {});
  }

  NewSiteSidepanel.AutomationTesterController = {
    mount: mount,
    refreshRuntimeStatus: refreshRuntimeStatus
  };
})(globalThis);
