(function initConditionalWorkflowSamples(globalScope) {
  const NewSiteCore = globalScope.NewSiteCore = globalScope.NewSiteCore || {};

  const SAMPLE_TIPO_FLOW = {
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

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getSampleTipoFlow() {
    return cloneValue(SAMPLE_TIPO_FLOW);
  }

  NewSiteCore.ConditionalWorkflowSamples = {
    getSampleTipoFlow: getSampleTipoFlow
  };
})(globalThis);
