(function initDeepSeekContent(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};
  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const TELEMETRY_EVENTS = NewSiteCore.TELEMETRY_EVENTS;
  const Telemetry = NewSiteCore.Telemetry;
  const Errors = NewSiteCore.Errors;
  const DeepSeekSiteProfile = DeepSeekAutomation.DeepSeekSiteProfile;
  const Selectors = DeepSeekAutomation.DeepSeekSelectors;
  const DomHelpers = DeepSeekAutomation.DeepSeekDomHelpers;

  function base64ToUint8Array(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function base64ToFile(contentBase64, name, mimeType) {
    return new File([base64ToUint8Array(contentBase64)], name, {
      type: mimeType || "application/octet-stream",
      lastModified: Date.now()
    });
  }

  async function attachFileToDeepSeek(filePayload, traceId) {
    const profile = await DeepSeekSiteProfile.loadSiteProfile();

    const input = await Selectors.waitForElement(
      profile.selectors.fileInput,
      profile.upload.elementWaitTimeoutMs,
      profile.upload.pollIntervalMs
    );

    if (!input) {
      await Telemetry.emit({
        eventName: TELEMETRY_EVENTS.DEEPSEEK_FILE_INPUT_NOT_FOUND,
        traceId: traceId,
        siteId: profile.siteId,
        component: "content",
        level: "error",
        message: "DeepSeek file input not found",
        data: { selector: profile.selectors.fileInput, snapshot: DomHelpers.getUploadSnapshot() }
      });
      throw Errors.createError("DEEPSEEK_FILE_INPUT_NOT_FOUND", "Could not find the DeepSeek file input.", {
        expected: "A file input matching the DeepSeek site profile should exist in the DOM.",
        actual: "No matching input[type='file'] element was found before timeout.",
        recoverable: true,
        suggestedFix: "Open the attachment menu manually or adjust the DeepSeek file input selector.",
        selector: profile.selectors.fileInput,
        pageSummary: DomHelpers.getUploadSnapshot()
      });
    }

    await Telemetry.emit({
      eventName: TELEMETRY_EVENTS.DEEPSEEK_FILE_INPUT_FOUND,
      traceId: traceId,
      siteId: profile.siteId,
      component: "content",
      level: "info",
      message: "DeepSeek file input found",
      data: { selector: profile.selectors.fileInput }
    });

    const file = base64ToFile(filePayload.contentBase64, filePayload.name, filePayload.mimeType);
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;

    profile.upload.dispatchEvents.forEach(function dispatchEventName(eventName) {
      input.dispatchEvent(new Event(eventName, { bubbles: true }));
    });

    await new Promise(function wait(resolve) {
      setTimeout(resolve, profile.upload.waitAfterAttachMs || 1500);
    });

    return {
      status: "completed",
      traceId: traceId,
      attached: true,
      fileName: file.name,
      fileSize: file.size,
      selectorUsed: profile.selectors.fileInput,
      snapshot: profile.diagnostics.captureDomUploadState ? DomHelpers.getUploadSnapshot() : null
    };
  }

  chrome.runtime.onMessage.addListener(function onMessage(message, sender, sendResponse) {
    if (!message || message.type !== MESSAGE_TYPES.DEEPSEEK_ATTACH_FILE) {
      return;
    }

    (async function run() {
      return attachFileToDeepSeek(message.file, message.traceId || Telemetry.createTraceId("deepseek"));
    })()
      .then(sendResponse)
      .catch(function handleError(error) {
        sendResponse({
          status: "failed",
          error: Errors.toStructuredError(error)
        });
      });

    return true;
  });
})(globalThis);
