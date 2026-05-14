(function initProfileEditorController(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};
  const store = NewSiteSidepanel.ProfileEditorStore.state;
  const render = NewSiteSidepanel.ProfileEditorRender.render;
  const messaging = NewSiteSidepanel.ChromeMessaging;
  const Toast = NewSiteSidepanel.Toast;
  const MESSAGE_TYPES = globalScope.NewSiteCore.MESSAGE_TYPES;
  const SiteProfile = globalScope.NewSiteAutomation.SiteProfile;

  let rootNode;

  function collectProfileFromDom() {
    const nextProfile = SiteProfile.normalizeSiteProfile(store.profile);
    nextProfile.baseUrl = document.getElementById("profile-base-url").value.trim();
    nextProfile.urlPattern = document.getElementById("profile-url-pattern").value.trim();

    Object.keys(nextProfile.selectors).forEach(function syncSelector(key) {
      const input = document.querySelector("[data-selector-input='" + key + "']");
      nextProfile.selectors[key] = input ? input.value.trim() : "";
    });

    Object.keys(nextProfile.timing).forEach(function syncTiming(key) {
      const input = document.querySelector("[data-timing-input='" + key + "']");
      nextProfile.timing[key] = input ? Number(input.value) : 0;
    });

    Object.keys(nextProfile.behavior || {}).forEach(function syncBehavior(key) {
      const input = document.querySelector("[data-behavior-input='" + key + "']");
      if (!input) {
        return;
      }
      if (Array.isArray(nextProfile.behavior[key])) {
        nextProfile.behavior[key] = input.value
          .split(",")
          .map(function trimEntry(entry) {
            return entry.trim();
          })
          .filter(Boolean);
        return;
      }
      if (typeof nextProfile.behavior[key] === "boolean") {
        nextProfile.behavior[key] = input.value === "true";
        return;
      }
      nextProfile.behavior[key] = input.value.trim();
    });

    return nextProfile;
  }

  async function loadProfile() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.PROFILE_GET });
    store.profile = response.profile;
    store.validationErrors = [];
    render(rootNode);
    bindEvents();
  }

  async function saveProfile() {
    const profile = collectProfileFromDom();
    const validation = SiteProfile.validateSiteProfile(profile);
    store.validationErrors = validation.errors;
    store.profile = validation.profile;
    render(rootNode);
    bindEvents();

    if (!validation.valid) {
      Toast.showToast("Validation errors detected.");
      return;
    }

    const response = await messaging.sendMessage({
      type: MESSAGE_TYPES.PROFILE_SAVE,
      profile: validation.profile
    });
    if (response.status === "completed") {
      Toast.showToast("Profile saved.");
    }
  }

  async function resetProfile() {
    const response = await messaging.sendMessage({ type: MESSAGE_TYPES.PROFILE_RESET });
    store.profile = response.profile;
    store.validationErrors = [];
    store.selectorResults = {};
    render(rootNode);
    bindEvents();
    Toast.showToast("Default profile restored.");
  }

  async function testSelector(selectorName) {
    const profile = collectProfileFromDom();
    const response = await messaging.sendMessage({
      type: MESSAGE_TYPES.SELECTOR_TEST,
      selectorName: selectorName,
      selector: profile.selectors[selectorName],
      profile: profile
    });
    store.profile = profile;
    store.selectorResults[selectorName] = response.result;
    render(rootNode);
    bindEvents();
  }

  async function testAll() {
    const profile = collectProfileFromDom();
    const response = await messaging.sendMessage({
      type: MESSAGE_TYPES.SELECTOR_TEST_ALL,
      profile: profile
    });
    store.profile = profile;
    response.selectorHealth.forEach(function storeResult(entry) {
      store.selectorResults[entry.selectorName] = entry;
    });
    render(rootNode);
    bindEvents();
    Toast.showToast("Selector test completed.");
  }

  function bindEvents() {
    document.getElementById("profile-save").onclick = saveProfile;
    document.getElementById("profile-reset").onclick = resetProfile;
    document.getElementById("profile-test-all").onclick = testAll;

    Array.from(document.querySelectorAll("[data-test-selector]")).forEach(function attach(button) {
      button.onclick = function onClick() {
        testSelector(button.getAttribute("data-test-selector"));
      };
    });
  }

  function mount(root) {
    rootNode = root;
    render(rootNode);
    loadProfile();
  }

  NewSiteSidepanel.ProfileEditorController = {
    mount: mount,
    loadProfile: loadProfile
  };
})(globalThis);
