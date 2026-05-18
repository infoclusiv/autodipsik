(function initDiagnosticRedactor(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  function redactPath(value) {
    if (!value || typeof value !== "string") {
      return value;
    }
    return value.replace(/[A-Za-z]:\\[^"'\\n]+/g, "[redacted-local-path]");
  }

  function truncatePrompt(value, maxLength) {
    if (!value || typeof value !== "string") {
      return value || "";
    }
    if (value.length <= maxLength) {
      return value;
    }
    return value.slice(0, maxLength) + "...[truncated]";
  }

  function deepRedact(value, options) {
    if (Array.isArray(value)) {
      return value.map(function mapEntry(entry) {
        return deepRedact(entry, options);
      });
    }

    if (!value || typeof value !== "object") {
      if (typeof value === "string") {
        return redactPath(value);
      }
      return value;
    }

    const redacted = {};
    Object.keys(value).forEach(function mapKey(key) {
      const entry = value[key];
      if (key === "contentBase64") {
        return;
      }
      if (key === "filePath" || key === "path") {
        redacted[key] = redactPath(entry);
        return;
      }
      if (key === "promptText") {
        redacted[key] = truncatePrompt(entry, options.promptMaxLength);
        return;
      }
      if (key === "currentPromptPreview") {
        redacted[key] = truncatePrompt(entry, 120);
        return;
      }
      redacted[key] = deepRedact(entry, options);
    });
    return redacted;
  }

  function sanitizeDiagnosticPackage(input) {
    const options = {
      promptMaxLength: 240
    };
    return {
      diagnostics: deepRedact(input, options),
      redactions: {
        localPathsRedacted: true,
        base64PayloadExcluded: true,
        promptTruncated: true
      }
    };
  }

  NewSiteCore.DiagnosticRedactor = {
    sanitizeDiagnosticPackage: sanitizeDiagnosticPackage
  };
})(globalThis);
