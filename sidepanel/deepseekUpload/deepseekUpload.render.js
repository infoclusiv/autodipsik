(function initDeepSeekUploadRender(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.DeepSeekUploadStore.state;
  const json = NewSiteSidepanel.LogView.renderJson;

  function renderStatusPill(gatewayStatus) {
    const state = gatewayStatus && gatewayStatus.state ? gatewayStatus.state : "disconnected";
    const className = state === "connected"
      ? "success"
      : state === "error"
        ? "error"
        : state === "reconnecting"
          ? "warn"
          : "neutral";
    return "<span class='status-pill " + className + "'>" + state + "</span>";
  }

  function render(root) {
    const gatewayStatus = store.gatewayStatus || {};
    const selectedFile = gatewayStatus.selectedFile || null;
    const lastResult = store.lastResult || null;
    const lastError = store.lastError || gatewayStatus.lastError || null;

    root.innerHTML = [
      "<div class='card'>",
      "<h2>DeepSeek Upload</h2>",
      "<p class='muted'>Connect the local Python gateway, pick an Excel file on your PC, and inject it into the active DeepSeek tab.</p>",
      "<div class='inline-metrics'>",
      "<div class='metric-card'><span>Gateway</span><strong>" + renderStatusPill(gatewayStatus) + "</strong></div>",
      "<div class='metric-card'><span>Endpoint</span><strong>ws://127.0.0.1:8765</strong></div>",
      "<div class='metric-card'><span>Selected File</span><strong>" + (selectedFile ? selectedFile.name : "None") + "</strong></div>",
      "</div>",
      "<div class='button-row'>",
      "<button id='deepseek-connect'>Connect</button>",
      "<button id='deepseek-disconnect'>Disconnect</button>",
      "<button id='deepseek-open-site'>Open DeepSeek</button>",
      "<button id='deepseek-select-file'>Select Excel File</button>",
      "<button class='primary' id='deepseek-execute'>Execute</button>",
      "<button id='deepseek-export-diagnostics'>Export Diagnostics</button>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<h3>Selected File</h3>",
      selectedFile
        ? "<div class='metrics-grid'>"
          + "<div class='metric-card'><span>Name</span><strong>" + selectedFile.name + "</strong></div>"
          + "<div class='metric-card'><span>Extension</span><strong>" + selectedFile.extension + "</strong></div>"
          + "<div class='metric-card'><span>Size</span><strong>" + selectedFile.sizeBytes + " bytes</strong></div>"
          + "<div class='metric-card'><span>Last Modified</span><strong>" + (selectedFile.lastModified || "Unknown") + "</strong></div>"
          + "</div>"
        : "<div class='muted'>No file selected yet.</div>",
      "</div>",
      "<div class='card'>",
      "<h3>Latest Result</h3>",
      "<pre>" + json({
        gatewayStatus: gatewayStatus,
        selectedFile: selectedFile,
        lastResult: lastResult,
        lastError: lastError
      }) + "</pre>",
      "</div>"
    ].join("");
  }

  NewSiteSidepanel.DeepSeekUploadRender = {
    render: render
  };
})(globalThis);
