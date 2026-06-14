import * as vscode from "vscode";
import { buildProblemsSummary } from "./summary";
import {
  calculateStats,
  problemIdentity,
  ProblemItem,
  serializeProblem,
  SerializedProblem,
  severityLabel
} from "./types";

interface SnapshotFile {
  generatedAt: string;
  counts: ReturnType<typeof calculateStats>;
  problems: SerializedProblem[];
}

export async function exportSummaryFile(
  problems: readonly ProblemItem[],
  format: "markdown" | "json"
): Promise<vscode.Uri | undefined> {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showWarningMessage("Open a workspace before exporting a ProblemMate report.");
    return undefined;
  }

  const reportsDir = vscode.Uri.joinPath(root.uri, ".problemmate", "reports");
  await vscode.workspace.fs.createDirectory(reportsDir);

  const extension = format === "markdown" ? "md" : "json";
  const uri = vscode.Uri.joinPath(
    reportsDir,
    `problemmate-summary-${timestampForFile()}.${extension}`
  );
  const content = buildProblemsSummary(problems, format);
  await writeTextFile(uri, content);
  return uri;
}

export async function appendFixLog(problem: ProblemItem): Promise<vscode.Uri | undefined> {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showWarningMessage("Open a workspace before writing the ProblemMate fix log.");
    return undefined;
  }

  const uri = vscode.Uri.joinPath(root.uri, "problemmate-fix-log.md");
  let existing = "";

  try {
    existing = await readTextFile(uri);
  } catch {
    existing = "# ProblemMate Fix Log\n";
  }

  const today = new Date().toISOString().slice(0, 10);
  const heading = `## ${today}`;
  const nextEntry = [
    "",
    `### Fixed: ${problem.displayPath}:${problem.line}`,
    `- Severity: ${severityLabel(problem.severity)}`,
    `- Source: ${problem.source || "unknown"}`,
    `- Code: ${problem.code ?? "unknown"}`,
    `- Message: ${problem.message}`,
    "- Note: user marked this problem as fixed."
  ].join("\n");

  let content = existing.trimEnd();
  if (!content.includes(heading)) {
    content += `\n\n${heading}`;
  }

  content += `\n${nextEntry}\n`;
  await writeTextFile(uri, content);
  return uri;
}

export async function openFixLog(): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showWarningMessage("Open a workspace before opening the ProblemMate fix log.");
    return;
  }

  const uri = vscode.Uri.joinPath(root.uri, "problemmate-fix-log.md");

  try {
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
  } catch {
    await writeTextFile(uri, "# ProblemMate Fix Log\n");
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
  }
}

export async function saveSnapshot(
  problems: readonly ProblemItem[]
): Promise<vscode.Uri | undefined> {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showWarningMessage("Open a workspace before saving a ProblemMate snapshot.");
    return undefined;
  }

  const snapshotsDir = vscode.Uri.joinPath(root.uri, ".problemmate", "snapshots");
  await vscode.workspace.fs.createDirectory(snapshotsDir);

  const snapshot: SnapshotFile = {
    generatedAt: new Date().toISOString(),
    counts: calculateStats(problems),
    problems: problems.map(serializeProblem)
  };
  const uri = vscode.Uri.joinPath(snapshotsDir, `snapshot-${timestampForFile()}.json`);
  await writeTextFile(uri, JSON.stringify(snapshot, null, 2));
  return uri;
}

export async function compareSnapshots(): Promise<vscode.Uri | undefined> {
  const root = getWorkspaceRoot();
  if (!root) {
    vscode.window.showWarningMessage("Open a workspace before comparing ProblemMate snapshots.");
    return undefined;
  }

  const snapshotsDir = vscode.Uri.joinPath(root.uri, ".problemmate", "snapshots");
  const snapshots = await listJsonFiles(snapshotsDir);

  if (snapshots.length < 2) {
    vscode.window.showInformationMessage("Save at least two ProblemMate snapshots first.");
    return undefined;
  }

  const picks = snapshots
    .sort((left, right) => right.path.localeCompare(left.path))
    .map((uri) => ({
      label: uri.path.split("/").pop() || uri.toString(),
      uri
    }));

  const beforePick = await vscode.window.showQuickPick(picks, {
    placeHolder: "Choose the earlier snapshot"
  });
  if (!beforePick) {
    return undefined;
  }

  const afterPick = await vscode.window.showQuickPick(
    picks.filter((pick) => pick.uri.toString() !== beforePick.uri.toString()),
    {
      placeHolder: "Choose the later snapshot"
    }
  );
  if (!afterPick) {
    return undefined;
  }

  const before = await readSnapshot(beforePick.uri);
  const after = await readSnapshot(afterPick.uri);
  const report = buildSnapshotDiffReport(before, after, beforePick.label, afterPick.label);

  const reportsDir = vscode.Uri.joinPath(root.uri, ".problemmate", "reports");
  await vscode.workspace.fs.createDirectory(reportsDir);
  const reportUri = vscode.Uri.joinPath(
    reportsDir,
    `snapshot-diff-${timestampForFile()}.md`
  );
  await writeTextFile(reportUri, report);
  return reportUri;
}

function buildSnapshotDiffReport(
  before: SnapshotFile,
  after: SnapshotFile,
  beforeName: string,
  afterName: string
): string {
  const beforeMap = new Map(before.problems.map((problem) => [serializedIdentity(problem), problem]));
  const afterMap = new Map(after.problems.map((problem) => [serializedIdentity(problem), problem]));
  const resolved = before.problems.filter((problem) => !afterMap.has(serializedIdentity(problem)));
  const added = after.problems.filter((problem) => !beforeMap.has(serializedIdentity(problem)));
  const unchanged = after.problems.filter((problem) => beforeMap.has(serializedIdentity(problem)));

  return [
    "# ProblemMate Snapshot Diff",
    "",
    `Before: ${beforeName} (${before.generatedAt})`,
    `After: ${afterName} (${after.generatedAt})`,
    "",
    "## Counts",
    "",
    `- Resolved: ${resolved.length}`,
    `- Added: ${added.length}`,
    `- Still present: ${unchanged.length}`,
    "",
    buildProblemList("Resolved Problems", resolved),
    "",
    buildProblemList("Added Problems", added),
    "",
    buildProblemList("Still Present", unchanged)
  ].join("\n");
}

function buildProblemList(title: string, problems: readonly SerializedProblem[]): string {
  const lines = [`## ${title}`, ""];

  if (problems.length === 0) {
    lines.push("None.");
    return lines.join("\n");
  }

  for (const problem of problems) {
    lines.push(
      `- **${severityLabel(problem.severity)}** \`${problem.file}:${problem.line}\` ${problem.message} _(source: ${problem.source})_`
    );
  }

  return lines.join("\n");
}

async function listJsonFiles(directory: vscode.Uri): Promise<vscode.Uri[]> {
  try {
    const entries = await vscode.workspace.fs.readDirectory(directory);
    return entries
      .filter(([name, type]) => type === vscode.FileType.File && name.endsWith(".json"))
      .map(([name]) => vscode.Uri.joinPath(directory, name));
  } catch {
    return [];
  }
}

async function readSnapshot(uri: vscode.Uri): Promise<SnapshotFile> {
  const raw = await readTextFile(uri);
  return JSON.parse(raw) as SnapshotFile;
}

function serializedIdentity(problem: SerializedProblem): string {
  return [
    problem.file,
    problem.line,
    problem.column,
    problem.severity,
    problem.source,
    problem.code,
    problem.message
  ].join("|");
}

function getWorkspaceRoot(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

async function writeTextFile(uri: vscode.Uri, content: string): Promise<void> {
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

async function readTextFile(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return new TextDecoder().decode(bytes);
}

function timestampForFile(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function getProblemKey(problem: ProblemItem): string {
  return problemIdentity(problem);
}
