(function initDiagnosticsRender(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.DiagnosticsStore.state;
  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render(root) {
    const diagnostics = store.diagnostics;
    const summary = diagnostics ? diagnostics.aiDebugSummary || {} : {};

    root.innerHTML = [
      "<div class='card'>",
      "<h2>Diagnostics</h2>",
      "<div class='button-row'>",
      "<button id='diag-refresh'>Refresh</button>",
      "<button class='primary' id='diag-export'>Export AI diagnostic JSON</button>",
      "<button id='diag-copy-summary'>Copy AI debug summary</button>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<h3>AI Debug Summary</h3>",
      (diagnostics ? [
        "<div class='metrics-grid'>",
        "<div class='metric-card'><span>Status</span><strong>" + escapeHtml(summary.status || "unknown") + "</strong></div>",
        "<div class='metric-card'><span>Probable failure area</span><strong>" + escapeHtml(summary.probableFailureArea || "unknown") + "</strong></div>",
        "<div class='metric-card'><span>Failed stage</span><strong>" + escapeHtml(summary.failedStage || "none") + "</strong></div>",
        "<div class='metric-card'><span>Failed step</span><strong>" + escapeHtml(summary.failedStep || "none") + "</strong></div>",
        "<div class='metric-card'><span>Trace ID</span><strong>" + escapeHtml(summary.traceId || "none") + "</strong></div>",
        "<div class='metric-card'><span>Workflow ID</span><strong>" + escapeHtml(summary.workflowId || "none") + "</strong></div>",
        "</div>",
        "<div class='timeline-item'><strong>Expected</strong><div>" + escapeHtml(summary.expected || "N/A") + "</div></div>",
        "<div class='timeline-item'><strong>Actual</strong><div>" + escapeHtml(summary.actual || "N/A") + "</div></div>",
        "<div class='timeline-item'><strong>Recommended next checks</strong><div>" + escapeHtml((summary.recommendedNextChecks || []).join(" | ") || "None") + "</div></div>",
        "<div class='timeline-item'><strong>Next best action</strong><div>" + escapeHtml(summary.nextBestAction || "None") + "</div></div>"
      ].join("") : "<div class='muted'>No diagnostics loaded.</div>"),
      "</div>"
    ].join("");
  }

  NewSiteSidepanel.DiagnosticsRender = {
    render: render
  };
})(globalThis);
