export interface CodeContextLine {
  lineNumber: number;
  text: string;
  isTarget: boolean;
}

export function formatCodeContextLines(lines: readonly CodeContextLine[]): string {
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
