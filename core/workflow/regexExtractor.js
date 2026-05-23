(function initRegexExtractor(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const Errors = NewSiteCore.Errors;

  const MODULE_FILE = "core/workflow/regexExtractor.js";

  function createValidationError(message, expected, actual, context) {
    return Errors.createError("CONTRACT_VALIDATION_FAILED", message, {
      expected: expected,
      actual: actual,
      messageType: context && context.messageType ? context.messageType : "",
      workflowId: context && context.workflowId ? context.workflowId : "",
      probableCause: MODULE_FILE
    });
  }

  function createPatternFailure(code, message, expected, actual, patternName, context) {
    return Errors.createError(code, message, {
      expected: expected,
      actual: actual,
      workflowId: context && context.workflowId ? context.workflowId : "",
      messageType: context && context.messageType ? context.messageType : "",
      probableCause: MODULE_FILE,
      workflowStep: patternName || ""
    });
  }

  function ensureExtractInput(input, context) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw createValidationError(
        "RegexExtractor.extract requires an object input.",
        "An object with text and patterns.",
        "Received " + describeValue(input) + ".",
        context
      );
    }

    if (typeof input.text !== "string") {
      throw createValidationError(
        "RegexExtractor.extract requires text to be a string.",
        "text should be a string.",
        "text was " + describeValue(input.text) + ".",
        context
      );
    }

    if (!Array.isArray(input.patterns) || !input.patterns.length) {
      throw createValidationError(
        "RegexExtractor.extract requires a non-empty patterns array.",
        "patterns should be a non-empty array of regex pattern objects.",
        "patterns was " + describeValue(input.patterns) + ".",
        context
      );
    }
  }

  function describeValue(value) {
    if (Array.isArray(value)) {
      return "an array";
    }

    if (value === null) {
      return "null";
    }

    return typeof value;
  }

  function validatePattern(pattern, index, context) {
    if (!pattern || typeof pattern !== "object" || Array.isArray(pattern)) {
      throw createValidationError(
        "RegexExtractor pattern must be an object.",
        "patterns[" + index + "] should be an object.",
        "patterns[" + index + "] was " + describeValue(pattern) + ".",
        context
      );
    }

    if (typeof pattern.name !== "string" || pattern.name.trim().length < 1) {
      throw createValidationError(
        "RegexExtractor pattern name is required.",
        "patterns[" + index + "].name should be a non-empty string.",
        "patterns[" + index + "].name was " + String(pattern.name) + ".",
        context
      );
    }

    if (typeof pattern.regex !== "string" || pattern.regex.length < 1) {
      throw createValidationError(
        "RegexExtractor pattern regex is required.",
        "patterns[" + index + "].regex should be a non-empty string.",
        "patterns[" + index + "].regex was " + String(pattern.regex) + ".",
        context
      );
    }

    const hasGroupIndex = typeof pattern.groupIndex !== "undefined";
    const hasGroupName = typeof pattern.groupName !== "undefined";

    if (!hasGroupIndex && !hasGroupName) {
      throw createValidationError(
        "RegexExtractor pattern requires groupIndex or groupName.",
        "patterns[" + index + "] should specify groupIndex or groupName.",
        "Neither groupIndex nor groupName was provided.",
        context
      );
    }

    if (hasGroupIndex && (!Number.isInteger(pattern.groupIndex) || pattern.groupIndex < 0)) {
      throw createValidationError(
        "RegexExtractor pattern groupIndex is invalid.",
        "patterns[" + index + "].groupIndex should be an integer greater than or equal to 0.",
        "patterns[" + index + "].groupIndex was " + String(pattern.groupIndex) + ".",
        context
      );
    }

    if (hasGroupName && (typeof pattern.groupName !== "string" || pattern.groupName.trim().length < 1)) {
      throw createValidationError(
        "RegexExtractor pattern groupName is invalid.",
        "patterns[" + index + "].groupName should be a non-empty string.",
        "patterns[" + index + "].groupName was " + String(pattern.groupName) + ".",
        context
      );
    }

    if (typeof pattern.required !== "undefined" && typeof pattern.required !== "boolean") {
      throw createValidationError(
        "RegexExtractor pattern required must be a boolean when provided.",
        "patterns[" + index + "].required should be true or false.",
        "patterns[" + index + "].required was " + String(pattern.required) + ".",
        context
      );
    }

    if (typeof pattern.flags !== "undefined" && typeof pattern.flags !== "string") {
      throw createValidationError(
        "RegexExtractor pattern flags must be a string when provided.",
        "patterns[" + index + "].flags should be a regex flags string.",
        "patterns[" + index + "].flags was " + describeValue(pattern.flags) + ".",
        context
      );
    }
  }

  function buildRegex(pattern, context) {
    try {
      return new RegExp(pattern.regex, pattern.flags || "");
    } catch (error) {
      throw createValidationError(
        "RegexExtractor pattern regex could not be compiled.",
        "Pattern \"" + pattern.name + "\" should contain a valid JavaScript regular expression.",
        "Regex compilation failed with " + String(error && error.message ? error.message : error) + ".",
        context
      );
    }
  }

  function readMatchValue(match, pattern, context) {
    if (typeof pattern.groupName === "string" && pattern.groupName.trim().length > 0) {
      const namedGroups = match && match.groups ? match.groups : null;
      const value = namedGroups ? namedGroups[pattern.groupName] : undefined;

      if (typeof value === "undefined") {
        throw createValidationError(
          "RegexExtractor groupName did not resolve to a captured group.",
          "Pattern \"" + pattern.name + "\" should capture a group named \"" + pattern.groupName + "\".",
          "No named group \"" + pattern.groupName + "\" was present in the match result.",
          context
        );
      }

      return value;
    }

    const value = match ? match[pattern.groupIndex] : undefined;
    if (typeof value === "undefined") {
      throw createValidationError(
        "RegexExtractor groupIndex did not resolve to a captured group.",
        "Pattern \"" + pattern.name + "\" should capture index " + String(pattern.groupIndex) + ".",
        "No capture group existed at index " + String(pattern.groupIndex) + ".",
        context
      );
    }

    return value;
  }

  function extract(input, context) {
    ensureExtractInput(input, context);

    const scopedContext = Object.assign({}, context || {});
    const result = {
      status: "no_match",
      variables: {},
      matches: [],
      errors: []
    };

    input.patterns.forEach(function extractPattern(pattern, index) {
      validatePattern(pattern, index, scopedContext);

      const regex = buildRegex(pattern, scopedContext);
      const match = input.text.match(regex);

      if (!match) {
        result.matches.push({
          name: pattern.name,
          value: null,
          matched: false
        });

        if (pattern.required === true) {
          result.errors.push(createPatternFailure(
            "REGEX_REQUIRED_MATCH_MISSING",
            "Required regex pattern did not match the text.",
            "Pattern \"" + pattern.name + "\" should match the provided text.",
            "No match was found for regex " + pattern.regex + ".",
            pattern.name,
            scopedContext
          ));
        }
        return;
      }

      const value = readMatchValue(match, pattern, scopedContext);
      result.variables[pattern.name] = value;
      result.matches.push({
        name: pattern.name,
        value: value,
        matched: true
      });
    });

    if (result.errors.length) {
      result.status = "failed";
      return result;
    }

    const matchedCount = result.matches.filter(function isMatched(entry) {
      return entry.matched === true;
    }).length;

    result.status = matchedCount > 0 ? "matched" : "no_match";
    return result;
  }

  NewSiteCore.RegexExtractor = {
    extract: extract
  };
})(globalThis);
