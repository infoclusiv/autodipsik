(function initConditionalWorkflowDraftStorage(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Storage = NewSiteCore.Storage;
  const storageKeys = NewSiteCore.CoreStorageKeys || {};
  const draftStorageKey = storageKeys.CONDITIONAL_WORKFLOW_DRAFT;

  async function loadDraft() {
    if (!Storage || typeof Storage.getValue !== "function" || !draftStorageKey) {
      return "";
    }

    try {
      const storedValue = await Storage.getValue(draftStorageKey, "");
      return typeof storedValue === "string" ? storedValue : "";
    } catch (error) {
      return "";
    }
  }

  async function saveDraft(text) {
    if (!Storage || typeof Storage.setValue !== "function" || !draftStorageKey) {
      return false;
    }

    try {
      return await Storage.setValue(draftStorageKey, String(text ?? ""));
    } catch (error) {
      return false;
    }
  }

  async function clearDraft() {
    if (!Storage || typeof Storage.removeValue !== "function" || !draftStorageKey) {
      return false;
    }

    try {
      return await Storage.removeValue(draftStorageKey);
    } catch (error) {
      return false;
    }
  }

  NewSiteCore.ConditionalWorkflowDraftStorage = {
    loadDraft: loadDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft
  };
})(globalThis);
