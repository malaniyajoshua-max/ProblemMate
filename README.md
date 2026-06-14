# ProblemMate

ProblemMate is a VS Code diagnostics companion. It helps inspect, filter, navigate, copy, export, and document diagnostics that are already available in VS Code Problems.

It does not run code, catch terminal runtime exceptions, call AI models, or use network services.

## Features

- Activity Bar and Explorer views.
- Current-file and workspace diagnostic groups.
- Click a problem to jump to its source range.
- Filter by scope, severity, source, and text.
- Sort by severity, file, line, or source.
- Copy problem context with nearby code.
- Copy summaries as plain text, Markdown, GitHub issue text, or JSON.
- Export Markdown and JSON reports.
- Save and compare diagnostic snapshots.
- Mark problems as fixed in `problemmate-fix-log.md`.
- Status bar error and warning counts.

## Development

```bash
npm install
npm run compile
```

Open this folder in VS Code and press `F5` to run an Extension Development Host.

## Build Package

```bash
npm run package
```

This creates a local `.vsix` package.

## Commands

- `ProblemMate: Show Actions`
- `ProblemMate: Refresh Problems`
- `ProblemMate: Filter Problems`
- `ProblemMate: Clear Filters`
- `ProblemMate: Sort Problems`
- `ProblemMate: Copy Problem Context`
- `ProblemMate: Copy Problem Context as Markdown`
- `ProblemMate: Copy Problems with Format...`
- `ProblemMate: Copy All Problems Summary`
- `ProblemMate: Copy Filtered Problems Summary`
- `ProblemMate: Copy Current File Summary`
- `ProblemMate: Export Summary as Markdown`
- `ProblemMate: Export Summary as JSON`
- `ProblemMate: Mark as Fixed`
- `ProblemMate: Open Fix Log`
- `ProblemMate: Save Diagnostic Snapshot`
- `ProblemMate: Compare Diagnostic Snapshots`
- `ProblemMate: Focus Problem View`

## Settings

```json
{
  "problemmate.contextLines": 2,
  "problemmate.defaultCopyFormat": "plain",
  "problemmate.defaultSortMode": "severity"
}
```

## Project Structure

```text
ProblemMate/
├─ package.json
├─ package-lock.json
├─ tsconfig.json
├─ README.md
├─ CHANGELOG.md
├─ LICENSE
├─ resources/
│  └─ problemmate.svg
└─ src/
   ├─ extension.ts
   ├─ diagnosticsReader.ts
   ├─ problemTreeProvider.ts
   ├─ problemContext.ts
   ├─ contextFormatter.ts
   ├─ filters.ts
   ├─ reports.ts
   ├─ statusBar.ts
   ├─ summary.ts
   └─ types.ts
```

## Scope

ProblemMate only reads diagnostics that VS Code and language extensions already publish. It is not a static analyzer, runtime error catcher, AI fixer, or Run / Debug extension.
