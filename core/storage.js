(function initStorage(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const config = NewSiteCore.EXTENSION_CONFIG;

  function getStorageArea() {
    return globalScope.chrome && chrome.storage && chrome.storage.local ? chrome.storage.local : null;
  }

  function namespaceKey(key) {
    if (!config || !config.storageNamespace) {
      return key;
    }
    if (key.indexOf(config.storageNamespace + ".") === 0) {
      return key;
    }
    return config.storageNamespace + "." + key;
  }

  async function getValue(key, fallback) {
    const storage = getStorageArea();
    if (!storage) {
      return fallback;
    }
    const namespacedKey = namespaceKey(key);
    const result = await storage.get(namespacedKey);
    return Object.prototype.hasOwnProperty.call(result, namespacedKey) ? result[namespacedKey] : fallback;
  }

  async function setValue(key, value) {
    const storage = getStorageArea();
    if (!storage) {
      return false;
    }
    const namespacedKey = namespaceKey(key);
    await storage.set({ [namespacedKey]: value });
    return true;
  }

  async function removeValue(key) {
    const storage = getStorageArea();
    if (!storage) {
      return false;
    }
    await storage.remove(namespaceKey(key));
    return true;
  }

  NewSiteCore.Storage = {
    namespaceKey: namespaceKey,
    getValue: getValue,
    setValue: setValue,
    removeValue: removeValue
  };
})(globalThis);
