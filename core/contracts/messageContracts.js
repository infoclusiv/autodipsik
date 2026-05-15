(function initMessageContracts(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Errors = NewSiteCore.Errors;

  function isMissingValue(value) {
    return typeof value === "undefined" || value === null || value === "";
  }

  function requireFields(object, fields, context) {
    const missing = fields.filter(function isMissing(field) {
      return !object || isMissingValue(object[field]);
    });

    if (missing.length) {
      throw Errors.createError("CONTRACT_VALIDATION_FAILED", "Required fields are missing.", {
        expected: "Required fields: " + fields.join(", "),
        actual: "Missing fields: " + missing.join(", "),
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: context && context.contractName ? context.contractName : "core/contracts/messageContracts.js"
      });
    }
  }

  function validateBaseMessage(message) {
    requireFields(message, ["type"], {
      contractName: "BaseMessage",
      messageType: message && message.type ? message.type : ""
    });
  }

  NewSiteCore.MessageContracts = {
    requireFields: requireFields,
    validateBaseMessage: validateBaseMessage
  };
})(globalThis);
