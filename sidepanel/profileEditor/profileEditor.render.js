(function initProfileEditorRender(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.ProfileEditorStore.state;
  const selectorGroups = NewSiteSidepanel.ProfileEditorStore.selectorGroups || [];

  function resultMarkup(result) {
    if (!result) {
      return "<span class='status-pill'>Not tested</span>";
    }

    const klass = result.status === "found" ? "" : (result.status === "multiple_matches" ? "warn" : "error");
    const sampleText = result.sampleText
      ? "<div class='field-help'>Sample: " + result.sampleText.replace(/</g, "&lt;") + "</div>"
      : "";
    const warning = result.selectorStabilityWarning
      ? "<div class='field-help warning-text'>" + result.selectorStabilityWarning + "</div>"
      : "";
    return "<span class='status-pill " + klass + "'>" + result.status + " | matched: " + result.matchedCount + " | visible: " + result.visibleCount + " | clickable: " + result.clickableCount + "</span>" + sampleText + warning;
  }

  function buildSelectorGroups(selectors) {
    const assigned = {};
    const groups = selectorGroups.map(function mapGroup(group) {
      const keys = group.keys.filter(function includeKey(key) {
        if (!Object.prototype.hasOwnProperty.call(selectors, key)) {
          return false;
        }
        assigned[key] = true;
        return true;
      });
      return {
        title: group.title,
        keys: keys
      };
    }).filter(function keepNonEmpty(group) {
      return group.keys.length > 0;
    });

    const otherKeys = Object.keys(selectors).filter(function notAssigned(key) {
      return !assigned[key];
    });

    if (otherKeys.length) {
      groups.push({
        title: "Other",
        keys: otherKeys
      });
    }

    return groups;
  }

  function renderSelectorRow(profile, key) {
    return [
      "<div class='selector-row'>",
      "<div><label>" + key + "</label><div class='field-help'>CSS selector</div></div>",
      "<div><input data-selector-input='" + key + "' value=\"" + String(profile.selectors[key]).replace(/"/g, "&quot;") + "\"></div>",
      "<div><button data-test-selector='" + key + "'>Test selector</button></div>",
      "<div>" + resultMarkup(store.selectorResults[key]) + "</div>",
      "</div>"
    ].join("");
  }

  function render(root) {
    const profile = store.profile;
    if (!profile) {
      root.innerHTML = "<div class='card'>Loading profile...</div>";
      return;
    }

    const selectorRows = buildSelectorGroups(profile.selectors).map(function mapGroup(group) {
      return "<div class='selector-group'><h4>" + group.title + "</h4>" + group.keys.map(function mapSelector(key) {
        return renderSelectorRow(profile, key);
      }).join("") + "</div>";
    }).join("");

    const behaviorFields = Object.keys(profile.behavior || {}).map(function mapBehavior(key) {
      const value = profile.behavior[key];
      if (typeof value === "boolean") {
        return "<div><label>" + key + "</label><select data-behavior-input='" + key + "'><option value='true'" + (value ? " selected" : "") + ">true</option><option value='false'" + (!value ? " selected" : "") + ">false</option></select></div>";
      }
      if (Array.isArray(value)) {
        return "<div><label>" + key + "</label><input data-behavior-input='" + key + "' value=\"" + value.join(", ").replace(/"/g, "&quot;") + "\"><div class='field-help'>Comma-separated values</div></div>";
      }
      return "<div><label>" + key + "</label><input data-behavior-input='" + key + "' value=\"" + String(value).replace(/"/g, "&quot;") + "\"></div>";
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
      "<h3>Behavior</h3>",
      "<div class='timing-grid'>",
      behaviorFields,
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
