(function initDeepSeekDomHelpers(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

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

  DeepSeekAutomation.DeepSeekDomHelpers = {
    isVisible: isVisible,
    describeElement: describeElement,
    getUploadSnapshot: getUploadSnapshot
  };
})(globalThis);
