(function initDiagnosticsRender(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.DiagnosticsStore.state;
  const json = NewSiteSidepanel.LogView.renderJson;

  function filterEvents(events) {
    return (events || []).filter(function keep(event) {
      const levelOk = !store.levelFilter || event.level === store.levelFilter;
      const traceOk = !store.traceFilter || event.traceId.indexOf(store.traceFilter) !== -1;
      return levelOk && traceOk;
    });
  }

  function render(root) {
    const diagnostics = store.diagnostics;
    const events = diagnostics ? filterEvents(diagnostics.events) : [];

    root.innerHTML = [
      "<div class='card'>",
      "<h2>Diagnostics</h2>",
      "<div class='form-grid'>",
      "<div><label>Level filter</label><select id='diag-level-filter'><option value=''>All</option><option value='debug'>debug</option><option value='info'>info</option><option value='warn'>warn</option><option value='error'>error</option></select></div>",
      "<div><label>Trace filter</label><input id='diag-trace-filter' value=\"" + store.traceFilter.replace(/"/g, "&quot;") + "\" placeholder='trace id fragment'></div>",
      "</div>",
      "<div class='button-row'>",
      "<button id='diag-refresh'>Refresh</button>",
      "<button class='primary' id='diag-export'>Export diagnostic JSON</button>",
      "<button id='diag-copy-summary'>Copy AI debug summary</button>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<h3>AI Debug Summary</h3>",
      "<pre>" + json(diagnostics ? diagnostics.aiDebugSummary : {}) + "</pre>",
      "</div>",
      "<div class='card'>",
      "<h3>Recent Events</h3>",
      (events.length ? events.map(function mapEvent(event) {
        return "<div class='event-item'><strong>" + event.eventName + "</strong><div>" + event.level + " | " + event.traceId + "</div><div>" + event.message + "</div></div>";
      }).join("") : "<div class='muted'>No diagnostics loaded.</div>"),
      "</div>",
      "<div class='card'>",
      "<h3>Raw Diagnostic Package</h3>",
      "<pre>" + json(diagnostics || {}) + "</pre>",
      "</div>"
    ].join("");

    const levelSelect = document.getElementById("diag-level-filter");
    if (levelSelect) {
      levelSelect.value = store.levelFilter;
    }
  }

  NewSiteSidepanel.DiagnosticsRender = {
    render: render
  };
})(globalThis);
