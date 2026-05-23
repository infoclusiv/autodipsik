(function initWorkflowLabRender(globalScope) {
  const WorkflowLab = globalScope.WorkflowLab = globalScope.WorkflowLab || {};
  const store = WorkflowLab.Store.state;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderJson(value) {
    return "<pre>" + escapeHtml(JSON.stringify(value, null, 2)) + "</pre>";
  }

  function render(root) {
    const gatewayStatus = store.gatewayStatus || {};
    const selectedFile = store.selectedFile || gatewayStatus.selectedFile || null;
    const result = store.conditionalWorkflowResult || {};
    const workflowRun = result.workflowRun || {};
    const error = store.lastError || result.error || null;

    root.innerHTML = [
      "<div class='card'>",
      "<h2>Conditional Workflow MVP</h2>",
      "<p class='field-help'>Use the same JSON workflow format as the sidepanel, but with a wider workspace for inspecting turns, variables, and saved output.</p>",
      "<div class='button-row'>",
      "<button id='workflow-lab-connect-gateway'>Connect Gateway</button>",
      "<button id='workflow-lab-select-file'>Select Excel File</button>",
      "<button id='workflow-lab-open-deepseek'>Open DeepSeek</button>",
      "<button id='workflow-lab-load-sample'>Load sample workflow</button>",
      "<button class='primary' id='workflow-lab-run'>Run conditional workflow</button>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<label>Workflow JSON</label>",
      "<textarea id='workflow-lab-json' rows='18' placeholder='Paste a conditional workflow definition here'>" + escapeHtml(store.conditionalWorkflowText || "") + "</textarea>",
      (store.conditionalWorkflowParseError
        ? "<p class='warning-text'>JSON parse error: " + escapeHtml(store.conditionalWorkflowParseError) + "</p>"
        : ""),
      "</div>",
      "<div class='card'>",
      "<h3>Run Summary</h3>",
      "<div class='metrics-grid'>",
      "<div class='metric-card'><span>Status</span><strong>" + escapeHtml(result.status || "Idle") + "</strong></div>",
      "<div class='metric-card'><span>Trace ID</span><strong>" + escapeHtml(result.traceId || "None") + "</strong></div>",
      "<div class='metric-card'><span>Workflow ID</span><strong>" + escapeHtml(result.workflowId || "None") + "</strong></div>",
      "<div class='metric-card'><span>Turn count</span><strong>" + escapeHtml(String((workflowRun.turns || []).length || 0)) + "</strong></div>",
      "<div class='metric-card'><span>Selected file</span><strong>" + escapeHtml(selectedFile ? selectedFile.name : "None") + "</strong></div>",
      "<div class='metric-card'><span>Saved JSON</span><strong>" + escapeHtml(result.workflowRunJsonSave && result.workflowRunJsonSave.fileName ? result.workflowRunJsonSave.fileName : "None") + "</strong></div>",
      "</div>",
      (error ? "<p class='warning-text'>Last error: " + escapeHtml(error.message || "Unknown error") + "</p>" : ""),
      "</div>",
      "<div class='card'>",
      "<h3>Execution Details</h3>",
      "<div class='stack-blocks'>",
      "<div><label>Visited nodes</label>" + renderJson(workflowRun.visitedNodeIds || []) + "</div>",
      "<div><label>Variables</label>" + renderJson(workflowRun.variables || {}) + "</div>",
      "<div><label>Turns</label>" + renderJson(workflowRun.turns || []) + "</div>",
      "<div><label>Decisions</label>" + renderJson(workflowRun.decisions || {}) + "</div>",
      "</div>",
      "</div>"
    ].join("");

    const gatewayStateNode = document.getElementById("workflow-lab-gateway-state");
    const selectedFileNode = document.getElementById("workflow-lab-selected-file");
    const statusNode = document.getElementById("workflow-lab-status");
    if (gatewayStateNode) {
      gatewayStateNode.textContent = gatewayStatus.state || "Unknown";
    }
    if (selectedFileNode) {
      selectedFileNode.textContent = selectedFile ? selectedFile.name : "None";
    }
    if (statusNode) {
      statusNode.textContent = result.status || "Idle";
    }
  }

  WorkflowLab.Render = {
    render: render
  };
})(globalThis);
