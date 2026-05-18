(function initDeepSeekComposerProbe(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};
  const Selectors = DeepSeekAutomation.DeepSeekSelectors;
  const DomHelpers = DeepSeekAutomation.DeepSeekDomHelpers;

  const SEND_ICON_PREFIX = "M8.3125 0.981587";
  const ATTACH_ICON_PREFIX = "M5.5498 9.75V5";

  function queryVisibleElement(selector) {
    const elements = Selectors.queryAllSafe(selector);
    return elements.find(Selectors.isElementVisible) || elements[0] || null;
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getFileExtension(filePath, fallbackName) {
    const source = String(filePath || fallbackName || "").toLowerCase();
    const match = source.match(/(\.[a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function getSelectedFileName(workflowInput, context) {
    if (context && context.attachedFile && context.attachedFile.name) {
      return context.attachedFile.name;
    }
    if (workflowInput && workflowInput.selectedFile && workflowInput.selectedFile.name) {
      return workflowInput.selectedFile.name;
    }
    if (workflowInput && workflowInput.filePayload && workflowInput.filePayload.name) {
      return workflowInput.filePayload.name;
    }
    const filePath = workflowInput && workflowInput.filePath ? String(workflowInput.filePath) : "";
    if (!filePath) {
      return "";
    }
    const segments = filePath.split(/[\\/]/);
    return segments[segments.length - 1] || "";
  }

  function normalizeFileNameForMatch(name) {
    return normalizeText(String(name || "")
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9]+/g, " "));
  }

  function getTextareaForHeuristic(profile, context) {
    return (context && context.chatInput) || queryVisibleElement(profile.selectors.chatInput)
      || queryVisibleElement(profile.selectors.chatInputFallback)
      || queryVisibleElement("textarea[placeholder='Message DeepSeek'], textarea[name='search'], textarea");
  }

  function getComposerRect(profile, context) {
    const textarea = getTextareaForHeuristic(profile, context);
    return textarea ? textarea.getBoundingClientRect() : null;
  }

  function isElementNearComposerRect(rect, composerRect) {
    if (!rect) {
      return false;
    }
    if (!composerRect) {
      return rect.x >= 0 && rect.x <= window.innerWidth && rect.y >= 150 && rect.y <= window.innerHeight;
    }
    return rect.right >= composerRect.left - 120
      && rect.left <= composerRect.right + 120
      && rect.bottom >= composerRect.top - 220
      && rect.top <= composerRect.bottom + 220;
  }

  function isCandidateOnRightSideOfComposer(rect, composerRect) {
    if (!rect || !composerRect) {
      return false;
    }
    return rect.left >= composerRect.left + Math.max(0, composerRect.width - 220);
  }

  function getVisibleButtonsNearComposer(profile, context) {
    const composerRect = getComposerRect(profile, context);
    return Array.from(document.querySelectorAll("[role='button'], button"))
      .filter(function filterButton(element) {
        if (!Selectors.isElementVisible(element)) {
          return false;
        }
        if (!composerRect) {
          return true;
        }
        const rect = element.getBoundingClientRect();
        return rect.y >= composerRect.y - 40 && rect.y <= composerRect.y + 180;
      })
      .slice(0, 10)
      .map(DomHelpers.getElementSummary);
  }

  function getAttachmentCandidateText(element) {
    return normalizeText(element && (element.innerText || element.textContent || ""));
  }

  function findAttachmentCandidatesNearComposer(profile, context) {
    const composerRect = getComposerRect(profile, context);
    const selectorElements = Selectors.queryAllSafe(profile.selectors.fileAttachedIndicator || "");
    const bodyElements = Array.from(document.querySelectorAll("body *"));
    const seen = new Set();

    return selectorElements.concat(bodyElements)
      .filter(function keepCandidate(element) {
        if (!element || seen.has(element)) {
          return false;
        }
        seen.add(element);
        if (!Selectors.isElementVisible(element)) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width < 24 || rect.height < 12) {
          return false;
        }
        if (!isElementNearComposerRect(rect, composerRect)) {
          return false;
        }
        const haystack = [
          getAttachmentCandidateText(element).toLowerCase(),
          String(element.className || "").toLowerCase(),
          String(element.getAttribute("aria-label") || "").toLowerCase(),
          String(element.getAttribute("title") || "").toLowerCase()
        ].join(" ");
        return haystack.includes(".xlsx")
          || haystack.includes(".xls")
          || haystack.includes("xlsx")
          || haystack.includes("xls")
          || haystack.includes("file");
      })
      .map(function mapCandidate(element) {
        const rect = element.getBoundingClientRect();
        return {
          element: element,
          rect: rect,
          text: getAttachmentCandidateText(element),
          area: rect.width * rect.height,
          nearComposer: isElementNearComposerRect(rect, composerRect)
        };
      });
  }

  function isUploadProgressVisibleNearComposer(profile, context) {
    const composerRect = getComposerRect(profile, context);
    const progressCandidates = [];
    const selectorElement = queryVisibleElement(profile.selectors.progressIndicator);
    if (selectorElement) {
      progressCandidates.push(selectorElement);
    }
    Array.from(document.querySelectorAll("[role='progressbar'], [aria-busy='true'], [class*='progress' i], [class*='upload' i], [class*='loading' i]"))
      .forEach(function addCandidate(element) {
        progressCandidates.push(element);
      });

    return progressCandidates.some(function matches(element) {
      return Boolean(element && Selectors.isElementVisible(element) && isElementNearComposerRect(element.getBoundingClientRect(), composerRect));
    });
  }

  function probeAttachmentState(profile, workflowInput, context) {
    const startedAt = context && typeof context.attachmentConfirmStartedAt === "number" ? context.attachmentConfirmStartedAt : Date.now();
    const attempts = context && typeof context.attachmentConfirmAttempts === "number" ? context.attachmentConfirmAttempts : 0;
    const fileNameExpected = getSelectedFileName(workflowInput, context);
    const normalizedFileName = normalizeFileNameForMatch(fileNameExpected);
    const normalizedTokens = normalizedFileName ? normalizedFileName.split(/\s+/).filter(Boolean) : [];
    const uniqueToken = normalizedTokens.slice().sort(function sortTokens(left, right) {
      return right.length - left.length;
    }).find(function pickToken(token) {
      return token.length >= 4;
    }) || "";
    const candidates = findAttachmentCandidatesNearComposer(profile, context);
    const uploadProgressVisible = isUploadProgressVisibleNearComposer(profile, context);
    let bestCandidate = null;

    candidates.forEach(function inspectCandidate(candidate) {
      const lowerText = candidate.text.toLowerCase();
      const normalizedText = normalizeFileNameForMatch(candidate.text);
      const matchedByFileName = Boolean(fileNameExpected) && (
        lowerText.includes(String(fileNameExpected).toLowerCase())
        || (normalizedFileName && normalizedText.includes(normalizedFileName))
        || (uniqueToken && normalizedText.includes(uniqueToken))
      );
      const matchedByExtension = lowerText.includes(".xlsx")
        || lowerText.includes(".xls")
        || lowerText.includes("xlsx")
        || lowerText.includes("xls");
      const score = (matchedByFileName ? 100 : 0) + (matchedByExtension ? 10 : 0) + (candidate.nearComposer ? 5 : 0) - Math.min(candidate.area / 1000, 20);

      if (!bestCandidate || score > bestCandidate.score || (score === bestCandidate.score && candidate.area < bestCandidate.area)) {
        bestCandidate = {
          score: score,
          area: candidate.area,
          matchedText: candidate.text,
          matchedByFileName: matchedByFileName,
          matchedByExtension: matchedByExtension,
          nearComposer: candidate.nearComposer,
          attachmentElementSummary: DomHelpers.getElementSummary(candidate.element)
        };
      }
    });

    const attachmentReady = Boolean(
      bestCandidate
      && bestCandidate.matchedByFileName
      && bestCandidate.matchedByExtension
      && bestCandidate.nearComposer
      && !uploadProgressVisible
    );
    const blockingCondition = attachmentReady
      ? ""
      : !bestCandidate
        ? "attachmentCandidateMissing"
        : !bestCandidate.matchedByFileName
          ? "attachmentFileNameMismatch"
          : !bestCandidate.matchedByExtension
            ? "attachmentExtensionMissing"
            : uploadProgressVisible
              ? "uploadProgressVisible"
              : "attachmentReady";

    return {
      attachmentReady: attachmentReady,
      blockingCondition: blockingCondition,
      attachmentVisible: Boolean(bestCandidate),
      fileNameExpected: fileNameExpected || "",
      expectedExtension: getFileExtension(workflowInput && workflowInput.filePath, fileNameExpected),
      matchedText: bestCandidate ? bestCandidate.matchedText : "",
      matchedByFileName: Boolean(bestCandidate && bestCandidate.matchedByFileName),
      matchedByExtension: Boolean(bestCandidate && bestCandidate.matchedByExtension),
      nearComposer: Boolean(bestCandidate && bestCandidate.nearComposer),
      uploadProgressVisible: uploadProgressVisible,
      attachmentElementSummary: bestCandidate ? bestCandidate.attachmentElementSummary : null,
      visibleButtonsNearComposer: getVisibleButtonsNearComposer(profile, context),
      elapsedMs: Math.max(0, Date.now() - startedAt),
      attempts: attempts,
      composerPresent: Boolean(getComposerRect(profile, context)),
      attachmentSelectorUsed: profile.selectors.fileAttachedIndicator || "",
      missingSignals: attachmentReady
        ? []
        : [
          bestCandidate ? "" : "No nearby file-card candidate matched the expected attachment.",
          bestCandidate && !bestCandidate.matchedByFileName ? "The matched attachment candidate did not contain the expected file name." : "",
          bestCandidate && !bestCandidate.matchedByExtension ? "The matched attachment candidate did not show an Excel file indicator." : "",
          uploadProgressVisible ? "An upload or progress indicator remains visible near the composer." : ""
        ].filter(Boolean)
    };
  }

  function getComposerValue(element) {
    if (!element) {
      return "";
    }
    if (typeof element.value === "string") {
      return element.value;
    }
    return String(element.innerText || element.textContent || "");
  }

  function probePromptState(profile, workflowInput, context) {
    const composer = getTextareaForHeuristic(profile, context);
    const promptText = workflowInput && workflowInput.promptText ? workflowInput.promptText : "";
    const normalizedExpected = normalizeText(promptText);
    const currentValue = getComposerValue(composer);
    const normalizedCurrent = normalizeText(currentValue);
    const promptReady = Boolean(normalizedExpected) && normalizedCurrent.includes(normalizedExpected);

    return {
      promptReady: promptReady,
      blockingCondition: promptReady ? "" : "promptReady",
      promptValueLength: currentValue.length,
      expectedPromptLength: promptText.length,
      composerElementSummary: composer ? DomHelpers.getElementSummary(composer) : null,
      currentPromptPreview: currentValue.slice(0, 160)
    };
  }

  function extractCandidateKeywords(element) {
    const text = normalizeText(element && (element.innerText || element.textContent || ""));
    const ariaLabel = normalizeText(element && element.getAttribute("aria-label"));
    const title = normalizeText(element && element.getAttribute("title"));
    return {
      text: text,
      ariaLabel: ariaLabel,
      title: title,
      haystack: [text, ariaLabel, title].join(" ").toLowerCase()
    };
  }

  function getSvgPathSignature(element) {
    if (!element || typeof element.querySelectorAll !== "function") {
      return [];
    }
    return Array.from(element.querySelectorAll("svg path"))
      .map(function mapPath(path) {
        return normalizeText(path.getAttribute("d"));
      })
      .filter(Boolean);
  }

  function hasSvgPathStartingWith(element, prefix) {
    if (!prefix) {
      return false;
    }
    return getSvgPathSignature(element).some(function matches(pathD) {
      return pathD.startsWith(prefix);
    });
  }

  function isArrowUpSendPath(pathD) {
    return Boolean(pathD) && (
      pathD.includes(SEND_ICON_PREFIX)
      || (pathD.includes("M8.3125") && pathD.includes("L14.707") && pathD.includes("V15.0431"))
    );
  }

  function isPaperclipAttachPath(pathD) {
    return Boolean(pathD) && (
      pathD.includes(ATTACH_ICON_PREFIX)
      || (pathD.includes("M5.5498") && pathD.includes("V5") && pathD.includes("9.75"))
    );
  }

  function isArrowUpSendIcon(element) {
    return getSvgPathSignature(element).some(isArrowUpSendPath);
  }

  function isPaperclipAttachIcon(element) {
    return getSvgPathSignature(element).some(isPaperclipAttachPath);
  }

  function getSvgSignature(element) {
    const paths = getSvgPathSignature(element);
    if (paths.some(isArrowUpSendPath)) {
      return "arrow_up_send";
    }
    if (paths.some(isPaperclipAttachPath)) {
      return "paperclip_attach";
    }
    return paths.length ? "unknown" : "none";
  }

  function getCandidateIdentity(element, svgSignature, keywords) {
    const tagName = String(element && element.tagName || "").toLowerCase();
    const role = String(element && element.getAttribute && element.getAttribute("role") || "").toLowerCase();
    const className = normalizeText(String(element && element.className || ""))
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .filter(function keep(token) {
        return token.indexOf("ds-icon-button") >= 0 || token === "disabled";
      })
      .join(".");
    const text = normalizeText(keywords && keywords.text || "").toLowerCase();
    return [tagName, role, svgSignature, className || "no-class", text || "no-text"].join("|");
  }

  function getDisabledSignals(element, profile, uploadProgressVisible) {
    const signals = [];
    if (!element) {
      signals.push("missing_candidate");
      return signals;
    }

    const className = String(element.className || "").toLowerCase();
    const ariaDisabled = String(element.getAttribute("aria-disabled") || "").toLowerCase();
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    if (element.disabled === true) {
      signals.push("disabled_property_true");
    }
    if (element.hasAttribute("disabled")) {
      signals.push("has_disabled_attribute");
    }
    if (ariaDisabled === "true") {
      signals.push("aria_disabled_true");
    }
    if (className.includes("ds-icon-button--disabled")) {
      signals.push("class_contains_ds_icon_button_disabled");
    }
    if (!className.includes("ds-icon-button--disabled") && className.includes("disabled")) {
      signals.push("class_contains_disabled");
    }
    if (String(element.getAttribute("aria-busy") || "").toLowerCase() === "true") {
      signals.push("aria_busy_true");
    }
    if (className.includes("loading")) {
      signals.push("class_contains_loading");
    }
    if (uploadProgressVisible) {
      signals.push("upload_progress_visible");
    }
    try {
      if (profile.selectors.sendButtonDisabledIndicator && element.matches(profile.selectors.sendButtonDisabledIndicator)) {
        signals.push("profile_disabled_indicator");
      }
    } catch (error) {
      signals.push("disabled_indicator_selector_error");
    }
    if (style.display === "none") {
      signals.push("display_none");
    }
    if (style.visibility === "hidden") {
      signals.push("visibility_hidden");
    }
    if (rect.width <= 0 || rect.height <= 0) {
      signals.push("zero_sized");
    }
    if (style.opacity === "0.4") {
      signals.push("opacity_0_4");
    }
    if (!Selectors.isElementClickable(element)) {
      signals.push("not_clickable");
    }
    return signals;
  }

  function getPrimaryDisabledReason(disabledSignals) {
    return Array.isArray(disabledSignals) && disabledSignals.length ? disabledSignals[0] : "";
  }

  function getButtonLikeCandidatesNearComposer(profile, context) {
    const composerRect = getComposerRect(profile, context);
    const seen = new Set();
    return Array.from(document.querySelectorAll("[role='button'], button"))
      .map(function resolveCandidate(element) {
        const buttonLikeParent = element.closest("[role='button'], button");
        return buttonLikeParent || element;
      })
      .filter(function keep(element) {
        if (!element || seen.has(element)) {
          return false;
        }
        seen.add(element);
        if (!Selectors.isElementVisible(element)) {
          return false;
        }
        return isElementNearComposerRect(element.getBoundingClientRect(), composerRect);
      });
  }

  function inspectSendButtonCandidate(element, profile, composerRect, uploadProgressVisible) {
    const rect = element.getBoundingClientRect();
    const keywords = extractCandidateKeywords(element);
    const type = String(element.getAttribute("type") || "").toLowerCase();
    const svgDetectionEnabled = !(profile && profile.behavior && profile.behavior.enableSvgSendButtonDetection === false);
    const matchesProfileSelector = (function checkProfileSelector() {
      try {
        return Boolean(profile.selectors.sendButton && element.matches(profile.selectors.sendButton));
      } catch (error) {
        return false;
      }
    })();
    const svgSignature = svgDetectionEnabled ? getSvgSignature(element) : "none";
    const selectionReasons = [];
    const rejectionReasons = [];
    let candidateRole = "unknown";
    let selectionScore = 0;

    if (/deepthink|search/.test(keywords.haystack)) {
      candidateRole = "known_non_send";
      rejectionReasons.push("known_non_send_control");
    } else if (svgSignature === "paperclip_attach" || /attach|upload|paperclip|file/.test(keywords.haystack)) {
      candidateRole = "attach";
      rejectionReasons.push(svgSignature === "paperclip_attach" ? "paperclip_attach_svg" : "attachment_control");
    } else if ((svgDetectionEnabled && svgSignature === "arrow_up_send") || type === "submit" || /send/.test(keywords.haystack) || matchesProfileSelector) {
      candidateRole = "send";
    }

    if (matchesProfileSelector) {
      selectionScore += 100;
      selectionReasons.push("matches_profile_selector");
    }
    if (type === "submit") {
      selectionScore += 40;
      selectionReasons.push("submit_type");
    }
    if (/send/.test(keywords.haystack)) {
      selectionScore += 35;
      selectionReasons.push("send_keyword");
    }
    if (svgSignature === "arrow_up_send") {
      selectionScore += 120;
      selectionReasons.push("arrow_up_svg");
    }
    if (svgSignature === "paperclip_attach") {
      selectionScore -= 120;
    }
    if (element.tagName === "BUTTON") {
      selectionScore += 10;
    }
    if (String(element.getAttribute("role") || "").toLowerCase() === "button") {
      selectionScore += 5;
    }
    if (isCandidateOnRightSideOfComposer(rect, composerRect)) {
      selectionScore += 15;
      selectionReasons.push("right_side_of_composer");
    }
    if (String(element.className || "").toLowerCase().includes("ds-icon-button")) {
      selectionScore += 10;
      selectionReasons.push("ds_icon_button_class");
    }
    if (!isElementNearComposerRect(rect, composerRect)) {
      rejectionReasons.push("not_near_composer");
    } else {
      selectionReasons.push("near_composer");
    }

    if (candidateRole !== "send" && rejectionReasons.length === 0) {
      rejectionReasons.push("not_classified_as_send");
    }

    const disabledSignals = getDisabledSignals(element, profile, uploadProgressVisible);
    const candidateIdentity = getCandidateIdentity(element, svgSignature, keywords);
    const elementSummary = DomHelpers.getElementSummary(element);

    return {
      element: element,
      candidateIdentity: candidateIdentity,
      candidateRole: candidateRole,
      svgSignature: svgSignature,
      selectionScore: selectionScore,
      selectionReasons: selectionReasons,
      rejectionReasons: rejectionReasons,
      disabledSignals: disabledSignals,
      disabledReason: getPrimaryDisabledReason(disabledSignals),
      matchesProfileSelector: matchesProfileSelector,
      keywords: keywords,
      rightSideOfComposer: isCandidateOnRightSideOfComposer(rect, composerRect),
      elementSummary: elementSummary
    };
  }

  function summarizeSendCandidate(candidate) {
    if (!candidate) {
      return null;
    }
    return {
      summary: candidate.elementSummary,
      candidateIdentity: candidate.candidateIdentity,
      svgSignature: candidate.svgSignature,
      candidateRole: candidate.candidateRole,
      selectionScore: candidate.selectionScore,
      selectionReasons: candidate.selectionReasons.slice(),
      rejectionReasons: candidate.rejectionReasons.slice(),
      disabledSignals: candidate.disabledSignals.slice()
    };
  }

  function probeSendButtonState(profile, workflowInput, context) {
    const composerRect = getComposerRect(profile, context);
    const uploadProgressVisible = isUploadProgressVisibleNearComposer(profile, context);
    const inspectedCandidates = getButtonLikeCandidatesNearComposer(profile, context)
      .map(function inspect(element) {
        return inspectSendButtonCandidate(element, profile, composerRect, uploadProgressVisible);
      })
      .sort(function sortCandidates(left, right) {
        return right.selectionScore - left.selectionScore;
      });

    const acceptedCandidates = inspectedCandidates.filter(function filterAccepted(candidate) {
      return candidate.candidateRole === "send" && candidate.rejectionReasons.length === 0;
    });
    const selectedCandidate = acceptedCandidates[0] || null;
    const sendButtonCandidateFound = Boolean(selectedCandidate);
    const disabledReason = selectedCandidate ? selectedCandidate.disabledReason : "no_send_candidate_found";
    const sendButtonReady = Boolean(sendButtonCandidateFound && selectedCandidate.disabledSignals.length === 0);
    const likelyWrongCandidate = inspectedCandidates.find(function findWrongCandidate(candidate) {
      return (candidate.candidateRole === "attach" || candidate.candidateRole === "known_non_send")
        && candidate.rightSideOfComposer
        && candidate.selectionScore >= 0;
    }) || null;

    return {
      sendButtonCandidateFound: sendButtonCandidateFound,
      sendButtonReady: sendButtonReady,
      disabledReason: disabledReason,
      disabledSignals: selectedCandidate ? selectedCandidate.disabledSignals.slice() : [],
      wrongCandidateLikely: Boolean(!selectedCandidate && likelyWrongCandidate),
      wrongCandidateEvidence: likelyWrongCandidate ? summarizeSendCandidate(likelyWrongCandidate) : null,
      selectedCandidateReason: selectedCandidate
        ? selectedCandidate.selectionReasons.join("_")
        : "",
      selectedCandidate: selectedCandidate ? Object.assign({}, selectedCandidate.elementSummary, {
        candidateIdentity: selectedCandidate.candidateIdentity,
        candidateRole: selectedCandidate.candidateRole,
        svgSignature: selectedCandidate.svgSignature,
        selectionScore: selectedCandidate.selectionScore,
        selectionReasons: selectedCandidate.selectionReasons.slice(),
        disabledSignals: selectedCandidate.disabledSignals.slice(),
        foundBy: selectedCandidate.matchesProfileSelector ? "profile-selector+heuristic" : "heuristic"
      }) : null,
      candidateSummaries: inspectedCandidates.slice(0, 8).map(summarizeSendCandidate),
      rejectedCandidates: inspectedCandidates
        .filter(function filterRejected(candidate) {
          return candidate.rejectionReasons.length > 0;
        })
        .slice(0, 8)
        .map(summarizeSendCandidate),
      visibleButtonsNearComposer: getVisibleButtonsNearComposer(profile, context),
      uploadProgressVisible: uploadProgressVisible,
      foundBy: selectedCandidate
        ? (selectedCandidate.matchesProfileSelector ? "profile-selector+heuristic" : "heuristic")
        : "none",
      element: selectedCandidate ? selectedCandidate.element : null
    };
  }

  function probeComposerReadyToSend(profile, workflowInput, context) {
    const startedAt = context && typeof context.composerReadyStartedAt === "number" ? context.composerReadyStartedAt : Date.now();
    const attempts = context && typeof context.composerReadyAttempts === "number" ? context.composerReadyAttempts : 0;
    const attachmentEvidence = probeAttachmentState(profile, workflowInput, context);
    const promptEvidence = probePromptState(profile, workflowInput, context);
    const sendButtonEvidence = probeSendButtonState(profile, workflowInput, context);
    const ready = attachmentEvidence.attachmentReady && promptEvidence.promptReady && sendButtonEvidence.sendButtonReady;
    const blockingCondition = ready
      ? ""
      : !attachmentEvidence.attachmentReady
        ? attachmentEvidence.blockingCondition || "attachmentReady"
        : !promptEvidence.promptReady
          ? "promptReady"
          : !sendButtonEvidence.sendButtonCandidateFound
            ? "sendButtonCandidateFound"
            : "sendButtonReady";

    return {
      ready: ready,
      blockingCondition: blockingCondition,
      attachmentReady: attachmentEvidence.attachmentReady,
      attachmentEvidence: attachmentEvidence,
      promptReady: promptEvidence.promptReady,
      promptValueLength: promptEvidence.promptValueLength,
      expectedPromptLength: promptEvidence.expectedPromptLength,
      promptEvidence: promptEvidence,
      sendButtonReady: sendButtonEvidence.sendButtonReady,
      sendButtonEvidence: Object.assign({}, sendButtonEvidence, { element: undefined }),
      uploadProgressVisible: Boolean(attachmentEvidence.uploadProgressVisible || sendButtonEvidence.uploadProgressVisible),
      attempts: attempts,
      elapsedMs: Math.max(0, Date.now() - startedAt),
      readinessFailures: [
        attachmentEvidence.attachmentReady ? "" : "Attachment is not currently ready near the composer.",
        promptEvidence.promptReady ? "" : "The expected prompt text is not present in the composer.",
        sendButtonEvidence.sendButtonCandidateFound ? "" : "No valid send button candidate was found near the composer.",
        sendButtonEvidence.sendButtonReady ? "" : (sendButtonEvidence.disabledReason || "The send button is not ready.")
      ].filter(Boolean)
    };
  }

  function probeSubmitEffect(profile, workflowInput, context) {
    const sendButtonState = probeSendButtonState(profile, workflowInput, context);
    const promptState = probePromptState(profile, workflowInput, context);
    const attachmentState = probeAttachmentState(profile, workflowInput, context);
    const generatingIndicator = queryVisibleElement(profile.selectors.generatingIndicator || "");
    const submitEffectObserved = Boolean(
      generatingIndicator
      || !sendButtonState.sendButtonReady
      || !promptState.promptReady
    );

    return {
      submitEffectObserved: submitEffectObserved,
      blockingCondition: submitEffectObserved ? "" : "submitEffectObserved",
      generatingIndicatorVisible: Boolean(generatingIndicator),
      promptStillPresent: promptState.promptReady,
      sendButtonStillReady: sendButtonState.sendButtonReady,
      attachmentStillReady: attachmentState.attachmentReady,
      selectedCandidate: sendButtonState.selectedCandidate,
      sendButtonEvidence: Object.assign({}, sendButtonState, { element: undefined })
    };
  }

  DeepSeekAutomation.DeepSeekComposerProbe = {
    getVisibleButtonsNearComposer: getVisibleButtonsNearComposer,
    getSvgPathSignature: getSvgPathSignature,
    hasSvgPathStartingWith: hasSvgPathStartingWith,
    isArrowUpSendIcon: isArrowUpSendIcon,
    isPaperclipAttachIcon: isPaperclipAttachIcon,
    probeAttachmentState: probeAttachmentState,
    probePromptState: probePromptState,
    probeSendButtonState: probeSendButtonState,
    probeComposerReadyToSend: probeComposerReadyToSend,
    probeSubmitEffect: probeSubmitEffect
  };
})(globalThis);
