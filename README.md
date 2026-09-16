# ProblemMate

ProblemMate is a lightweight VS Code diagnostics companion for the Problems data already published by VS Code and language extensions. It helps collect, filter, navigate, copy, export, and compare diagnostics without introducing a separate analyzer or network service.

## Highlights

- Two synchronized tree views: Activity Bar and Explorer.
- Workspace and current-file diagnostic grouping.
- Filter by scope, severity, source, and text; sort by severity, file, line, or source.
- Jump from a diagnostic directly to its source range.
- Copy a diagnostic with nearby source context.
- Copy summaries as plain text, Markdown, GitHub issue text, or JSON.
- Export Markdown / JSON reports to `.problemmate/reports/`.
- Save diagnostic snapshots and generate before/after diff reports.
- Record manually resolved items in `problemmate-fix-log.md`.
- Status-bar counts for errors and warnings.

ProblemMate does **not** run code, perform static analysis, capture terminal runtime exceptions, call AI models, or use network services. It only consumes diagnostics already exposed through the VS Code Diagnostics API.

## Development

Requirements:

- Node.js 20+
- VS Code 1.90+

```bash
npm install
npm run compile
```

Open the repository in VS Code and press `F5` to launch an Extension Development Host.

To build an installable VSIX:

```bash
npm run package
```

## Main Commands

- `ProblemMate: Show Actions`
- `ProblemMate: Filter Problems`
- `ProblemMate: Clear Filters`
- `ProblemMate: Sort Problems`
- `ProblemMate: Copy Problem Context`
- `ProblemMate: Copy Problems with Format...`
- `ProblemMate: Export Summary as Markdown`
- `ProblemMate: Export Summary as JSON`
- `ProblemMate: Mark as Fixed`
- `ProblemMate: Open Fix Log`
- `ProblemMate: Save Diagnostic Snapshot`
- `ProblemMate: Compare Diagnostic Snapshots`

## Settings

```json
{
  "problemmate.contextLines": 2,
  "problemmate.defaultCopyFormat": "plain",
  "problemmate.defaultSortMode": "severity"
}
```

`problemmate.contextLines` is limited to 0–20 lines on each side of the target diagnostic.

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
   ├─ extension.ts            # activation, commands and workflow coordination
   ├─ diagnosticsReader.ts    # VS Code diagnostics -> internal model
   ├─ filters.ts              # filtering, sorting and view-state normalization
   ├─ problemTreeProvider.ts  # TreeView data provider and tree items
   ├─ problemContext.ts       # nearby source-context extraction and formatting
   ├─ summary.ts              # plain/Markdown/GitHub/JSON summaries
   ├─ reports.ts              # report export, fix log and snapshot persistence
   ├─ statusBar.ts            # status-bar diagnostics summary
   └─ types.ts                # shared data model and utility functions
```

## Data and Privacy

ProblemMate has no runtime third-party npm dependencies and does not send diagnostics, source code, or reports over the network. Generated reports and snapshots remain inside the current workspace.

## Current Limitations

- ProblemMate depends on diagnostics produced by VS Code or installed language/tooling extensions; it does not create diagnostics itself.
- Report and snapshot storage currently uses the first workspace folder in a multi-root workspace.
- `Mark as Fixed` records an entry in the fix log; it does not remove or mutate the underlying VS Code diagnostic.
- The repository currently relies on TypeScript compilation and package-build validation rather than an automated test suite.

## License

MIT
