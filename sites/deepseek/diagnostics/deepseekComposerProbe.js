(function initDeepSeekComposerProbe(globalScope) {
  const DeepSeekAutomation = globalScope.DeepSeekAutomation = globalScope.DeepSeekAutomation || {};
  const Selectors = DeepSeekAutomation.DeepSeekSelectors;
  const DomHelpers = DeepSeekAutomation.DeepSeekDomHelpers;

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
    const text = normalizeText(element && (element.innerText || element.textContent || "")).toLowerCase();
    const ariaLabel = normalizeText(element && element.getAttribute("aria-label")).toLowerCase();
    const title = normalizeText(element && element.getAttribute("title")).toLowerCase();
    return {
      text: text,
      ariaLabel: ariaLabel,
      title: title,
      haystack: [text, ariaLabel, title].join(" ")
    };
  }

  function getSendButtonDisabledReasonCode(element, profile, uploadProgressVisible) {
    if (!element) {
      return "no_send_candidate_found";
    }
    if (element.disabled) {
      return "candidate_disabled_property";
    }
    if (String(element.getAttribute("aria-disabled") || "").toLowerCase() === "true") {
      return "candidate_aria_disabled";
    }
    if (String(element.className || "").toLowerCase().includes("disabled")) {
      return "candidate_has_disabled_class";
    }
    if (String(element.className || "").toLowerCase().includes("loading") || String(element.getAttribute("aria-busy") || "").toLowerCase() === "true") {
      return "candidate_loading";
    }
    if (uploadProgressVisible) {
      return "upload_progress_visible";
    }
    try {
      if (profile.selectors.sendButtonDisabledIndicator && element.matches(profile.selectors.sendButtonDisabledIndicator)) {
        return "profile_disabled_indicator";
      }
    } catch (error) {
      return "disabled_indicator_selector_error";
    }
    if (!Selectors.isElementClickable(element)) {
      return "candidate_not_clickable";
    }
    return "";
  }

  function probeSendButtonState(profile, workflowInput, context) {
    const composerRect = getComposerRect(profile, context);
    const uploadProgressVisible = isUploadProgressVisibleNearComposer(profile, context);
    const rawCandidates = Array.from(document.querySelectorAll("[role='button'], button"))
      .filter(function onlyVisibleNearComposer(element) {
        return Boolean(Selectors.isElementVisible(element) && isElementNearComposerRect(element.getBoundingClientRect(), composerRect));
      })
      .map(function inspectCandidate(element) {
        const rect = element.getBoundingClientRect();
        const keywords = extractCandidateKeywords(element);
        const type = String(element.getAttribute("type") || "").toLowerCase();
        const matchesProfileSelector = (function checkProfileSelector() {
          try {
            return Boolean(profile.selectors.sendButton && element.matches(profile.selectors.sendButton));
          } catch (error) {
            return false;
          }
        })();
        const rejectionReasons = [];
        let score = 0;

        if (/deepthink|search/.test(keywords.haystack)) {
          rejectionReasons.push("known_non_send_control");
        }
        if (/attach|upload|paperclip|file/.test(keywords.haystack)) {
          rejectionReasons.push("attachment_control");
        }
        if (type === "submit") {
          score += 40;
        }
        if (/send/.test(keywords.haystack)) {
          score += 35;
        }
        if (matchesProfileSelector) {
          score += 100;
        }
        if (element.tagName === "BUTTON") {
          score += 10;
        }
        if (composerRect && rect.x > composerRect.x + Math.max(0, composerRect.width - 180)) {
          score += 10;
        }

        const disabledReason = getSendButtonDisabledReasonCode(element, profile, uploadProgressVisible);
        return {
          element: element,
          score: score,
          matchesProfileSelector: matchesProfileSelector,
          rejectionReasons: rejectionReasons,
          disabledReason: disabledReason,
          elementSummary: DomHelpers.getElementSummary(element)
        };
      })
      .sort(function sortCandidates(left, right) {
        return right.score - left.score;
      });

    const acceptedCandidates = rawCandidates.filter(function filterAccepted(candidate) {
      return candidate.rejectionReasons.length === 0 && candidate.score >= 35;
    });
    const selectedCandidate = acceptedCandidates[0] || null;
    const topRejectedProfileCandidate = rawCandidates.find(function findRejected(candidate) {
      return candidate.matchesProfileSelector && candidate.rejectionReasons.length;
    }) || null;
    const sendButtonCandidateFound = Boolean(selectedCandidate);
    const disabledReason = selectedCandidate ? selectedCandidate.disabledReason : (topRejectedProfileCandidate ? "only_non_send_controls_visible" : "no_send_candidate_found");
    const sendButtonReady = Boolean(sendButtonCandidateFound && !disabledReason);
    const wrongCandidateLikely = Boolean(!selectedCandidate && topRejectedProfileCandidate);

    return {
      sendButtonCandidateFound: sendButtonCandidateFound,
      sendButtonReady: sendButtonReady,
      disabledReason: disabledReason,
      wrongCandidateLikely: wrongCandidateLikely,
      selectedCandidate: selectedCandidate ? Object.assign({}, selectedCandidate.elementSummary, {
        foundBy: selectedCandidate.matchesProfileSelector ? "profile-selector" : "heuristic",
        score: selectedCandidate.score
      }) : null,
      rejectedCandidates: rawCandidates
        .filter(function filterRejected(candidate) {
          return candidate.rejectionReasons.length > 0;
        })
        .slice(0, 8)
        .map(function mapRejected(candidate) {
          return {
            summary: candidate.elementSummary,
            reasons: candidate.rejectionReasons.slice()
          };
        }),
      visibleButtonsNearComposer: getVisibleButtonsNearComposer(profile, context),
      uploadProgressVisible: uploadProgressVisible,
      foundBy: selectedCandidate ? (selectedCandidate.matchesProfileSelector ? "profile-selector" : "heuristic") : "none",
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
    probeAttachmentState: probeAttachmentState,
    probePromptState: probePromptState,
    probeSendButtonState: probeSendButtonState,
    probeComposerReadyToSend: probeComposerReadyToSend,
    probeSubmitEffect: probeSubmitEffect
  };
})(globalThis);
