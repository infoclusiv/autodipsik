(function initProfileHandlers(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const Storage = NewSiteCore.Storage;

  async function getProfile(message) {
    const profileService = NewSiteBackground.SiteProfileResolver.resolve(message.targetSiteId).profileService;
    return {
      status: "completed",
      traceId: message.traceId,
      profile: await profileService.loadSiteProfile()
    };
  }

  async function saveProfile(message) {
    const profileService = NewSiteBackground.SiteProfileResolver.resolve(message.targetSiteId).profileService;
    const saveResult = await profileService.saveSiteProfile(message.profile);
    return {
      status: saveResult.valid ? "completed" : "failed",
      traceId: message.traceId,
      validation: saveResult
    };
  }

  async function resetProfile(message) {
    const profileInfo = NewSiteBackground.SiteProfileResolver.resolve(message.targetSiteId);
    const profile = profileInfo.profileService.cloneDefaultProfile();
    await Storage.setValue(profileInfo.storageKey, profile);
    return {
      status: "completed",
      traceId: message.traceId,
      profile: profile
    };
  }

  NewSiteBackground.ProfileHandlers = {
    getProfile: getProfile,
    saveProfile: saveProfile,
    resetProfile: resetProfile
  };
})(globalThis);
