(function initSelectors(globalScope) {
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};

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
    return {
      tagName: element.tagName,
      id: element.id || "",
      className: element.className || "",
      text: (element.innerText || element.textContent || "").trim().slice(0, 120)
    };
  }

  async function waitForSelector(options) {
    const selector = options.selector;
    const timeoutMs = options.timeoutMs;
    const pollIntervalMs = options.pollIntervalMs;
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
      errorMessage: ""
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

  NewSiteAutomation.Selectors = {
    getSelector: getSelector,
    querySelectorSafe: querySelectorSafe,
    queryAllSafe: queryAllSafe,
    isElementVisible: isElementVisible,
    isElementClickable: isElementClickable,
    waitForSelector: waitForSelector,
    testSelector: testSelector
  };
})(globalThis);
