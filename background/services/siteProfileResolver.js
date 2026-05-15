(function initSiteProfileResolver(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};

  function resolve(targetSiteId) {
    if (targetSiteId === "deepseek") {
      return {
        config: DeepSeekAutomation.DEEPSEEK_CONFIG,
        profileService: DeepSeekAutomation.DeepSeekSiteProfile,
        storageKey: NewSiteCore.STORAGE_KEYS.DEEPSEEK_SITE_PROFILE
      };
    }

    return {
      config: NewSiteAutomation.NEWSITE_CONFIG,
      profileService: NewSiteAutomation.SiteProfile,
      storageKey: NewSiteCore.STORAGE_KEYS.SITE_PROFILE
    };
  }

  NewSiteBackground.SiteProfileResolver = {
    resolve: resolve
  };
})(globalThis);
