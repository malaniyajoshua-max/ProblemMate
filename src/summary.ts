import {
  calculateStats,
  compactMessage,
  ProblemItem,
  serializeProblem,
  severityLabel
} from "./types";

export type SummaryFormat = "plain" | "markdown" | "github" | "json";

export function buildProblemsSummary(
  problems: readonly ProblemItem[],
  format: SummaryFormat = "plain"
): string {
  switch (format) {
    case "markdown":
      return buildMarkdownSummary(problems);
    case "github":
      return buildGitHubIssueSummary(problems);
    case "json":
      return buildJsonSummary(problems);
    case "plain":
      return buildPlainSummary(problems);
  }
}

function buildPlainSummary(problems: readonly ProblemItem[]): string {
  const stats = calculateStats(problems);
  const lines = [
    "ProblemMate Summary",
    "",
    `Total: ${stats.total} ${stats.total === 1 ? "problem" : "problems"}`,
    `Errors: ${stats.errors}`,
    `Warnings: ${stats.warnings}`,
    `Information: ${stats.information}`,
    `Hints: ${stats.hints}`,
    ""
  ];

  if (problems.length === 0) {
    lines.push("No problems found.");
    return lines.join("\n");
  }

  for (const problem of problems) {
    const source = problem.source || "unknown";
    lines.push(
      `[${severityLabel(problem.severity)}] ${problem.displayPath}:${problem.line} - ${compactMessage(
        problem.message,
        240
      )} (source: ${source})`
    );
  }

  return lines.join("\n");
}

function buildMarkdownSummary(problems: readonly ProblemItem[]): string {
  const stats = calculateStats(problems);
  const lines = [
    "# ProblemMate Summary",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Counts",
    "",
    `- Total: ${stats.total}`,
    `- Errors: ${stats.errors}`,
    `- Warnings: ${stats.warnings}`,
    `- Information: ${stats.information}`,
    `- Hints: ${stats.hints}`,
    "",
    "## Problems",
    ""
  ];

  if (problems.length === 0) {
    lines.push("No problems found.");
    return lines.join("\n");
  }

  lines.push("| Severity | File | Line | Source | Message |");
  lines.push("| --- | --- | ---: | --- | --- |");

  for (const problem of problems) {
    lines.push(
      `| ${severityLabel(problem.severity)} | \`${escapeMarkdownTable(
        problem.displayPath
      )}\` | ${problem.line} | ${escapeMarkdownTable(
        problem.source || "unknown"
      )} | ${escapeMarkdownTable(compactMessage(problem.message, 180))} |`
    );
  }

  return lines.join("\n");
}

function buildGitHubIssueSummary(problems: readonly ProblemItem[]): string {
  const stats = calculateStats(problems);
  const lines = [
    "## Problem Summary",
    "",
    `- Total: ${stats.total}`,
    `- Errors: ${stats.errors}`,
    `- Warnings: ${stats.warnings}`,
    `- Information: ${stats.information}`,
    `- Hints: ${stats.hints}`,
    "",
    "## Diagnostics",
    ""
  ];

  if (problems.length === 0) {
    lines.push("No problems found.");
    return lines.join("\n");
  }

  for (const problem of problems) {
    lines.push(
      `- [ ] **${severityLabel(problem.severity)}** \`${problem.displayPath}:${
        problem.line
      }\` ${compactMessage(problem.message, 220)} _(source: ${
        problem.source || "unknown"
      })_`
    );
  }

  return lines.join("\n");
}

function buildJsonSummary(problems: readonly ProblemItem[]): string {
  const stats = calculateStats(problems);
  return JSON.stringify(
    {
      name: "ProblemMate Summary",
      generatedAt: new Date().toISOString(),
      counts: stats,
      problems: problems.map(serializeProblem)
    },
    null,
    2
  );
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
