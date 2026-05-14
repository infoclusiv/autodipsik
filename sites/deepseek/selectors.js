(function initDeepSeekSelectors(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

  function getSelector(profile, selectorName) {
    return profile && profile.selectors ? profile.selectors[selectorName] || "" : "";
  }

  function querySelectorSafe(selector) {
    try {
      return selector ? document.querySelector(selector) : null;
    } catch (error) {
      return null;
    }
  }

  function queryAllSafe(selector) {
    try {
      return selector ? Array.from(document.querySelectorAll(selector)) : [];
    } catch (error) {
      return [];
    }
  }

  function isElementVisible(element) {
    if (!element) {
      return false;
    }
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
  }

  function isElementClickable(element) {
    if (!isElementVisible(element)) {
      return false;
    }
    return !element.disabled && element.getAttribute("aria-disabled") !== "true";
  }

  function getElementSample(element) {
    if (!element) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    return {
      tagName: element.tagName,
      id: element.id || "",
      className: element.className || "",
      text: (element.innerText || element.textContent || "").trim().slice(0, 120),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      ariaDisabled: element.getAttribute("aria-disabled") || "",
      disabled: Boolean(element.disabled)
    };
  }

  function looksGeneratedClassName(token) {
    return /^_[a-z0-9]{5,}$/i.test(token) || /^[a-f0-9]{6,}$/i.test(token);
  }

  function getSelectorStabilityWarning(selector) {
    if (!selector) {
      return "";
    }

    const classes = selector.split(".").slice(1).map(function normalizeClassToken(token) {
      return token.split(/[\s#[:]/)[0];
    }).filter(Boolean);
    const generatedClasses = classes.filter(looksGeneratedClassName);

    if (generatedClasses.length || /^div(\.|[\s>])/.test(selector)) {
      return "This selector may be unstable. Consider using a semantic selector or enabling heuristic fallback.";
    }

    return "";
  }

  async function waitForElement(selector, timeoutMs, pollIntervalMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const element = querySelectorSafe(selector);
      if (element) {
        return element;
      }
      await new Promise(function sleep(resolve) {
        setTimeout(resolve, pollIntervalMs);
      });
    }
    return null;
  }

  async function testSelector(options) {
    const selectorName = options.selectorName;
    const selector = options.selector;
    const result = {
      selectorName: selectorName,
      selector: selector,
      status: "missing",
      count: 0,
      matchedCount: 0,
      visibleCount: 0,
      clickableCount: 0,
      sample: null,
      errorMessage: "",
      sampleText: "",
      sampleRect: null,
      ariaDisabled: "",
      selectorStabilityWarning: ""
    };

    if (!selector) {
      result.status = "missing";
      result.errorMessage = "Selector is empty.";
      return result;
    }

    let elements;
    try {
      elements = Array.from(document.querySelectorAll(selector));
    } catch (error) {
      result.status = "invalid";
      result.errorMessage = error.message;
      return result;
    }

    result.count = elements.length;
    result.matchedCount = elements.length;
    result.visibleCount = elements.filter(isElementVisible).length;
    result.clickableCount = elements.filter(isElementClickable).length;
    result.sample = getElementSample(elements[0] || null);
    result.sampleText = result.sample ? result.sample.text : "";
    result.sampleRect = result.sample ? result.sample.rect : null;
    result.ariaDisabled = elements[0] ? elements[0].getAttribute("aria-disabled") || "" : "";
    result.selectorStabilityWarning = getSelectorStabilityWarning(selector);

    if (!elements.length) {
      result.status = "missing";
    } else if (elements.length > 1) {
      result.status = "multiple_matches";
    } else if (!result.visibleCount) {
      result.status = "not_visible";
    } else if (!result.clickableCount) {
      result.status = "not_clickable";
    } else {
      result.status = "found";
    }

    return result;
  }

  DeepSeekAutomation.DeepSeekSelectors = {
    getSelector: getSelector,
    querySelectorSafe: querySelectorSafe,
    queryAllSafe: queryAllSafe,
    isElementVisible: isElementVisible,
    isElementClickable: isElementClickable,
    waitForElement: waitForElement,
    testSelector: testSelector,
    getElementSample: getElementSample,
    getSelectorStabilityWarning: getSelectorStabilityWarning
  };
})(globalThis);
