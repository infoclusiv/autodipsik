(function initProfileEditorRender(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.ProfileEditorStore.state;

  function resultMarkup(result) {
    if (!result) {
      return "<span class='status-pill'>Not tested</span>";
    }

    const klass = result.status === "found" ? "" : (result.status === "multiple_matches" ? "warn" : "error");
    return "<span class='status-pill " + klass + "'>" + result.status + " | matched: " + result.matchedCount + " | visible: " + result.visibleCount + " | clickable: " + result.clickableCount + "</span>";
  }

  function render(root) {
    const profile = store.profile;
    if (!profile) {
      root.innerHTML = "<div class='card'>Loading profile...</div>";
      return;
    }

    const selectorRows = Object.keys(profile.selectors).map(function mapSelector(key) {
      return [
        "<div class='selector-row'>",
        "<div><label>" + key + "</label><div class='field-help'>CSS selector</div></div>",
        "<div><input data-selector-input='" + key + "' value=\"" + String(profile.selectors[key]).replace(/"/g, "&quot;") + "\"></div>",
        "<div><button data-test-selector='" + key + "'>Test selector</button></div>",
        "<div>" + resultMarkup(store.selectorResults[key]) + "</div>",
        "</div>"
      ].join("");
    }).join("");

    root.innerHTML = [
      "<div class='card'>",
      "<h2>Site Profile Editor</h2>",
      "<div class='form-grid'>",
      "<div><label>Base URL</label><input id='profile-base-url' value=\"" + profile.baseUrl.replace(/"/g, "&quot;") + "\"></div>",
      "<div><label>URL Pattern</label><input id='profile-url-pattern' value=\"" + profile.urlPattern.replace(/"/g, "&quot;") + "\"></div>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<h3>Selectors</h3>",
      selectorRows,
      "<div class='button-row'>",
      "<button class='primary' id='profile-save'>Save profile</button>",
      "<button id='profile-reset'>Reset defaults</button>",
      "<button id='profile-test-all'>Test all selectors</button>",
      "</div>",
      "</div>",
      "<div class='card'>",
      "<h3>Timing</h3>",
      "<div class='timing-grid'>",
      Object.keys(profile.timing).map(function mapTiming(key) {
        return "<div><label>" + key + "</label><input type='number' data-timing-input='" + key + "' value='" + profile.timing[key] + "'></div>";
      }).join(""),
      "</div>",
      "</div>",
      "<div class='card'>",
      "<h3>Validation</h3>",
      (store.validationErrors.length ? "<pre>" + store.validationErrors.join("\n") + "</pre>" : "<div class='muted'>No validation errors.</div>"),
      "</div>"
    ].join("");
  }

  NewSiteSidepanel.ProfileEditorRender = {
    render: render
  };
})(globalThis);
