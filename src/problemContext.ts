import * as vscode from "vscode";
import { ProblemItem, severityLabel } from "./types";

export interface ProblemContextOptions {
  contextLines?: number;
  format?: "plain" | "markdown";
}

export async function buildProblemContext(
  problem: ProblemItem,
  options: ProblemContextOptions = {}
): Promise<string> {
  if (options.format === "markdown") {
    return buildMarkdownProblemContext(problem, options.contextLines ?? 2);
  }

  const header = buildHeader(problem);
  const codeContext = await tryBuildCodeContext(problem, options.contextLines ?? 2);

  if (!codeContext) {
    return header;
  }

  return `${header}\n\nCode Context:\n${codeContext}`;
}

async function buildMarkdownProblemContext(
  problem: ProblemItem,
  contextLines: number
): Promise<string> {
  const codeContext = await tryBuildCodeContext(problem, contextLines);
  const lines = [
    "## Problem Context",
    "",
    `- **File:** \`${problem.displayPath}\``,
    `- **Line:** ${problem.line}`,
    `- **Column:** ${problem.column}`,
    `- **Severity:** ${severityLabel(problem.severity)}`,
    `- **Source:** ${problem.source || "unknown"}`,
    `- **Code:** ${problem.code ?? "unknown"}`,
    `- **Message:** ${problem.message}`
  ];

  if (codeContext) {
    lines.push("", "```text", codeContext, "```");
  }

  return lines.join("\n");
}

function buildHeader(problem: ProblemItem): string {
  const source = problem.source || "unknown";
  const code = problem.code ?? "unknown";

  return [
    `File: ${problem.displayPath}`,
    `Line: ${problem.line}`,
    `Column: ${problem.column}`,
    `Severity: ${severityLabel(problem.severity)}`,
    `Source: ${source}`,
    `Code: ${code}`,
    `Message: ${problem.message}`
  ].join("\n");
}

async function tryBuildCodeContext(
  problem: ProblemItem,
  contextLines: number
): Promise<string | undefined> {
  try {
    const document = await vscode.workspace.openTextDocument(problem.uri);
    if (document.lineCount === 0) {
      return undefined;
    }

    const targetLine = clamp(problem.range.start.line, 0, document.lineCount - 1);
    const lineWindow = clamp(Math.floor(contextLines), 0, 20);
    const startLine = clamp(targetLine - lineWindow, 0, document.lineCount - 1);
    const endLine = clamp(targetLine + lineWindow, 0, document.lineCount - 1);
    const lines = [];

    for (let line = startLine; line <= endLine; line += 1) {
      lines.push({
        lineNumber: line + 1,
        text: document.lineAt(line).text,
        isTarget: line === targetLine
      });
    }

    return formatCodeContextLines(lines);
  } catch {
    return undefined;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface CodeContextLine {
  lineNumber: number;
  text: string;
  isTarget: boolean;
}

function formatCodeContextLines(lines: readonly CodeContextLine[]): string {
  if (lines.length === 0) {
    return "";
  }

  const width = Math.max(...lines.map((line) => String(line.lineNumber).length));

  return lines
    .map((line) => {
      const marker = line.isTarget ? ">" : " ";
      const lineNumber = String(line.lineNumber).padStart(width, " ");
      return `${marker}${lineNumber} | ${line.text}`;
    })
    .join("\n");
}
