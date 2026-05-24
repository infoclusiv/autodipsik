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

  function renderCompactJson(value) {
    return "<pre>" + escapeHtml(JSON.stringify(value, null, 2)) + "</pre>";
  }

  function render(root) {
    const runtime = store.runtimeStatus || {};
    const pageState = store.pageState || {};
    const gatewayStatus = store.gatewayStatus || {};
    const selectedFile = store.selectedFile || gatewayStatus.selectedFile || null;
    const lastRunSummary = store.lastRunSummary || {};
    const conditionalWorkflowResult = store.conditionalWorkflowResult || {};
    const conditionalWorkflowRun = conditionalWorkflowResult.workflowRun || {};
    const conditionalWorkflowVariables = conditionalWorkflowRun.variables || {};
    const conditionalWorkflowVisited = conditionalWorkflowRun.visitedNodeIds || [];
    const workflowRunJsonSave = conditionalWorkflowResult.workflowRunJsonSave || null;
    const workflowAhkFileSave = conditionalWorkflowResult.workflowAhkFileSave || null;
    const error = store.lastError || lastRunSummary.error || null;

    root.innerHTML = [
      "<div class='card'>",
      "<h2>Automation Tester</h2>",
      "<p class='field-help'>Run conditional DeepSeek workflows from saved JSON drafts. The extension will connect the gateway, ensure the DeepSeek tab is ready, and execute the workflow definition you provide.</p>",
      "<div class='inline-metrics'>",
      "<div class='metric-card'><span>Gateway</span><strong>" + renderStatusPill(gatewayStatus) + "</strong></div>",
      "<div class='metric-card'><span>Selected file</span><strong>" + escapeHtml(selectedFile ? selectedFile.name : "None") + "</strong></div>",
      "<div class='metric-card'><span>Page state</span><strong>" + escapeHtml(pageState.pageState ? pageState.pageState.state : "Unknown") + "</strong></div>",
      "<div class='metric-card'><span>Workflow</span><strong>" + escapeHtml(conditionalWorkflowResult.workflowId || "Idle") + "</strong></div>",
      "</div>",
      "<div class='button-row'>",
      "<button id='automation-select-file'>Select Excel File</button>",
      "<button id='open-workflow-lab'>Open Workflow Lab</button>",
      "<button id='automation-export-causal-report'>Export Causal Report</button>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<h3>Conditional Workflow MVP</h3>",
      "<p class='field-help'>Paste or load a JSON workflow definition, then run the conditional DeepSeek flow without building a visual canvas yet.</p>",
      "<div class='button-row'>",
      "<button id='load-sample-conditional-workflow'>Load sample workflow</button>",
      "<button class='primary' id='run-conditional-workflow'>Run conditional workflow</button>",
      "</div>",
      "<label>Workflow JSON</label>",
      "<textarea id='conditional-workflow-json' rows='14' placeholder='Paste a conditional workflow JSON definition here'>" + escapeHtml(store.conditionalWorkflowText || "") + "</textarea>",
      (store.conditionalWorkflowParseError
        ? "<p class='warning-text'>JSON parse error: " + escapeHtml(store.conditionalWorkflowParseError) + "</p>"
        : ""),
      "<div class='metrics-grid'>",
      "<div class='metric-card'><span>Conditional status</span><strong>" + escapeHtml(conditionalWorkflowResult.status || "Idle") + "</strong></div>",
      "<div class='metric-card'><span>Trace ID</span><strong>" + escapeHtml(conditionalWorkflowResult.traceId || "None") + "</strong></div>",
      "<div class='metric-card'><span>Workflow ID</span><strong>" + escapeHtml(conditionalWorkflowResult.workflowId || "None") + "</strong></div>",
      "<div class='metric-card'><span>Turn count</span><strong>" + escapeHtml(String((conditionalWorkflowRun.turns || []).length || 0)) + "</strong></div>",
      "</div>",
      (workflowRunJsonSave
        ? "<p class='field-help'>Workflow run JSON saved: " + escapeHtml(workflowRunJsonSave.fileName || "Unknown") + "</p>"
        : ""),
      (workflowAhkFileSave
        ? "<p class='field-help'>AutoHotkey file saved: " + escapeHtml(workflowAhkFileSave.fileName || "Unknown") + "</p>"
        : ""),
      (conditionalWorkflowResult.status
        ? "<div class='stack-blocks'>"
          + "<div><label>Visited nodes</label>" + renderCompactJson(conditionalWorkflowVisited) + "</div>"
          + "<div><label>Variables</label>" + renderCompactJson(conditionalWorkflowVariables) + "</div>"
          + "<div><label>Decisions</label>" + renderCompactJson(conditionalWorkflowRun.decisions || {}) + "</div>"
          + "</div>"
        : ""),
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
      (workflowRunJsonSave
        ? "<p class='field-help'>Workflow run JSON saved: " + escapeHtml(workflowRunJsonSave.fileName || "Unknown") + "</p>"
        : ""),
      (workflowAhkFileSave
        ? "<p class='field-help'>AutoHotkey file saved: " + escapeHtml(workflowAhkFileSave.fileName || "Unknown") + "</p>"
        : ""),
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
      "<h3>Execution Timeline</h3>",
      ((conditionalWorkflowRun.turns || []).length ? (conditionalWorkflowRun.turns || []).map(function mapTurn(turn, index) {
        return "<div class='timeline-item'><strong>Turn " + escapeHtml(String(index + 1)) + "</strong><div>" + escapeHtml(turn.promptNodeId || turn.nodeId || turn.turnId || "Unknown") + "</div></div>";
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
      "</div>",
      "</div>"
    ].join("");
  }

  NewSiteSidepanel.AutomationTesterRender = {
    render: render
  };
})(globalThis);
