(function initTabHandlers(globalScope) {
  const NewSiteBackground = globalScope.NewSiteBackground = globalScope.NewSiteBackground || {};

  async function testOrDetect(message) {
    return NewSiteBackground.ActiveTabForwarder.forwardToSiteAwareTab(message);
  }

  async function ensureDeepSeekTab(message) {
    return {
      status: "completed",
      traceId: message.traceId,
      tab: await NewSiteBackground.DeepSeekTabService.ensureReady(message.traceId)
    };
  }

  NewSiteBackground.TabHandlers = {
    testOrDetect: testOrDetect,
    ensureDeepSeekTab: ensureDeepSeekTab
  };
})(globalThis);
