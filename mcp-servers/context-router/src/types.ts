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

export interface GetContextOutput {
  mode: string;
  agent: string;
  rules_loaded: number;
  rules_lines: number;
  rules_text: string;
  lessons: string;
  git_log: string;
  current_task: string;
  research_cache: string;
  active_since: string;
}

export interface SwitchContextOutput extends GetContextOutput {
  switched_from: string;
  switched_to: string;
  new_rules_count: number;
  dropped_rules_count: number;
}
