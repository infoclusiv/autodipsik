(function initDeepSeekUploadController(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.DeepSeekUploadStore.state;
  const render = NewSiteSidepanel.DeepSeekUploadRender.render;
  const messaging = NewSiteSidepanel.ChromeMessaging;
  const Toast = NewSiteSidepanel.Toast;
  const MESSAGE_TYPES = globalScope.NewSiteCore.MESSAGE_TYPES;
  const deepSeekConfig = globalScope.DeepSeekAutomation.DEEPSEEK_CONFIG;

  let rootNode;

  function applyResponse(response) {
    if (response.status === "failed") {
      store.lastError = response.error || null;
      if (response.gatewayStatus) {
        store.gatewayStatus = response.gatewayStatus;
      }
      render(rootNode);
      bindEvents();
      if (response.error && response.error.message) {
        Toast.showToast(response.error.message);
      }
      return false;
    }
    return true;
  }

  async function refreshStatus() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_STATUS_GET });
    if (!applyResponse(response)) {
      return;
    }
    store.gatewayStatus = response.gatewayStatus || null;
    document.getElementById("extension-status").textContent = response.status;
    render(rootNode);
    bindEvents();
  }

  async function connectGateway() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_CONNECT });
    if (!applyResponse(response)) {
      return;
    }
    store.gatewayStatus = response.gatewayStatus || null;
    store.lastError = null;
    render(rootNode);
    bindEvents();
    Toast.showToast("Gateway connection requested.");
  }

  async function disconnectGateway() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_DISCONNECT });
    if (!applyResponse(response)) {
      return;
    }
    store.gatewayStatus = response.gatewayStatus || null;
    render(rootNode);
    bindEvents();
  }

  async function selectFile() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_SELECT_FILE });
    if (!applyResponse(response)) {
      return;
    }
    store.gatewayStatus = response.gatewayStatus || null;
    store.lastResult = response.file || null;
    store.lastError = response.error || null;
    render(rootNode);
    bindEvents();
    Toast.showToast(response.file ? "Excel file selected." : "File selection cancelled.");
  }

  async function executeUpload() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_EXECUTE_UPLOAD });
    if (!applyResponse(response)) {
      return;
    }
    store.gatewayStatus = response.gatewayStatus || null;
    store.lastResult = response.attachResult || response;
    store.lastError = response.error || null;
    render(rootNode);
    bindEvents();
    Toast.showToast(response.attachResult && response.attachResult.status === "completed"
      ? "File attached to DeepSeek."
      : "DeepSeek upload requested.");
  }

  async function exportDiagnostics() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.GATEWAY_EXPORT_DIAGNOSTICS });
    if (!applyResponse(response)) {
      return;
    }
    const payload = JSON.stringify(response.diagnostics, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url: url,
      filename: "autodipsik-deepseek-diagnostics-" + Date.now() + ".json",
      saveAs: true
    });
    Toast.showToast("DeepSeek diagnostics export started.");
  }

  function bindEvents() {
    document.getElementById("deepseek-connect").onclick = connectGateway;
    document.getElementById("deepseek-disconnect").onclick = disconnectGateway;
    document.getElementById("deepseek-open-site").onclick = function onOpen() {
      chrome.tabs.create({ url: deepSeekConfig.baseUrl });
    };
    document.getElementById("deepseek-select-file").onclick = selectFile;
    document.getElementById("deepseek-execute").onclick = executeUpload;
    document.getElementById("deepseek-export-diagnostics").onclick = exportDiagnostics;
  }

  function mount(root) {
    rootNode = root;
    render(rootNode);
    refreshStatus().catch(function noop() {});
  }

  NewSiteSidepanel.DeepSeekUploadController = {
    mount: mount,
    refreshStatus: refreshStatus
  };
})(globalThis);
