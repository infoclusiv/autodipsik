(function initAutomationTesterSections(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

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

  function renderHeaderCard(viewModel) {
    return [
      "<div class='card'>",
      "<h2>Automation Tester</h2>",
      "<p class='field-help'>Run conditional DeepSeek workflows from saved JSON drafts. The extension will connect the gateway, ensure the DeepSeek tab is ready, and execute the workflow definition you provide.</p>",
      "<div class='inline-metrics'>",
      "<div class='metric-card'><span>Gateway</span><strong>" + renderStatusPill(viewModel.gatewayStatus) + "</strong></div>",
      "<div class='metric-card'><span>Selected file</span><strong>" + escapeHtml(viewModel.selectedFile ? viewModel.selectedFile.name : "None") + "</strong></div>",
      "<div class='metric-card'><span>Page state</span><strong>" + escapeHtml(viewModel.pageState.pageState ? viewModel.pageState.pageState.state : "Unknown") + "</strong></div>",
      "<div class='metric-card'><span>Workflow</span><strong>" + escapeHtml(viewModel.conditionalWorkflowResult.workflowId || "Idle") + "</strong></div>",
      "</div>",
      "<div class='button-row'>",
      "<button id='automation-select-file'>Select Excel File</button>",
      "<button id='automation-select-files'>Select Multiple Excel Files</button>",
      "<button id='open-workflow-lab'>Open Workflow Lab</button>",
      "<button id='automation-export-causal-report'>Export Causal Report</button>",
      "</div>",
      "</div>"
    ].join("");
  }

  function renderConditionalWorkflowCard(viewModel) {
    return [
      "<div class='card'>",
      "<h3>Conditional Workflow MVP</h3>",
      "<p class='field-help'>Paste or load a JSON workflow definition, then run the conditional DeepSeek flow without building a visual canvas yet.</p>",
      "<div class='button-row'>",
      "<button id='load-sample-conditional-workflow'>Load sample workflow</button>",
      "<button class='primary' id='run-conditional-workflow'>"
        + escapeHtml(viewModel.store.isRunningBatchConditionalWorkflow ? "Running batch workflow..." : viewModel.store.isRunningConditionalWorkflow ? "Running conditional workflow..." : "Run conditional workflow")
        + "</button>",
      "</div>",
      "<label>Workflow JSON</label>",
      "<textarea id='conditional-workflow-json' rows='14' placeholder='Paste a conditional workflow JSON definition here'>" + escapeHtml(viewModel.store.conditionalWorkflowText || "") + "</textarea>",
      (viewModel.store.conditionalWorkflowParseError
        ? "<p class='warning-text'>JSON parse error: " + escapeHtml(viewModel.store.conditionalWorkflowParseError) + "</p>"
        : ""),
      "<div class='metrics-grid'>",
      "<div class='metric-card'><span>Conditional status</span><strong>" + escapeHtml(viewModel.conditionalWorkflowResult.status || "Idle") + "</strong></div>",
      "<div class='metric-card'><span>Trace ID</span><strong>" + escapeHtml(viewModel.conditionalWorkflowResult.traceId || "None") + "</strong></div>",
      "<div class='metric-card'><span>Workflow ID</span><strong>" + escapeHtml(viewModel.conditionalWorkflowResult.workflowId || "None") + "</strong></div>",
      "<div class='metric-card'><span>Turn count</span><strong>" + escapeHtml(String((viewModel.conditionalWorkflowRun.turns || []).length || 0)) + "</strong></div>",
      "</div>",
      (viewModel.workflowRunJsonSave
        ? "<p class='field-help'>Workflow run JSON saved: " + escapeHtml(viewModel.workflowRunJsonSave.fileName || "Unknown") + "</p>"
        : ""),
      (viewModel.workflowAhkFileSave
        ? "<p class='field-help'>AutoHotkey file saved: " + escapeHtml(viewModel.workflowAhkFileSave.fileName || "Unknown") + "</p>"
        : ""),
      (viewModel.conditionalWorkflowResult.status
        ? "<div class='stack-blocks'>"
          + "<div><label>Visited nodes</label>" + renderCompactJson(viewModel.conditionalWorkflowVisited) + "</div>"
          + "<div><label>Variables</label>" + renderCompactJson(viewModel.conditionalWorkflowVariables) + "</div>"
          + "<div><label>Decisions</label>" + renderCompactJson(viewModel.conditionalWorkflowRun.decisions || {}) + "</div>"
          + "</div>"
        : ""),
      "</div>"
    ].join("");
  }

  function renderBatchSummaryCard(viewModel) {
    if (!viewModel.store.batchRunResult) {
      return "";
    }

    const failedBatchFiles = Array.isArray(viewModel.store.failedBatchFiles)
      ? viewModel.store.failedBatchFiles
      : [];
    const isWorkflowRunning = viewModel.store.isRunningConditionalWorkflow || viewModel.store.isRunningBatchConditionalWorkflow;

    return [
      "<div class='card'>",
      "<h3>Batch Run Summary</h3>",
      "<div class='metrics-grid'>",
      "<div class='metric-card'><span>Status</span><strong>" + escapeHtml(viewModel.batchRunResult.status || "Idle") + "</strong></div>",
      "<div class='metric-card'><span>Total count</span><strong>" + escapeHtml(String(viewModel.batchRunResult.totalCount || 0)) + "</strong></div>",
      "<div class='metric-card'><span>Completed count</span><strong>" + escapeHtml(String(viewModel.batchRunResult.completedCount || 0)) + "</strong></div>",
      "<div class='metric-card'><span>Failed count</span><strong>" + escapeHtml(String(viewModel.batchRunResult.failedCount || 0)) + "</strong></div>",
      "</div>",
      ((viewModel.batchRunResult.results || []).length
        ? "<div class='stack-blocks'>"
          + (viewModel.batchRunResult.results || []).map(function mapBatchResult(item, index) {
            const itemFile = item && item.selectedFile ? item.selectedFile : null;
            const itemError = item && item.error ? item.error : null;
            return "<div class='timeline-item'><strong>"
              + escapeHtml(String(index + 1))
              + ". "
              + escapeHtml(itemFile && itemFile.name ? itemFile.name : "Unknown")
              + " - "
              + escapeHtml(item && item.status ? item.status : "unknown")
              + "</strong><div>"
              + escapeHtml(item && item.workflowAhkFileSave && item.workflowAhkFileSave.fileName ? "AHK: " + item.workflowAhkFileSave.fileName : itemError && itemError.message ? "Error: " + itemError.message : "No AHK file saved")
              + "</div></div>";
          }).join("")
          + "</div>"
        : "<div class='muted'>No batch results yet.</div>"),
      (viewModel.batchRunResult.error
        ? "<p class='warning-text'>Batch error: " + escapeHtml(viewModel.batchRunResult.error.message || "Unknown error") + "</p>"
        : ""),
      (failedBatchFiles.length
        ? "<div class='stack-blocks'>"
          + "<div><label>Failed files</label>"
          + failedBatchFiles.map(function mapFailedFile(file, index) {
            return "<div class='timeline-item'><strong>"
              + escapeHtml(String(index + 1))
              + ". "
              + escapeHtml(file && file.name ? file.name : "Unknown")
              + "</strong><div>"
              + escapeHtml((file && file.extension ? file.extension : "Unknown extension") + " | File ID: " + (file && file.fileId ? file.fileId : "Unknown"))
              + "</div></div>";
          }).join("")
          + "</div></div>"
        : ""),
      (failedBatchFiles.length && !isWorkflowRunning
        ? "<div class='button-row'><button id='automation-retry-failed-files'>Retry failed files</button></div>"
        : ""),
      "</div>"
    ].join("");
  }

  function renderSelectedBatchCard(viewModel) {
    return [
      "<div class='card'>",
      "<h3>Selected Batch</h3>",
      (viewModel.selectedFiles.length
        ? "<p class='field-help'>Selected files: " + escapeHtml(String(viewModel.selectedFiles.length)) + ". Active file: " + escapeHtml(viewModel.selectedFile ? viewModel.selectedFile.name : "None") + "</p>"
          + "<div class='stack-blocks'>"
          + viewModel.selectedFiles.map(function mapSelectedFile(file, index) {
            const isActive = viewModel.selectedFile && viewModel.selectedFile.fileId && file && file.fileId === viewModel.selectedFile.fileId;
            return "<div class='timeline-item'><strong>"
              + escapeHtml(String(index + 1))
              + ". "
              + escapeHtml(file && file.name ? file.name : "Unknown")
              + "</strong><div>"
              + escapeHtml(isActive ? "Active selected file" : (file && file.extension ? file.extension : ""))
              + "</div></div>";
          }).join("")
          + "</div>"
        : "<div class='muted'>No batch of Excel files selected yet.</div>"),
      "</div>"
    ].join("");
  }

  function renderSelectedFileCard(viewModel) {
    return [
      "<div class='card'>",
      "<h3>Selected File</h3>",
      (viewModel.selectedFile
        ? "<div class='metrics-grid'>"
          + "<div class='metric-card'><span>Name</span><strong>" + escapeHtml(viewModel.selectedFile.name || "Unknown") + "</strong></div>"
          + "<div class='metric-card'><span>Extension</span><strong>" + escapeHtml(viewModel.selectedFile.extension || "Unknown") + "</strong></div>"
          + "<div class='metric-card'><span>Size</span><strong>" + escapeHtml(String(viewModel.selectedFile.sizeBytes || 0)) + " bytes</strong></div>"
          + "<div class='metric-card'><span>Last modified</span><strong>" + escapeHtml(formatDate(viewModel.selectedFile.lastModified)) + "</strong></div>"
          + "</div>"
        : "<div class='muted'>No Excel file selected yet.</div>"),
      "</div>"
    ].join("");
  }

  function renderLastRunSummaryCard(viewModel) {
    return [
      "<div class='card'>",
      "<h3>Last Run Summary</h3>",
      "<div class='metrics-grid'>",
      "<div class='metric-card'><span>Status</span><strong>" + escapeHtml(viewModel.lastRunSummary.status || "Idle") + "</strong></div>",
      "<div class='metric-card'><span>Failed stage</span><strong>" + escapeHtml(viewModel.lastRunSummary.failedStage || "None") + "</strong></div>",
      "<div class='metric-card'><span>Failed step</span><strong>" + escapeHtml(viewModel.lastRunSummary.failedStep || "None") + "</strong></div>",
      "<div class='metric-card'><span>Trace ID</span><strong>" + escapeHtml(viewModel.lastRunSummary.traceId || "None") + "</strong></div>",
      "<div class='metric-card'><span>Workflow ID</span><strong>" + escapeHtml(viewModel.lastRunSummary.workflowId || "None") + "</strong></div>",
      "<div class='metric-card'><span>Last error</span><strong>" + escapeHtml(viewModel.error ? viewModel.error.message : "None") + "</strong></div>",
      "</div>",
      (viewModel.workflowRunJsonSave
        ? "<p class='field-help'>Workflow run JSON saved: " + escapeHtml(viewModel.workflowRunJsonSave.fileName || "Unknown") + "</p>"
        : ""),
      (viewModel.workflowAhkFileSave
        ? "<p class='field-help'>AutoHotkey file saved: " + escapeHtml(viewModel.workflowAhkFileSave.fileName || "Unknown") + "</p>"
        : ""),
      "</div>"
    ].join("");
  }

  function renderRuntimeSnapshotCard(viewModel) {
    return [
      "<div class='card'>",
      "<h3>Runtime Snapshot</h3>",
      "<div class='metrics-grid'>",
      "<div class='metric-card'><span>Current Site</span><strong>deepseek</strong></div>",
      "<div class='metric-card'><span>Current URL</span><strong>" + escapeHtml(viewModel.runtime.activeTabUrl || "Unknown") + "</strong></div>",
      "<div class='metric-card'><span>Detected Page State</span><strong>" + escapeHtml(viewModel.pageState.pageState ? viewModel.pageState.pageState.state : "Unknown") + "</strong></div>",
      "<div class='metric-card'><span>Gateway state</span><strong>" + escapeHtml(viewModel.gatewayStatus.state || "Unknown") + "</strong></div>",
      "</div>",
      "</div>"
    ].join("");
  }

  function renderExecutionTimelineCard(viewModel) {
    return [
      "<div class='card'>",
      "<h3>Execution Timeline</h3>",
      ((viewModel.conditionalWorkflowRun.turns || []).length ? (viewModel.conditionalWorkflowRun.turns || []).map(function mapTurn(turn, index) {
        return "<div class='timeline-item'><strong>Turn " + escapeHtml(String(index + 1)) + "</strong><div>" + escapeHtml(turn.promptNodeId || turn.nodeId || turn.turnId || "Unknown") + "</div></div>";
      }).join("") : "<div class='muted'>No workflow executed yet.</div>"),
      "</div>"
    ].join("");
  }

  function renderAdvancedActionsCard() {
    return [
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

  NewSiteSidepanel.AutomationTesterSections = {
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    renderCompactJson: renderCompactJson,
    renderHeaderCard: renderHeaderCard,
    renderConditionalWorkflowCard: renderConditionalWorkflowCard,
    renderBatchSummaryCard: renderBatchSummaryCard,
    renderSelectedBatchCard: renderSelectedBatchCard,
    renderSelectedFileCard: renderSelectedFileCard,
    renderLastRunSummaryCard: renderLastRunSummaryCard,
    renderRuntimeSnapshotCard: renderRuntimeSnapshotCard,
    renderExecutionTimelineCard: renderExecutionTimelineCard,
    renderAdvancedActionsCard: renderAdvancedActionsCard
  };
})(globalThis);
