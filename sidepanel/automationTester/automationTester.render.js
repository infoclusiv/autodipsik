(function initAutomationRender(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.AutomationTesterStore.state;
  const json = NewSiteSidepanel.LogView.renderJson;

  function render(root) {
    const runtime = store.runtimeStatus || {};
    const pageState = store.pageState || {};
    const workflow = store.workflowResult || {};

    root.innerHTML = [
      "<div class='card'>",
      "<h2>Automation Tester</h2>",
      "<div class='form-grid'>",
      "<div><label>Excel file path</label><input id='automation-file-path' value=\"" + String(store.filePath || "").replace(/\"/g, "&quot;") + "\" placeholder='C:\\files\\input.xlsx'></div>",
      "<div><label>Prompt text</label><textarea id='automation-prompt-text' rows='3' placeholder='Describe what DeepSeek should do with the attached file'>" + String(store.promptText || "").replace(/</g, "&lt;") + "</textarea></div>",
      "</div>",
      "<div class='button-row'>",
      "<button id='open-target-site'>Open target site</button>",
      "<button id='detect-page-state'>Detect page state</button>",
      "<button id='run-dry-run'>Run dry run</button>",
      "<button class='primary' id='run-automation'>Run automation</button>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<div class='metrics-grid'>",
      "<div class='metric-card'><span>Current Site</span><strong>deepseek-chat</strong></div>",
      "<div class='metric-card'><span>Current URL</span><strong>" + (runtime.activeTabUrl || "Unknown") + "</strong></div>",
      "<div class='metric-card'><span>Detected Page State</span><strong>" + (pageState.pageState ? pageState.pageState.state : "Unknown") + "</strong></div>",
      "<div class='metric-card'><span>Current Workflow</span><strong>" + (workflow.workflowId || "None") + "</strong></div>",
      "<div class='metric-card'><span>Current Step</span><strong>" + (workflow.failedStep || "Completed/Idle") + "</strong></div>",
      "<div class='metric-card'><span>Last Error</span><strong>" + (store.lastError ? store.lastError.message : "None") + "</strong></div>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<h3>Step Timeline</h3>",
      (workflow.timeline && workflow.timeline.length ? workflow.timeline.map(function mapStep(step) {
        return "<div class='timeline-item'><strong>" + step.stepName + "</strong><div>" + step.status + "</div></div>";
      }).join("") : "<div class='muted'>No workflow executed yet.</div>"),
      "</div>",
      "<div class='card'>",
      "<h3>Latest Payload</h3>",
      "<pre>" + json({
        runtimeStatus: runtime,
        pageState: pageState,
        workflowResult: workflow,
        lastError: store.lastError
      }) + "</pre>",
      "</div>"
    ].join("");
  }

  NewSiteSidepanel.AutomationTesterRender = {
    render: render
  };
})(globalThis);
