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
  modes: string[];
  agent: string;
  files: string[];
  codexSkills: string[];
  codexSubagents: string[];
  pipeline: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  needsFreshDocs: boolean;
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
