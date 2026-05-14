(function initAutomationController(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.AutomationTesterStore.state;
  const render = NewSiteSidepanel.AutomationTesterRender.render;
  const messaging = NewSiteSidepanel.ChromeMessaging;
  const Toast = NewSiteSidepanel.Toast;
  const MESSAGE_TYPES = globalScope.NewSiteCore.MESSAGE_TYPES;
  const siteConfig = globalScope.NewSiteAutomation.NEWSITE_CONFIG;

  let rootNode;

  async function refreshRuntimeStatus() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.RUNTIME_STATUS_GET });
    store.runtimeStatus = response.runtimeStatus;
    document.getElementById("extension-status").textContent = response.status;
    document.getElementById("active-tab-url").textContent = response.runtimeStatus.activeTabUrl || "Unknown";
    render(rootNode);
    bindEvents();
  }

  async function detectPageState() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.PAGE_STATE_DETECT });
    store.pageState = response;
    store.lastError = response.error || null;
    render(rootNode);
    bindEvents();
  }

  function collectAutomationInput() {
    const filePathInput = document.getElementById("automation-file-path");
    const promptInput = document.getElementById("automation-prompt-text");
    store.filePath = filePathInput ? filePathInput.value.trim() : "";
    store.promptText = promptInput ? promptInput.value.trim() : "";
    return {
      filePath: store.filePath,
      promptText: store.promptText
    };
  }

  async function runAutomation(dryRun) {
    const collected = collectAutomationInput();
    const response = await messaging.sendMessage({
      type: MESSAGE_TYPES.RUN_AUTOMATION,
      input: Object.assign({}, collected, { dryRun: dryRun })
    });
    store.workflowResult = response;
    store.lastError = response.error || null;
    render(rootNode);
    bindEvents();
    Toast.showToast(dryRun ? "Dry run executed." : "Automation executed.");
  }

  function bindEvents() {
    document.getElementById("open-target-site").onclick = function onOpen() {
      chrome.tabs.create({ url: siteConfig.baseUrl });
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
    render(rootNode);
    refreshRuntimeStatus();
  }

  NewSiteSidepanel.AutomationTesterController = {
    mount: mount,
    refreshRuntimeStatus: refreshRuntimeStatus
  };
})(globalThis);
