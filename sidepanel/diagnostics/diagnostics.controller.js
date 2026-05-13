(function initDiagnosticsController(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.DiagnosticsStore.state;
  const render = NewSiteSidepanel.DiagnosticsRender.render;
  const messaging = NewSiteSidepanel.ChromeMessaging;
  const Toast = NewSiteSidepanel.Toast;
  const MESSAGE_TYPES = globalScope.NewSiteCore.MESSAGE_TYPES;

  let rootNode;

  async function refresh() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.EXPORT_DIAGNOSTICS });
    store.diagnostics = response.diagnostics;
    render(rootNode);
    bindEvents();
  }

  async function exportJson() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.EXPORT_DIAGNOSTICS });
    const payload = JSON.stringify(response.diagnostics, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url: url,
      filename: "newsite-diagnostics-" + Date.now() + ".json",
      saveAs: true
    });
    Toast.showToast("Diagnostic export started.");
  }

  async function copySummary() {
    if (!store.diagnostics) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(store.diagnostics.aiDebugSummary, null, 2));
    Toast.showToast("AI debug summary copied.");
  }

  function bindEvents() {
    document.getElementById("diag-refresh").onclick = refresh;
    document.getElementById("diag-export").onclick = exportJson;
    document.getElementById("diag-copy-summary").onclick = copySummary;
    document.getElementById("diag-level-filter").onchange = function onChange(event) {
      store.levelFilter = event.target.value;
      render(rootNode);
      bindEvents();
    };
    document.getElementById("diag-trace-filter").oninput = function onInput(event) {
      store.traceFilter = event.target.value.trim();
      render(rootNode);
      bindEvents();
    };
  }

  function mount(root) {
    rootNode = root;
    render(rootNode);
    refresh();
  }

  NewSiteSidepanel.DiagnosticsController = {
    mount: mount,
    refresh: refresh
  };
})(globalThis);
