import * as vscode from "vscode";
import { ProblemStats } from "./types";

export class ProblemMateStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.command = "problemmate.showActions";
    this.item.tooltip = "Open ProblemMate actions";
  }

  update(stats: ProblemStats, filterDescription = ""): void {
    if (stats.total === 0) {
      this.item.text = "$(check) ProblemMate: No problems";
      this.item.tooltip = "ProblemMate found no current VS Code diagnostics.";
    } else {
      this.item.text = `$(issues) ProblemMate: ${stats.errors}E ${stats.warnings}W`;
      this.item.tooltip = [
        "ProblemMate diagnostics summary",
        `Errors: ${stats.errors}`,
        `Warnings: ${stats.warnings}`,
        `Information: ${stats.information}`,
        `Hints: ${stats.hints}`,
        filterDescription ? `Filter: ${filterDescription}` : "",
        "",
        "Click for ProblemMate actions."
      ]
        .filter(Boolean)
        .join("\n");
    }

    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
