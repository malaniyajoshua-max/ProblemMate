import * as vscode from "vscode";
import {
  compactMessage,
  ProblemGroup,
  ProblemItem,
  severityLabel
} from "./types";

type ProblemTreeElement =
  | EmptyElement
  | InfoElement
  | SectionElement
  | FileElement
  | ProblemElement;

interface EmptyElement {
  kind: "empty";
  label: string;
}

interface InfoElement {
  kind: "info";
  label: string;
}

interface SectionElement {
  kind: "section";
  section: "currentFile" | "workspace";
  label: string;
  count: number;
}

interface FileElement {
  kind: "file";
  group: ProblemGroup;
}

interface ProblemElement {
  kind: "problem";
  problem: ProblemItem;
}

export class ProblemTreeProvider implements vscode.TreeDataProvider<ProblemTreeElement> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    ProblemTreeElement | undefined | null | void
  >();

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private workspaceGroups: ProblemGroup[] = [];
  private currentFileProblems: ProblemItem[] = [];
  private allProblems: ProblemItem[] = [];
  private hasActiveEditor = false;
  private filterDescription = "";

  setData(
    workspaceGroups: ProblemGroup[],
    currentFileProblems: ProblemItem[],
    allProblems: ProblemItem[],
    hasActiveEditor: boolean,
    filterDescription = ""
  ): void {
    this.workspaceGroups = workspaceGroups;
    this.currentFileProblems = currentFileProblems;
    this.allProblems = allProblems;
    this.hasActiveEditor = hasActiveEditor;
    this.filterDescription = filterDescription;
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: ProblemTreeElement): vscode.TreeItem {
    switch (element.kind) {
      case "empty":
        return this.createEmptyItem(element);
      case "info":
        return this.createInfoItem(element);
      case "section":
        return this.createSectionItem(element);
      case "file":
        return this.createFileItem(element);
      case "problem":
        return this.createProblemItem(element.problem);
    }
  }

  getChildren(element?: ProblemTreeElement): vscode.ProviderResult<ProblemTreeElement[]> {
    if (!element) {
      if (this.allProblems.length === 0) {
        return [
          {
            kind: "empty",
            label: this.filterDescription
              ? "No problems match the active filters"
              : "No problems found"
          }
        ];
      }

      const rootItems: ProblemTreeElement[] = [];

      if (this.filterDescription) {
        rootItems.push({
          kind: "info",
          label: `Filter: ${this.filterDescription}`
        });
      }

      rootItems.push(
        {
          kind: "section",
          section: "currentFile",
          label: "Current File",
          count: this.currentFileProblems.length
        },
        {
          kind: "section",
          section: "workspace",
          label: "Workspace",
          count: this.allProblems.length
        }
      );

      return rootItems;
    }

    if (element.kind === "section" && element.section === "currentFile") {
      if (!this.hasActiveEditor) {
        return [{ kind: "empty", label: "No active editor" }];
      }

      if (this.currentFileProblems.length === 0) {
        return [{ kind: "empty", label: "No problems in current file" }];
      }

      return this.currentFileProblems.map((problem) => ({ kind: "problem", problem }));
    }

    if (element.kind === "section" && element.section === "workspace") {
      if (this.workspaceGroups.length === 0) {
        return [{ kind: "empty", label: "No workspace problems" }];
      }

      return this.workspaceGroups.map((group) => ({ kind: "file", group }));
    }

    if (element.kind === "file") {
      return element.group.problems.map((problem) => ({ kind: "problem", problem }));
    }

    return [];
  }

  private createEmptyItem(element: EmptyElement): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon("info");
    item.contextValue = "problemmate.empty";
    return item;
  }

  private createInfoItem(element: InfoElement): vscode.TreeItem {
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon("filter");
    item.contextValue = "problemmate.info";
    return item;
  }

  private createSectionItem(element: SectionElement): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      vscode.TreeItemCollapsibleState.Expanded
    );
    item.description = `${element.count}`;
    item.iconPath =
      element.section === "currentFile"
        ? new vscode.ThemeIcon("file-code")
        : new vscode.ThemeIcon("workspace-trusted");
    item.contextValue = "problemmate.section";
    return item;
  }

  private createFileItem(element: FileElement): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.group.displayPath,
      vscode.TreeItemCollapsibleState.Expanded
    );
    item.description = `${element.group.problems.length}`;
    item.tooltip = element.group.filePath;
    item.iconPath = new vscode.ThemeIcon("file");
    item.contextValue = "problemmate.file";
    return item;
  }

  private createProblemItem(problem: ProblemItem): vscode.TreeItem {
    const item = new vscode.TreeItem(
      `${severityLabel(problem.severity)} line ${problem.line}: ${compactMessage(
        problem.message,
        80
      )}`,
      vscode.TreeItemCollapsibleState.None
    );

    item.description = problem.source || "unknown";
    item.tooltip = [
      `${severityLabel(problem.severity)} at ${problem.displayPath}:${problem.line}:${problem.column}`,
      problem.source ? `Source: ${problem.source}` : "Source: unknown",
      problem.code !== undefined ? `Code: ${problem.code}` : "Code: unknown",
      "",
      problem.message
    ].join("\n");
    item.iconPath = problemIcon(problem);
    item.contextValue = "problemmate.problem";
    item.command = {
      command: "problemmate.openProblem",
      title: "Open Problem",
      arguments: [problem]
    };

    return item;
  }
}

function problemIcon(problem: ProblemItem): vscode.ThemeIcon {
  switch (problem.severity) {
    case "error":
      return new vscode.ThemeIcon("error", new vscode.ThemeColor("problemsErrorIcon.foreground"));
    case "warning":
      return new vscode.ThemeIcon(
        "warning",
        new vscode.ThemeColor("problemsWarningIcon.foreground")
      );
    case "information":
      return new vscode.ThemeIcon("info", new vscode.ThemeColor("problemsInfoIcon.foreground"));
    case "hint":
      return new vscode.ThemeIcon("lightbulb");
  }
}

export function getProblemFromTreeElement(
  element: unknown
): ProblemItem | undefined {
  if (isProblemItem(element)) {
    return element;
  }

  if (
    typeof element === "object" &&
    element !== null &&
    "kind" in element &&
    element.kind === "problem" &&
    "problem" in element &&
    isProblemItem(element.problem)
  ) {
    return element.problem;
  }

  return undefined;
}

function isProblemItem(value: unknown): value is ProblemItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "uri" in value &&
    "range" in value &&
    "message" in value &&
    "severity" in value
  );
}
