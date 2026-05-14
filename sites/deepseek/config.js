(function initDeepSeekConfig(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

  const baseUrl = "https://chat.deepseek.com/";
  const urlPattern = "https://chat.deepseek.com/*";

  function isDeepSeekUrl(url) {
    return /^https:\/\/chat\.deepseek\.com\/.*/i.test(url || "");
  }

  DeepSeekAutomation.DEEPSEEK_CONFIG = {
    siteId: "deepseek",
    displayName: "DeepSeek Chat",
    baseUrl: baseUrl,
    urlPattern: urlPattern,
    storageKeySiteProfile: "deepseek_site_profile",
    supportedCapabilities: [
      "file_upload",
      "prompt_injection",
      "submit"
    ],
    isDeepSeekUrl: isDeepSeekUrl
  };
})(globalThis);
