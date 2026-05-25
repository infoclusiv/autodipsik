(function initConditionalWorkflowDraftSession(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const draftStorage = NewSiteCore.ConditionalWorkflowDraftStorage;

  function create(options) {
    const resolvedOptions = options || {};
    const getText = typeof resolvedOptions.getText === "function" ? resolvedOptions.getText : function getFallbackText() {
      return "";
    };
    const setText = typeof resolvedOptions.setText === "function" ? resolvedOptions.setText : function setFallbackText() {};
    const onLoaded = typeof resolvedOptions.onLoaded === "function" ? resolvedOptions.onLoaded : function onLoadedFallback() {};

    let saveTimer = null;
    let sessionVersion = 0;

    async function saveDraft(text) {
      if (!draftStorage || typeof draftStorage.saveDraft !== "function") {
        return false;
      }

      try {
        return await draftStorage.saveDraft(text);
      } catch (error) {
        return false;
      }
    }

    function scheduleSave(text) {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }

      saveTimer = setTimeout(function persistDraft() {
        saveTimer = null;
        saveDraft(text).catch(function noop() {});
      }, 250);
    }

    async function flushSave(text) {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }

      return saveDraft(text);
    }

    async function loadDraft() {
      if (!draftStorage || typeof draftStorage.loadDraft !== "function") {
        return;
      }

      const loadVersion = sessionVersion;
      const loadedDraft = await draftStorage.loadDraft();

      if (sessionVersion !== loadVersion) {
        return;
      }

      if (typeof loadedDraft !== "string" || loadedDraft === getText()) {
        return;
      }

      setText(loadedDraft);
      onLoaded(loadedDraft);
    }

    function markEdited() {
      sessionVersion += 1;
    }

    return {
      loadDraft: loadDraft,
      flushSave: flushSave,
      scheduleSave: scheduleSave,
      markEdited: markEdited
    };
  }

  NewSiteCore.ConditionalWorkflowDraftSession = {
    create: create
  };
})(globalThis);
