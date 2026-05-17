(function initDeepSeekFilePayloadHelpers(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

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

  DeepSeekAutomation.FilePayloadHelpers = {
    base64ToUint8Array: base64ToUint8Array,
    base64ToFile: base64ToFile
  };
})(globalThis);
