(function initWorkflowLabController(globalScope) {
  const WorkflowLab = globalScope.WorkflowLab = globalScope.WorkflowLab || {};
  const NewSiteCore = globalScope.NewSiteCore || {};
  const store = WorkflowLab.Store.state;
  const render = WorkflowLab.Render.render;
  const MESSAGE_TYPES = NewSiteCore.MESSAGE_TYPES;
  const workflowSamples = NewSiteCore.ConditionalWorkflowSamples;
  const draftSessionApi = NewSiteCore.ConditionalWorkflowDraftSession;
  const deepSeekConfig = globalScope.DeepSeekAutomation.DEEPSEEK_CONFIG;

  let rootNode;
  const draftSession = draftSessionApi && typeof draftSessionApi.create === "function"
    ? draftSessionApi.create({
      getText: function getDraftText() {
        return store.conditionalWorkflowText;
      },
      setText: function setDraftText(text) {
        store.conditionalWorkflowText = text;
      },
      onLoaded: function onDraftLoaded() {
        rerender();
      }
    })
    : null;

  function rerender() {
    render(rootNode);
    bindEvents();
  }

  async function sendMessage(message) {
    return chrome.runtime.sendMessage(message);
  }

  async function refreshGatewayStatus() {
    const response = await sendMessage({ type: MESSAGE_TYPES.GATEWAY_STATUS_GET });
    store.gatewayStatus = response.gatewayStatus || null;
    store.selectedFile = store.gatewayStatus ? store.gatewayStatus.selectedFile || null : null;
    rerender();
  }

  async function connectGateway() {
    const response = await sendMessage({ type: MESSAGE_TYPES.GATEWAY_CONNECT });
    store.gatewayStatus = response.gatewayStatus || null;
    store.selectedFile = store.gatewayStatus ? store.gatewayStatus.selectedFile || null : null;
    rerender();
  }

  async function selectExcelFile() {
    const response = await sendMessage({ type: MESSAGE_TYPES.GATEWAY_SELECT_FILE });
    store.gatewayStatus = response.gatewayStatus || null;
    store.selectedFile = response.file || (store.gatewayStatus ? store.gatewayStatus.selectedFile || null : null);
    rerender();
  }

  function loadSampleWorkflow() {
    const sampleDefinition = workflowSamples && typeof workflowSamples.getSampleTipoFlow === "function"
      ? workflowSamples.getSampleTipoFlow()
      : null;
    store.conditionalWorkflowText = JSON.stringify(sampleDefinition || {}, null, 2);
    if (draftSession && typeof draftSession.markEdited === "function") {
      draftSession.markEdited();
    }
    store.conditionalWorkflowParseError = "";
    rerender();
    if (draftSession && typeof draftSession.flushSave === "function") {
      draftSession.flushSave(store.conditionalWorkflowText).catch(function noop() {});
    }
  }

  async function runConditionalWorkflow() {
    const jsonInput = document.getElementById("workflow-lab-json");
    store.conditionalWorkflowText = jsonInput ? jsonInput.value : store.conditionalWorkflowText;
    if (draftSession && typeof draftSession.flushSave === "function") {
      await draftSession.flushSave(store.conditionalWorkflowText);
    }

    if (!store.conditionalWorkflowText.trim()) {
      store.conditionalWorkflowParseError = "Conditional workflow JSON is required.";
      rerender();
      return;
    }

    let definition;
    try {
      definition = JSON.parse(store.conditionalWorkflowText);
    } catch (error) {
      store.conditionalWorkflowParseError = error && error.message ? error.message : "Invalid JSON.";
      rerender();
      return;
    }

    store.conditionalWorkflowParseError = "";
    store.isRunningConditionalWorkflow = true;
    store.conditionalWorkflowResult = null;
    rerender();

    const response = await sendMessage({
      type: MESSAGE_TYPES.CONDITIONAL_WORKFLOW_RUN,
      input: {
        definition: definition,
        autoConnectGateway: true,
        autoOpenDeepSeek: true,
        autoSelectFileIfMissing: true
      }
    });

    store.isRunningConditionalWorkflow = false;
    store.conditionalWorkflowResult = response;
    store.lastError = response.error || null;
    if (response.gatewayStatus) {
      store.gatewayStatus = response.gatewayStatus;
      store.selectedFile = response.gatewayStatus.selectedFile || store.selectedFile;
    }
    rerender();
  }

  function openDeepSeek() {
    chrome.tabs.create({ url: deepSeekConfig.baseUrl });
  }

  function bindEvents() {
    document.getElementById("workflow-lab-connect-gateway").onclick = connectGateway;
    document.getElementById("workflow-lab-select-file").onclick = selectExcelFile;
    document.getElementById("workflow-lab-open-deepseek").onclick = openDeepSeek;
    document.getElementById("workflow-lab-json").addEventListener("input", function onInput(event) {
      if (draftSession && typeof draftSession.markEdited === "function") {
        draftSession.markEdited();
      }
      store.conditionalWorkflowText = event.target.value;
      if (draftSession && typeof draftSession.scheduleSave === "function") {
        draftSession.scheduleSave(store.conditionalWorkflowText);
      }
    });
    document.getElementById("workflow-lab-load-sample").onclick = loadSampleWorkflow;
    document.getElementById("workflow-lab-run").onclick = function onRun() {
      return runConditionalWorkflow();
    };
  }

  function mount(root) {
    rootNode = root;
    rerender();
    if (draftSession && typeof draftSession.loadDraft === "function") {
      draftSession.loadDraft().catch(function noop() {});
    }
    refreshGatewayStatus().catch(function noop() {});
  }

  WorkflowLab.Controller = {
    mount: mount
  };
})(globalThis);
