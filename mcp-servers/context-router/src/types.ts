export interface Route {
  keywords: RegExp;
  files: string[];
  agent: string;
}

export interface RouteResult {
  modes: string[];
  agent: string;
  files: string[];
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
}
