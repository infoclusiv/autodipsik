(function initBackgroundContracts(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Errors = NewSiteCore.Errors;

  function validateAutomationOneClickInput(input, context) {
    if (!input || !input.promptText) {
      throw Errors.createError("PROMPT_REQUIRED", "Prompt text is required.", {
        failedStage: "validate_input",
        expected: "A non-empty prompt should be provided before running automation.",
        actual: "The one-click request did not include prompt text.",
        messageType: context && context.messageType ? context.messageType : "",
        probableCause: "core/contracts/backgroundContracts.js"
      });
    }
  }

  NewSiteCore.BackgroundContracts = {
    validateAutomationOneClickInput: validateAutomationOneClickInput
  };
})(globalThis);
