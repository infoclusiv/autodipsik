(function initWorkflowLabController(globalScope) {
  const WorkflowLab = globalScope.WorkflowLab = globalScope.WorkflowLab || {};
  const store = WorkflowLab.Store.state;
  const render = WorkflowLab.Render.render;
  const MESSAGE_TYPES = globalScope.NewSiteCore.MESSAGE_TYPES;
  const draftStorage = globalScope.NewSiteCore && globalScope.NewSiteCore.ConditionalWorkflowDraftStorage;
  const deepSeekConfig = globalScope.DeepSeekAutomation.DEEPSEEK_CONFIG;

  const SAMPLE_CONDITIONAL_WORKFLOW = {
    flowVersion: 1,
    workflowId: "mvp_tipo_flow",
    startNodeId: "prompt_1",
    nodes: [
      {
        id: "prompt_1",
        type: "prompt",
        promptText: "Analyze the attached Excel briefly. At the end include exactly one marker: [[TIPO: tipo_1]] or [[TIPO: tipo_2]].",
        attachFile: true,
        waitForResponse: true,
        nextNodeId: "extract_tipo"
      },
      {
        id: "extract_tipo",
        type: "regex_extract",
        sourceNodeId: "prompt_1",
        patterns: [
          {
            name: "tipo",
            regex: "\\\\[\\\\[TIPO:\\\\s*(tipo_1|tipo_2)\\\\s*\\\\]\\\\]",
            groupIndex: 1,
            required: true
          }
        ],
        nextNodeId: "decision_tipo"
      },
      {
        id: "decision_tipo",
        type: "condition",
        variable: "tipo",
        branches: [
          { equals: "tipo_1", nextNodeId: "prompt_tipo_1" },
          { equals: "tipo_2", nextNodeId: "prompt_tipo_2" }
        ],
        fallbackNextNodeId: "end_no_match"
      },
      {
        id: "prompt_tipo_1",
        type: "prompt",
        promptText: "Continue with the tipo_1 follow-up and keep the answer brief.",
        attachFile: false,
        waitForResponse: true,
        nextNodeId: "end"
      },
      {
        id: "prompt_tipo_2",
        type: "prompt",
        promptText: "Continue with the tipo_2 follow-up and keep the answer brief.",
        attachFile: false,
        waitForResponse: true,
        nextNodeId: "end"
      },
      {
        id: "end_no_match",
        type: "end",
        reason: "No matching branch."
      },
      {
        id: "end",
        type: "end"
      }
    ]
  };

  let rootNode;
  let conditionalWorkflowDraftSaveTimer = null;
  let conditionalWorkflowDraftSessionVersion = 0;

  function rerender() {
    render(rootNode);
    bindEvents();
  }

  async function saveConditionalWorkflowDraft(text) {
    if (!draftStorage || typeof draftStorage.saveDraft !== "function") {
      return false;
    }

    try {
      return await draftStorage.saveDraft(text);
    } catch (error) {
      return false;
    }
  }

  function scheduleConditionalWorkflowDraftSave(text) {
    if (conditionalWorkflowDraftSaveTimer) {
      clearTimeout(conditionalWorkflowDraftSaveTimer);
    }

    conditionalWorkflowDraftSaveTimer = setTimeout(function persistDraft() {
      conditionalWorkflowDraftSaveTimer = null;
      saveConditionalWorkflowDraft(text).catch(function noop() {});
    }, 250);
  }

  async function flushConditionalWorkflowDraftSave(text) {
    if (conditionalWorkflowDraftSaveTimer) {
      clearTimeout(conditionalWorkflowDraftSaveTimer);
      conditionalWorkflowDraftSaveTimer = null;
    }
    return saveConditionalWorkflowDraft(text);
  }

  async function loadConditionalWorkflowDraft() {
    if (!draftStorage || typeof draftStorage.loadDraft !== "function") {
      return;
    }

    const loadVersion = conditionalWorkflowDraftSessionVersion;
    const loadedDraft = await draftStorage.loadDraft();

    if (conditionalWorkflowDraftSessionVersion !== loadVersion) {
      return;
    }

    if (typeof loadedDraft !== "string" || loadedDraft === store.conditionalWorkflowText) {
      return;
    }

    store.conditionalWorkflowText = loadedDraft;
    rerender();
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
    store.conditionalWorkflowText = JSON.stringify(SAMPLE_CONDITIONAL_WORKFLOW, null, 2);
    conditionalWorkflowDraftSessionVersion += 1;
    store.conditionalWorkflowParseError = "";
    rerender();
    flushConditionalWorkflowDraftSave(store.conditionalWorkflowText).catch(function noop() {});
  }

  async function runConditionalWorkflow() {
    const jsonInput = document.getElementById("workflow-lab-json");
    store.conditionalWorkflowText = jsonInput ? jsonInput.value : store.conditionalWorkflowText;
    await flushConditionalWorkflowDraftSave(store.conditionalWorkflowText);

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
      conditionalWorkflowDraftSessionVersion += 1;
      store.conditionalWorkflowText = event.target.value;
      scheduleConditionalWorkflowDraftSave(store.conditionalWorkflowText);
    });
    document.getElementById("workflow-lab-load-sample").onclick = loadSampleWorkflow;
    document.getElementById("workflow-lab-run").onclick = function onRun() {
      return runConditionalWorkflow();
    };
  }

  function mount(root) {
    rootNode = root;
    rerender();
    loadConditionalWorkflowDraft().catch(function noop() {});
    refreshGatewayStatus().catch(function noop() {});
  }

  WorkflowLab.Controller = {
    mount: mount
  };
})(globalThis);
