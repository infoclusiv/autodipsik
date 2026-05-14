(function initAutomationRender(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.AutomationTesterStore.state;

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
    const lastRunSummary = store.lastRunSummary || workflow || {};
    const error = store.lastError || lastRunSummary.error || null;

    root.innerHTML = [
      "<div class='card'>",
      "<h2>Automation Tester</h2>",
      "<p class='field-help'>Run the DeepSeek workflow end to end from one button. The extension will connect the gateway, ensure the DeepSeek tab is ready, run preflight, and then execute the upload.</p>",
      "<div class='inline-metrics'>",
      "<div class='metric-card'><span>Gateway</span><strong>" + renderStatusPill(gatewayStatus) + "</strong></div>",
      "<div class='metric-card'><span>Selected file</span><strong>" + escapeHtml(selectedFile ? selectedFile.name : "None") + "</strong></div>",
      "<div class='metric-card'><span>Page state</span><strong>" + escapeHtml(pageState.pageState ? pageState.pageState.state : "Unknown") + "</strong></div>",
      "<div class='metric-card'><span>Workflow</span><strong>" + escapeHtml(workflow.workflowId || "Idle") + "</strong></div>",
      "</div>",
      "<div class='button-row'>",
      "<button id='automation-select-file'>Select Excel File</button>",
      "<button class='primary' id='run-automation'>Run automation</button>",
      "<button id='automation-export-diagnostics'>Export diagnostic</button>",
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
      "<h3>Last Run Summary</h3>",
      "<div class='metrics-grid'>",
      "<div class='metric-card'><span>Status</span><strong>" + escapeHtml(lastRunSummary.status || "Idle") + "</strong></div>",
      "<div class='metric-card'><span>Failed stage</span><strong>" + escapeHtml(lastRunSummary.failedStage || "None") + "</strong></div>",
      "<div class='metric-card'><span>Failed step</span><strong>" + escapeHtml(lastRunSummary.failedStep || "None") + "</strong></div>",
      "<div class='metric-card'><span>Trace ID</span><strong>" + escapeHtml(lastRunSummary.traceId || "None") + "</strong></div>",
      "<div class='metric-card'><span>Workflow ID</span><strong>" + escapeHtml(lastRunSummary.workflowId || "None") + "</strong></div>",
      "<div class='metric-card'><span>Last error</span><strong>" + escapeHtml(error ? error.message : "None") + "</strong></div>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<h3>Runtime Snapshot</h3>",
      "<div class='metrics-grid'>",
      "<div class='metric-card'><span>Current Site</span><strong>deepseek</strong></div>",
      "<div class='metric-card'><span>Current URL</span><strong>" + escapeHtml(runtime.activeTabUrl || "Unknown") + "</strong></div>",
      "<div class='metric-card'><span>Detected Page State</span><strong>" + escapeHtml(pageState.pageState ? pageState.pageState.state : "Unknown") + "</strong></div>",
      "<div class='metric-card'><span>Gateway state</span><strong>" + escapeHtml(gatewayStatus.state || "Unknown") + "</strong></div>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<h3>Step Timeline</h3>",
      (workflow.timeline && workflow.timeline.length ? workflow.timeline.map(function mapStep(step) {
        return "<div class='timeline-item'><strong>" + escapeHtml(step.stepName) + "</strong><div>" + escapeHtml(step.status) + "</div></div>";
      }).join("") : "<div class='muted'>No workflow executed yet.</div>"),
      "</div>",
      "<div class='card'>",
      "<h3>Advanced Actions</h3>",
      "<p class='field-help'>These controls remain available for diagnostics, but they are not required for the normal workflow.</p>",
      "<div class='button-row'>",
      "<button id='automation-connect-gateway'>Connect Gateway</button>",
      "<button id='automation-disconnect-gateway'>Disconnect Gateway</button>",
      "<button id='open-target-site'>Open DeepSeek</button>",
      "<button id='detect-page-state'>Detect page state</button>",
      "<button id='run-dry-run'>Run dry run</button>",
      "</div>",
      "</div>"
    ].join("");
  }

  NewSiteSidepanel.AutomationTesterRender = {
    render: render
  };
})(globalThis);
