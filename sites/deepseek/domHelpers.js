(function initDeepSeekDomHelpers(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

  function clickElement(element) {
    if (!element) {
      return false;
    }
    element.scrollIntoView({ block: "center", inline: "center" });
    element.click();
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

  function isVisible(element) {
    if (!element) {
      return false;
    }
    const style = window.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0)
    );
  }

  function describeElement(element) {
    if (!element) {
      return null;
    }
    return {
      tag: element.tagName.toLowerCase(),
      type: element.getAttribute("type"),
      accept: element.getAttribute("accept"),
      id: element.id || null,
      className: typeof element.className === "string" ? element.className : null,
      ariaLabel: element.getAttribute("aria-label"),
      title: element.getAttribute("title"),
      role: element.getAttribute("role"),
      text: (element.innerText || element.textContent || "").trim().slice(0, 120),
      visible: isVisible(element)
    };
  }

  function getUploadSnapshot() {
    return {
      url: location.href,
      title: document.title,
      fileInputs: Array.from(document.querySelectorAll("input[type='file']")).map(describeElement),
      composers: Array.from(document.querySelectorAll("textarea, div[contenteditable='true']")).map(describeElement),
      buttons: Array.from(document.querySelectorAll("button, [role='button'], label"))
        .map(describeElement)
        .filter(function filterInteresting(item) {
          const haystack = [
            item && item.text,
            item && item.ariaLabel,
            item && item.title,
            item && item.className
          ].filter(Boolean).join(" ").toLowerCase();
          return haystack.includes("attach") || haystack.includes("upload") || haystack.includes("file") || haystack.includes("send");
        })
    };
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

  DeepSeekAutomation.DeepSeekDomHelpers = {
    clickElement: clickElement,
    setNativeValue: setNativeValue,
    isVisible: isVisible,
    describeElement: describeElement,
    getUploadSnapshot: getUploadSnapshot,
    getElementSummary: getElementSummary,
    getVisibleButtonsSummary: getVisibleButtonsSummary,
    getVisibleInputsSummary: getVisibleInputsSummary,
    getPageSummary: getPageSummary
  };
})(globalThis);
