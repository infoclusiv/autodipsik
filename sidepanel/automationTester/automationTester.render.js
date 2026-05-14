(function initAutomationRender(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.AutomationTesterStore.state;
  const json = NewSiteSidepanel.LogView.renderJson;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderStatusPill(gatewayStatus) {
    const state = gatewayStatus && gatewayStatus.state ? gatewayStatus.state : "disconnected";
    const className = state === "connected"
      ? "success"
      : state === "error"
        ? "error"
        : state === "reconnecting" || state === "connecting"
          ? "warn"
          : "neutral";
    return "<span class='status-pill " + className + "'>" + escapeHtml(state) + "</span>";
  }

  function formatDate(value) {
    if (!value) {
      return "Unknown";
    }
    try {
      return new Date(value).toLocaleString();
    } catch (error) {
      return String(value);
    }
  }

  function render(root) {
    const runtime = store.runtimeStatus || {};
    const pageState = store.pageState || {};
    const workflow = store.workflowResult || {};
    const gatewayStatus = store.gatewayStatus || {};
    const selectedFile = store.selectedFile || gatewayStatus.selectedFile || null;
    const latestPayload = {
      runtimeStatus: runtime,
      gatewayStatus: gatewayStatus,
      selectedFile: selectedFile,
      fileSelectionResult: store.fileSelectionResult,
      pageState: pageState,
      workflowResult: workflow,
      lastError: store.lastError
    };

    root.innerHTML = [
      "<div class='card'>",
      "<h2>Automation Tester</h2>",
      "<p class='field-help'>Use the local gateway to pick an Excel file, then run the DeepSeek workflow with the selectors managed from Site Profile.</p>",
      "<div class='inline-metrics'>",
      "<div class='metric-card'><span>Gateway</span><strong>" + renderStatusPill(gatewayStatus) + "</strong></div>",
      "<div class='metric-card'><span>Selected file</span><strong>" + escapeHtml(selectedFile ? selectedFile.name : "None") + "</strong></div>",
      "<div class='metric-card'><span>Page state</span><strong>" + escapeHtml(pageState.pageState ? pageState.pageState.state : "Unknown") + "</strong></div>",
      "<div class='metric-card'><span>Workflow</span><strong>" + escapeHtml(workflow.workflowId || "Idle") + "</strong></div>",
      "</div>",
      "<div class='button-row'>",
      "<button id='automation-connect-gateway'>Connect Gateway</button>",
      "<button id='automation-disconnect-gateway'>Disconnect Gateway</button>",
      "<button id='automation-select-file'>Select Excel File</button>",
      "<button id='open-target-site'>Open DeepSeek</button>",
      "<button id='detect-page-state'>Detect page state</button>",
      "<button id='run-dry-run'>Run dry run</button>",
      "<button class='primary' id='run-automation'>Run automation</button>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<h3>Prompt</h3>",
      "<label>Prompt text</label>",
      "<textarea id='automation-prompt-text' rows='4' placeholder='Describe what DeepSeek should do with the attached file'>" + escapeHtml(store.promptText || "") + "</textarea>",
      "</div>",
      "<div class='card'>",
      "<h3>Selected File</h3>",
      (selectedFile
        ? "<div class='metrics-grid'>"
          + "<div class='metric-card'><span>Name</span><strong>" + escapeHtml(selectedFile.name || "Unknown") + "</strong></div>"
          + "<div class='metric-card'><span>Extension</span><strong>" + escapeHtml(selectedFile.extension || "Unknown") + "</strong></div>"
          + "<div class='metric-card'><span>Size</span><strong>" + escapeHtml(String(selectedFile.sizeBytes || 0)) + " bytes</strong></div>"
          + "<div class='metric-card'><span>Last modified</span><strong>" + escapeHtml(formatDate(selectedFile.lastModified)) + "</strong></div>"
          + "</div>"
        : "<div class='muted'>No Excel file selected yet.</div>"),
      "</div>",
      "<div class='card'>",
      "<h3>Runtime Snapshot</h3>",
      "<div class='metrics-grid'>",
      "<div class='metric-card'><span>Current Site</span><strong>deepseek</strong></div>",
      "<div class='metric-card'><span>Current URL</span><strong>" + escapeHtml(runtime.activeTabUrl || "Unknown") + "</strong></div>",
      "<div class='metric-card'><span>Detected Page State</span><strong>" + escapeHtml(pageState.pageState ? pageState.pageState.state : "Unknown") + "</strong></div>",
      "<div class='metric-card'><span>Current Workflow</span><strong>" + escapeHtml(workflow.workflowId || "None") + "</strong></div>",
      "<div class='metric-card'><span>Current Step</span><strong>" + escapeHtml(workflow.failedStep || "Completed/Idle") + "</strong></div>",
      "<div class='metric-card'><span>Last Error</span><strong>" + escapeHtml(store.lastError ? store.lastError.message : "None") + "</strong></div>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<h3>Step Timeline</h3>",
      (workflow.timeline && workflow.timeline.length ? workflow.timeline.map(function mapStep(step) {
        return "<div class='timeline-item'><strong>" + escapeHtml(step.stepName) + "</strong><div>" + escapeHtml(step.status) + "</div></div>";
      }).join("") : "<div class='muted'>No workflow executed yet.</div>"),
      "</div>",
      "<div class='card'>",
      "<h3>Latest Payload</h3>",
      "<pre>" + json(latestPayload) + "</pre>",
      "</div>"
    ].join("");
  }

  NewSiteSidepanel.AutomationTesterRender = {
    render: render
  };
})(globalThis);
