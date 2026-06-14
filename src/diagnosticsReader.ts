import * as vscode from "vscode";
import {
  compareProblems,
  ProblemGroup,
  ProblemItem,
  ProblemSeverity
} from "./types";

export function readWorkspaceProblems(): ProblemItem[] {
  const problems: ProblemItem[] = [];

  for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
    if (!shouldIncludeUri(uri)) {
      continue;
    }

    for (const diagnostic of diagnostics) {
      problems.push(toProblemItem(uri, diagnostic));
    }
  }

  return problems.sort(compareProblems);
}

export function groupProblemsByFile(problems: readonly ProblemItem[]): ProblemGroup[] {
  const groups = new Map<string, ProblemGroup>();

  for (const problem of problems) {
    const key = problem.uri.toString();
    let group = groups.get(key);

    if (!group) {
      group = {
        uri: problem.uri,
        filePath: problem.filePath,
        displayPath: problem.displayPath,
        problems: []
      };
      groups.set(key, group);
    }

    group.problems.push(problem);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      problems: [...group.problems].sort(compareProblems)
    }))
    .sort((left, right) => left.displayPath.localeCompare(right.displayPath));
}

export function problemsForUri(
  problems: readonly ProblemItem[],
  uri: vscode.Uri | undefined
): ProblemItem[] {
  if (!uri) {
    return [];
  }

  const uriKey = uri.toString();
  return problems.filter((problem) => problem.uri.toString() === uriKey).sort(compareProblems);
}

function shouldIncludeUri(uri: vscode.Uri): boolean {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return true;
  }

  return Boolean(vscode.workspace.getWorkspaceFolder(uri));
}

function toProblemItem(uri: vscode.Uri, diagnostic: vscode.Diagnostic): ProblemItem {
  const range = normalizeRange(diagnostic.range);
  const filePath = uri.scheme === "file" ? uri.fsPath : uri.toString(true);

  return {
    uri,
    filePath,
    displayPath: getDisplayPath(uri),
    line: range.start.line + 1,
    column: range.start.character + 1,
    message: diagnostic.message,
    severity: toSeverity(diagnostic.severity),
    source: diagnostic.source || undefined,
    code: normalizeCode(diagnostic.code),
    range
  };
}

function getDisplayPath(uri: vscode.Uri): string {
  if (vscode.workspace.getWorkspaceFolder(uri)) {
    return vscode.workspace.asRelativePath(uri, false);
  }

  return uri.scheme === "file" ? uri.fsPath : uri.toString(true);
}

function toSeverity(severity: vscode.DiagnosticSeverity): ProblemSeverity {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Warning:
      return "warning";
    case vscode.DiagnosticSeverity.Information:
      return "information";
    case vscode.DiagnosticSeverity.Hint:
      return "hint";
    default:
      return "information";
  }
}

function normalizeCode(
  code: vscode.Diagnostic["code"]
): string | number | undefined {
  if (code === undefined) {
    return undefined;
  }

  if (typeof code === "object" && "value" in code) {
    return code.value;
  }

  return code;
}

function normalizeRange(range: vscode.Range): vscode.Range {
  const startLine = Math.max(0, range.start.line);
  const startCharacter = Math.max(0, range.start.character);
  const endLine = Math.max(startLine, range.end.line);
  const endCharacter =
    endLine === startLine
      ? Math.max(startCharacter, range.end.character)
      : Math.max(0, range.end.character);

  return new vscode.Range(startLine, startCharacter, endLine, endCharacter);
}
