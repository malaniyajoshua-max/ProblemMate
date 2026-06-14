import * as vscode from "vscode";
import {
  ProblemItem,
  ProblemSeverity,
  ProblemSortMode,
  ProblemViewState,
  severityRank
} from "./types";

export const defaultViewState: ProblemViewState = {
  scope: "workspace",
  severity: "all",
  source: "all",
  query: "",
  sortMode: "severity"
};

export function applyProblemViewState(
  problems: readonly ProblemItem[],
  activeUri: vscode.Uri | undefined,
  state: ProblemViewState
): ProblemItem[] {
  const activeUriKey = activeUri?.toString();
  const query = state.query.trim().toLowerCase();

  return sortProblems(
    problems.filter((problem) => {
      if (state.scope === "currentFile" && problem.uri.toString() !== activeUriKey) {
        return false;
      }

      if (state.severity !== "all" && problem.severity !== state.severity) {
        return false;
      }

      if (state.source !== "all" && (problem.source || "unknown") !== state.source) {
        return false;
      }

      if (query) {
        const searchable = [
          problem.displayPath,
          problem.message,
          problem.source || "unknown",
          problem.code ?? ""
        ]
          .join(" ")
          .toLowerCase();
        return searchable.includes(query);
      }

      return true;
    }),
    state.sortMode
  );
}

export function sortProblems(
  problems: readonly ProblemItem[],
  sortMode: ProblemSortMode
): ProblemItem[] {
  return [...problems].sort((left, right) => {
    switch (sortMode) {
      case "severity":
        return (
          severityRank(left.severity) - severityRank(right.severity) ||
          left.displayPath.localeCompare(right.displayPath) ||
          left.line - right.line ||
          left.column - right.column
        );
      case "file":
        return (
          left.displayPath.localeCompare(right.displayPath) ||
          left.line - right.line ||
          left.column - right.column ||
          severityRank(left.severity) - severityRank(right.severity)
        );
      case "line":
        return (
          left.line - right.line ||
          left.column - right.column ||
          left.displayPath.localeCompare(right.displayPath) ||
          severityRank(left.severity) - severityRank(right.severity)
        );
      case "source":
        return (
          (left.source || "unknown").localeCompare(right.source || "unknown") ||
          severityRank(left.severity) - severityRank(right.severity) ||
          left.displayPath.localeCompare(right.displayPath) ||
          left.line - right.line
        );
    }
  });
}

export function getAvailableSources(problems: readonly ProblemItem[]): string[] {
  return Array.from(new Set(problems.map((problem) => problem.source || "unknown"))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export function describeViewState(state: ProblemViewState): string {
  const parts: string[] = [];

  if (state.scope === "currentFile") {
    parts.push("current file");
  }

  if (state.severity !== "all") {
    parts.push(state.severity);
  }

  if (state.source !== "all") {
    parts.push(`source: ${state.source}`);
  }

  if (state.query.trim()) {
    parts.push(`search: ${state.query.trim()}`);
  }

  if (parts.length === 0) {
    return "";
  }

  return parts.join(", ");
}

export function normalizeSeverity(value: string | undefined): ProblemSeverity | "all" {
  if (
    value === "error" ||
    value === "warning" ||
    value === "information" ||
    value === "hint"
  ) {
    return value;
  }

  return "all";
}

export function normalizeSortMode(value: string | undefined): ProblemSortMode {
  if (value === "file" || value === "line" || value === "source") {
    return value;
  }

  return "severity";
}
