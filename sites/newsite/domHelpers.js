(function initDomHelpers(globalScope) {
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};

  function clickElement(element) {
    if (!element) {
      return false;
    }
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
    return true;
  }

  function typeIntoElement(element, value) {
    if (!element) {
      return false;
    }
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function setNativeValue(element, value) {
    if (!element) {
      return false;
    }

    const ownDescriptor = Object.getOwnPropertyDescriptor(element, "value");
    const prototype = Object.getPrototypeOf(element);
    const prototypeDescriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, "value") : null;

    if (prototypeDescriptor && ownDescriptor && ownDescriptor.set !== prototypeDescriptor.set) {
      prototypeDescriptor.set.call(element, value);
    } else if (prototypeDescriptor && prototypeDescriptor.set) {
      prototypeDescriptor.set.call(element, value);
    } else if (ownDescriptor && ownDescriptor.set) {
      ownDescriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: value
    }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function getElementSummary(element) {
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

  function getVisibleButtonsSummary() {
    return Array.from(document.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit']"))
      .filter(function onlyVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .slice(0, 20)
      .map(getElementSummary);
  }

  function getVisibleInputsSummary() {
    return Array.from(document.querySelectorAll("input, textarea, select"))
      .filter(function onlyVisible(element) {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .slice(0, 20)
      .map(getElementSummary);
  }

  function getPageSummary() {
    const detectedErrors = Array.from(document.querySelectorAll("[role='alert'], .error, .alert, .warning"))
      .slice(0, 10)
      .map(getElementSummary);

    return {
      url: location.href,
      title: document.title,
      visibleButtons: getVisibleButtonsSummary(),
      visibleInputs: getVisibleInputsSummary(),
      detectedErrors: detectedErrors
    };
  }

  NewSiteAutomation.DomHelpers = {
    clickElement: clickElement,
    typeIntoElement: typeIntoElement,
    setNativeValue: setNativeValue,
    getElementSummary: getElementSummary,
    getVisibleButtonsSummary: getVisibleButtonsSummary,
    getVisibleInputsSummary: getVisibleInputsSummary,
    getPageSummary: getPageSummary
  };
})(globalThis);
