export interface WritingSourceGrounding {
  state: "not-required" | "primary-passages-required" | "blocked";
  required: boolean;
  kind: string;
  sourceIds: string[];
  applicability: Array<{ id: string; relevant: boolean; reason: string }>;
  command: string | null;
  evidence: string;
  library: { state: string; root?: string; issues?: string[] };
}

export interface Route {
  keywords: RegExp;
  files: string[];
  agent: string;
  codexSkills: string[];
  codexSubagents: string[];
  pipeline: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  needsFreshDocs?: boolean;
}

export interface RouteResult {
  workflowDepth: "direct" | "routed";
  resourceDecision: {
    role: string;
    recommendedModel: string;
    recommendedEffort: string;
    reason: string;
    scope: string[];
    acceptance: string[];
    evidenceRefs: string[];
    escalationCondition: string;
    orchestrator: string;
    runtimeStatus: "recommendation-only";
    effectiveModel: null;
    effectiveEffort: null;
    childThreadId: null;
    completionEvidence: string[];
    resourceRequest: { isValid: boolean; reason: string; hostStatus?: string; budgetEnforcement?: string };
    dispatch: {
      owner: string; customRole: string | null; strategy: string; ready: boolean;
      capabilityStatus: string; instructionsSource: string | null;
      requestedSandbox: string | null; sandboxStatus: string;
      callContract: null | { tool: string; model: string; reasoning_effort: string; fork_turns: string; task_name: string; message: string };
    };
  };
  modes: string[];
  agent: string;
  files: string[];
  codexSkills: string[];
  codexSubagents: string[];
  pipeline: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  codeIntelligence: {
    id: string;
    tools: string[];
    reason: string;
    guards: string[];
  };
  needsFreshDocs: boolean;
  targetLanguage: string | null;
  languageResolution: string | null;
  writingProfiles: string[];
  writingLanguageProfiles: string[];
  writingProcessProfiles: string[];
  writingDomainProfiles: string[];
  writingTechnicalProfiles: string[];
  writingEditors: string[];
  writingGates: string[];
  writingSourceGrounding: WritingSourceGrounding | null;
  writingExternalTools: Array<{
    id: string;
    access: string;
    execution: string;
    paid: boolean;
  }>;
  writingRejectedProfiles: Array<{ id: string; reason: string }>;
}

export interface ServerState {
  currentModes: string[];
  activeRules: string[];
  lastRouteTime: string;
  taskDescription: string;
}

export interface ProjectContext {
  lessons: string;
  research: string;
  gitLog: string;
  currentTask: string;
  toolRegistry: string;
  ecosystem: string;
}
