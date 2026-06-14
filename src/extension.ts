import * as vscode from "vscode";
import {
  groupProblemsByFile,
  problemsForUri,
  readWorkspaceProblems
} from "./diagnosticsReader";
import {
  applyProblemViewState,
  defaultViewState,
  describeViewState,
  getAvailableSources,
  normalizeSeverity,
  normalizeSortMode
} from "./filters";
import { buildProblemContext } from "./problemContext";
import { getProblemFromTreeElement, ProblemTreeProvider } from "./problemTreeProvider";
import {
  appendFixLog,
  compareSnapshots,
  exportSummaryFile,
  openFixLog,
  saveSnapshot
} from "./reports";
import { ProblemMateStatusBar } from "./statusBar";
import { buildProblemsSummary, SummaryFormat } from "./summary";
import {
  calculateStats,
  compactMessage,
  ProblemItem,
  ProblemSortMode,
  ProblemViewState,
  severityLabel,
  severityRank
} from "./types";

let latestProblems: ProblemItem[] = [];
let latestVisibleProblems: ProblemItem[] = [];
let latestCurrentFileProblems: ProblemItem[] = [];
let refreshTimer: NodeJS.Timeout | undefined;
let viewState: ProblemViewState = defaultViewState;
let extensionContext: vscode.ExtensionContext | undefined;
let treeProviderRef: ProblemTreeProvider | undefined;
let statusBarRef: ProblemMateStatusBar | undefined;

const viewStateKey = "problemmate.viewState";

export function activate(context: vscode.ExtensionContext): void {
  extensionContext = context;
  viewState = loadViewState(context);

  const treeProvider = new ProblemTreeProvider();
  const statusBar = new ProblemMateStatusBar();
  treeProviderRef = treeProvider;
  statusBarRef = statusBar;

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("problemmateView", treeProvider),
    vscode.window.registerTreeDataProvider("problemmateExplorerView", treeProvider),
    statusBar,
    vscode.commands.registerCommand("problemmate.openProblem", openProblem),
    vscode.commands.registerCommand("problemmate.refreshProblems", async () => {
      refresh();
      vscode.window.showInformationMessage("ProblemMate problems refreshed.");
    }),
    vscode.commands.registerCommand("problemmate.showActions", showActions),
    vscode.commands.registerCommand("problemmate.copyProblemContext", async (element?: unknown) => {
      await copyProblemContext(element, "plain");
    }),
    vscode.commands.registerCommand(
      "problemmate.copyProblemContextMarkdown",
      async (element?: unknown) => {
        await copyProblemContext(element, "markdown");
      }
    ),
    vscode.commands.registerCommand("problemmate.copyAllProblemsSummary", async () => {
      refresh();
      await copySummary(latestProblems, getDefaultCopyFormat(), "ProblemMate summary copied.");
    }),
    vscode.commands.registerCommand("problemmate.copyFilteredProblemsSummary", async () => {
      refresh();
      await copySummary(
        latestVisibleProblems,
        getDefaultCopyFormat(),
        "Filtered ProblemMate summary copied."
      );
    }),
    vscode.commands.registerCommand("problemmate.copyCurrentFileSummary", async () => {
      refresh();
      await copySummary(
        latestCurrentFileProblems,
        getDefaultCopyFormat(),
        "Current file ProblemMate summary copied."
      );
    }),
    vscode.commands.registerCommand("problemmate.copyProblemsWithFormat", copyProblemsWithFormat),
    vscode.commands.registerCommand("problemmate.exportSummaryMarkdown", async () => {
      await exportSummary("markdown");
    }),
    vscode.commands.registerCommand("problemmate.exportSummaryJson", async () => {
      await exportSummary("json");
    }),
    vscode.commands.registerCommand("problemmate.filterProblems", filterProblems),
    vscode.commands.registerCommand("problemmate.clearFilters", clearFilters),
    vscode.commands.registerCommand("problemmate.sortProblems", sortProblemsCommand),
    vscode.commands.registerCommand("problemmate.markAsFixed", async (element?: unknown) => {
      await markAsFixed(element);
    }),
    vscode.commands.registerCommand("problemmate.openFixLog", openFixLog),
    vscode.commands.registerCommand("problemmate.saveSnapshot", async () => {
      refresh();
      const uri = await saveSnapshot(latestProblems);
      if (uri) {
        vscode.window.showInformationMessage(`ProblemMate snapshot saved: ${uri.fsPath}`);
      }
    }),
    vscode.commands.registerCommand("problemmate.compareSnapshots", async () => {
      const uri = await compareSnapshots();
      if (uri) {
        await showFileResult("ProblemMate snapshot diff created.", uri);
      }
    }),
    vscode.commands.registerCommand("problemmate.focusProblemView", async () => {
      await vscode.commands.executeCommand("problemmateView.focus");
    }),
    vscode.languages.onDidChangeDiagnostics(() => scheduleRefresh()),
    vscode.window.onDidChangeActiveTextEditor(() => scheduleRefresh())
  );

  refresh();
}

export function deactivate(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = undefined;
  }
}

function scheduleRefresh(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(refresh, 150);
}

function refresh(): void {
  if (!treeProviderRef || !statusBarRef) {
    return;
  }

  latestProblems = readWorkspaceProblems();
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  const filterDescription = describeViewState(viewState);
  latestVisibleProblems = applyProblemViewState(latestProblems, activeUri, viewState);
  latestCurrentFileProblems = problemsForUri(latestVisibleProblems, activeUri);

  treeProviderRef.setData(
    groupProblemsByFile(latestVisibleProblems),
    latestCurrentFileProblems,
    latestVisibleProblems,
    Boolean(activeUri),
    filterDescription
  );
  statusBarRef.update(calculateStats(latestProblems), filterDescription);
}

async function openProblem(problem: ProblemItem): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(problem.uri);
    const editor = await vscode.window.showTextDocument(document, {
      preview: true,
      preserveFocus: false
    });
    const range = clampRange(problem.range, document);

    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showWarningMessage(`ProblemMate could not open this problem: ${message}`);
  }
}

async function showActions(): Promise<void> {
  const picked = await vscode.window.showQuickPick(
    [
      {
        label: "$(list-tree) Focus ProblemMate View",
        command: "problemmate.focusProblemView"
      },
      {
        label: "$(filter) Filter Problems",
        command: "problemmate.filterProblems"
      },
      {
        label: "$(sort-precedence) Sort Problems",
        command: "problemmate.sortProblems"
      },
      {
        label: "$(copy) Copy Summary",
        command: "problemmate.copyProblemsWithFormat"
      },
      {
        label: "$(file-code) Export Markdown Report",
        command: "problemmate.exportSummaryMarkdown"
      },
      {
        label: "$(save) Save Snapshot",
        command: "problemmate.saveSnapshot"
      }
    ],
    {
      placeHolder: "Choose a ProblemMate action"
    }
  );

  if (picked) {
    await vscode.commands.executeCommand(picked.command);
  }
}

async function copyProblemContext(
  element: unknown,
  format: "plain" | "markdown"
): Promise<void> {
  const directProblem = getProblemFromTreeElement(element);
  const problem = directProblem ?? (await selectProblemForContext());

  if (!problem) {
    return;
  }

  const contextText = await buildProblemContext(problem, {
    contextLines: getContextLines(),
    format
  });
  await vscode.env.clipboard.writeText(contextText);
  vscode.window.showInformationMessage("Problem context copied to clipboard.");
}

async function copyProblemsWithFormat(): Promise<void> {
  refresh();
  const format = await pickSummaryFormat();
  if (!format) {
    return;
  }

  const scope = await vscode.window.showQuickPick(
    [
      {
        label: "Current View",
        description: `${latestVisibleProblems.length} problems after active filters`,
        problems: latestVisibleProblems
      },
      {
        label: "Current File",
        description: `${latestCurrentFileProblems.length} visible problems`,
        problems: latestCurrentFileProblems
      },
      {
        label: "Whole Workspace",
        description: `${latestProblems.length} problems, ignoring filters`,
        problems: latestProblems
      }
    ],
    {
      placeHolder: "Choose which problems to copy"
    }
  );

  if (!scope) {
    return;
  }

  await copySummary(scope.problems, format, "ProblemMate summary copied.");
}

async function copySummary(
  problems: readonly ProblemItem[],
  format: SummaryFormat,
  message: string
): Promise<void> {
  const summary = buildProblemsSummary(problems, format);
  await vscode.env.clipboard.writeText(summary);
  vscode.window.showInformationMessage(message);
}

async function exportSummary(format: "markdown" | "json"): Promise<void> {
  refresh();
  const uri = await exportSummaryFile(latestVisibleProblems, format);
  if (uri) {
    await showFileResult(`ProblemMate ${format} report exported.`, uri);
  }
}

async function filterProblems(): Promise<void> {
  refresh();
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Scope", description: viewState.scope, action: "scope" },
      { label: "Severity", description: viewState.severity, action: "severity" },
      { label: "Source", description: viewState.source, action: "source" },
      { label: "Search Text", description: viewState.query || "none", action: "query" },
      { label: "Clear Filters", description: "Show all workspace diagnostics", action: "clear" }
    ],
    {
      placeHolder: "Choose a ProblemMate filter to change"
    }
  );

  if (!picked) {
    return;
  }

  switch (picked.action) {
    case "scope":
      await updateViewState({
        scope: await pickScope(viewState.scope)
      });
      break;
    case "severity":
      await updateViewState({
        severity: await pickSeverity(viewState.severity)
      });
      break;
    case "source":
      await updateViewState({
        source: await pickSource(viewState.source)
      });
      break;
    case "query":
      await updateViewState({
        query:
          (await vscode.window.showInputBox({
            prompt: "Filter by file, message, source, or code",
            value: viewState.query
          })) ?? viewState.query
      });
      break;
    case "clear":
      await clearFilters();
      return;
  }

  refresh();
}

async function clearFilters(): Promise<void> {
  await updateViewState({
    scope: "workspace",
    severity: "all",
    source: "all",
    query: ""
  });
  refresh();
  vscode.window.showInformationMessage("ProblemMate filters cleared.");
}

async function sortProblemsCommand(): Promise<void> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Severity", mode: "severity" as ProblemSortMode },
      { label: "File", mode: "file" as ProblemSortMode },
      { label: "Line", mode: "line" as ProblemSortMode },
      { label: "Source", mode: "source" as ProblemSortMode }
    ],
    {
      placeHolder: "Choose ProblemMate sort order"
    }
  );

  if (!picked) {
    return;
  }

  await updateViewState({ sortMode: picked.mode });
  refresh();
}

async function markAsFixed(element?: unknown): Promise<void> {
  const directProblem = getProblemFromTreeElement(element);
  const problem = directProblem ?? (await selectProblemForContext());

  if (!problem) {
    return;
  }

  const uri = await appendFixLog(problem);
  if (uri) {
    await showFileResult("ProblemMate fix log updated.", uri);
  }
}

async function selectProblemForContext(): Promise<ProblemItem | undefined> {
  latestProblems = readWorkspaceProblems();

  if (latestProblems.length === 0) {
    vscode.window.showInformationMessage("ProblemMate found no current diagnostics to copy.");
    return undefined;
  }

  const nearest = findNearestProblemInActiveEditor(latestProblems);
  if (nearest) {
    return nearest;
  }

  if (latestProblems.length === 1) {
    return latestProblems[0];
  }

  const selected = await vscode.window.showQuickPick(
    latestProblems.map((problem) => ({
      label: `${severityQuickPickIcon(problem)} ${problem.displayPath}:${problem.line}`,
      description: `${severityLabel(problem.severity)} | ${problem.source || "unknown"}`,
      detail: compactMessage(problem.message, 180),
      problem
    })),
    {
      placeHolder: "Select a problem"
    }
  );

  return selected?.problem;
}

function findNearestProblemInActiveEditor(
  problems: readonly ProblemItem[]
): ProblemItem | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }

  const uriKey = editor.document.uri.toString();
  const cursorLine = editor.selection.active.line + 1;
  const currentFileProblems = problems.filter((problem) => problem.uri.toString() === uriKey);

  if (currentFileProblems.length === 0) {
    return undefined;
  }

  return [...currentFileProblems].sort((left, right) => {
    return (
      Math.abs(left.line - cursorLine) - Math.abs(right.line - cursorLine) ||
      severityRank(left.severity) - severityRank(right.severity) ||
      left.line - right.line ||
      left.column - right.column
    );
  })[0];
}

async function pickSummaryFormat(): Promise<SummaryFormat | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Plain Text", format: "plain" as SummaryFormat },
      { label: "Markdown", format: "markdown" as SummaryFormat },
      { label: "GitHub Issue", format: "github" as SummaryFormat },
      { label: "JSON", format: "json" as SummaryFormat }
    ],
    {
      placeHolder: "Choose summary format"
    }
  );

  return picked?.format;
}

async function pickScope(current: ProblemViewState["scope"]): Promise<ProblemViewState["scope"]> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Workspace", scope: "workspace" as const },
      { label: "Current File", scope: "currentFile" as const }
    ],
    {
      placeHolder: "Choose ProblemMate scope"
    }
  );

  return picked?.scope ?? current;
}

async function pickSeverity(
  current: ProblemViewState["severity"]
): Promise<ProblemViewState["severity"]> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: "All", severity: "all" as const },
      { label: "Error", severity: "error" as const },
      { label: "Warning", severity: "warning" as const },
      { label: "Information", severity: "information" as const },
      { label: "Hint", severity: "hint" as const }
    ],
    {
      placeHolder: "Choose severity filter"
    }
  );

  return picked?.severity ?? current;
}

async function pickSource(current: string): Promise<string> {
  const sources = getAvailableSources(latestProblems);
  const picked = await vscode.window.showQuickPick(
    [
      { label: "All", source: "all" },
      ...sources.map((source) => ({ label: source, source }))
    ],
    {
      placeHolder: "Choose source filter"
    }
  );

  return picked?.source ?? current;
}

async function updateViewState(patch: Partial<ProblemViewState>): Promise<void> {
  viewState = {
    ...viewState,
    ...patch
  };
  await extensionContext?.workspaceState.update(viewStateKey, viewState);
}

function loadViewState(context: vscode.ExtensionContext): ProblemViewState {
  const config = vscode.workspace.getConfiguration("problemmate");
  const saved = context.workspaceState.get<Partial<ProblemViewState>>(viewStateKey, {});
  const configuredSortMode = normalizeSortMode(config.get<string>("defaultSortMode"));
  const savedSortMode = saved.sortMode ? normalizeSortMode(saved.sortMode) : configuredSortMode;

  return {
    ...defaultViewState,
    ...saved,
    severity: normalizeSeverity(saved.severity),
    sortMode: savedSortMode
  };
}

function getContextLines(): number {
  const value = vscode.workspace.getConfiguration("problemmate").get<number>("contextLines", 2);
  return Math.min(Math.max(Math.floor(value), 0), 20);
}

function getDefaultCopyFormat(): SummaryFormat {
  const value = vscode.workspace
    .getConfiguration("problemmate")
    .get<string>("defaultCopyFormat", "plain");

  if (value === "markdown" || value === "github" || value === "json") {
    return value;
  }

  return "plain";
}

async function showFileResult(message: string, uri: vscode.Uri): Promise<void> {
  const action = await vscode.window.showInformationMessage(message, "Open");
  if (action === "Open") {
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
  }
}

function severityQuickPickIcon(problem: ProblemItem): string {
  switch (problem.severity) {
    case "error":
      return "$(error)";
    case "warning":
      return "$(warning)";
    case "information":
      return "$(info)";
    case "hint":
      return "$(lightbulb)";
  }
}

function clampRange(range: vscode.Range, document: vscode.TextDocument): vscode.Range {
  if (document.lineCount === 0) {
    return new vscode.Range(0, 0, 0, 0);
  }

  const startLine = clamp(range.start.line, 0, document.lineCount - 1);
  const endLine = clamp(range.end.line, startLine, document.lineCount - 1);
  const startCharacter = clamp(
    range.start.character,
    0,
    document.lineAt(startLine).text.length
  );
  const endCharacter = clamp(
    range.end.character,
    0,
    document.lineAt(endLine).text.length
  );

  if (endLine === startLine && endCharacter < startCharacter) {
    return new vscode.Range(startLine, startCharacter, startLine, startCharacter);
  }

  return new vscode.Range(startLine, startCharacter, endLine, endCharacter);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
