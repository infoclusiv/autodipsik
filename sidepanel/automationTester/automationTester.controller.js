(function initAutomationController(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.AutomationTesterStore.state;
  const render = NewSiteSidepanel.AutomationTesterRender.render;
  const messaging = NewSiteSidepanel.ChromeMessaging;
  const Toast = NewSiteSidepanel.Toast;
  const MESSAGE_TYPES = globalScope.NewSiteCore.MESSAGE_TYPES;
  const deepSeekConfig = globalScope.DeepSeekAutomation.DEEPSEEK_CONFIG;

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

  function collectAutomationInput() {
    const promptInput = document.getElementById("automation-prompt-text");
    store.promptText = promptInput ? promptInput.value.trim() : "";

    const selectedFile = store.selectedFile
      || (store.gatewayStatus && store.gatewayStatus.selectedFile)
      || null;

    return {
      promptText: store.promptText,
      selectedFile: selectedFile,
      fileId: selectedFile ? selectedFile.fileId : "",
      fileName: selectedFile ? selectedFile.name : "",
      fileExtension: selectedFile ? selectedFile.extension : ""
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
    store.lastError = response.error || null;
    if (response.gatewayStatus) {
      store.gatewayStatus = response.gatewayStatus;
      store.selectedFile = response.gatewayStatus.selectedFile || store.selectedFile;
    }
    rerender();
    Toast.showToast(dryRun ? "Dry run executed." : "Automation executed.");
  }

  function bindEvents() {
    document.getElementById("automation-connect-gateway").onclick = connectGateway;
    document.getElementById("automation-disconnect-gateway").onclick = disconnectGateway;
    document.getElementById("automation-select-file").onclick = selectExcelFile;
    document.getElementById("open-target-site").onclick = function onOpen() {
      chrome.tabs.create({ url: deepSeekConfig.baseUrl });
    };
    document.getElementById("detect-page-state").onclick = detectPageState;
    document.getElementById("run-dry-run").onclick = function onDryRun() {
      runAutomation(true);
    };
    document.getElementById("run-automation").onclick = function onRun() {
      runAutomation(false);
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
