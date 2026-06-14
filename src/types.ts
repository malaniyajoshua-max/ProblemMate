import * as vscode from "vscode";

export type ProblemSeverity = "error" | "warning" | "information" | "hint";

export interface ProblemItem {
  uri: vscode.Uri;
  filePath: string;
  displayPath: string;
  line: number;
  column: number;
  message: string;
  severity: ProblemSeverity;
  source?: string;
  code?: string | number;
  range: vscode.Range;
}

export interface ProblemGroup {
  uri: vscode.Uri;
  filePath: string;
  displayPath: string;
  problems: ProblemItem[];
}

export interface ProblemStats {
  total: number;
  errors: number;
  warnings: number;
  information: number;
  hints: number;
}

export type ProblemSortMode = "severity" | "file" | "line" | "source";

export interface ProblemViewState {
  scope: "workspace" | "currentFile";
  severity: ProblemSeverity | "all";
  source: string;
  query: string;
  sortMode: ProblemSortMode;
}

export interface SerializedProblem {
  file: string;
  line: number;
  column: number;
  severity: ProblemSeverity;
  source: string;
  code: string;
  message: string;
}

const severityLabels: Record<ProblemSeverity, string> = {
  error: "Error",
  warning: "Warning",
  information: "Information",
  hint: "Hint"
};

const severityRanks: Record<ProblemSeverity, number> = {
  error: 0,
  warning: 1,
  information: 2,
  hint: 3
};

export function severityLabel(severity: ProblemSeverity): string {
  return severityLabels[severity];
}

export function severityRank(severity: ProblemSeverity): number {
  return severityRanks[severity];
}

export function compareProblems(left: ProblemItem, right: ProblemItem): number {
  return (
    left.displayPath.localeCompare(right.displayPath) ||
    severityRank(left.severity) - severityRank(right.severity) ||
    left.line - right.line ||
    left.column - right.column ||
    left.message.localeCompare(right.message)
  );
}

export function problemIdentity(problem: ProblemItem): string {
  return [
    problem.displayPath,
    problem.line,
    problem.column,
    problem.severity,
    problem.source || "unknown",
    problem.code ?? "unknown",
    problem.message
  ].join("|");
}

export function serializeProblem(problem: ProblemItem): SerializedProblem {
  return {
    file: problem.displayPath,
    line: problem.line,
    column: problem.column,
    severity: problem.severity,
    source: problem.source || "unknown",
    code: String(problem.code ?? "unknown"),
    message: problem.message
  };
}

export function calculateStats(problems: readonly ProblemItem[]): ProblemStats {
  const stats: ProblemStats = {
    total: problems.length,
    errors: 0,
    warnings: 0,
    information: 0,
    hints: 0
  };

  for (const problem of problems) {
    switch (problem.severity) {
      case "error":
        stats.errors += 1;
        break;
      case "warning":
        stats.warnings += 1;
        break;
      case "information":
        stats.information += 1;
        break;
      case "hint":
        stats.hints += 1;
        break;
    }
  }

  return stats;
}

export function compactMessage(message: string, maxLength = 120): string {
  const singleLine = message.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }

  return `${singleLine.slice(0, Math.max(0, maxLength - 1))}...`;
}
