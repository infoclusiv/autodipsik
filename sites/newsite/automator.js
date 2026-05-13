(function initAutomator(globalScope) {
  const NewSiteAutomation = globalScope.NewSiteAutomation = globalScope.NewSiteAutomation || {};
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};
  const siteConfig = NewSiteAutomation.NEWSITE_CONFIG;
  const contracts = NewSiteAutomation.SiteProfileContract;
  const Selectors = NewSiteAutomation.Selectors;
  const DomHelpers = NewSiteAutomation.DomHelpers;
  const PageState = NewSiteAutomation.PageState;
  const WorkflowRunner = NewSiteCore.WorkflowRunner;
  const Errors = NewSiteCore.Errors;

  function delay(ms) {
    return new Promise(function wait(resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function testAllSelectors(options) {
    const profile = options.profile;
    const traceId = options.traceId;
    const results = [];
    const keys = Object.keys(profile.selectors || {});

    for (const key of keys) {
      results.push(await Selectors.testSelector({
        selectorName: key,
        selector: profile.selectors[key]
      }));
    }

    return {
      status: "completed",
      traceId: traceId,
      selectorHealth: results
    };
  }

  async function runMainAutomation(options) {
    const profile = options.profile;
    const input = options.input || {};
    const traceId = options.traceId;

    const steps = [
      {
        name: "detect_initial_page_state",
        description: "Detect the current page state before automation",
        expected: "A structured page state should be detected.",
        run: async function runStep() {
          return PageState.detectPageState(profile);
        }
      },
      {
        name: "validate_required_selectors",
        description: "Validate required selectors for the main workflow",
        expected: "Required selectors should be present in the site profile.",
        run: async function runStep() {
          const missing = contracts.requiredSelectorsForMainWorkflow.filter(function missingRequired(key) {
            return !profile.selectors[key];
          });
          if (missing.length) {
            throw Errors.createError("PROFILE_INVALID", "Required selectors are missing.", {
              expected: "The site profile must define required selectors.",
              actual: "Missing selector keys: " + missing.join(", "),
              nextChecks: [
                "Open the Site Profile tab and configure the missing selectors.",
                "Run Test All before trying the main workflow again."
              ]
            });
          }
          return { missing: [] };
        }
      },
      {
        name: "perform_primary_action",
        description: "Click the main process button when not in dry run mode",
        expected: "The configured process button should become clickable and trigger processing.",
        run: async function runStep() {
          if (input.dryRun) {
            return { skipped: true, reason: "dry_run" };
          }

          const selector = profile.selectors.processButton;
          const button = await Selectors.waitForSelector({
            selector: selector,
            timeoutMs: profile.timing.elementWaitTimeoutMs,
            pollIntervalMs: profile.timing.pollIntervalMs
          });

          if (!button) {
            throw Errors.createError("SELECTOR_TIMEOUT", "Result ready indicator was not found before timeout.", {
              message: "Process button was not found before timeout.",
              expected: "A visible process button should appear.",
              actual: "No matching process button found before timeout.",
              selectorName: "processButton",
              selector: selector,
              url: location.href,
              pageState: PageState.detectPageState(profile),
              pageSummary: DomHelpers.getPageSummary(),
              nextChecks: [
                "Check if the process button selector still matches the page.",
                "Check if the page requires a prior action before enabling processing."
              ]
            });
          }

          DomHelpers.clickElement(button);
          await delay(profile.timing.afterActionClickDelayMs);
          return { clicked: true };
        }
      },
      {
        name: "wait_for_processing",
        description: "Wait briefly for the page to transition after the action",
        expected: "The page should move into processing or a subsequent known state.",
        run: async function runStep() {
          await delay(input.dryRun ? 250 : profile.timing.afterActionClickDelayMs);
          return PageState.detectPageState(profile);
        }
      },
      {
        name: "detect_result_ready",
        description: "Determine whether a result-ready state can be observed",
        expected: "A result-ready indicator should eventually appear or the page state should stay explainable.",
        run: async function runStep() {
          if (input.dryRun) {
            return {
              skipped: true,
              pageState: PageState.detectPageState(profile)
            };
          }

          const selector = profile.selectors.resultReadyIndicator;
          const resultElement = await Selectors.waitForSelector({
            selector: selector,
            timeoutMs: profile.timing.elementWaitTimeoutMs,
            pollIntervalMs: profile.timing.pollIntervalMs
          });

          if (!resultElement) {
            throw Errors.createError("SELECTOR_TIMEOUT", "Result ready indicator was not found before timeout.", {
              expected: "A visible result ready indicator should appear.",
              actual: "No matching visible element found after " + profile.timing.elementWaitTimeoutMs + "ms.",
              selectorName: "resultReadyIndicator",
              selector: selector,
              url: location.href,
              pageState: PageState.detectPageState(profile),
              pageSummary: DomHelpers.getPageSummary(),
              nextChecks: [
                "Check if the process completes under a different state or selector.",
                "Check for error banners or intermediate confirmation dialogs."
              ]
            });
          }

          return {
            ready: true,
            pageState: PageState.detectPageState(profile)
          };
        }
      },
      {
        name: "finalize",
        description: "Return a compact workflow summary",
        expected: "The workflow should end with an explainable summary.",
        run: async function runStep(context) {
          return {
            workflowId: context.workflowId,
            dryRun: Boolean(input.dryRun),
            finalPageState: PageState.detectPageState(profile),
            pageSummary: DomHelpers.getPageSummary()
          };
        }
      }
    ];

    return WorkflowRunner.runWorkflow({
      siteId: siteConfig.siteId,
      workflowName: input.dryRun ? "dry_run" : "main_automation",
      traceId: traceId,
      input: input,
      steps: steps
    });
  }

  NewSiteAutomation.Automator = {
    runMainAutomation: runMainAutomation,
    testAllSelectors: testAllSelectors
  };
})(globalThis);
