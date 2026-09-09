/**
 * CSV Preview parsing utility for Bank Import Inbox
 * Parses headers and first 5 rows with delimiter auto-detection and quote escaping.
 */

export interface ParsedCsvPreview {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsvPreview(content: string, maxPreviewRows = 5): ParsedCsvPreview {
  if (!content || !content.trim()) {
    throw new Error("ملف CSV فارغ.");
  }

  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error("يجب أن يحتوي الملف على رأس وصف واحد على الأقل.");
  }

  // Auto-detect delimiter among comma, semicolon, tab
  const delimiter = [",", ";", "\t"].reduce((best, value) => 
    lines[0].split(value).length > lines[0].split(best).length ? value : best, 
    ","
  );

  const splitLine = (line: string): string[] => {
    const output: string[] = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        output.push(cell.trim());
        cell = "";
      } else {
        cell += char;
      }
    }
    output.push(cell.trim());
    return output.map(value => value.replace(/^"|"$/g, ""));
  };

  const headers = splitLine(lines[0]).map((value, index) => value || `عمود ${index + 1}`);
  if (new Set(headers).size !== headers.length) {
    throw new Error("عناوين الأعمدة المكررة لا يمكن تصنيفها بأمان.");
  }

  const previewRows = lines.slice(1, maxPreviewRows + 1).map(line => {
    const cells = splitLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });

  return { headers, rows: previewRows };
}
